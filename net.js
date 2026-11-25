/* Otondo — multiplayer layer.
   Every function is failure-tolerant on purpose: if Supabase is unset, slow,
   or down, the game must still be playable. Nothing here throws upward. */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=20261124213825';

const TOKEN_KEY = 'otondo:token';
let sb = null, token = null, channel = null;

/* What we broadcast about ourselves to everyone else in camp. Nickname and
   platoon only — both are already public in chat and on the awards board.
   The token NEVER goes in here; presence is readable by every client. */
let me = null;
let onCount = () => {}, onChat = () => {};

export const online = () => !!sb;

export async function initNet({ onPlayerCount, onChatMessage } = {}) {
  onCount = onPlayerCount || onCount;
  onChat  = onChatMessage || onChat;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const { createClient } = await import(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });
    try { token = localStorage.getItem(TOKEN_KEY); } catch {}
    subscribe();
    return true;
  } catch (e) { console.warn('[otondo] offline mode:', e.message); sb = null; return false; }
}

function subscribe() {
  if (!sb) return;
  channel = sb.channel('camp', { config: { presence: { key: crypto.randomUUID() } } })
    .on('presence', { event: 'sync' }, () => {
      try { onCount(Object.keys(channel.presenceState()).length); } catch {}
    })
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat' },
        p => { try { onChat(p.new); } catch {} })
    .subscribe(async status => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({ ...(me || {}), at: Date.now() });
      /* report immediately — presence only re-syncs when someone joins or
         leaves, so without this the count can sit stale at nothing */
      try { onCount(Object.keys(channel.presenceState()).length); } catch {}
    });
}

/* Call whenever the player's name, platoon or day changes. Re-tracking
   replaces the previous payload for this connection.
   Returns false if the channel is not joined yet, so the caller knows to try
   again rather than assuming it landed — track() before the join silently
   does nothing, and the player then never appears in anyone's list. */
export function setPresence(info) {
  me = info ? {
    nick:    String(info.nick || '').slice(0, 16),
    platoon: Number(info.platoon) || 0,
    day:     Number(info.day) || 0,
  } : null;
  if (!channel || channel.state !== 'joined') return false;
  try { channel.track({ ...(me || {}), at: Date.now() }); return true; }
  catch { return false; }
}

/* Everyone currently connected. Entries without a nickname are people still on
   the start screen — counted, but they have nothing to show yet. */
export function campRoster() {
  if (!channel) return [];
  try {
    /* One entry per connection. presenceState() maps each key to an ARRAY of
       payloads and re-tracking appends to it — flattening counted the same
       person once per update (14 rows against a count of 3). Take the latest. */
    return Object.values(channel.presenceState())
      .filter(metas => metas && metas.length)
      .map(metas => metas[metas.length - 1])
      /* Presence is whatever each OTHER browser says about itself, so nothing
         in it is trusted: numbers are made numbers and the name a short string
         (the page escapes it too). A tampered client sending markup as its
         "platoon" would otherwise have run on everyone's screen (2026-11-24). */
      .map(p => {
        const n = v => { const x = Math.floor(Number(v)); return Number.isFinite(x) ? x : null; };
        const pl = n(p.platoon), dy = n(p.day), av = n(p.av);
        return { nick: typeof p.nick === 'string' ? p.nick.slice(0, 16) : null,
                 platoon: pl >= 1 && pl <= 10 ? pl : null, day: dy >= 1 && dy <= 21 ? dy : null,
                 av: av >= 0 && av < 12 ? av : null };   // AV_N faces in index.html
      });
  } catch { return []; }
}

/* Set a name after the fact. The front door no longer asks for one, so this
   is how a player claims an identity once they care about it. */
export async function renameMe(nickname) {
  if (!sb || !token) return false;
  try {
    const { data, error } = await sb.rpc('rename_player',
      { p_token: token, p_nickname: nickname });
    if (error) throw error;
    return data === true;      // false: the server refused the name (names.sql)
  } catch (e) { console.warn('[otondo] rename failed:', e.message); return null; }   // null: could not ask
}

