import { S } from './save.js';
let ac, nb, touched = false; const last = {};
export const actx = () => ac;
export function unlock() {
  touched = true;
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const n = ac.sampleRate; nb = ac.createBuffer(1, n, n); const d = nb.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume();
}
function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(Math.max(.0002, vol), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + .03);
}
function noise(dur, vol, ftype, freq, q = 1, delay = 0, f1 = 0) {
  const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nb; f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(Math.max(.0002, vol), t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
}
const R = () => Math.random();
const SFX = {
  punch(v, p) { tone(150 * p, 60 * p, .08, v * .5); noise(.04, v * .25, 'lowpass', 1800); },
  whoosh(v, p) { noise(.12, v * .12, 'bandpass', 900 * p, 1.5, 0, 300); },
  glass(v, p) { noise(.25, v * .3, 'highpass', 3000); for (let i = 0; i < 5; i++) { const f = (2000 + R() * 4000) * p; tone(f, f * .9, .06 + R() * .1, v * .1, 'sine', i * .02); } },
  plastic(v, p) { noise(.06, v * .4, 'bandpass', 1200 * p, 2); tone(900 * p, 300, .03, v * .2, 'square'); },
  wood(v, p) { tone(90 * p, 50, .2, v * .6); noise(.12, v * .3, 'lowpass', 500); },
  metal(v, p) { [523, 811, 1220, 1780].forEach((f, i) => tone(f * p, f * p * .99, .3 + i * .12, v * .12, 'sine')); noise(.03, v * .3, 'highpass', 2000); },
  paper(v, p) { noise(.22, v * .3, 'bandpass', 2500 * p, 1.2, 0, 700); },
  zap(v, p) { for (let i = 0; i < 4; i++) tone((300 + R() * 900) * p, 100 + R() * 800, .04, v * .14, 'sawtooth', i * .035); noise(.1, v * .2, 'highpass', 4000); },
  water(v, p) { noise(.4, v * .3, 'lowpass', 900 * p); for (let i = 0; i < 3; i++) tone(500 + R() * 700, 300, .05, v * .08, 'sine', .05 + i * .06); },
  pop(v, p) { tone(600 * p, 1200 * p, .05, v * .35); },
  stamp(v, p) { tone(70 * p, 40, .3, v * .8); noise(.5, v * .25, 'lowpass', 400); },
  boom(v, p) { tone(110 * p, 30, .5, v * .8); noise(.6, v * .5, 'lowpass', 700, 1, 0, 100); },
  ring(v) { for (let i = 0; i < 4; i++) { tone(1400, 1400, .05, v * .12, 'square', i * .1); tone(1750, 1750, .05, v * .12, 'square', i * .1 + .05); } },
  beep(v) { tone(1900, 1900, .09, v * .12, 'square'); },
  tune(v) { const n = [392, 440, 494, 523, 587, 659][R() * 6 | 0] * (.94 + R() * .12); tone(n, n * (R() < .3 ? 1.08 : 1), .28, v * .1, 'triangle'); },
  combo(v, p, k = 0) { tone(500 + k * 90, 700 + k * 90, .09, v * .25, 'triangle'); },
  up(v) { [523, 659, 784].forEach((f, i) => tone(f, f, .16, v * .25, 'triangle', i * .1)); },
  jump(v, p) { tone(280 * p, 520 * p, .09, v * .12, 'triangle'); },
  type(v, p) { noise(.02, v * .25, 'highpass', 2500); tone(1200 * p, 800, .02, v * .1, 'square'); },
  step(v, p) { noise(.035, v * .5, 'lowpass', 500 * p); },
  ding(v) { tone(1320, 1320, .5, v * .25, 'sine'); tone(990, 990, .6, v * .2, 'sine', .22); },
  special(v) { tone(200, 900, .35, v * .4, 'sawtooth'); noise(.35, v * .3, 'bandpass', 600, 1, 0, 3000); },
  // 놀거리: 비상벨·차 경보·소화기·지게차·바퀴
  bell(v) { for (let i = 0; i < 7; i++) { tone(2350, 2350, .035, v * .09, 'square', i * .055); tone(1760, 1760, .03, v * .06, 'square', i * .055 + .027); } },
  caralarm(v) { tone(880, 1560, .22, v * .1, 'sawtooth'); tone(1560, 880, .22, v * .1, 'sawtooth', .23); },
  spray(v, p) { noise(.14, v * .22, 'highpass', 2600 * p); noise(.1, v * .1, 'bandpass', 900, 1); },
  hum(v, p) { tone(62 * p, 66 * p, .22, v * .2, 'sawtooth'); noise(.2, v * .12, 'lowpass', 260); },
  roll(v, p) { noise(.12, v * .14, 'lowpass', 380 * p); },
  // 확성기 외침(찌그러진 소리)과 탬버린
  shout(v, p) { tone(240 * p, 190 * p, .42, v * .22, 'sawtooth'); tone(362 * p, 300 * p, .38, v * .14, 'square', .02); noise(.36, v * .22, 'bandpass', 1400 * p, 2.5); },
  tamb(v) { for (let i = 0; i < 6; i++) tone(3000 + R() * 1800, 2800, .05, v * .07, 'square', i * .016); noise(.09, v * .22, 'highpass', 6000); },
};
export function sfx(name, vol = 1, k) {
  if (!ac || S.mute || !SFX[name]) return;
  const now = performance.now(); if (now - (last[name] || 0) < 40) return; last[name] = now;
  try { SFX[name](Math.min(1, vol), .88 + Math.random() * .24, k); } catch (e) {}
}
export function buzz(p) { if (touched && S.haptic && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
