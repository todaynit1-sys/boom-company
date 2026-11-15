// 상황별 배경음악. 음원 파일 없이 WebAudio로 즉석 연주한다.
// office: 낮 사무실 로파이 · night: 야근 · tense: 참는 중(시계 소리) · rage: 뚜껑 열렸다 · win: 피날레·청구서
import { S } from './save.js';
import { actx } from './audio.js';

let ac = null, master = null, rev = null, nb = null, timer = 0, want = null, duck = 1;
const songs = [];
const N = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

function init() {
  ac = actx(); if (!ac) return false;
  master = ac.createGain(); master.gain.value = level(); master.connect(ac.destination);
  rev = ac.createConvolver(); const len = ac.sampleRate * 1.8 | 0, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  rev.buffer = ir; const rg = ac.createGain(); rg.gain.value = .32; rev.connect(rg).connect(master);
  nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}
const level = () => (S.mute || S.bgm === false) ? 0 : .26 * duck;
export function refreshMusic() { if (master) master.gain.setTargetAtTime(level(), ac.currentTime, .15); }
export function duckMusic(k) { duck = k; refreshMusic(); }
export function music(name) { want = name; if (!timer) timer = setInterval(pump, 25); }
export const musicState = () => ({ want, playing: songs.filter(s => !s.dying).map(s => s.name), steps: songs.map(s => s.k), ctx: ac ? ac.state : 'none', level: master ? +master.gain.value.toFixed(3) : null });

// ───── 악기
function tone(type, f, t, dur, v, d, o = {}) {
  const os = ac.createOscillator(), g = ac.createGain(); os.type = type; os.frequency.setValueAtTime(f, t); if (o.detune) os.detune.value = o.detune;
  if (o.f1) os.frequency.exponentialRampToValueAtTime(o.f1, t + (o.fd || dur));
  let n = os; if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; fl.Q.value = o.q || .7; n.connect(fl); n = fl; }
  n.connect(g); g.connect(d); if (o.send) g.connect(rev);
  const a = o.a ?? .006, hold = o.hold || 0, dec = o.dec ?? dur / 3;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setTargetAtTime(0, t + a + hold, dec);
  os.start(t); os.stop(t + a + hold + dec * 6 + .05);
}
function noise(t, v, d, type, f, dec, q = .8) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + dec); s.connect(fl).connect(g).connect(d); s.start(t, Math.random() * .5); s.stop(t + dec + .02); }
function kick(t, v, d) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .32); o.connect(g).connect(d); o.start(t); o.stop(t + .35); }
const snare = (t, v, d) => { noise(t, v, d, 'bandpass', 1900, .17, .7); tone('triangle', 190, t, .08, v * .5, d, { dec: .03 }); };
const rim = (t, v, d) => { noise(t, v, d, 'bandpass', 3200, .05, 2); tone('square', 820, t, .02, v * .25, d, { dec: .01, lp: 2000 }); };
const hat = (t, v, d, open) => noise(t, v, d, 'highpass', 7500, open ? .2 : .045, .5);
const tick = (t, v, d, hi) => tone('sine', hi ? 2100 : 1550, t, .03, v, d, { dec: .012 });
function keys(t, m, dur, v, d) { const f = N(m); tone('sine', f, t, dur, v, d, { a: .008, dec: dur * .45, send: 1 }); tone('sine', f, t, dur, v * .45, d, { a: .01, dec: dur * .5, detune: 8 }); tone('triangle', f * 2, t, dur * .5, v * .14, d, { a: .004, dec: dur * .2 }); }
const bass = (t, m, dur, v, d) => tone('triangle', N(m), t, dur, v, d, { a: .01, dec: dur * .35, lp: 700 });
const bassDist = (t, m, dur, v, d) => tone('sawtooth', N(m), t, dur, v, d, { a: .004, dec: dur * .45, lp: 950, q: 4 });
const lead = (t, m, dur, v, d) => tone('square', N(m), t, dur, v, d, { a: .003, dec: dur * .5, lp: 2600 });
function pad(t, ms, dur, v, d, lp = 1200) { for (const m of ms) tone('sawtooth', N(m), t, dur, v, d, { a: dur * .2, hold: dur * .45, dec: dur * .25, lp, detune: rnd(-10, 10), send: 1 }); }

