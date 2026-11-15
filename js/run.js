import { G, rand } from './state.js';
import { S, save, copy, rankOf, RANKS } from './save.js';
import { ROOMS } from './data/rooms.js';
import { initWorld, spawn, later, slow, explode, shove, breakObj } from './engine.js';
import { extBg } from './draw.js';
import { startFloor, fitW, F } from './floor.js';
import { P, I } from './player.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';

export const R = { mode: 'title' };
const STY = { glass: ['#7fb4d6', '#dff4ff'], brick: ['#b5563f', '#ffe9a8'], gov: ['#b9b3a3', '#7f97a8'] };
const timers = [];
const after = (ms, fn) => timers.push(setTimeout(fn, ms));
function clearTimers() { timers.splice(0).forEach(clearTimeout); }

function buildExterior(co) {
  const [c1, c2] = STY[co.style] || STY.glass, n = co.floors.length + 1, bw = 84, bh = 54, x0 = G.cx - bw * 1.5;
  for (let f = 0; f < n; f++) for (let i = 0; i < 4; i++) spawn('block', x0 + i * bw, 520 - bh / 2 - f * bh - .5, { col: c1, col2: c2 });
  const name = [...(co.name || '회사')], sp = Math.min(38, 330 / name.length), y = 520 - n * bh - 20;
  name.forEach((ch, i) => spawn('letter', G.cx + (i - (name.length - 1) / 2) * sp, y, { text: ch, w: Math.min(34, sp - 2) }));
}
export function title() {
  clearTimers(); R.mode = 'title'; P.active = false;
  ui.showTitle(); G.cam = .62;
  initWorld(Math.round(fitW() / .62), 'ext'); extBg(); buildExterior(S.company);
  G.paused = false; G.rage = 0;
}
export function preview() { if (R.mode === 'title') { initWorld(Math.round(fitW() / .62), 'ext'); extBg(); buildExterior(S.company); } }

function reset() { clearTimers(); G.cam = 1; Object.assign(G, { money: 0, counts: {}, bubbles: 0, bubbleSum: 0, maxCombo: 0, combo: 0, rage: 0 }); R.t0 = Date.now(); }
export function startRun() {
  reset(); R.mode = 'run'; R.co = copy(S.company); R.floors = [...R.co.floors, 'ceo']; R.i = 0;
  ui.only(null); floorCard();
}
function floorCard() {
  const id = R.floors[R.i], room = ROOMS[id], n = R.floors.length;
  ui.hudShow(true);
  startFloor(id, R.co, S.char, { time: room.ceo ? 80 : 70, onEnd: floorEnd, label: `${R.i + 1}층 · ${room.n}` });
  G.paused = true;
  ui.card(`${R.co.name} ${R.i + 1} / ${n}층`, room.n, room.sub, ['시각', room.time, '주범', F.culprit.def.n], () => { G.paused = false; if (R.i === 0) { ui.keysHint(true); after(9000, () => ui.keysHint(false)); } S.seenHelp = true; });
}
function floorEnd(res) {
  ui.stamp(res.text, res.grade, res.small); sfx('stamp'); G.shake = 8;
  after(1700, () => {
    if (R.i >= R.floors.length - 1) return finale();
    ui.big('천장 돌파!'); G.flashW = 10; sfx('boom'); buzz(60);
    after(800, () => { R.i++; floorCard(); });
  });
}

function finale() {
  R.mode = 'finale'; P.active = false; ui.keysHint(false);
  initWorld(fitW(), 'ext'); extBg(); buildExterior(R.co);
  R.fin = { press: 0, t: 0, done: false, pa: false };
  ui.mash(G.mobile ? '연타! (때리기)' : '연타! (Z 또는 클릭)');
  ui.hud({ floor: '피날레', sub: R.co.name + ' 통째로', money: G.money, stress: 0, combo: 0, rage: 0, time: '', cname: '', chp: 0 });
  G.onTick = () => {
    const f = R.fin; f.t++;
    const press = (I.a && !f.pa) || I.tap || (G.auto && f.t % 12 === 0); f.pa = I.a; I.tap = false;
    if (f.done) return;
    if (press) blast();
    if (f.press >= 12 || f.t >= 540) collapse();
    if (f.t % 6 === 0) ui.hud({ floor: '피날레', sub: R.co.name + ' 통째로', money: G.money, stress: 0, combo: G.combo, rage: 0, time: '', cname: '', chp: 0 });
  };
}
function blast() {
  const bl = G.objs.filter(o => o.type === 'block' && !o.dead); if (!bl.length) return;
  const my = Math.max(...bl.map(o => o.body.position.y)), low = bl.filter(o => o.body.position.y > my - 12), b = low[Math.random() * low.length | 0], p = b.body.position;
  R.fin.press++; breakObj(b); explode(p.x, p.y, 150, 0, 8); fx.cloud(p.x, p.y, 8, '#cbbfa9', 50); sfx('boom', .7); buzz(30); G.hitstop = 40;
}
function collapse() {
  const f = R.fin; f.done = true; ui.over(''); slow(.4, 130); G.shake = 20; G.flashW = 6; sfx('boom');
  for (const o of G.objs.slice()) if ((o.type === 'block' || o.type === 'letter') && !o.dead) later(rand(2, 70) | 0, () => { if (o.dead) return; const p = o.body.position; shove(o, rand(-8, 8), rand(-9, -2)); breakObj(o); fx.cloud(p.x, p.y, 4, '#cbbfa9', 50); });
  after(2600, () => { ui.big(R.co.name + ' 뿌셨다!'); sfx('up'); });
  after(5200, () => ui.big(R.co.name + ' 뿌셨다!', '…는 상상. 내일도 출근이지만, 오늘은 속 시원하게 퇴근!'));
  after(8200, bill);
}

export function startEndless(roomId) {
  reset(); R.mode = 'endless'; R.co = copy(S.company); R.room = roomId;
  ui.only(null); ui.hudShow(true);
  startFloor(roomId, R.co, S.char, { endless: true, label: '무한 난동 · ' + ROOMS[roomId].n });
  G.paused = false; ui.keysHint(true); after(9000, () => ui.keysHint(false));
  ui.toast('일시정지에서 청구서를 받을 수 있어요');
}
export function bill() {
  clearTimers(); const was = R.mode; R.last = was === 'endless' ? 'endless' : 'run'; R.mode = 'bill'; P.active = false; G.onTick = null;
  const total = Math.round(G.money), r0 = rankOf(S.total);
  S.total += total; if (R.last === 'run') S.best = Math.max(S.best, total); S.runs++;
  for (const k in G.counts) S.counts[k] = (S.counts[k] || 0) + G.counts[k].n;
  save();
  const r1 = rankOf(S.total);
  ui.bill({ company: R.co.name, who: ui.charName(S.char), counts: G.counts, bubbles: G.bubbles, bubbleSum: G.bubbleSum, total, maxCombo: G.maxCombo, sec: Math.round((Date.now() - R.t0) / 1000), promo: r1 > r0 ? RANKS[r1] : null });
}
export function again() { if (R.last === 'endless') startEndless(R.room); else startRun(); }
