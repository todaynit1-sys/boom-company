export const G = {
  props: [], removeQ: [], timers: [],
  tick: 0, real: 0, hitstop: 0, timeScale: 1, slowUntil: 0, shake: 0,
  money: 0, mult: 1, combo: 0, comboT: 0, maxCombo: 0, rage: 0,
  counts: {}, nags: 0, nagSum: 0,
  settle: 0, paused: true, userPause: false, calm: false, mobile: false, auto: false,
  onTick: null, onBreak: null, onHit: null,
  camBlock: [], zone: null,
};
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const pick = a => a[Math.random() * a.length | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
export function angLerp(a, b, t) { let d = (b - a) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return a + d * t; }
