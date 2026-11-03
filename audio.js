/* Otondo — the camp groove.
   A real track now: a 16-bar loop cut from "Amapiano Beats Log Drum Groove"
   by alex-morgan on Pixabay (Pixabay Content License: free for commercial
   use, no attribution required, not for resale as a standalone file). The
   loop is fetched and decoded at load, so the first tap only has to open a
   context and press play. The synthesised groove below stays as the fallback
   for when the file cannot be fetched or decoded, so the game is never
   silent for want of a download.

   The iOS story, because it cost two attempts:
   Web Audio defaults to the AMBIENT category, which on iPhone is the ringer
   channel — the context reports itself running, the scheduler ticks, the UI
   shows playing, and the phone stays silent. The first fix was to render to a
   WAV and play a media element, which uses the playback channel; that got
   sound out but it arrived as STATIC.
   The real fix is navigator.audioSession.type = 'playback' (iOS 16.4+), which
   puts Web Audio itself on the playback channel. Measured on an iPhone
   (iOS 18.7, Safari 26.6) with otondo.ng/audiotest.html: the identical beep was
   SILENT without it and CLEAN with it, and the full groove was clean too.

   Where there is no audioSession, there is no safe path on iOS: plain Web Audio
   is silent and the WAV detour is the thing that produced the static. So the
   button is HIDDEN on those devices rather than offering a player something
   broken. Everywhere else (desktop, Android) plain Web Audio is fine.
   Off by default. */

/* The track: measured from the cut itself (16 bars in 35.8921s). */
const TRACK = { url: './groove.mp3', bpm: 106.987, bars: 16, level: 0.5 };
export const BPM  = TRACK.bpm;
export const BEAT = 60 / BPM;            // 0.5608s
export const BAR  = BEAT * 4;            // 2.2433s
const BARS = TRACK.bars;                 // bars in the loop that is playing
const SYNTH_BARS = 8;                    // the fallback's own cycle
const STEPS_PER_BAR = 16;
const LOOP_SECONDS = BAR * BARS;
const LEVEL = 0.09;            /* Deliberately low. A screen recording of the
   phone showed the output hard-clipped — peak 1.90, 8.4% of samples maxed, and
   58% of the energy above 4kHz, which is distortion harmonics rather than
   anything in the source. The source itself only peaked at 0.33, so something
   downstream is applying gain. Headroom is cheaper than static. */

/* An arrangement, not eight copies of one bar. It also tracks what is on
   screen: bars 0-3 are the dance break, so the groove is full; bars 4-7 are
   the walk, so it thins out and lets the ear rest. That is what stops it
   feeling relentless. */
const ARR = [
  { kick:1, clap:1, shaker:1, open:1, bass:1, lead:0 },           // 0 legwork
  { kick:1, clap:1, shaker:1, open:1, bass:1, lead:1 },           // 1
  { kick:1, clap:1, shaker:1, open:1, bass:1, lead:0 },           // 2 shaku
  { kick:1, clap:1, shaker:1, open:1, bass:1, lead:1, fill:1 },   // 3
  { kick:1, clap:0, shaker:1, open:0, bass:1, lead:0, half:1 },   // 4 walking
  { kick:1, clap:0, shaker:0, open:0, bass:1, lead:0 },           // 5 breathe
  { kick:1, clap:1, shaker:1, open:0, bass:1, lead:0, half:1 },   // 6
  { kick:1, clap:0, shaker:1, open:1, bass:0, lead:0, fill:1 },   // 7 turnaround
];

/* A 16-step bar. The syncopated kick and offbeat shaker are what make this read
   as Afrobeats rather than a generic four-to-the-floor. */
const KICK   = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0];
const CLAP   = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const SHAKER = [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1];
const OPEN   = [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1];
/* Two octaves up from where this started. 55Hz, then 110Hz, were both below
   what a phone speaker can move — at 220Hz the part is finally audible on the
   device most players are holding, and it reads as a bass riff rather than as
   rattle. */
const BASS   = [220.00,0,0,0, 0,0,261.63,0, 0,0,293.66,0, 0,0,0,0];
const LEAD   = [0,0,0,440.00, 0,0,0,0, 523.25,0,0,0, 0,0,587.33,0];

let ctx = null, node = null, startedAt = 0, playing = false;
let onBar = () => {}, raf = 0, lastBar = -1;

