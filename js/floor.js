import { G, rand, pick, clamp } from './state.js';
import { ROOMS } from './data/rooms.js';
import { DEFS } from './data/objects.js';
import { SETS, COMMON } from './data/lines.js';
import { initWorld, spawn, later, slow, explode } from './engine.js';
import { roomBg, textW, stampDecal } from './draw.js';
import { spawnPlayer, updatePlayer, P } from './player.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';
import * as ui from './ui.js';
const M = Matter;

export const F = {};
export function fitW() { const w = document.getElementById('wrap'); return clamp(Math.round(560 * w.clientWidth / Math.max(1, w.clientHeight)), 600, 1000); }

function place(it, placed, slabs, co) {
  const def = DEFS[it.t], w = it.w || def.w, h = it.h || def.h, at = it.on != null ? 'on' : it.at || def.at || 'floor';
  const sub = s => s === '@motto' ? co.motto : s === '@who' ? co.who : s === '@name' ? co.name : s;
  let x = G.cx + (it.x || 0), y;
  if (at === 'slab') y = (it.top || def.top) + h / 2;
  else if (at === 'wall' || at === 'air') y = it.y;
  else if (at === 'ceil') y = 14 + h / 2;
  else if (at === 'on') { const r = placed[it.on]; x = r.body.position.x + (it.dx || 0); y = r.top - h / 2 - 1; }
  else if (at === 'desk') { const s = slabs.find(s => Math.abs(x - s.body.position.x) <= s.w / 2); y = (s ? s.top : 520) - h / 2 - 1; }
  else y = 520 - h / 2 - 1;
  const o = spawn(it.t, x, y, Object.assign({}, it, { text: sub(it.text), culprit: !!it.c }, it.c ? { hp: def.hp * 1.6 } : null));
  o.top = y - h / 2; placed.push(o); if (at === 'slab') slabs.push(o);
  return o;
}

export function startFloor(roomId, co, charId, o = {}) {
  const room = ROOMS[roomId];
  initWorld(fitW(), 'room'); roomBg(room);
  const placed = [], slabs = []; let target = 0, culprit = null;
  for (const it of room.items.concat(G.W >= 860 ? room.wide : [])) { const ob = place(it, placed, slabs, co); if (ob.hp != null) target += ob.price; if (ob.culprit) culprit = ob; }
  const lines = [...room.lines, ...COMMON]; co.sets.forEach(k => SETS[k] && lines.push(...SETS[k].l));
  if (room.ceo) Object.values(SETS).forEach(s => lines.push(s.l[0]));
  Object.assign(F, {
    room, roomId, co, endless: !!o.endless, limit: (o.time || 70) * 60, t: 0, phase: 'play', ft: 0, culprit, cdef: culprit && { t: culprit.type }, target, m0: G.money,
    lines: lines.map(s => s.replace('{who}', co.who)), mine: co.myLines.map(s => s.trim()).filter(Boolean), nag: true,
    tB: 100, tP: 160, tD: 200, stT: 0, zero: false, onEnd: o.onEnd, label: o.label || room.n, base: placed.length, stress: 100,
  });
  spawnPlayer(charId, G.cx - 215);
  G.onTick = floorTick; G.onBreak = onBreak; G.onStage = onStage; G.combo = 0; G.dark = room.sky === 'night' ? .08 : 0;
  hud();
}

const count = k => G.objs.reduce((n, o) => n + (o.kind === k && !o.dead ? 1 : 0), 0);
function bubble() {
  let text, mine = false;
  if (F.mine.length && rand() < .25) { text = pick(F.mine); mine = true; } else text = pick(F.lines);
  const w = Math.min(textW(text, 15) + 30, G.W - 40), left = rand() < .5;
  spawn('bubble', left ? w / 2 + 10 : G.W - w / 2 - 10, rand(70, 230), { w, text, mine, price: mine ? 200000 : 50000, v: { x: (left ? 1 : -1) * rand(2, 4.5), y: rand(-1, 1) } });
}
function stampMove(c) {
  F.stT++; const cyc = F.stT % 260, p = c.body.position; let x = p.x, y = 180;
  if (cyc < 138) x += clamp(P.body.position.x - x, -.9, .9);
  else if (cyc < 150) y = 180 + (cyc - 138) / 12 * 240;
  else if (cyc < 220) y = 420;
  else y = 420 - (cyc - 220) / 40 * 240;
  if (cyc === 150) {
    const hp = c.hp; explode(x, 470, 200, 5, 9); c.hp = hp;
    stampDecal(x + rand(-70, 70), rand(300, 460), '반려', '#E5342B', 26); sfx('stamp'); G.shake = Math.max(G.shake, 9); fx.puff(x, 470, 12, '#cbbfa9', 6);
  }
  M.Body.setPosition(c.body, { x, y });
}

function floorTick() {
  updatePlayer(); F.t++;
  const c = F.culprit, em = F.room.emit, alive = c && !c.dead;
  if (F.phase === 'play') {
    const prog = F.endless ? .5 : F.t / F.limit;
    if (F.nag && (alive || F.endless) && --F.tB <= 0) { F.tB = (144 - 72 * prog) | 0; if (count('bubble') < 10) bubble(); }
    if (alive) {
      const cp = c.body.position;
      if (em.popup && --F.tP <= 0) { F.tP = 200; if (count('popup') < 6) spawn('popup', cp.x + rand(-30, 30), cp.y - c.h / 2 - 34, { text: pick(em.popup), v: { x: rand(-5, 5), y: rand(-9, -5) }, av: rand(-.08, .08) }); sfx('beep', .4); }
      if (em.drop && --F.tD <= 0) { F.tD = em.drop; for (let i = 0; i < 2; i++) spawn('papers', rand(70, G.W - 70), 30 + i * 44, { h: rand(22, 40) | 0 }); fx.note(G.cx, 90, '서류 폭탄!', '#E5342B', 20); }
      if (em.crumple && F.t % (c.stage >= 2 ? 18 : em.crumple) === 0) spawn('crumple', cp.x - c.w / 2 - 6, cp.y - 20, { life: 260, v: { x: rand(-9, -3), y: rand(-8, -3) } });
      if (em.tune && F.t % 38 === 0) sfx('tune', .7);
      if (em.roll && F.t % em.roll === 0) spawn('bottle', 24, 490, { ang: 1.57, v: { x: rand(5, 8), y: -1 } });
      if (F.roomId === 'boss') stampMove(c);
      if (F.roomId === 'copy' && F.t % 170 === 0) sfx('beep', .5);
    }
    if (em.ring && F.t % 110 === 0) { const ph = G.objs.filter(o => o.type === 'phone' && !o.dead); ph.forEach(o => o.ringing = true); if (ph.length) { sfx('ring', .7); fx.note(ph[0].body.position.x, ph[0].body.position.y - 34, '따르릉!', '#2F6BFF'); } }
    if (F.endless) {
      if (F.t % 480 === 0 && G.objs.filter(o => o.hp != null && o.kind === 'obj').length < F.base * .6) {
        const pool = F.room.items.filter(it => !it.c && !DEFS[it.t].fix && !it.text && it.on == null);
        for (let i = 0; i < 6; i++) { const it = pick(pool); spawn(it.t, rand(60, G.W - 60), 40 + i * 20, Object.assign({}, it)); }
        ui.toast('새 비품 도착!');
      }
    } else if (F.t >= F.limit) end();
  } else if (F.phase === 'finish' && --F.ft <= 0) end();
  const s = F.endless ? null : clamp(100 - 100 * (G.money - F.m0) / F.target, 0, 100);
  if (s === 0 && !F.zero) { F.zero = true; G.mult = Math.max(G.mult, 1.5); fx.word(G.cx, 150, '스트레스 0%!', 44, '#8fe0a8'); ui.toast('지금부터 보너스 ×1.5'); sfx('up'); }
  F.stress = s;
  if (F.roomId === 'office' && F.t % 30 === 0) for (const o of G.objs) if (o.type === 'clock') o.clockT = 17 * 60 + 55 + (1 - s / 100) * 5;
  if (F.t % 6 === 0) hud();
}
function hud() {
  const c = F.culprit, left = Math.max(0, Math.ceil((F.limit - F.t) / 60));
  ui.hud({ floor: F.label, sub: F.room.time + ' · ' + F.room.sub, money: G.money, stress: F.stress, combo: G.combo, mult: G.combo >= 50 ? 3 : G.combo >= 25 ? 2 : G.combo >= 10 ? 1.5 : 1, rage: G.rage,
    time: F.endless ? '무한 난동' : F.phase === 'finish' ? '마무리 난동 ×2!' : '남은 ' + left + '초', cname: c ? c.def.n : '', chp: c && !c.dead ? c.hp / c.maxHp : 0 });
}

function onBreak(o) {
  if (o.type === 'light') G.dark = Math.min(.32, G.dark + .1);
  if (o !== F.culprit) return;
  slow(.25, 72); G.flashW = 8;
  if (F.roomId === 'meeting') G.objs.forEach(s => { if (s.type === 'screen') s.dark = true; });
  if (F.roomId === 'boss') later(30, () => { stampDecal(G.cx, 260, '승인', '#1F9D57', 70); sfx('stamp'); G.shake = 12; });
  later(34, () => fx.word(G.cx, 210, '…조용하다.', 34, '#fff'));
  if (F.endless) { const t = F.cdef.t; later(1200, () => { if (G.onTick !== floorTick) return; const d = DEFS[t]; F.culprit = spawn(t, G.cx + rand(-100, 100), d.at === 'air' ? 150 : 60, { culprit: true }); ui.toast('새 ' + d.n + ' 입고'); }); return; }
  F.phase = 'finish'; F.ft = 360; G.mult = Math.max(G.mult, 2);
}
function onStage(o, st) {
  const p = o.body.position;
  G.hitstop = 120; G.shake = 14; fx.word(p.x, p.y - o.h / 2 - 10, st === 1 ? '덜컹!' : '우지끈!', 40, '#FF5C8A'); sfx('metal'); sfx('wood');
  for (let i = 0; i < 4; i++) spawn('frag', p.x + rand(-.4, .4) * o.w, p.y - o.h / 2, { w: rand(12, 26), h: rand(8, 18), col: pick(o.def.cols), life: 260, v: { x: rand(-8, 8), y: rand(-12, -5) }, av: rand(-.3, .3) });
  fx.sparks(p.x, p.y, 10);
  if (F.roomId === 'meeting') G.objs.forEach(s => { if (s.type === 'screen') s.text = (3 + st) + ' / 126'; });
}
function end() {
  if (F.phase === 'done') return; F.phase = 'done';
  const dead = !F.culprit || F.culprit.dead, grade = dead && F.zero ? 'gold' : dead ? '' : 'soft';
  hud();
  F.onEnd && F.onEnd({ grade, text: grade === 'gold' ? '속이 뻥' : grade === '' ? '시원' : '조금 풀림', small: dead ? F.room.done : '그래도 좀 풀렸죠?' });
}
export function setNag(v) { F.nag = v; }
