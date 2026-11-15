import { G, rand, pick } from './state.js';
import { S, save, copy, rankOf, RANKS } from './save.js';
import { buildOffice, buildExterior, find, restock, setWallClock, elev } from './world.js';
import { later, slow, explode, shove, breakProp, settleFrags, setScreen } from './engine.js';
import { P, I, CAM, spawnPlayer, updatePlayer, sit, standUp, setFace, camHold, camGlide, placeAt, throwCarry } from './player.js';
import { MISSIONS, MS, startMission, stopMission, tickMission, missionHud } from './missions.js';
import { SETS, COMMON } from './data/lines.js';
import { setTime } from './gfx.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { say, hush } from './voice.js';
import { music } from './music.js';

export const R = { mode: 'title' };
const timers = [];
const after = (ms, fn) => timers.push(setTimeout(fn, ms));
function clearTimers() { timers.splice(0).forEach(clearTimeout); }
export function fmtClock(min) { min = Math.floor(min) % 1440; const h = min / 60 | 0, m = String(min % 60).padStart(2, '0'), tag = h < 12 ? '오전' : h < 13 ? '낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤'; return `${tag} ${h % 12 || 12}:${m}`; }
const SLOTS = ['출근', '오전', '점심', '오후', '퇴근'];
const MY = ['myDesk', 'myMonitor', 'myKeyboard', 'myPc', 'myChair'];
const ORD = ['', '', '두', '세', '네', '다섯', '여섯', '일곱', '여덟'];
const baseMusic = sky => sky === 'night' ? 'night' : 'office';

export function title() {
  clearTimers(); hush(); stopMission(); R.mode = 'title'; ui.fade(false, true); ui.band(null); ui.keysHint(false);
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI);
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: 1.3, z: 4.9 }, r: 4.4, h: 1.75, base: Math.PI, sway: .45, t: 0 });
  G.onTick = () => { P.t++; }; G.paused = false; G.rage = 0; G.interact = null; G.lookAt = null; ui.showTitle(); setFace('normal');
  music('office');
}
export function preview(close) {
  if (R.mode !== 'title') return;
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI);
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: close ? .75 : 1.3, z: 4.9 }, r: close ? 2.7 : 4.4, h: close ? 1.6 : 1.75, base: Math.PI, sway: close ? .7 : .45 });
}

function reset() { clearTimers(); hush(); ui.keysHint(false); Object.assign(G, { money: 0, counts: {}, nags: 0, maxCombo: 0, combo: 0, rage: 0, stress: 30, stressMax: 30, restocked: {}, clock: 0 }); R.t0 = Date.now(); R.co = copy(S.company); R.built = false; P.cheer = false; }
function pickAlt(a, key) { const v = S[key] && a.includes(S[key]) ? a.find(x => x !== S[key]) : pick(a); S[key] = v; return v; }
// 출근하기: 출근 → 오전 → 점심 → 오후 → 야근(사직서) → 건물 붕괴 → 청구서
export function startCourse() {
  reset(); R.mode = 'run'; R.course = true; ui.only(null);
  const am = pickAlt(['meeting', 'report'], 'lastAm'), pm = pickAlt(['printer', 'overtime'], 'lastPm'); save();
  R.list = [...(S.skipArrive ? [] : ['arrive']), am, 'lunch', pm, 'resign']; R.i = 0; G.dayList = R.list;
  if (R.list[0] === 'arrive') prologue(); else goMission();
}
export function startSingle(id) { reset(); R.mode = 'run'; R.course = false; R.list = [id]; R.i = 0; G.dayList = R.list; ui.only(null); goMission(); }

