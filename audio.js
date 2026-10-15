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

let el = null, url = null, ready = null, playing = false;
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
    const c = new OAC(1, Math.ceil(rate * LOOP_SECONDS), rate);
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
    for (let b = 0; b < BARS; b++) {
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

function build() {
  if (ready) return ready;
  ready = (async () => {
    const rendered = await renderLoop();
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