/* ---------- rendering ---------- */
function env(g, at, a, d, peak) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.linearRampToValueAtTime(0.0001, at + a + d);
}
/* Everything here is tuned for a PHONE SPEAKER. A small driver reproduces
   almost nothing below ~400Hz, so the old kick (42-140Hz) and bass (55-73Hz)
   were inaudible and all that reached the ear was filtered white noise — which
   is exactly what static sounds like. */
function kick(c, out, at) {
  const o = c.createOscillator(), g = c.createGain();
  /* A tom-like thump rather than a sub kick: everything below ~200Hz is
     inaudible on a phone and only makes the driver distort. */
  o.frequency.setValueAtTime(330, at);
  o.frequency.exponentialRampToValueAtTime(165, at + 0.08);
  env(g, at, 0.004, 0.17, 0.72);
  o.connect(g).connect(out); o.start(at); o.stop(at + 0.3);
  /* A midrange click so the kick still lands on a speaker that cannot move
     any air below 400Hz. */
  const k = c.createOscillator(), kg = c.createGain();
  k.type = 'triangle'; k.frequency.setValueAtTime(420, at);
  env(kg, at, 0.002, 0.05, 0.42);
  k.connect(kg).connect(out); k.start(at); k.stop(at + 0.06);
}

/* Band-passed rather than high-passed: a narrow band reads as a struck
   percussion "tss", a wide high shelf reads as hiss. */
function noise(c, out, at, dur, hz, q, peak) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const fade = Math.pow(1 - i / n, 2.2);        // sharper decay, less tail
    d[i] = (Math.random() * 2 - 1) * fade;
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q;
  const g = c.createGain(); env(g, at, 0.002, dur, peak);
  src.connect(f).connect(g).connect(out); src.start(at);
}
function tone(c, out, at, hz, dur, peak, type) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(hz, at);
  env(g, at, 0.008, dur, peak);
  o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.05);
}

/* The bass fundamental sits where a phone speaker cannot go, so it is layered
   with a quieter octave and twelfth. Headphones get the weight, a phone gets
   the harmonics — which is how the ear reconstructs the missing fundamental. */
function bassNote(c, out, at, hz, dur, peak) {
  tone(c, out, at, hz,       dur,        peak,        'triangle');
  tone(c, out, at, hz * 2,   dur * 0.85, peak * 0.55, 'triangle');
  tone(c, out, at, hz * 3,   dur * 0.6,  peak * 0.22, 'triangle');
}


/* OfflineAudioContext needs no user gesture, so the loop is built up front and
   the tap only has to call play() — which must stay synchronous on iOS. */
/* The loop as a bare AudioBuffer. Split out of build() so it can be played
   either through a media element (the WAV path below) or straight out of a
   live AudioContext, without rendering the arrangement twice. */
let renderedLoop = null;
export function renderLoop() {
  if (renderedLoop) return renderedLoop;
  renderedLoop = (async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const AC  = window.AudioContext || window.webkitAudioContext;
    if (!OAC || !AC) throw new Error('no web audio');
    const rate = 44100;
    const c = new OAC(1, Math.ceil(rate * BAR * SYNTH_BARS), rate);
    const out = c.createGain(); out.gain.value = LEVEL;
    /* Two cascaded high-passes at 150Hz. This is the fix for "static on the
       phone, fine on the laptop": a small driver fed deep bass distorts
       MECHANICALLY, which the ear hears as static. There was four times more
       energy below 350Hz than in the band a phone can reproduce at all, so the
       speaker was being asked to do something physically impossible. Cutting it
       costs a little weight on headphones and removes the distortion entirely
       on the device most players are holding. */
    const hp1 = c.createBiquadFilter();
    hp1.type = 'highpass'; hp1.frequency.value = 230; hp1.Q.value = 0.7;
    const hp2 = c.createBiquadFilter();
    hp2.type = 'highpass'; hp2.frequency.value = 230; hp2.Q.value = 0.7;
    /* Takes the glare off the hats and the lead. */
    const soft = c.createBiquadFilter();
    soft.type = 'lowpass'; soft.frequency.value = 9000; soft.Q.value = 0.3;
    out.connect(hp1).connect(hp2).connect(soft).connect(c.destination);

    const stepDur = BEAT / 4;
    for (let b = 0; b < SYNTH_BARS; b++) {
      const a = ARR[b];
      for (let i = 0; i < STEPS_PER_BAR; i++) {
        const at = b * BAR + i * stepDur;
        if (a.kick && KICK[i])   kick(c, out, at);
        if (a.clap && CLAP[i])   noise(c, out, at, 0.10, 1500, 2.2, 0.34);
        /* `half` drops the shaker to quarter-notes — the every-eighth pattern
           is what made it feel relentless over a long session. */
        if (a.shaker && SHAKER[i] && (!a.half || i % 4 === 1))
          noise(c, out, at, 0.022, 4200, 3.0, i % 4 === 1 ? 0.10 : 0.055);
        if (a.open && OPEN[i])   noise(c, out, at, 0.13, 4800, 2.0, 0.08);
        if (a.bass && BASS[i])   bassNote(c, out, at, BASS[i], 0.32, 0.34);
        /* Triangle, not square: the square wave was the harshest thing in it. */
        if (a.lead && LEAD[i])   tone(c, out, at, LEAD[i], 0.26, 0.11, 'triangle');
      }
      /* A fill on the last beat turns the bar over instead of just repeating. */
      if (a.fill) {
        for (const k of [12, 14, 15]) {
          noise(c, out, b * BAR + k * stepDur, 0.05, 2600, 2.5, 0.14);
        }
        kick(c, out, b * BAR + 14 * stepDur);
      }
    }
    return c.startRendering();
  })();
  return renderedLoop;
}