// 회사 앞: 걸어 들어가는 뒷모습과 간판
function prologue() {
  ui.hudShow(false); ui.objectives(null); ui.band(null); ui.fade(false, true);
  buildExterior(R.co, 'morning'); spawnPlayer(S.char, 1.0, 16, Math.PI); P.auto = { x: .2, z: 5.4, spd: 1.45 };
  camHold([4.6, 1.8, 21.5], [0, 6.3, 0]); camGlide([3.2, 2.1, 15.5], [0, 7.4, 0]);
  G.onTick = dt => updatePlayer(dt); G.paused = false; music('office');
  later(40, () => say('나', '오늘도 왔다.'));
  later(230, () => goMission());
}
function goMission() {
  const id = R.list[R.i], m = MISSIONS[id];
  timeCut(fmtClock(m.clock[0] * 60 + m.clock[1]), (R.course ? SLOTS[m.slot] + ' · ' : '') + m.n, () => setup(id), () => begin(id));
}
// 시계 넘김: 검게 → 시각 → 그사이 자리 정리 → 밝게
function timeCut(time, label, onDark, onDone) {
  G.paused = true; ui.prompt(null); ui.hint(null); ui.subtitle(null); ui.fade(true); ui.fadeText(time, label);
  after(450, onDark); after(1600, () => ui.fade(false)); after(2000, () => { G.paused = false; onDone(); });
}
function restockLines(b) {
  if (!b.length) return [];
  const mine = b.filter(p => /^my(Desk|Monitor|Pc|Keyboard)$/.test(p.tag));
  if (mine.length) { const n = Math.max(...mine.map(p => G.restocked[p.tag])) + 1; return [['총무팀', '자리 또 바꿔 드렸어요.' + (n >= 3 ? ` (오늘만 ${ORD[n] || n} 번째)` : '')]]; }
  const p = b.reduce((a, q) => q.price > a.price ? q : a), n = G.restocked[p.tag] + 1;
  return [['총무팀', `${p.def.n} 새로 들여놨습니다. (오늘만 ${ORD[n] || n} 번째)`]];
}
function setup(id) {
  const m = MISSIONS[id]; let pre = [];
  stopMission(); fx.clearFxSoft(); ui.over(''); P.cheer = false;
  G.clock = m.clock[0] * 60 + m.clock[1];
  if (!R.course || !R.built) { buildOffice(R.co, m.sky); R.built = true; spawnPlayer(S.char, 0, 2, Math.PI); }
  else {
    // 사무실은 다시 짓지 않는다. 이번 상황에 꼭 필요한 것만 총무팀이 다시 들여놓는다
    settleFrags(); setTime(m.sky);
    if (P.carry) throwCarry(true); if (P.seated) standUp(); P.atk = null; P.slam = false; P.rush = P.storm = 0;
    pre = restockLines(restock([...MY, ...(m.needs || [])]).bought);
    if (m.id !== 'arrive') {
      if (G.money > 1e8) pre.push(pick([['who', '…자네, 요즘 힘든 일 있나?'], ['총무팀', '오늘 견적서만 세 장째입니다.']]));
      else if (G.money > 3e7) pre.push(pick([['who', '사무실이 왜 이 모양이야? …아무튼, 일들 해.'], ['팀장님', '(유리 조각을 피해 걸으며) 자, 그건 그렇고.'], ['총무팀', '누가 치울 거예요, 이거. 일단 일하세요.']]));
    }
  }
  setWallClock(G.clock); setScreen(find('myMonitor'), m.screen || 'work');
  m.setup && m.setup();
  if (m.place === 'elevator') { placeAt(G.elev.x, 9.95, Math.PI); elev(false); camHold([G.elev.x + 1.9, 1.5, 6.1], [G.elev.x, 1.3, 9.3]); }
  else { sit(find('myChair')); CAM.yaw = P.yaw + Math.PI; CAM.pitch = .32; camHold([3.4, 2.6, 2.7], [-.3, .8, -2.4]); }
  Object.assign(G, { rage: 0, combo: 0, mult: 1 }); P.lock = 0; P.auto = null; setFace('normal');
  R.label = m.n; R.sub = m.sub; G.onTick = playTick; G.bgmBase = baseMusic(m.sky);
  ui.hudShow(true); ui.band(R.course ? m.slot : null);
  ui.hud({ title: R.label, sub: R.sub, money: G.money, stress: G.stress, combo: 0, rage: 0, clock: fmtClock(G.clock), time: '', weapon: P.wdef ? P.wdef.n : '맨손' });
  ui.objectives(m.steps.filter(s => !s.hide).map(s => s.t), 0);
  R.pre = pre; music(G.bgmBase);
}
function begin(id) {
  startMission(MISSIONS[id], R.co, ui.charName(S.char), missionEnd, R.pre);
  if (R.i === 0 && id !== 'arrive' && !S.seenHelp) { ui.keysHint(true); after(12000, () => ui.keysHint(false)); }
  if (id === 'arrive' || R.i === 0) { S.seenHelp = true; save(); }
}
function playTick(dt) {
  updatePlayer(dt); tickMission(dt);
  if (MS.phase !== 'idle') G.clock += dt / 3;
  if (G.tick % 6 === 0) { const h = missionHud(); ui.hud({ title: R.label, sub: R.sub || '', money: G.money, stress: G.stress, combo: G.combo, rage: G.rage, clock: fmtClock(G.clock), time: h.left != null ? '자유 난동 ' + h.left + '초 · 피해액 2배' : '', weapon: P.wdef ? P.wdef.n + (P.wdur ? ' ' + P.wdur : '') : '맨손' }); promptTick(); }
  if (G.tick % 30 === 0) setWallClock(G.clock);
}
// 임무 안내가 없을 때: 집기·엎기 안내
function promptTick() {
  if (ui.promptBusy()) return; const c = P.cand;
  if (P.seated) ui.hint(null);
  else if (P.carry) ui.hint('때리기 버튼 = 던지기 · E = 내려놓기');
  else if (c && !c.dead) ui.hint(c.def.weapon ? `E  ${c.def.n} 들기` : c.def.flip ? `E 꾹  ${c.def.n} 엎기` : `E  ${c.def.n} 집어 들기`, c.def.flip ? P.eHold / .45 : 0);
  else ui.hint(null);
}
// ⑤ 숨 고르기 → 도장 → 다음 시각
function missionEnd(res) {
  const m = MISSIONS[R.list[R.i]];
  if (m.noStamp) return nextMission();
  if (res.final) return R.course ? finale() : bill();
  setFace('relief'); P.lock = 170; music(G.bgmBase);
  say('나', m.after || '…후. 일하자.');
  const g = res.stress <= 0 ? 'gold' : res.stress < 50 ? '' : 'soft';
  later(40, () => { ui.stamp(g === 'gold' ? '속이 뻥' : g === '' ? '시원' : '조금 풀림', g, m.n + ' 끝'); sfx('stamp'); G.shake = .15; });
  later(180, () => { ui.over(''); nextMission(); });
}
function nextMission() { if (R.i < R.list.length - 1) { R.i++; goMission(); } else bill(); }

