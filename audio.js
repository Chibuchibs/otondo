/* Otondo — the camp groove.
   Synthesised, not sampled. Three reasons: nothing to license or get claimed,
   zero bytes to download on a phone, and — the one that actually decided it —
   the dance can share the audio clock, so the legwork lands on the beat instead
   of drifting against it the way CSS against an <audio> element does.

   Off by default. Players arrive from TikTok with their own music playing. */

export const BPM  = 105;
export const BEAT = 60 / BPM;          // 0.5714s
export const BAR  = BEAT * 4;          // 2.2857s

let ctx = null, master = null, running = false;
let step = 0, nextNoteAt = 0, timer = null;
let onBar = () => {};

const LOOKAHEAD = 0.1;                 // seconds of audio scheduled ahead
const TICK      = 25;                  // ms between scheduler wakeups
const STEP      = BEAT / 4;            // sixteenth notes

/* A 16-step bar. The syncopated kick and the offbeat shaker are what make this
   read as Afrobeats rather than as a generic 4-to-the-floor loop. */
const KICK   = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0];
const CLAP   = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
const SHAKER = [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1];
const OPEN   = [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1];   // open hat lift
/* Pentatonic, so anything it lands on sounds intentional. */
const BASS   = [55.00,0,0,0, 0,0,65.41,0, 0,0,73.42,0, 0,0,0,0];
const LEAD   = [0,0,0,440.00, 0,0,0,0, 523.25,0,0,0, 0,0,587.33,0];

function env(node, at, a, d, peak) {
  node.gain.setValueAtTime(0.0001, at);
  node.gain.exponentialRampToValueAtTime(peak, at + a);
  node.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
}

function kick(at) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  env(g, at, 0.002, 0.26, 0.9);
  o.connect(g).connect(master); o.start(at); o.stop(at + 0.3);
}

function noise(at, dur, hz, q, peak, type = 'highpass') {
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q;
  const g = ctx.createGain(); env(g, at, 0.001, dur, peak);
  src.connect(f).connect(g).connect(master); src.start(at);
}

function tone(at, hz, dur, peak, type) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(hz, at);
  env(g, at, 0.006, dur, peak);
  o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
}

function schedule(i, at) {
  if (KICK[i])   kick(at);
  if (CLAP[i])   noise(at, 0.14, 1400, 1.2, 0.34);
  if (SHAKER[i]) noise(at, 0.035, 6500, 0.8, i % 4 === 1 ? 0.14 : 0.08);
  if (OPEN[i])   noise(at, 0.19, 5200, 0.6, 0.11);
  if (BASS[i])   tone(at, BASS[i], 0.34, 0.5, 'triangle');
  if (LEAD[i])   tone(at, LEAD[i], 0.22, 0.09, 'square');
  if (i === 0)   { try { onBar(at); } catch {} }      // the dance hangs off this
}

function run() {
  while (nextNoteAt < ctx.currentTime + LOOKAHEAD) {
    schedule(step, nextNoteAt);
    nextNoteAt += STEP;
    step = (step + 1) % 16;
  }
  timer = setTimeout(run, TICK);
}

/* Must be called from a tap, and everything that matters has to happen
   SYNCHRONOUSLY inside it. iOS only unlocks audio for work done in the gesture
   itself — an `await` before the first node is created hands control back to
   the event loop and Safari silently refuses to make a sound. */
export function startMusic(onBarCallback) {
  if (running) return true;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();

    /* The iOS unlock: play one silent sample immediately. Without this the
       context reports "running" while producing nothing at all. */
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start(0);

    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
    }
    ctx.resume();                      // deliberately not awaited

    onBar = onBarCallback || onBar;
    step = 0;
    nextNoteAt = ctx.currentTime + 0.12;
    running = true;
    run();
    master.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.8);
    return true;
  } catch (e) { console.warn('[otondo] no audio:', e.message); return false; }
}

/* For diagnosing a phone that stays silent. */
export const audioState = () => ({
  ctx: ctx ? ctx.state : 'none',
  running,
  time: ctx ? +ctx.currentTime.toFixed(2) : 0,
  gain: master ? +master.gain.value.toFixed(4) : 0,
});

export function stopMusic() {
  if (!running) return;
  running = false;
  clearTimeout(timer); timer = null;
  try { master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3); } catch {}
}

export const musicOn  = () => running;
/* Seconds until the next bar line, so a dance can start ON the beat. */
export const toNextBar = () => {
  if (!running || !ctx) return 0;
  return Math.max(0, (nextNoteAt - (step * STEP)) + BAR - ctx.currentTime) % BAR;
};