/* Warm the render immediately. OfflineAudioContext needs no user gesture, so
   by the time anybody taps, the loop is already a finished AudioBuffer and the
   tap only has to open an AudioContext. */
renderLoop().catch(e => console.warn('[otondo] audio build failed:', e.message));

/* The track, fetched and decoded at load (no gesture needed for either). An
   OfflineAudioContext decodes it so no live context has to exist yet. Any
   failure — offline, a 404, a codec the browser lacks — resolves to null and
   the synth loop plays instead. */
let trackBuf = null, trackTried = null;
export let usingTrack = false;
function loadTrack() {
  if (trackTried) return trackTried;
  trackTried = (async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const res = await fetch(TRACK.url);
    if (!res.ok) throw new Error('track ' + res.status);
    const bytes = await res.arrayBuffer();
    const c = new OAC(1, 1, 44100);
    const buf = await new Promise((ok, no) => {
      const p = c.decodeAudioData(bytes, ok, no);
      if (p && p.then) p.then(ok, no);
    });
    trackBuf = buf;
    return buf;
  })().catch(e => { console.warn('[otondo] track unavailable, using the synth groove:', e.message); return null; });
  return trackTried;
}
loadTrack();

/* THE iOS FIX. Web Audio defaults to the ambient category, which on iPhone
   means the ringer channel: the context reports itself running, the scheduler
   ticks, and the phone stays silent. Declaring 'playback' moves it to the same
   channel YouTube and Spotify use.
   Measured on an iPhone (iOS 18.7, Safari 26.6) with otondo.ng/audiotest.html:
   the identical beep was SILENT without this line and CLEAN with it. It is the
   whole reason the old code rendered to a WAV and played a media element —
   that detour is what produced the static, and this replaces it. */
function claimPlayback() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; }
  catch {}
}

/* iPads have reported themselves as Macs since iPadOS 13, so the touch-point
   count is the tell rather than the platform string. */
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.platform || '') ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  /iPhone|iPad|iPod/.test(navigator.userAgent);

/* Whether to offer sound at all. On an iPhone without audioSession both
   available paths are known-bad — silent one way, static the other — and a
   play button that produces static is worse than no play button. */
export const audioSupported = () => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (isIOS() && !navigator.audioSession) return false;
  return true;
};

/* Must run inside the tap: iOS only lets a context start from a gesture. */
function openCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  claimPlayback();
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* Started at load, the context usually waits: browsers hold sound back until
   the visitor first touches the page. Every touch calls this until it takes. */
export function wakeAudio() {
  if (!ctx) return;
  claimPlayback();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}
/* Whether sound is actually coming out, as against merely switched on. */
export const audible = () => playing && !!ctx && ctx.state === 'running';

/* The dance hangs off the audio clock, so it cannot drift from the music
   however long the page stays open. ctx.currentTime is sample-accurate —
   better than the media element's currentTime it replaces. */
function watch() {
  if (!playing || !ctx) return;
  const t = ctx.currentTime - startedAt;
  const b = Math.floor(t / BAR) % (usingTrack ? BARS : SYNTH_BARS);
  if (b !== lastBar) { lastBar = b; try { onBar(b); } catch {} }
  raf = requestAnimationFrame(watch);
}

