// Music made on the fly with WebAudio: a drone, a melody in the map's own mode and frame drums, in three
// levels (0 calm, 1 battle, 2 boss) that main.js sets from what is happening. No audio files.
// Each map: root note (Hz), mode (semitones), tempo (beats a minute), melody voice.
const THEMES = {
  ela: { root: 146.8, mode: [0, 2, 3, 5, 7, 9, 10], bpm: 92, voice: 'triangle' }, // dorian: shepherds' hills
  mar: { root: 138.6, mode: [0, 1, 4, 5, 7, 8, 10], bpm: 100, voice: 'sawtooth' }, // hijaz: Egypt
  ossos: { root: 110, mode: [0, 1, 3, 5, 6, 8, 10], bpm: 84, voice: 'square' }, // locrian: the valley of the dead
  jerico: { root: 155.6, mode: [0, 1, 4, 5, 7, 8, 11], bpm: 104, voice: 'sawtooth' }, // double harmonic: the walled city
  carmelo: { root: 130.8, mode: [0, 2, 4, 5, 7, 9, 10], bpm: 96, voice: 'triangle' }, // mixolydian: fire on the mount
  babilonia: { root: 123.5, mode: [0, 1, 4, 5, 7, 8, 10], bpm: 108, voice: 'square' }, // hijaz again, brighter and faster
  babel: { root: 116.5, mode: [0, 2, 3, 5, 7, 8, 10], bpm: 112, voice: 'sawtooth' }, // aeolian: the tower
};

let ctx = null;
let out = null;
let theme = null;
let level = 0;
let next = 0;
let beat = 0;
let timer = 0;
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function note(f, t, dur, type, vol, dest = out) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}
let noise = null;
// A frame drum: low "dum" (a falling sine) or high "tak" (a click of filtered noise).
export function drum(t, low, vol = 0.25) {
  if (!ctx) return;
  if (low) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.32);
    return;
  }
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 2400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  s.connect(f).connect(g).connect(out);
  s.start(t);
}
const pitch = (deg, oct = 0) => {
  const m = theme.mode;
  const k = ((deg % m.length) + m.length) % m.length;
  return theme.root * 2 ** (oct + Math.floor(deg / m.length) + m[k] / 12);
};

let droneNodes = [];
function drone() {
  for (const n of droneNodes) try { n.stop(); } catch {}
  droneNodes = [];
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  f.connect(g).connect(out);
  for (const [mul, det] of [[0.5, 0], [0.5, 6], [0.75, -4]]) { // root and fifth, a little out of tune: an oud's hum
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = theme.root * mul;
    o.detune.value = det;
    o.connect(f);
    o.start();
    droneNodes.push(o);
  }
}

// One beat at a time, a little ahead of the clock.
let deg = 0;
function schedule() {
  const spb = 60 / (theme.bpm * (level === 2 ? 1.25 : 1));
  while (next < ctx.currentTime + 0.25) {
    const t = next;
    const bar = beat % 8;
    // Drums: one hit a bar when calm, the full pattern in battle, doubled for the boss.
    if (level >= 1 || bar === 0) drum(t, bar === 0 || bar === 3 || bar === 6, level ? 0.22 : 0.12);
    if (level >= 1 && (bar === 2 || bar === 5 || bar === 7)) drum(t, false, 0.18);
    if (level === 2) drum(t + spb / 2, false, 0.12);
    // Melody: a step or a leap within the mode, now and then a rest; more notes as it heats up.
    if (rnd() < [0.35, 0.6, 0.8][level]) {
      deg += [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(rnd() * 8)];
      deg = Math.max(-3, Math.min(9, deg));
      const len = spb * (rnd() < 0.3 ? 2 : 1);
      note(pitch(deg, 1), t, len * 0.95, theme.voice, level === 2 ? 0.05 : 0.04);
      if (level === 2 && rnd() < 0.5) note(pitch(deg + 2, 1), t, len * 0.9, 'triangle', 0.025);
    }
    if (bar === 0 && level >= 1) note(pitch(0, -1), t, spb * 4, 'triangle', 0.06); // a bass on each bar
    next += spb;
    beat++;
  }
}

export function startMusic(audioCtx, dest, mapId) {
  ctx = audioCtx;
  if (!out) {
    out = ctx.createGain();
    out.connect(dest);
  }
  theme = THEMES[mapId] || THEMES.ela;
  seed = Math.floor(theme.root * 1000);
  next = ctx.currentTime + 0.1;
  drone();
  clearInterval(timer);
  timer = setInterval(schedule, 100);
}
export function setMusicLevel(l) { level = l; }
export function setMusicVolume(v) { if (out) out.gain.value = v * 0.9; }
export function stopMusic() {
  clearInterval(timer);
  for (const n of droneNodes) try { n.stop(); } catch {}
  droneNodes = [];
}

// Short cues for the marked events (main.js markAt): each kind sounds different.
export function cue(kind) {
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  const r = theme?.root || 146.8;
  if (kind === 'mini') { // a war horn swelling, then drums
    note(r * 0.5, t, 1.1, 'sawtooth', 0.09);
    note(r * 0.75, t + 0.15, 0.9, 'sawtooth', 0.06);
    for (let k = 0; k < 4; k++) drum(t + 0.5 + k * 0.16, k % 2 === 0, 0.3);
  } else if (kind === 'mana') { // falling chimes
    for (let k = 0; k < 5; k++) note(r * 8 * 2 ** (-k / 7), t + k * 0.09, 0.5, 'sine', 0.05);
  } else if (kind === 'tesouro') { // a bright arpeggio
    for (const [k, m] of [1, 1.25, 1.5, 2].entries()) note(r * 4 * m, t + k * 0.08, 0.35, 'triangle', 0.06);
  } else if (kind === 'acampamento') { // war drums
    for (let k = 0; k < 6; k++) drum(t + k * 0.13, k % 3 !== 2, 0.32);
  } else if (kind === 'combo') { // two rising fifths
    note(r * 2, t, 0.3, 'triangle', 0.06);
    note(r * 3, t + 0.12, 0.45, 'triangle', 0.06);
  }
}
