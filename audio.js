/* Otondo — the camp groove.
   Still synthesised, nothing licensed and nothing downloaded. But it is now
   RENDERED OFFLINE to a WAV in memory and played through an <audio> element
   rather than straight out of Web Audio.
   Why: on iOS, raw Web Audio routes to the ringer channel — it reports itself
   as running, the scheduler ticks, the UI shows playing, and the phone stays
   silent regardless of the mute switch or the volume. A media element uses the
   playback channel instead, the same one YouTube and Spotify use. The player
   asked for sound by tapping play, so playback is the right channel.
   Off by default. */

export const BPM  = 105;
export const BEAT = 60 / BPM;            // 0.5714s
export const BAR  = BEAT * 4;            // 2.2857s
const BARS = 8;                          // one full dance cycle per loop
const STEPS_PER_BAR = 16;
const LOOP_SECONDS = BAR * BARS;
const LEVEL = 0.22;

/* A 16-step bar. The syncopated kick and offbeat shaker are what make this read
   as Afrobeats rather than a generic four-to-the-floor. */
const KICK   = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0];
const CLAP   = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const SHAKER = [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1];
const OPEN   = [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1];
const BASS   = [55.00,0,0,0, 0,0,65.41,0, 0,0,73.42,0, 0,0,0,0];
const LEAD   = [0,0,0,440.00, 0,0,0,0, 523.25,0,0,0, 0,0,587.33,0];

let el = null, url = null, ready = null, playing = false;
let onBar = () => {}, raf = 0, lastBar = -1;

/* ---------- rendering ---------- */
function env(g, at, a, d, peak) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.linearRampToValueAtTime(0.0001, at + a + d);
}
function kick(c, out, at) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(140, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  env(g, at, 0.004, 0.26, 0.95);
  o.connect(g).connect(out); o.start(at); o.stop(at + 0.32);
}
function noise(c, out, at, dur, hz, q, peak) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hz; f.Q.value = q;
  const g = c.createGain(); env(g, at, 0.002, dur, peak);
  src.connect(f).connect(g).connect(out); src.start(at);
}
function tone(c, out, at, hz, dur, peak, type) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(hz, at);
  env(g, at, 0.008, dur, peak);
  o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.05);
}

function wav(buf) {
  const n = buf.length, d = buf.getChannelData(0);
  const ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, d[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/* OfflineAudioContext needs no user gesture, so the loop is built up front and
   the tap only has to call play() — which must stay synchronous on iOS. */
function build() {
  if (ready) return ready;
  ready = (async () => {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const AC  = window.AudioContext || window.webkitAudioContext;
    if (!OAC || !AC) throw new Error('no web audio');
    const rate = 44100;
    const c = new OAC(1, Math.ceil(rate * LOOP_SECONDS), rate);
    const out = c.createGain(); out.gain.value = LEVEL; out.connect(c.destination);
    const stepDur = BEAT / 4;
    for (let b = 0; b < BARS; b++) {
      for (let i = 0; i < STEPS_PER_BAR; i++) {
        const at = b * BAR + i * stepDur;
        if (KICK[i])   kick(c, out, at);
        if (CLAP[i])   noise(c, out, at, 0.14, 1400, 1.2, 0.34);
        if (SHAKER[i]) noise(c, out, at, 0.035, 6500, 0.8, i % 4 === 1 ? 0.14 : 0.08);
        if (OPEN[i])   noise(c, out, at, 0.19, 5200, 0.6, 0.11);
        if (BASS[i])   tone(c, out, at, BASS[i], 0.34, 0.5, 'triangle');
        if (LEAD[i])   tone(c, out, at, LEAD[i], 0.22, 0.09, 'square');
      }
    }
    const rendered = await c.startRendering();
    url = URL.createObjectURL(wav(rendered));
    el = document.createElement('audio');
    el.src = url; el.loop = true; el.preload = 'auto';
    el.setAttribute('playsinline', '');      // iOS: do not hand off to a player
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  })().catch(e => { console.warn('[otondo] audio build failed:', e.message); return null; });
  return ready;
}
build();                                   // start rendering immediately

/* The dance hangs off the element's own clock, so it cannot drift from the music
   however long the page stays open. */
function watch() {
  if (!playing || !el) return;
  const b = Math.floor(el.currentTime / BAR) % BARS;
  if (b !== lastBar) { lastBar = b; try { onBar(b); } catch {} }
  raf = requestAnimationFrame(watch);
}

/* Call from a tap. play() is issued synchronously when the loop is ready. */
export function startMusic(onBarCallback) {
  onBar = onBarCallback || onBar;
  if (!el) { build().then(e => { if (e) { e.play().catch(() => {}); begin(); } }); return true; }
  el.currentTime = 0;
  const p = el.play();
  if (p && p.catch) p.catch(e => console.warn('[otondo] play refused:', e.message));
  begin();
  return true;
}
function begin() { playing = true; lastBar = -1; cancelAnimationFrame(raf); watch(); }

export function stopMusic() {
  playing = false;
  cancelAnimationFrame(raf);
  try { el && el.pause(); } catch {}
}

export const musicOn = () => playing;

export const audioState = () => ({
  ctx: el ? (playing && !el.paused ? 'running' : 'ready') : 'building',
  running: playing,
  time: el ? +el.currentTime.toFixed(2) : 0,
  gain: LEVEL,
  via: 'media element',
});