/* Call from a tap. The context is opened synchronously; the buffer is already
   rendered, so the await resolves on the same microtask in practice. */
export function startMusic(onBarCallback) {
  onBar = onBarCallback || onBar;
  const c = openCtx();
  if (!c) return false;
  loadTrack().then(track => track || renderLoop()).then(buf => {
    if (!buf) return;
    stopNode();
    usingTrack = buf === trackBuf;
    node = c.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    /* The track is mastered hot; the synth already carries its own level.
       A gentle high-pass keeps the log drum from rattling a phone speaker
       without gutting it the way the synth's 230Hz cut would. */
    const g = c.createGain();
    g.gain.value = usingTrack ? TRACK.level : 1;
    musicGain = g;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = usingTrack ? 90 : 20; hp.Q.value = 0.7;
    node.connect(g).connect(hp).connect(c.destination);
    startedAt = c.currentTime;
    node.start();
    playing = true; lastBar = -1;
    Object.values(VOICE).flat().forEach(loadVoice); // decoded before anyone speaks
    try { chan?.postMessage('playing'); } catch {}  // any other Otondo tab stops
    if (rainWanted) setRain(rainWanted);          // sound came on mid-shower
    cancelAnimationFrame(raf); watch();
  }).catch(e => console.warn('[otondo] play failed:', e.message));
  return true;
}

function stopNode() {
  if (!node) return;
  try { node.stop(); } catch {}
  try { node.disconnect(); } catch {}
  node = null;
}

export function stopMusic() {
  playing = false;
  if (rainGain) rainGain.gain.setValueAtTime(0, ctx.currentTime);
  cancelAnimationFrame(raf);
  stopNode();
}

/* Rain on the street, under the music. Pink noise with sparse drop ticks,
   band-limited so it reads as rain on a roof and a road rather than as tape
   hiss, looped from a four-second buffer built once. It only sounds while
   the music is on: the player's sound switch is for all of it. */
const RAIN_LEVEL = 0.2;
let rainGain = null, rainWanted = 0;
export function setRain(level) {
  rainWanted = level;
  if (!ctx) return;
  if (!rainGain) {
    if (!level) return;
    /* Built a little long, and the extra folded back over the start, so the
       loop has no seam. It used to fade to silence at both ends instead: a
       dip and a fresh wash every four seconds, which over the music sounded
       like a second track cutting in. */
    const c = ctx, n = c.sampleRate * 4, fade = Math.round(c.sampleRate * 0.25);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = new Float32Array(n + fade);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n + fade; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    }
    for (let k = 0; k < n / 300; k++) {
      const at = Math.floor(Math.random() * (n + fade - 80)), amp = 0.15 + Math.random() * 0.35;
      for (let j = 0; j < 80; j++) d[at + j] += (Math.random() * 2 - 1) * amp * Math.pow(1 - j / 80, 3);
    }
    for (let i = 0; i < fade; i++) {                // equal-power crossfade
      const f = i / fade;
      d[i] = d[i] * Math.sin(f * Math.PI / 2) + d[n + i] * Math.cos(f * Math.PI / 2);
    }
    buf.getChannelData(0).set(d.subarray(0, n));
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    rainGain = c.createGain(); rainGain.gain.value = 0;
    src.connect(hp).connect(lp).connect(rainGain).connect(c.destination);
    src.start();
  }
  const t = ctx.currentTime, g = rainGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(playing && level ? level * RAIN_LEVEL : 0, t + (level ? 4 : 2.5));
}

/* One tab plays at a time. Two windows side by side, both on screen, still
   played the groove twice out of step; hiding a tab only covered the case
   where one of them was out of sight. Whichever starts last wins, and the
   one it silences is told so it can show its button as off. */
const chan = 'BroadcastChannel' in window ? new BroadcastChannel('otondo-sound') : null;
let onSilenced = () => {};
export const whenSilenced = cb => { onSilenced = cb; };
if (chan) chan.onmessage = e => {
  if (e.data !== 'playing' || !playing) return;
  stopMusic();
  try { onSilenced(); } catch {}
};

/* A tab you are not looking at goes quiet. Each reload or second window
   opened its own copy of the game, and every one kept playing behind the
   others, so the player heard the groove twice, out of step. Suspending the
   context pauses the bar clock with it, so the dance picks up in step. */
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else if (playing) ctx.resume().catch(() => {});
});

