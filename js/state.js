export const G = {
  W: 800, H: 560, cx: 400, scene: 'none',
  engine: null, world: null,
  objs: [], removeQ: [], hits: [], timers: [], parts: [], texts: [], bursts: [], bombs: [],
  tick: 0, real: 0, hitstop: 0, timeScale: 1, slowAcc: 0, slowUntil: 0,
  shake: 0, flashW: 0, dark: 0,
  money: 0, mult: 1, combo: 0, comboT: 0, maxCombo: 0, rage: 0,
  counts: {}, bubbles: 0, bubbleSum: 0,
  settle: 0, paused: true, calm: false, mobile: false, auto: false,
  onTick: null, onBreak: null, onStage: null,
  bg: null, decal: null, dctx: null,
};
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const pick = a => a[Math.random() * a.length | 0];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
export const INK = '#2A2522';