/* The face you picked (avatars.sql). Past messages are updated server-side.
   On a database without the migration the RPC is missing and this returns
   false; the choice still lives in local state and the default face shows. */
export async function setAvatar(n) {
  if (!sb || !token) return false;
  try {
    const { data, error } = await sb.rpc('set_avatar', { p_token: token, p_avatar: n });
    if (error) throw error;
    return data === true;
  } catch (e) { console.warn('[otondo] avatar failed:', e.message); return false; }
}

export async function joinCamp(nickname, platoon, source) {
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('join_camp',
      { p_nickname: nickname, p_platoon: platoon, p_source: source || null });
    if (error) throw error;
    token = data;
    try { localStorage.setItem(TOKEN_KEY, token); } catch {}
    return token;
  } catch (e) { console.warn('[otondo] joinCamp failed:', e.message); return null; }
}

/* Throttled: the state machine may call this on every action, but we only
   reach the network every 30s (or immediately when a run ends). */
let lastSync = 0, pending = null, timer = null;
let slimSync = false;   // see flush()
export function syncPlayer(s, { force = false } = {}) {
  if (!sb || !token) return;
  pending = s;
  const due = force || Date.now() - lastSync > 30000;
  if (due) return flush();
  if (!timer) timer = setTimeout(flush, 30000 - (Date.now() - lastSync));
}
async function flush() {
  clearTimeout(timer); timer = null;
  const s = pending; pending = null;
  if (!s || !sb || !token) return;
  lastSync = Date.now();
  const args = {
    p_token: token, p_day: s.day, p_cred: s.cred, p_money: s.money,
    p_finished: s.phase === 'ending', p_posting: s.posting ? s.posting.place : null,
    p_drills: s.drills || 0,
  };
  /* The street counts (titles.sql). A database that has not had that
     migration has no sync_player taking them; PostgREST says so with
     PGRST202, and from then on this session sends the older shape. */
  if (!slimSync){ args.p_thieves = s.thieves || 0; args.p_fires = s.fires || 0; }
  try {
    const { error } = await sb.rpc('sync_player', args);
    if (error && error.code === 'PGRST202' && !slimSync){
      slimSync = true;
      delete args.p_thieves; delete args.p_fires;
      const r2 = await sb.rpc('sync_player', args);
      if (r2.error) throw r2.error;
    } else if (error) throw error;
  } catch (e) { console.warn('[otondo] sync failed:', e.message); }
}

/* Leaderboard is cached for 60s — thousands of players must not each hammer it. */
let boardCache = null, boardAt = 0;
export async function platoonBoard() {
  if (!sb) return null;
  if (boardCache && Date.now() - boardAt < 60000) return boardCache;
  try {
    const { data, error } = await sb.rpc('platoon_board');
    if (error) throw error;
    boardCache = data; boardAt = Date.now();
    return data;
  } catch (e) { console.warn('[otondo] board failed:', e.message); return boardCache; }
}

export async function recentChat(limit = 30) {
  if (!sb) return [];
  try {
    /* '*' rather than a column list: it picks up `title` once titles.sql has
       run, and keeps working on a database where it has not. */
    const { data, error } = await sb.from('chat')
      .select('*')
      .order('id', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).reverse();
  } catch (e) { console.warn('[otondo] chat read failed:', e.message); return []; }
}

/* Returns a reason code from the server so the UI can explain itself:
   ok | cooldown | banned | too_new | link | digits | word | empty | no_player */