/* Voices: the player's own lines and the sellers' calls, recorded by the
   maker and his wife. They only speak while the music is audible — the sound
   button is for all of it — one at a time, and on an off-beat or beat of the
   groove so they sit in the song rather than on top of it. The music dips a
   little under each line so the words come through on a phone speaker. */
const VOICE = {
  oya:   './sfx/oya-letsgo.m4a',
  water: './sfx/seller-water.m4a',
  akara: './sfx/seller-akara.m4a',             // the wife, when your runner buys
  akaraWalk: './sfx/seller-akara-jolaolu.m4a',  // Jolaolu, "Oga, buy your akara here!" as she walks into view
  kunu:  './sfx/seller-kunu.m4a',
  shine:   './sfx/shine-your-eyes.m4a',
  enter:   './sfx/haha-e-enter.m4a',    // "Haha, e enter!" — pidgin for: that satisfies
  toomuch: './sfx/you-too-much.m4a',
  welldone: './sfx/well-done.m4a',
  ewo:     './sfx/ewooo.m4a',       // Jolaolu, when YOU goes into the pothole
};
const VOICE_LEVEL = 0.9, DUCK = 0.55;
const VGRID = 0.058, VLEAD = 0.08; // the track's beats sit 58ms early; each clip has 80ms of lead-in
let musicGain = null, voiceFree = 0, lastSaid = '', saidCount = 0;
const voiceBufs = {};
/* A line can have several takes (a list): they take turns, one per call. */
const voiceTurn = {};
function voicePath(name) {
  const v = VOICE[name];
  if (!Array.isArray(v)) return v;
  const i = voiceTurn[name] || 0;
  voiceTurn[name] = (i + 1) % v.length;
  return v[i];
}
function loadVoice(path) {
  if (!ctx || !path) return Promise.resolve(null);
  if (!voiceBufs[path]) voiceBufs[path] = fetch(path)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(b => new Promise((ok, no) => { const p = ctx.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); }))
    .catch(e => { console.warn('[otondo] voice unavailable:', path, e.message); return null; });
  return voiceBufs[path];
}
/* `queue`: if someone is already talking, wait for them to finish rather
   than drop the line — up to two seconds. A seller answering "Oya, let's go!"
   has to come after it, not instead of it. */
export function say(name, { queue = false } = {}) {
  if (!playing || !ctx || ctx.state !== 'running') return false;
  const wait = voiceFree - ctx.currentTime;
  if (wait > (queue ? 2 : 0)) return false;
  const path = voicePath(name);
  loadVoice(path).then(buf => {
    if (!buf || !playing || ctx.state !== 'running') return;
    /* The next eighth-note of the groove: never more than a quarter-second
       away, so a line still answers the tap that caused it. */
    const step = BEAT / 2, offset = usingTrack ? VGRID : 0;
    const pos = Math.max(ctx.currentTime, voiceFree) - startedAt + VLEAD + 0.03;
    const at = startedAt + Math.ceil((pos + offset) / step) * step - offset - VLEAD;
    if (at < voiceFree - 0.001) return;
    voiceFree = at + buf.duration;
    lastSaid = Array.isArray(VOICE[name]) ? `${name}/${path.split('/').pop()}` : name; saidCount++;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = VOICE_LEVEL;
    src.connect(g).connect(ctx.destination);
    src.start(at);
    if (musicGain) {
      /* Back to the music's own level, not to whatever the gain read at the
         moment: a line queued behind another was called mid-dip, and
         "restoring" to that left the music a little quieter every time. */
      const full = usingTrack ? TRACK.level : 1, mg = musicGain.gain;
      mg.setTargetAtTime(full * DUCK, at, 0.03);
      mg.setTargetAtTime(full, at + buf.duration - 0.1, 0.15);
    }
  });
  return true;
}

export const musicOn = () => playing;

export const audioState = () => ({
  ctx: ctx ? ctx.state : 'building',
  running: playing,
  time: ctx && playing ? +((ctx.currentTime - startedAt) % (usingTrack ? LOOP_SECONDS : BAR * SYNTH_BARS)).toFixed(2) : 0,
  gain: usingTrack ? TRACK.level : LEVEL,
  source: usingTrack ? 'track' : 'synth',
  rain: rainGain ? +rainGain.gain.value.toFixed(3) : 0,
  said: lastSaid + ' #' + saidCount,
  music: musicGain ? +musicGain.gain.value.toFixed(3) : 0,
  via: 'web audio' + (navigator.audioSession ? ' + playback category' : ''),
});
