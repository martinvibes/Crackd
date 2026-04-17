/**
 * Crackd sound engine — synthesized via Web Audio API.
 *
 * No audio files to load, no copyright concerns, instant playback.
 * Every sound is a shaped oscillator or noise burst, designed to feel
 * like a premium puzzle game.
 *
 * Call `sounds.init()` once on any user interaction (click) to create
 * the AudioContext (browsers require user gesture). All subsequent
 * calls are fire-and-forget.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** Call on first user interaction to unlock audio. */
export function init() {
  getCtx();
}

// ---- Primitives ----

function osc(
  type: OscillatorType,
  freq: number,
  duration: number,
  volume = 0.15,
  delay = 0,
) {
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + delay);
  g.gain.linearRampToValueAtTime(volume, c.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + delay);
  o.stop(c.currentTime + delay + duration + 0.05);
}

function noise(duration: number, volume = 0.08, delay = 0) {
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(volume, c.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  // Bandpass filter so it sounds like a mechanical click, not TV static.
  const filt = c.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = 4000;
  filt.Q.value = 1.5;
  src.connect(filt).connect(g).connect(c.destination);
  src.start(c.currentTime + delay);
  src.stop(c.currentTime + delay + duration + 0.05);
}

// ---- Game sounds ----

export const sounds = {
  /** Unlock audio context — call on any early user click. */
  init,

  /** Player locks in their secret code. Mechanical latch feel. */
  codeLock() {
    noise(0.06, 0.12);
    osc("square", 1200, 0.04, 0.08, 0.02);
    osc("sine", 800, 0.08, 0.06, 0.04);
  },

  /** Guess submitted — quick upward sweep. */
  guessSubmit() {
    osc("sine", 600, 0.08, 0.07);
    osc("sine", 900, 0.06, 0.05, 0.04);
  },

  /** Single POT dot — bright chime. Call once per POT in the result. */
  pot() {
    osc("sine", 1047, 0.18, 0.12); // C6
    osc("sine", 1319, 0.12, 0.06, 0.03); // E6 harmonic
  },

  /** Single PAN dot — softer, lower tick. */
  pan() {
    osc("triangle", 587, 0.1, 0.07); // D5
  },

  /** Miss — very subtle low thud, barely there. */
  miss() {
    osc("sine", 200, 0.06, 0.03);
  },

  /**
   * Play the result dots in sequence with tiny delays so the player
   * HEARS each dot land. Pass the pots/pans count.
   */
  resultSequence(pots: number, pans: number) {
    const total = 4;
    let t = 0;
    for (let i = 0; i < pots; i++) {
      setTimeout(() => sounds.pot(), t);
      t += 120;
    }
    for (let i = 0; i < pans; i++) {
      setTimeout(() => sounds.pan(), t);
      t += 120;
    }
    const misses = total - pots - pans;
    for (let i = 0; i < misses; i++) {
      setTimeout(() => sounds.miss(), t);
      t += 100;
    }
  },

  /** All 4 POTs — you cracked it! Short ascending fanfare. */
  cracked() {
    // C5 → E5 → G5 → C6, quick ascending major arpeggio
    osc("sine", 523, 0.2, 0.12, 0.0);
    osc("sine", 659, 0.2, 0.12, 0.1);
    osc("sine", 784, 0.2, 0.12, 0.2);
    osc("sine", 1047, 0.35, 0.15, 0.3);
    // Sparkle noise on top
    noise(0.15, 0.06, 0.3);
    // Low power chord underneath
    osc("sawtooth", 131, 0.5, 0.04, 0.1);
  },

  /** You lost — descending minor. Subdued, not annoying. */
  defeat() {
    osc("sine", 440, 0.25, 0.08);
    osc("sine", 370, 0.25, 0.08, 0.15);
    osc("sine", 311, 0.4, 0.06, 0.3);
  },

  /** It's your turn — gentle two-tone ping. */
  yourTurn() {
    osc("sine", 880, 0.08, 0.06);
    osc("sine", 1047, 0.1, 0.06, 0.08);
  },

  /** Chat message received. */
  chatPop() {
    osc("sine", 1200, 0.05, 0.04);
    noise(0.03, 0.03, 0.02);
  },

  /** Vault taunt arrives. Slightly menacing. */
  taunt() {
    osc("sawtooth", 200, 0.12, 0.04);
    osc("sine", 350, 0.08, 0.05, 0.06);
  },

  /** Generic UI click — button press, tab switch. */
  click() {
    noise(0.03, 0.06);
    osc("sine", 1000, 0.03, 0.04);
  },

  /** Digit entered in the composer. Typewriter key feel. */
  digitTap() {
    noise(0.02, 0.05);
    osc("square", 800 + Math.random() * 400, 0.02, 0.03);
  },
};