// ───── 곡 (16분음표 한 칸씩, 4마디 반복)
const SONGS = {
  office: {
    bpm: 80, swing: .35, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], root: [41, 40, 38, 36],
    mel: [[0, 2, 72, 2], [0, 6, 69, 2], [0, 10, 67, 4], [1, 0, 71, 2], [1, 4, 67, 2], [1, 8, 64, 6], [2, 2, 69, 2], [2, 6, 65, 2], [2, 10, 64, 2], [2, 12, 62, 4], [3, 4, 64, 2], [3, 8, 67, 6]],
    play(k, t, d, sd) {
      const st = k % 16, bar = (k >> 4) % 4, T = t + (st % 4 === 2 ? sd * this.swing : 0), ch = this.chords[bar];
      if (st === 0) { ch.forEach((m, i) => keys(t + i * .012, m, sd * 14, .06, d)); bass(t, this.root[bar], sd * 6, .2, d); }
      if (st === 10) { keys(T, ch[1] + 12, sd * 4, .04, d); keys(T, ch[3], sd * 4, .04, d); bass(T, this.root[bar] + 7, sd * 4, .14, d); }
      if (st === 0 || st === 7 || st === 10) kick(T, st === 0 ? .5 : .3, d);
      if (st === 4 || st === 12) snare(T, .13, d);
      if (st % 2 === 0) hat(T, st % 4 === 0 ? .04 : .026, d);
      if ((k >> 6) % 2) for (const [b, s2, m, len] of this.mel) if (b === bar && s2 === st) keys(T, m, sd * len, .05, d);
    },
  },
  night: {
    bpm: 68, swing: .4, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 55, 59, 62]], root: [45, 41, 38, 40],
    mel: [[0, 4, 76, 4], [0, 10, 72, 4], [1, 6, 69, 6], [2, 2, 74, 3], [2, 8, 72, 3], [3, 4, 71, 8]],
    play(k, t, d, sd) {
      const st = k % 16, bar = (k >> 4) % 4, T = t + (st % 4 === 2 ? sd * this.swing : 0), ch = this.chords[bar];
      if (st === 0) { ch.forEach((m, i) => keys(t + i * .02, m, sd * 15, .055, d)); bass(t, this.root[bar], sd * 8, .18, d); }
      if (st === 0 || st === 10) kick(T, .32, d);
      if (st === 8) rim(T, .07, d);
      if (st % 4 === 2) hat(T, .02, d);
      for (const [b, s2, m, len] of this.mel) if (b === bar && s2 === st) keys(T, m, sd * len, .045, d);
    },
  },
  tense: {
    bpm: 64,
    play(k, t, d, sd) {
      const st = k % 16, bar = k >> 4;
      if (st === 0 && bar % 2 === 0) pad(t, [33, 40, 45], sd * 32, .05, d, 380);
      if (st % 4 === 0) tick(t, .045, d, st % 8 === 0);
      if (st === 0) kick(t, .26, d); if (st === 3) kick(t, .17, d);
      if (st === 8 && bar % 2 === 1) { tone('sine', N(76), t, sd * 8, .022, d, { a: sd * 4, dec: sd * 2 }); tone('sine', N(77), t, sd * 8, .016, d, { a: sd * 4, dec: sd * 2 }); }
    },
  },
  rage: {
    bpm: 150, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], root: [33, 29, 36, 31],
    play(k, t, d, sd) {
      const st = k % 16, bar = (k >> 4) % 4, ch = this.prog[bar];
      if (st % 4 === 0) kick(t, .55, d);
      if (st === 4 || st === 12) snare(t, .24, d); if (bar === 3 && st >= 13) snare(t, .18, d);
      hat(t, st % 2 ? .025 : .045, d, st % 4 === 2);
      if (st % 2 === 0) bassDist(t, this.root[bar] + (st % 4 === 2 ? 12 : 0), sd * 1.6, .13, d);
      lead(t, ch[[0, 1, 2, 1][st % 4]] + 12 + ((k >> 5) % 2 && st >= 8 ? 12 : 0), sd * .9, .04, d);
      if (st === 0) pad(t, ch, sd * 16, .025, d);
    },
  },
  win: {
    bpm: 118, prog: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], root: [36, 31, 33, 29],
    play(k, t, d, sd) {
      const st = k % 16, bar = (k >> 4) % 4, ch = this.prog[bar];
      if (st === 0 || st === 8 || st === 10) kick(t, .45, d);
      if (st === 4 || st === 12) snare(t, .18, d);
      if (st % 2 === 0) hat(t, .03, d);
      if (st % 4 === 0) bass(t, this.root[bar] + (st === 8 ? 7 : 0), sd * 3, .2, d);
      if (st === 0) pad(t, ch, sd * 16, .03, d, 1800);
      if ([0, 3, 6, 8, 11, 14].includes(st)) tone('triangle', N(ch[[0, 1, 2, 1, 2, 0][[0, 3, 6, 8, 11, 14].indexOf(st)]] + 24), t, sd * 1.5, .05, d, { a: .004, dec: sd * .6, send: 1 });
    },
  },
};

function pump() {
  if (!ac && !init()) return;
  if (ac.state !== 'running') return;
  const now = ac.currentTime, cur = songs.find(s => !s.dying);
  if ((cur ? cur.name : null) !== want) {
    if (cur) { cur.dying = now + .9; cur.g.gain.cancelScheduledValues(now); cur.g.gain.setValueAtTime(cur.g.gain.value, now); cur.g.gain.linearRampToValueAtTime(0, now + .8); }
    if (want && SONGS[want]) { const g = ac.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + .7); g.connect(master); songs.push({ name: want, def: SONGS[want], g, k: 0, next: now + .06 }); }
  }
  for (let i = songs.length - 1; i >= 0; i--) {
    const s = songs[i]; if (s.dying && now > s.dying) { setTimeout(() => s.g.disconnect(), 3000); songs.splice(i, 1); continue; }
    const sd = 60 / s.def.bpm / 4;
    while (s.next < now + .14) { if (!s.dying) s.def.play(s.k, s.next, s.g, sd); s.next += sd; s.k++; }
  }
}
