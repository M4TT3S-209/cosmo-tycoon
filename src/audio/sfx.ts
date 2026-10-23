// Synthetische Soundeffekte + generative Ambient-Musik (WebAudio, keine Dateien)

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let soundOn = true;
let musicOn = true;
let musicTimer = 0;
let lastCoin = 0;

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    // iOS: respektiert den Stummschalter und unterbricht keine andere Musik
    const nav = navigator as AudioSessionNav;
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  } catch {
    /* egal */
  }
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = soundOn ? 0.55 : 0;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(master);
  return ctx;
}

/** Beim ersten Tippen aufrufen (iOS erlaubt Audio nur nach einer Geste) */
export function unlockAudio(): void {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  if (musicOn) startMusic();
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function setSound(on: boolean): void {
  soundOn = on;
  if (sfxBus && ctx) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
}

export function setMusic(on: boolean): void {
  musicOn = on;
  if (!ctx) return;
  if (on) startMusic();
  else stopMusic();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, slideTo?: number): void {
  if (!ctx || !sfxBus || !soundOn || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, filterFreq = 1200, delay = 0): void {
  if (!ctx || !sfxBus || !soundOn || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(filterFreq, t);
  f.frequency.exponentialRampToValueAtTime(80, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const note = (base: number, step: number) => base * Math.pow(2, PENTA[step % PENTA.length] / 12 + Math.floor(step / PENTA.length));

export const sfx = {
  coin(building = 0): void {
    const now = performance.now();
    if (now - lastCoin < 70) return;
    lastCoin = now;
    const f = note(880, building % 7);
    tone(f, 0.09, 'triangle', 0.12);
    tone(f * 1.5, 0.12, 'sine', 0.08, 0.04);
  },
  tap(): void {
    tone(520, 0.05, 'triangle', 0.1, 0, 700);
  },
  buy(): void {
    tone(660, 0.06, 'square', 0.06);
    tone(990, 0.08, 'triangle', 0.1, 0.035);
  },
  error(): void {
    tone(180, 0.14, 'sawtooth', 0.06, 0, 120);
  },
  click(): void {
    tone(1200, 0.025, 'sine', 0.06);
  },
  upgrade(): void {
    [0, 2, 4, 5].forEach((s, i) => tone(note(523, s), 0.14, 'triangle', 0.12, i * 0.05));
  },
  manager(): void {
    [0, 4, 7].forEach((s, i) => tone(note(392, s), 0.2, 'triangle', 0.13, i * 0.07));
    tone(note(392, 9), 0.4, 'sine', 0.1, 0.22);
  },
  milestone(): void {
    [0, 2, 4, 7].forEach((s, i) => tone(note(523, s), 0.22, 'triangle', 0.13, i * 0.07));
    tone(note(1046, 4), 0.5, 'sine', 0.08, 0.3);
  },
  achievement(): void {
    [0, 4, 7, 9].forEach((s, i) => tone(note(659, s), 0.18, 'sine', 0.12, i * 0.08));
  },
  cometSpawn(): void {
    for (let i = 0; i < 6; i++) tone(note(1318, 9 - i), 0.12, 'sine', 0.05, i * 0.05);
  },
  comet(): void {
    for (let i = 0; i < 8; i++) tone(note(784, i), 0.14, 'triangle', 0.1, i * 0.04);
    noise(0.3, 0.08, 6000);
  },
  gems(): void {
    [12, 14, 16, 19].forEach((s, i) => tone(note(523, s), 0.16, 'sine', 0.1, i * 0.06));
  },
  supernova(): void {
    tone(55, 1.8, 'sawtooth', 0.25, 0, 30);
    tone(110, 1.2, 'square', 0.08, 0, 40);
    noise(2.2, 0.5, 3000);
    [0, 4, 7, 12, 16, 19].forEach((s, i) => tone(note(262, s), 0.8, 'triangle', 0.08, 1.1 + i * 0.09));
  },
  galaxy(): void {
    noise(3, 0.45, 5000);
    for (let i = 0; i < 12; i++) tone(note(131, i), 1.2, 'sine', 0.09, i * 0.12);
  },
  claim(): void {
    [0, 4, 7, 12].forEach((s, i) => tone(note(587, s), 0.15, 'triangle', 0.12, i * 0.05));
  },
};

// ---- Musik: langsame Pads mit Delay, Akkordwechsel alle 8 s ---------------------

const CHORDS = [
  [0, 7, 12, 16],
  [-3, 4, 9, 12],
  [-7, 0, 5, 9],
  [-5, 2, 7, 11],
];
let chordIdx = 0;
let delayNode: DelayNode | null = null;

function startMusic(): void {
  if (!ctx || !musicBus || musicTimer) return;
  musicBus.gain.setTargetAtTime(0.1, ctx.currentTime, 1.5);
  if (!delayNode) {
    delayNode = ctx.createDelay(1.5);
    delayNode.delayTime.value = 0.6;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    delayNode.connect(fb).connect(delayNode);
    delayNode.connect(musicBus);
  }
  playChord();
  musicTimer = window.setInterval(playChord, 8000);
}

function stopMusic(): void {
  if (!ctx || !musicBus) return;
  musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
  clearInterval(musicTimer);
  musicTimer = 0;
}

function playChord(): void {
  if (!ctx || !musicBus || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const chord = CHORDS[chordIdx++ % CHORDS.length];
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.linearRampToValueAtTime(1400, t + 4);
  filter.frequency.linearRampToValueAtTime(500, t + 8.5);
  filter.connect(musicBus);
  if (delayNode) filter.connect(delayNode);
  for (const semi of chord) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 110 * Math.pow(2, semi / 12);
      o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 2.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 9);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + 9.2);
    }
  }
  // funkelnde Glöckchen
  for (let i = 0; i < 3; i++) {
    const when = t + 1 + Math.random() * 6;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880 * Math.pow(2, (chord[Math.floor(Math.random() * chord.length)] + 12) / 12);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.035, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    o.connect(g).connect(musicBus);
    if (delayNode) g.connect(delayNode);
    o.start(when);
    o.stop(when + 1.7);
  }
}

// ---- Haptik (iOS 18+: Switch-Trick, sonst Vibration API) ------------------------

let hapticLabel: HTMLLabelElement | null = null;
let hapticsOn = true;
let lastHaptic = 0;

export function setHaptics(on: boolean): void {
  hapticsOn = on;
}

export function haptic(): void {
  if (!hapticsOn) return;
  const now = performance.now();
  if (now - lastHaptic < 60) return;
  lastHaptic = now;
  if (navigator.vibrate) {
    navigator.vibrate(8);
    return;
  }
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    hapticLabel.appendChild(input);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}