function finale() {
  R.mode = 'finale'; ui.keysHint(false); ui.objectives(null); ui.prompt(null); ui.hint(null); ui.band(null);
  buildExterior(R.co, 'evening'); spawnPlayer(S.char, 0, 13, Math.PI); P.active = true;
  camHold([5, 3.4, 21], [0, 6, 0]);
  R.fin = { press: 0, t: 0, done: false, pa: false };
  ui.mash(G.mobile ? '연타! (때리기)' : '연타! (Z · 클릭)'); music('win');
  G.onTick = dt => {
    const f = R.fin; f.t++; P.t++;
    if (P.atk) { P.atk.t += dt / P.atk.dur; if (P.atk.t >= 1) P.atk = null; }
    const press = (I.a && !f.pa) || I.tap || (G.auto && f.t % 12 === 0); f.pa = I.a; I.tap = false;
    if (f.t % 6 === 0) ui.hud({ title: '피날레', sub: R.co.name + ' 통째로', money: G.money, stress: G.stress, combo: G.combo, rage: 0, time: '', clock: '밤 11:30', weapon: '' });
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
  after(2800, () => { ui.big(R.co.name + ' 뿌셨다!'); sfx('up'); P.atk = null; P.cheer = true; setFace('relief'); });
  after(5400, () => ui.big(R.co.name + ' 뿌셨다!', '…는 상상. 내일도 출근이지만, 오늘은 속 시원하게 퇴근!'));
  after(8600, () => { P.cheer = false; bill(); });
}

// 자유 난동: 사무실 한 층 전체, 시간 제한 없음
export function startFree() {
  reset(); R.mode = 'free'; R.course = false; ui.only(null); ui.hudShow(true); ui.band(null);
  const sky = pick(['day', 'evening', 'night']); buildOffice(R.co, sky); spawnPlayer(S.char, 0, 5, Math.PI);
  R.label = '자유 난동'; G.paused = false; G.mult = 1; G.clock = sky === 'night' ? 23 * 60 : sky === 'evening' ? 18 * 60 : 15 * 60;
  ui.objectives(['회사 전체를 마음껏 부수세요', '무기: 방망이(복사실) · 골프채(부장실) · 오함마(로비)', '책상·탁자·캐비닛은 E 꾹 눌러 엎기', '끝내려면 일시정지 → 청구서'], -1);
  const lines = [...COMMON]; R.co.sets.forEach(k => SETS[k] && lines.push(...SETS[k].l)); R.co.myLines.forEach(s => s.trim() && lines.push(s.trim()));
  G.onTick = dt => {
    updatePlayer(dt);
    if (G.tick % 6 === 0) { ui.hud({ title: R.label, sub: R.co.name, money: G.money, stress: null, combo: G.combo, rage: G.rage, time: '시간 제한 없음', clock: '', weapon: P.wdef ? P.wdef.n + (P.wdur ? ' ' + P.wdur : '') : '맨손' }); promptTick(); }
    if (G.tick % 620 === 300) say(R.co.who, pick(lines).replace('{who}: ', '').replace('{who}', R.co.who));
    if (G.tick % 900 === 450) { const ph = G.props.filter(p => p.type === 'phone' && !p.dead); if (ph.length) { const p = pick(ph); sfx('ring'); p.punch = 10; fx.text({ x: p.body.position.x, y: p.body.position.y + .4, z: p.body.position.z }, '따르릉!', 'note'); } }
  };
  ui.keysHint(true); after(12000, () => ui.keysHint(false)); music('rage');
}

export function bill() {
  clearTimers(); hush(); stopMission(); const was = R.mode; R.last = was === 'free' ? 'free' : R.course ? 'course' : 'single'; R.mode = 'bill'; G.onTick = null; G.interact = null;
  ui.objectives(null); ui.prompt(null); ui.hint(null); ui.band(null); fx.clearFxSoft();
  const nagSum = G.nags * 100000, total = Math.round(G.money + nagSum), r0 = rankOf(S.total);
  S.total += total; if (R.last === 'course') S.best = Math.max(S.best, total); S.runs++;
  for (const k in G.counts) S.counts[k] = (S.counts[k] || 0) + G.counts[k].n;
  save();
  const r1 = rankOf(S.total);
  ui.bill({ company: R.co.name, who: ui.charName(S.char), counts: G.counts, nags: G.nags, nagSum, total, maxCombo: G.maxCombo, sec: Math.round((Date.now() - R.t0) / 1000), promo: r1 > r0 ? RANKS[r1] : null, stressMax: was === 'free' ? null : G.stressMax, stressEnd: G.stress });
  music('win');
}
export function again() { if (R.last === 'free') startFree(); else if (R.last === 'course') startCourse(); else startSingle(R.list[0]); }
void sit; void standUp;
