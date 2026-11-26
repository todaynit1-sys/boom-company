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
// 같은 소리도 매번 조금씩 다르게: J = ±a 흔들기, N = 0 ~ n-1 중 하나
const J = (a = .1) => 1 + (R() - .5) * 2 * a, N = n => R() * n | 0;
const SFX = {
  // 사람 때릴 때: 짝 갈라지는 소리 + 퍽 몸통 + 낮은 울림. 세 가지 몸통 소리 중 하나, 가끔 옷 스치는 소리
  smack(v, p) {
    noise(.03 + R() * .015, v * .5, 'highpass', (2200 + R() * 1200) * p);
    const k = N(3);
    if (k === 0) { noise(.07, v * .45, 'bandpass', 1100 * p * J(.15), 1.2, 0, 500); tone(190 * p, 50 * p, .14, v * .7); }
    else if (k === 1) { noise(.09, v * .5, 'bandpass', 800 * p * J(.15), 1.5, 0, 300); tone(160 * p, 45 * p, .16, v * .72, 'triangle'); }
    else { noise(.05, v * .42, 'lowpass', 1600 * p, 1, 0, 400); tone(230 * p, 60 * p, .11, v * .6); tone(120 * p, 50, .12, v * .3, 'sine', .015); }
    tone(70 * J(.12), 40, .18, v * .5, 'sine', .01);
    if (R() < .3) noise(.12, v * .16, 'bandpass', 3200 * p, 3, .02, 1800);
  },
  thud(v, p) {
    tone(85 * p * J(.15), 38, .22, v * .75); noise(.18, v * .4, 'lowpass', 420 * p * J(.2), 1, 0, 120);
    if (R() < .45) tone(70 * p, 35, .14, v * .3, 'sine', .08 + R() * .05);
    if (R() < .3) noise(.06, v * .15, 'bandpass', 1800 * J(.3), 2, .03);
  },
  punch(v, p) {
    const k = N(3);
    if (k === 0) { tone(150 * p, 60 * p, .08, v * .5); noise(.04, v * .25, 'lowpass', 1800 * J(.2)); }
    else if (k === 1) { tone(130 * p, 55 * p, .09, v * .5, 'triangle'); noise(.05, v * .28, 'bandpass', 1300 * J(.2), 1.3); }
    else { tone(175 * p, 70 * p, .07, v * .45); noise(.03, v * .3, 'highpass', 1500 * J(.2)); }
  },
  // 가벼운 주먹: 짧게 탁
  jab(v, p) {
    noise(.022 + R() * .01, v * .42, 'highpass', 2800 * p * J(.2));
    if (R() < .5) tone(270 * p * J(.1), 120 * p, .05, v * .45, 'triangle'); else tone(320 * p * J(.1), 140 * p, .045, v * .4);
    if (R() < .3) noise(.04, v * .18, 'lowpass', 900 * J(.2), 1, .01);
  },
  // 무거운 발차기: 묵직하게 퍽 + 꼬리 울림
  kickh(v, p) {
    noise(.05, v * .5, 'bandpass', 700 * p * J(.2), 1, 0, 250); tone(120 * p * J(.1), 40, .2, v * .75);
    if (R() < .5) noise(.1, v * .22, 'lowpass', 300 * J(.2), 1, .03); else tone(240 * p, 90, .06, v * .3, 'triangle', .01);
  },
  // 어퍼컷: 올라가는 바람 + 딱
  upper(v, p) { noise(.12, v * .2, 'bandpass', 500 * p, 2, 0, 2400 * J(.15)); tone(140 * p, 380 * p, .1, v * .3, 'triangle'); noise(.03, v * .45, 'highpass', 2800 * p, 1, .09); tone(210 * p, 60, .15, v * .5, 'sine', .09); },
  // 돌진 시작(낮게 부웅)과 들이받기(쿵)
  dash(v, p) { noise(.25, v * .22, 'lowpass', 600 * p * J(.2), 1, 0, 200); tone(90 * p, 60, .2, v * .22, 'sawtooth'); },
  dashhit(v, p) { tone(95 * p * J(.1), 35, .3, v * .85); noise(.18, v * .5, 'lowpass', 900 * p, 1, 0, 150); noise(.04, v * .32, 'highpass', 2000 * p * J(.2)); if (R() < .4) tone(60, 30, .25, v * .35, 'sine', .05); },
  // 내려찍기: 떨어지는 휘파람과 착지 쿵
  dive(v, p) { tone(900 * p * J(.1), 300 * p, .22, v * .12, 'triangle'); noise(.22, v * .15, 'bandpass', 1400 * p, 2, 0, 500); },
  stomp(v, p) {
    tone(70 * p * J(.12), 30, .35, v * .9); noise(.3, v * .45, 'lowpass', 500 * p * J(.2), 1, 0, 80);
    if (R() < .5) for (let i = 0; i < 3; i++) noise(.03, v * .1, 'bandpass', 2000 + R() * 2000, 4, .05 + i * .04);
  },
  // 사람 붙잡기(옷 움켜쥐는 소리)와 던지기(크게 휙)
  grab(v, p) { noise(.12, v * .3, 'bandpass', 2600 * p * J(.2), 1.5, 0, 1200); tone(180 * p, 140 * p, .06, v * .22, 'triangle', .03); },
  toss(v, p) { noise(.3, v * .26, 'bandpass', 400 * p * J(.15), 1.2, 0, 1600); tone(110 * p, 220 * p, .18, v * .2, 'triangle'); },
  // 막혔다: 판에 딱 부딪히고 쨍
  block(v, p) {
    if (R() < .5) tone(600 * p * J(.1), 500 * p, .05, v * .32, 'square'); else tone(330 * p * J(.1), 260 * p, .07, v * .4, 'triangle');
    noise(.04, v * .5, 'bandpass', 1800 * p * J(.15), 3); tone(1900 * p * J(.08), 1850 * p, .18, v * .08, 'sine', .01);
  },
  // 내가 맞았을 때: 둔탁한 퍽 + 내려가는 소리
  hurt(v, p) { noise(.08, v * .5, 'lowpass', 1200 * p * J(.2)); tone(220 * p * J(.1), 90 * p, .22, v * .35, 'triangle'); tone(60, 35, .25, v * .6); if (R() < .4) noise(.05, v * .2, 'highpass', 2400, 1, .02); },
  // 적이 크게 휘두르기 전: 올라가는 경고음 + 딸깍
  windup(v, p, k = 0) { const b = 300 + k * 60; tone(b * p, b * 3 * p, .3, v * .14, 'square'); tone(1250 * J(.05), 1250, .05, v * .14, 'square', .28); },
  // 모으기: 모일수록 높아지는 똑딱, 다 모이면 땡
  chargeup(v, p, k = 0) { const f = 400 + k * 700; tone(f, f * 1.05, .06, v * .1, 'triangle'); },
  chargefull(v) { tone(1400, 1400, .2, v * .18, 'sine'); tone(2100, 2100, .25, v * .1, 'sine', .04); },
  spin(v, p) { for (let i = 0; i < 4; i++) noise(.09, v * .2, 'bandpass', (700 + i * 300) * p * J(.1), 2, i * .07, 300); },
  // 구르기
  dodge(v, p) { noise(.2, v * .25, 'lowpass', 700 * p * J(.2), 1, 0, 200); tone(240 * p, 160 * p, .08, v * .12, 'triangle'); },
  // 직급 기술: 슬라이딩·배치기·골프 스윙·수도·박치기
  slide(v, p) { noise(.35, v * .28, 'bandpass', 1600 * p * J(.15), 1.2, 0, 600); },
  belly(v, p) { tone(140 * p * J(.08), 70 * p, .28, v * .7); tone(300 * p, 520 * p, .12, v * .2, 'triangle', .02); },
  golf(v, p) { noise(.14, v * .25, 'bandpass', 1500 * p, 2, 0, 400); tone(2400 * p * J(.05), 2350 * p, .12, v * .18, 'sine', .1); tone(3600 * p, 3500 * p, .08, v * .08, 'sine', .1); },
  chop(v, p) { tone(260 * p * J(.1), 70 * p, .12, v * .55, 'triangle'); noise(.05, v * .4, 'highpass', 2200 * p * J(.2)); },
  bonk(v, p) { tone(500 * p * J(.1), 180 * p, .14, v * .45, 'triangle'); tone(90 * p, 40, .2, v * .6); },
  // 날아가는 서류·컵과 맞았을 때
  proj(v, p) { noise(.15, v * .15, 'bandpass', 1800 * p * J(.2), 2, 0, 600); },
  splat(v, p) { noise(.08, v * .35, 'bandpass', 1500 * p * J(.2), 1, 0, 400); tone(300 * p, 120, .06, v * .2); },
  // 사장님 분노(목소리가 아닌 낮은 굉음), 쓰러짐, 항복, 단계 바뀜
  roar(v, p) { tone(80 * p, 60 * p, .9, v * .4, 'sawtooth'); tone(83 * p, 55 * p, .9, v * .28, 'square'); noise(.9, v * .35, 'lowpass', 500, 1, 0, 150); },
  ko(v) { [440, 330, 220].forEach((f, i) => tone(f, f * .9, .2, v * .2, 'triangle', i * .16)); tone(60, 30, .4, v * .5, 'sine', .4); },
  foedown(v) { tone(600, 200, .4, v * .2, 'triangle'); tone(80, 35, .3, v * .6, 'sine', .1); },
  phase(v) { tone(300, 600, .25, v * .22, 'sawtooth'); tone(600, 300, .25, v * .22, 'sawtooth', .25); },
  whoosh(v, p) { noise(.1 + R() * .05, v * .12, 'bandpass', 900 * p * J(.25), 1.2 + R(), 0, 300 * J(.2)); },
  glass(v, p) { noise(.22 + R() * .08, v * .3, 'highpass', 3000 * J(.15)); const n = 3 + N(5); for (let i = 0; i < n; i++) { const f = (2000 + R() * 4000) * p; tone(f, f * .9, .06 + R() * .1, v * .1, 'sine', i * (.015 + R() * .015)); } },
  plastic(v, p) { noise(.06, v * .4, 'bandpass', 1200 * p * J(.2), 2); tone(900 * p * J(.1), 300, .03, v * .2, 'square'); if (R() < .4) tone(600 * p, 250, .03, v * .14, 'square', .03); },
  wood(v, p) {
    if (R() < .5) { tone(90 * p, 50, .2, v * .6); noise(.12, v * .3, 'lowpass', 500 * J(.2)); }
    else { tone(110 * p * J(.1), 55, .18, v * .55, 'triangle'); noise(.09, v * .3, 'bandpass', 700 * J(.2), 1.4); }
    if (R() < .35) noise(.05, v * .2, 'highpass', 1800, 1, .02);
  },
  metal(v, p) {
    const s = R() < .5 ? [523, 811, 1220, 1780] : [440, 697, 1046, 1568], d = J(.06);
    s.forEach((f, i) => tone(f * p * d, f * p * d * .99, .3 + i * .12, v * .12, 'sine'));
    noise(.03, v * .3, 'highpass', 2000 * J(.2)); if (R() < .3) tone(3100 * p, 3000 * p, .4, v * .04, 'sine', .02);
  },
  paper(v, p) { noise(.18 + R() * .1, v * .3, 'bandpass', 2500 * p * J(.2), 1.2, 0, 700 * J(.2)); if (R() < .35) noise(.06, v * .15, 'highpass', 4000, 1, .08); },
  zap(v, p) { for (let i = 0; i < 4; i++) tone((300 + R() * 900) * p, 100 + R() * 800, .04, v * .14, 'sawtooth', i * .035); noise(.1, v * .2, 'highpass', 4000); },
  water(v, p) { noise(.4, v * .3, 'lowpass', 900 * p); for (let i = 0; i < 3; i++) tone(500 + R() * 700, 300, .05, v * .08, 'sine', .05 + i * .06); },
  pop(v, p) { tone(600 * p, 1200 * p, .05, v * .35); },
  stamp(v, p) { tone(70 * p, 40, .3, v * .8); noise(.5, v * .25, 'lowpass', 400 * J(.2)); },
  boom(v, p) {
    tone(110 * p * J(.12), 30, .5, v * .8); noise(.6, v * .5, 'lowpass', 700 * J(.2), 1, 0, 100);
    if (R() < .4) noise(.35, v * .18, 'bandpass', 1400 * J(.3), 1, .06, 300);
  },
  ring(v) { for (let i = 0; i < 4; i++) { tone(1400, 1400, .05, v * .12, 'square', i * .1); tone(1750, 1750, .05, v * .12, 'square', i * .1 + .05); } },
  beep(v) { tone(1900, 1900, .09, v * .12, 'square'); },
  tune(v) { const n = [392, 440, 494, 523, 587, 659][R() * 6 | 0] * (.94 + R() * .12); tone(n, n * (R() < .3 ? 1.08 : 1), .28, v * .1, 'triangle'); },
  combo(v, p, k = 0) { tone(500 + k * 90, 700 + k * 90, .09, v * .25, 'triangle'); },
  up(v) { [523, 659, 784].forEach((f, i) => tone(f, f, .16, v * .25, 'triangle', i * .1)); },
  jump(v, p) { tone(280 * p, 520 * p, .09, v * .12, 'triangle'); },
  type(v, p) { noise(.02, v * .25, 'highpass', 2500); tone(1200 * p, 800, .02, v * .1, 'square'); },
  // 발소리: 뒤꿈치·앞꿈치가 번갈아, 가끔 끌리는 소리
  step(v, p) {
    noise(.03 + R() * .015, v * .5, 'lowpass', 500 * p * J(.25));
    if (R() < .25) noise(.02, v * .14, 'bandpass', 2400 * J(.3), 2, .02);
  },
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
// 같은 이름은 40ms 안에 한 번만(여러 겹 변주는 한 이름 안에서 만든다)
export function sfx(name, vol = 1, k) {
  if (!ac || S.mute || !SFX[name]) return;
  const now = performance.now(); if (now - (last[name] || 0) < 40) return; last[name] = now;
  try { SFX[name](Math.min(1, vol), .88 + Math.random() * .24, k); } catch (e) {}
}
export function buzz(p) { if (touched && S.haptic && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }
