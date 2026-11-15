import { G, rand, pick } from './state.js';
import { S, save, copy, rankOf, RANKS } from './save.js';
import { buildOffice, buildExterior, find, TAG } from './world.js';
import { later, slow, explode, shove, breakProp } from './engine.js';
import { P, I, CAM, spawnPlayer, updatePlayer, hidePlayer } from './player.js';
import { MISSIONS, MISSION_IDS, MS, startMission, stopMission, tickMission, missionHud } from './missions.js';
import { SETS, COMMON } from './data/lines.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { say, hush } from './voice.js';

export const R = { mode: 'title' };
const timers = [];
const after = (ms, fn) => timers.push(setTimeout(fn, ms));
function clearTimers() { timers.splice(0).forEach(clearTimeout); }

export function title() {
  clearTimers(); hush(); stopMission(); R.mode = 'title';
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI);
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: 1.25, z: 4.9 }, r: 4.4, h: 1.75, base: Math.PI, sway: .45, t: 0 });
  G.onTick = null; G.paused = false; G.rage = 0; G.interact = null; ui.showTitle();
}
export function preview(close) {
  if (R.mode !== 'title') return;
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI);
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: close ? .35 : 1.25, z: 4.9 }, r: close ? 3.6 : 4.4, h: close ? 1.5 : 1.75, base: Math.PI, sway: close ? .7 : .45 });
}

function reset() { clearTimers(); hush(); Object.assign(G, { money: 0, counts: {}, nags: 0, maxCombo: 0, combo: 0, rage: 0 }); R.t0 = Date.now(); R.co = copy(S.company); }
const ORDER = ['meeting', 'report', 'lunch', 'printer', 'overtime'];
export function startCourse() {
  reset(); R.mode = 'run'; R.course = true;
  const three = ORDER.slice().sort(() => Math.random() - .5).slice(0, 3);
  R.list = ORDER.filter(id => three.includes(id)).concat('resign'); R.i = 0; ui.only(null); mission();
}
export function startSingle(id) { reset(); R.mode = 'run'; R.course = false; R.list = [id]; R.i = 0; ui.only(null); mission(); }

function playTick(dt) {
  updatePlayer(dt); tickMission(dt);
  if (G.tick % 6 === 0) { const h = missionHud(), m = MS.m; ui.hud({ title: R.label, sub: m ? m.time + ' · ' + m.sub : '', money: G.money, stress: h.stress, combo: G.combo, rage: G.rage, time: h.left != null ? '자유 난동 ' + h.left + '초 · 피해액 2배' : '', weapon: P.wdef ? P.wdef.n + (P.wdur ? ' ' + P.wdur : '') : '맨손' }); promptTick(); }
}
// 임무 안내가 없을 때: 집기·엎기 안내
function promptTick() {
  if (ui.promptBusy()) return; const c = P.cand;
  if (P.carry) ui.hint('때리기 버튼 = 던지기 · E = 내려놓기');
  else if (c && !c.dead) ui.hint(c.def.weapon ? `E  ${c.def.n} 들기` : c.def.flip ? `E 꾹  ${c.def.n} 엎기` : `E  ${c.def.n} 집어 들기`, c.def.flip ? P.eHold / .45 : 0);
  else ui.hint(null);
}
function mission() {
  const id = R.list[R.i], m = MISSIONS[id], [x, z, yaw] = m.start;
  ui.hudShow(true); buildOffice(R.co, m.sky); spawnPlayer(S.char, x, z, yaw); m.setup && m.setup();
  R.label = (R.course ? `${R.i + 1}/${R.list.length} · ` : '') + m.n;
  G.onTick = playTick; G.paused = true; G.mult = 1;
  ui.objectives(m.steps.map(s => s.t), 0);
  ui.card(R.co.name + (R.course ? ` · 상황 ${R.i + 1} / ${R.list.length}` : ''), m.n, m.sub, ['시각', m.time, '할 일', m.steps.length + '단계'], () => {
    G.paused = false; startMission(m, R.co, ui.charName(S.char), missionEnd);
    if (!S.seenHelp || R.i === 0) { ui.keysHint(true); after(12000, () => ui.keysHint(false)); S.seenHelp = true; save(); }
  });
}
function missionEnd(res) {
  const g = res.stress <= 0 ? 'gold' : res.stress < 50 ? '' : 'soft';
  ui.stamp(g === 'gold' ? '속이 뻥' : g === '' ? '시원' : '조금 풀림', g, MS.m.n + ' 끝'); sfx('stamp'); G.shake = .15;
  after(1900, () => {
    ui.over('');
    if (R.i < R.list.length - 1) { R.i++; return mission(); }
    if (res.final && R.course) return finale();
    bill();
  });
}

function finale() {
  R.mode = 'finale'; ui.keysHint(false); ui.objectives(null); ui.prompt(null); ui.hint(null);
  buildExterior(R.co); spawnPlayer(S.char, 0, 13, Math.PI); P.active = true;
  Object.assign(CAM, { mode: 'fixed', pos: { x: 5, y: 3.4, z: 21 }, look: { x: 0, y: 6, z: 0 } });
  R.fin = { press: 0, t: 0, done: false, pa: false };
  ui.mash(G.mobile ? '연타! (때리기)' : '연타! (Z · 클릭)');
  G.onTick = dt => {
    const f = R.fin; f.t++;
    if (P.atk && P.atk !== true) { P.atk.t += dt / P.atk.dur; if (P.atk.t >= 1) P.atk = null; }
    const press = (I.a && !f.pa) || I.tap || (G.auto && f.t % 12 === 0); f.pa = I.a; I.tap = false;
    if (f.t % 6 === 0) ui.hud({ title: '피날레', sub: R.co.name + ' 통째로', money: G.money, stress: 0, combo: G.combo, rage: 0, time: '', weapon: '' });
    if (f.done) return;
    if (press) blast();
    if (f.press >= 12 || f.t >= 600) collapse();
  };
}
function blast() {
  const bl = G.props.filter(o => o.type === 'block' && !o.dead); if (!bl.length) return;
  const my = Math.min(...bl.map(o => o.body.position.y)), low = bl.filter(o => o.body.position.y < my + .6), b = pick(low), p = b.body.position, pos = { x: p.x, y: p.y, z: p.z };
  R.fin.press++; P.atk = { type: 'swing', t: 0, dur: .25, hit: true }; breakProp(b); explode(pos, 5, 0, 5); fx.cloud(pos, 10, '#b9b2a2', 2.2, 1.5); sfx('boom', .8); buzz(30); G.hitstop = 40;
}
function collapse() {
  const f = R.fin; f.done = true; ui.over(''); slow(.4, 140); G.shake = .8; G.flash = 6; sfx('boom');
  for (const o of G.props.slice()) if ((o.type === 'block' || o.type === 'letter') && !o.dead) later(rand(2, 80) | 0, () => { if (o.dead) return; const p = o.body.position, pos = { x: p.x, y: p.y, z: p.z }; shove(o, rand(-6, 6), rand(-2, 4), rand(-6, 6)); breakProp(o); fx.cloud(pos, 3, '#b9b2a2', 2.6, 1.5); });
  after(2800, () => { ui.big(R.co.name + ' 뿌셨다!'); sfx('up'); P.atk = null; P.carry = true; });
  after(5400, () => ui.big(R.co.name + ' 뿌셨다!', '…는 상상. 내일도 출근이지만, 오늘은 속 시원하게 퇴근!'));
  after(8600, () => { P.carry = null; bill(); });
}

// 자유 난동: 사무실 한 층 전체, 시간 제한 없음
export function startFree() {
  reset(); R.mode = 'free'; R.course = false; ui.only(null); ui.hudShow(true);
  buildOffice(R.co, pick(['day', 'evening', 'night'])); spawnPlayer(S.char, 0, 5, Math.PI);
  R.label = '자유 난동'; G.paused = false; G.mult = 1; ui.objectives(['회사 전체를 마음껏 부수세요', '무기: 방망이(복사실) · 골프채(부장실) · 오함마(로비)', '책상·탁자·캐비닛은 E 꾹 눌러 엎기', '끝내려면 일시정지 → 청구서'], -1);
  const lines = [...COMMON]; R.co.sets.forEach(k => SETS[k] && lines.push(...SETS[k].l)); R.co.myLines.forEach(s => s.trim() && lines.push(s.trim()));
  G.onTick = dt => {
    updatePlayer(dt);
    if (G.tick % 6 === 0) { ui.hud({ title: R.label, sub: R.co.name, money: G.money, stress: null, combo: G.combo, rage: G.rage, time: '시간 제한 없음', weapon: P.wdef ? P.wdef.n + (P.wdur ? ' ' + P.wdur : '') : '맨손' }); promptTick(); }
    if (G.tick % 620 === 300) say(R.co.who, pick(lines).replace('{who}: ', '').replace('{who}', R.co.who));
    if (G.tick % 900 === 450) { const ph = G.props.filter(p => p.type === 'phone' && !p.dead); if (ph.length) { const p = pick(ph); sfx('ring'); p.punch = 10; fx.text({ x: p.body.position.x, y: p.body.position.y + .4, z: p.body.position.z }, '따르릉!', 'note'); } }
  };
  ui.keysHint(true); after(12000, () => ui.keysHint(false));
}

export function bill() {
  clearTimers(); hush(); stopMission(); const was = R.mode; R.last = was === 'free' ? 'free' : R.course ? 'course' : 'single'; R.mode = 'bill'; G.onTick = null; G.interact = null;
  ui.objectives(null); ui.prompt(null); ui.hint(null); fx.clearFx();
  const nagSum = G.nags * 100000, total = Math.round(G.money + nagSum), r0 = rankOf(S.total);
  S.total += total; if (R.last === 'course') S.best = Math.max(S.best, total); S.runs++;
  for (const k in G.counts) S.counts[k] = (S.counts[k] || 0) + G.counts[k].n;
  save();
  const r1 = rankOf(S.total);
  ui.bill({ company: R.co.name, who: ui.charName(S.char), counts: G.counts, nags: G.nags, nagSum, total, maxCombo: G.maxCombo, sec: Math.round((Date.now() - R.t0) / 1000), promo: r1 > r0 ? RANKS[r1] : null });
}
export function again() { if (R.last === 'free') startFree(); else if (R.last === 'course') startCourse(); else startSingle(R.list[0]); }
void find; void TAG; void hidePlayer; void MISSION_IDS;