export async function postChat(body) {
  if (!sb || !token) return 'offline';
  try {
    const { data, error } = await sb.rpc('post_chat', { p_token: token, p_body: body });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[otondo] chat post failed:', e.message); return 'offline'; }
}

export async function reportMessage(chatId) {
  if (!sb || !token) return 'offline';
  try {
    const { data, error } = await sb.rpc('report_message',
      { p_token: token, p_chat_id: chatId });
    if (error) throw error;
    return data;   // reported | hidden | no_player
  } catch (e) { console.warn('[otondo] report failed:', e.message); return 'offline'; }
}

/* Awards, cached like the platoon board. The whole camp pulling this on every
   tab switch is the fastest way to burn the shared Supabase egress. */
let awardCache = null, awardAt = 0;
export async function awardBoard() {
  if (!sb) return null;
  if (awardCache && Date.now() - awardAt < 60000) return awardCache;
  try {
    const { data, error } = await sb.rpc('award_board');
    if (error) throw error;
    awardCache = data; awardAt = Date.now();
    return data;
  } catch (e) { console.warn('[otondo] awards failed:', e.message); return awardCache; }
}

/* Which awards are currently yours — resolved server-side from your token, so
   a player cannot claim a badge by renaming themselves after the winner. */
export async function myAwards() {
  if (!sb || !token) return [];
  try {
    const { data, error } = await sb.rpc('my_awards', { p_token: token });
    if (error) throw error;
    return (data || []).map(r => r.slug);
  } catch (e) { console.warn('[otondo] my awards failed:', e.message); return []; }
}

/* ok | already | own | banned | gone | no_player | offline */
export async function laughChat(chatId) {
  if (!sb || !token) return 'offline';
  try {
    const { data, error } = await sb.rpc('laugh_chat',
      { p_token: token, p_chat_id: chatId });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[otondo] laugh failed:', e.message); return 'offline'; }
}

export async function postSuggestion(body) {
  if (!sb) return false;
  try {
    const { data, error } = await sb.rpc('post_suggestion',
      { p_token: token, p_body: body });
    if (error) throw error;
    return data === true;
  } catch (e) { console.warn('[otondo] suggestion failed:', e.message); return false; }
}

/* The weekly ₦10,000 airtime race (supabase/prize.sql). The board is cached for
   a minute like the others; your own standing is asked for by token, so a
   claim code only ever reaches the device that earned it. Before prize.sql is
   run these return null and the game simply shows no race. */
let prizeCache = null, prizeAt = 0;
export async function prizeBoard() {
  if (!sb) return null;
  if (prizeCache && Date.now() - prizeAt < 60000) return prizeCache;
  try {
    const { data, error } = await sb.rpc('prize_board');
    if (error) throw error;
    prizeCache = data; prizeAt = Date.now();
    return data;
  } catch (e) { console.warn('[otondo] prize board failed:', e.message); return prizeCache; }
}
/* Platoon War (supabase/platoonwar.sql): this week's platoon totals and last
   week's winner, cached a minute like the other boards. Null until the SQL
   has run, so the game only shows the war once the server is counting it. */
let warCache = null, warAt = 0;
export async function platoonWar() {
  if (!sb) return null;
  if (warCache && Date.now() - warAt < 60000) return warCache;
  try {
    const { data, error } = await sb.rpc('platoon_war');
    if (error) throw error;
    warCache = data; warAt = Date.now();
    return data;
  } catch (e) { console.warn('[otondo] platoon war failed:', e.message); return warCache; }
}
/* Last week's winners' bonus: { won, eligible, claimed, platoon, bonus? }.
   The server pays it once; bonus is only present the first time. */
export async function claimPlatoonWin() {
  if (!sb || !token) return null;
  try {
    const { data, error } = await sb.rpc('claim_platoon_win', { p_token: token });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[otondo] platoon claim failed:', e.message); return null; }
}
export async function myPrize() {
  if (!sb || !token) return null;
  try {
    const { data, error } = await sb.rpc('my_prize', { p_token: token });
    if (error) throw error;
    return data;
  } catch (e) { console.warn('[otondo] my prize failed:', e.message); return null; }
}
