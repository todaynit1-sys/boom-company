import { G, rand, pick, won } from './state.js';
import { S, save, copy, rankOf, RANKS } from './save.js';
import { buildOffice, buildExterior, find, restock, setWallClock, elev, snapshotFloor, applyFloor, EX } from './world.js';
import { later, slow, explode, shove, breakProp, settleFrags, setScreen, spawn } from './engine.js';
import { P, I, CAM, spawnPlayer, updatePlayer, sit, standUp, setFace, camHold, camGlide, camTo, placeAt, throwCarry, equip, carry } from './player.js';
import * as PL from './player.js';
import { FLOORS, FLOOR_IDS, FLOOR_LINES, FLOOR_GREET, BOSS_LINES, BOSS_PHASE, buildFloor, floorName, floorLv, floorLocked, lockText, isCleared, clearedN, CLEAR_AT, NEED_CLEAR } from './floors.js';
import { tickToys, resetToys, TOY } from './toys.js';
import { spawnPeople } from './people.js';
// 보스전 함수(spawnBoss·foesLeft)는 아직 없을 수도 있어서 이름표로만 찾는다
import * as PE from './people.js';
import { MISSIONS, MS, startMission, stopMission, tickMission, missionHud, rebind } from './missions.js';
import { SETS, COMMON } from './data/lines.js';
import { setTime, THREE } from './gfx.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { say, hush } from './voice.js';
import { music } from './music.js';

export const R = { mode: 'title' };
// 예전 저장: 도전과제를 이미 4개 이상 해 둔 층은 정복으로 쳐 준다
try { if (S.done) { S.cleared = S.cleared || {}; let ch = false; for (const fid of FLOOR_IDS) { if (S.cleared[fid]) continue; const n = (FLOORS[fid].goals || []).filter(g => S.done[g.id]).length; if (n >= CLEAR_AT) { S.cleared[fid] = true; ch = true; } } if (ch) save(); } } catch (e) { }
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
  G.toys = false; G.emit = null; resetToys(); ui.elev(null); ui.alarm(false); R.panel = false; endCombat(); ui.ko(false); R.intro = false;
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI); if (P.ko) heal();
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: 1.3, z: 4.9 }, r: 4.4, h: 1.75, base: Math.PI, sway: .45, t: 0 });
  G.onTick = () => { P.t++; }; G.paused = false; G.rage = 0; G.interact = null; G.lookAt = null; ui.showTitle(); setFace('normal');
  music('office');
}
export function preview(close) {
  if (R.mode !== 'title') return;
  buildOffice(S.company, 'day'); spawnPlayer(S.char, 3.0, 4.5, Math.PI);
  Object.assign(CAM, { mode: 'orbit', center: { x: 3.0, y: close ? .75 : 1.3, z: 4.9 }, r: close ? 2.7 : 4.4, h: close ? 1.6 : 1.75, base: Math.PI, sway: close ? .7 : .45 });
}

export function reset() {
  clearTimers(); hush(); ui.keysHint(false); Object.assign(G, { money: 0, counts: {}, nags: 0, maxCombo: 0, combo: 0, rage: 0, stress: 30, stressMax: 30, restocked: {}, clock: 0, toys: false, emit: null, onAlarm: null, combat: false, onPlayerKO: null });
  R.t0 = Date.now(); R.co = copy(S.company); R.built = false; P.cheer = false; R.got = null; R.panel = false; resetToys(); ui.elev(null); ui.alarm(false); ui.over('');
  R.cfloor = 'office'; R.csnap = {}; R.cwet = {}; R.rush = null; R.isRush = false; R.mi = 0;
  R.fight = null; R.bossBeat = false; R.fights = 0; R.intro = false; R.prev = null; ui.combat(null); ui.ko(false); ui.bonusHud(null);
  if (P.ko) heal();
  // 휴대폰을 세로로 들고 있으면 한 번만 알려 준다
  if (G.mobile && innerHeight > innerWidth && !R.rotTold) { R.rotTold = true; after(2600, () => ui.toast('휴대폰을 가로로 돌리면 더 넓게 보여요')); }
}
// 지난번과 다른 것 중에서 고른다
function pickAlt(a, key) { const others = a.filter(x => x !== S[key]), v = pick(others.length ? others : a); S[key] = v; return v; }
// 출근하기: 출근 → 오전 → 점심 → 오후 → 야근(사직서) → 건물 붕괴 → 청구서
export function startCourse() {
  reset(); R.mode = 'run'; R.course = true; ui.only(null);
  // 오전 = 회의·보고서·12층 임원 보고, 점심 = 탕비실·1층 카페, 오후 = 복합기·퇴근 5분 전·B2 사장님 차
  const am = pickAlt(['meeting', 'report', 'exec', 'assembly'], 'lastAm'), lu = pickAlt(['lunch', 'cafe', 'rooftop'], 'lastLunch'), pm = pickAlt(['printer', 'overtime', 'valet', 'party'], 'lastPm'); save();
  R.list = [...(S.skipArrive ? [] : ['arrive']), am, lu, pm, 'resign']; R.i = 0; G.dayList = R.list;
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
  stopMission(); fx.clearFxSoft(); ui.over(''); P.cheer = false; G.toys = false;
  G.clock = m.clock[0] * 60 + m.clock[1];
  if (!R.course || !R.built) { buildOffice(R.co, m.sky); R.built = true; R.cfloor = 'office'; R.csnap = {}; R.cwet = {}; resetToys(); spawnPlayer(S.char, 0, 2, Math.PI); spawnPeople('office', [[0, 2, 3.5], [EX, 8.5, 3.5]]); }
  else {
    // 다른 층에서 끝났으면 우리 층으로 돌아온다(그 층은 부순 채로 기억해 둔다)
    if (R.cfloor !== 'office') courseFloor('office', m.sky);
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
// ───── 상황 중 층 옮기기: 지금 층을 기억해 두고 다른 층을 지은 뒤(전에 왔던 층이면 부순 채로) 엘리베이터에서 걸어 나온다
function courseFloor(to, sky) {
  const keep = { weapon: P.weapon, wdur: P.wdur, fuel: P.fuel }, mult = G.mult;
  if (P.carry && P.carry !== true) throwCarry(true);
  R.csnap[R.cfloor] = snapshotFloor(); R.cwet[R.cfloor] = TOY.wet; resetToys();
  if (to === 'office') buildOffice(R.co, sky); else buildFloor(to, R.co, sky);
  applyFloor(R.csnap[to]); TOY.wet = !!R.cwet[to]; R.cfloor = to; G.mult = mult;
  spawnPlayer(S.char, EX, 9.95, Math.PI); spawnPeople(to, [[EX, 8.5, 3.5]]);
  if (keep.weapon) { equip(keep.weapon, { fuel: keep.fuel }); P.wdur = keep.wdur; }
  G.onTick = playTick; rebind();
}
G.rideTo = (to, done) => {
  const m = MISSIONS[R.list[R.i]];
  P.lock = 9999; P.auto = null; elev(false); sfx('ding');
  after(650, () => timeCut(floorLv(to), FLOORS[to].n, () => { courseFloor(to, m ? m.sky : 'day'); P.lock = 9999; camHold([EX + 2.3, 1.75, 4.9], [EX, 1.15, 9.2]); },
    () => { P.lock = 0; elev(true); sfx('ding'); P.auto = { x: EX, z: 6.8, spd: 1.8 }; after(1500, () => { if (R.mode === 'run' && CAM.mode === 'hold') camTo('follow', .7); }); done(); }));
};
function begin(id) {
  startMission(MISSIONS[id], R.co, ui.charName(S.char), missionEnd, R.pre);
  if (R.i === 0 && id !== 'arrive' && !S.seenHelp) { ui.keysHint(true); after(12000, () => ui.keysHint(false)); }
  if (id === 'arrive' || R.i === 0) { S.seenHelp = true; save(); }
}
// 피해액이 큰 고비를 넘을 때마다 알려 준다
const MILES = [1e7, 5e7, 1e8, 3e8, 5e8, 1e9, 3e9];
function miles() { while (G.money >= MILES[R.mi || 0]) { const v = MILES[R.mi || 0]; R.mi = (R.mi || 0) + 1; ui.toast('피해액 ' + (v >= 1e8 ? v / 1e8 + '억' : v / 1e4 + '만') + ' 원 돌파!'); sfx('up'); G.flash = Math.max(G.flash, 3); } }
function playTick(dt) {
  updatePlayer(dt); tickToys(dt); tickMission(dt); if (G.tick % 12 === 0) miles();
  if (MS.phase !== 'idle') G.clock += dt / 3;
  if (G.tick % 6 === 0) { const h = missionHud(); ui.hud({ title: R.label, sub: R.sub || '', money: G.money, stress: G.stress, combo: G.combo, rage: G.rage, clock: fmtClock(G.clock), time: h.left != null ? '자유 난동 ' + h.left + '초 · 피해액 2배' : '', weapon: weaponLabel() }); promptTick(); }
  if (G.tick % 30 === 0) setWallClock(G.clock);
}
// 임무 안내가 없을 때: 집기·엎기·타기·뿜기 안내
const RIDE_HINT = {
  pc: { chair: 'WASD 굴러가기 · 좌클릭 = 발 구르기 돌진 · 스페이스·E = 내리기', cart: 'WASD 밀기 · 좌클릭 = 힘껏 밀기 · E = 놓기', fork: 'W·S 앞뒤 · A·D 방향 · 좌클릭 = 포크 올리기 · 우클릭 = 내리기 · E = 내리기' },
  mo: { chair: '조이스틱 = 굴러가기 · 때리기 = 발 구르기 · 점프 = 내리기', cart: '조이스틱 = 밀기 · 때리기 = 힘껏 밀기 · 행동 = 놓기', fork: '조이스틱 = 운전 · 때리기 = 포크 올리기 · 강타 = 내리기 · 행동 = 내리기' },
};
export function promptTick() {
  if (ui.promptBusy()) return; const c = P.cand;
  if (P.ride) return ui.hint(RIDE_HINT[G.mobile ? 'mo' : 'pc'][P.ride.kind]);
  if (P.wdef && P.wdef.spray && !P.carry) return ui.hint(G.mobile ? '[때리기] 꾹 = 뿜기 · 아래를 보고 뿜으면 날아요' : '좌클릭 꾹 = 뿜기 · 아래를 보고 뿜으면 날아요', Math.max(.002, P.fuel / 100));
  if (P.seated) ui.hint(null);
  else if (P.carry) ui.hint('때리기 버튼 = 던지기 · E = 내려놓기');
  else if (P.grab) ui.hint(G.mobile ? '[때리기]·[강타] = 사람 던지기 · [행동] = 내려놓기' : '좌클릭·우클릭 = 사람 던지기 · E = 내려놓기');
  else if (P.pcand && !(c && !c.dead)) ui.hint((G.mobile ? '[행동]  ' : 'E  ') + ((P.pcand.d && P.pcand.d.n) || '사람') + ' 들어 올리기');
  else if (c && !c.dead) {
    const d = c.def, ride = d.ride && G.toys, chair = ride && d.grab !== false;
    const t = d.use ? `E  ${d.useN}` : ride && !chair ? `E  ${d.n} 타기` : chair ? (G.mobile ? `[행동] 집기 · 꾹 = ${d.n} 타기` : `E 집기 · E 꾹 = ${d.n} 타기`) : d.weapon ? `E  ${d.n} 들기` : d.flip ? `E 꾹  ${d.n} 엎기` : `E  ${d.n} 집어 들기`;
    ui.hint(t, d.flip ? P.eHold / .45 : chair ? P.eHold / .35 : 0);
  }
  else ui.hint(P.wdef && P.wdef.shout ? (G.mobile ? '[때리기] = 확성기로 외치기' : '좌클릭 = 확성기로 외치기') : null);
}
export const weaponLabel = () => P.ride ? { chair: '바퀴의자', cart: '택배 카트', fork: '지게차' }[P.ride.kind] : P.wdef ? P.wdef.n + (P.wdef.spray ? ' ' + Math.max(0, Math.ceil(P.fuel)) + '%' : P.wdur ? ' ' + P.wdur : '') : '맨손';
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

// ───── 자유 난동: 고른 층에서 시작해 엘리베이터로 건물 전체를 오간다. 부순 건 층마다 그대로 남는다
export function startFree(floor = 'office', opt = {}) {
  // 12층은 다른 층 3곳을 정복해야 열린다
  if (!FLOORS[floor] || floorLocked(floor)) floor = 'office';
  reset(); R.mode = 'free'; R.course = false; R.isRush = !!opt.rush; ui.only(null); ui.hudShow(true); ui.band(null);
  G.toys = true; G.paused = false; G.mult = 1;
  R.sky = pick(['day', 'evening', 'night']); R.floor = R.startFloor = floor; R.snap = {}; R.wet = {}; R.ev = {}; R.got = new Set(); R.visited = new Set([floor]); R.moving = false;
  G.clock = R.sky === 'night' ? 23 * 60 : R.sky === 'evening' ? 18 * 60 : 15 * 60;
  R.lines = [...COMMON]; R.co.sets.forEach(k => SETS[k] && R.lines.push(...SETS[k].l)); R.co.myLines.forEach(s => s.trim() && R.lines.push(s.trim()));
  enterFloor(floor); arrive();
  ui.keysHint(true); after(12000, () => ui.keysHint(false)); if (!R.fight) music('rage');
  // 보스전으로 시작하면 안내 한 줄은 띄우지 않는다(보스 체력 막대와 겹친다)
  if (!R.fight) ui.tips(G.mobile
    ? ['엘리베이터 안에 들어서면 다른 층 버튼이 나와요', '의자: 행동 꾹 = 올라타기 · 카트·지게차: 행동 = 타기', '소화기를 들고 때리기 꾹 — 아래를 보고 뿜으면 날아요', '빨간 비상벨을 누르면 스프링클러가 터져요', '벽도 부서져요 — 발차기나 무기로 뚫고 지나가 보세요', '잔소리하는 부장님, 이제 때려도 됩니다']
    : ['엘리베이터 안에 들어서면 층 버튼이 나와요 (숫자 키로도)', '의자: <b>E</b> 꾹 = 올라타기 · 카트·지게차: <b>E</b> = 타기', '소화기를 들고 <b>좌클릭</b> 꾹 — 아래를 보고 뿜으면 날아요', '빨간 비상벨을 누르면 스프링클러가 터져요', '벽도 부서져요 — 발차기나 무기로 뚫고 지나가 보세요', '잔소리하는 부장님, 이제 때려도 됩니다']);
}
// 도착: 문이 열리고, 홀 쪽에서 본 카메라 앞으로 걸어 나온 뒤 등 뒤 시점으로
function arrive() {
  if (R.fight && !R.fight.started) return bossIntro();
  elev(true); sfx('ding'); P.auto = { x: EX, z: 6.7, spd: 1.8 };
  camHold([EX + 2.3, 1.75, 4.9], [EX, 1.15, 9.2]);
  after(1600, () => { if (R.mode === 'free' && !R.moving) camTo('follow', .7); });
}
// 쓰러졌거나 다쳤으면 층을 옮길 때 다시 일으킨다(체력 기능이 없으면 그냥 넘어간다)
function heal() { if (typeof PL.healPlayer === 'function') { try { PL.healPlayer(); } catch (e) { console.error(e); } } }
function enterFloor(id) {
  buildFloor(id, R.co, R.sky); applyFloor(R.snap[id]); resetToys(!!R.wet[id]);
  spawnPlayer(S.char, EX, 9.95, Math.PI);
  if (P.ko || (typeof P.hp === 'number' && P.hp < (P.maxHp || 100))) heal();
  // 12층(자유 난동, 1분 난동은 빼고): 사장님 보스전. 이긴 뒤에 다시 오면 조용하다
  G.combat = false; G.onPlayerKO = null; R.fight = null; R.intro = false; ui.combat(null);
  const fight = id === 'exec' && R.mode === 'free' && !R.isRush && !R.bossBeat && typeof PE.spawnBoss === 'function';
  if (fight) {
    try { PE.spawnBoss(); R.fight = { started: false, won: false, ko: false, n: ++R.fights, phase: 1, seen: false, t0: G.tick }; }
    catch (e) { console.error(e); R.fight = null; spawnPeople(id, [[EX, 8.5, 3.5]]); }
  } else if (!(id === 'exec' && R.bossBeat)) spawnPeople(id, [[EX, 8.5, 3.5]]);
  camHold([EX + 2.3, 1.75, 4.9], [EX, 1.15, 9.2]);
  R.label = floorName(id) + (R.fight ? ' · 보스전' : ''); R.cabArm = false; R.panel = false; ui.elev(null);
  G.emit = track; G.onAlarm = on => ui.alarm(on);
  G.onBreak = p => { track('break:' + p.type); if (p.tag) track('tag:' + p.tag); };
  G.onOut = p => { track('out'); track('out:' + p.type); if (p.tag) track('outtag:' + p.tag); };
  G.onTick = freeTick; goalsHud();
  const gr = FLOOR_GREET[id]; if (gr && !R.fight && !(id === 'exec' && R.bossBeat)) after(2600, () => { if (R.mode === 'free' && R.floor === id) say(gr[0].replace('{who}', R.co.who), gr[1]); });
}
const elevFloors = () => FLOOR_IDS.map(id => ({ id, lv: FLOORS[id].lv, n: FLOORS[id].n, lock: floorLocked(id) ? lockText() : null, done: isCleared(id) }));
function freeTick(dt) {
  updatePlayer(dt); tickToys(dt); if (G.tick % 12 === 0) miles();
  if (G.tick % 6 === 0) { ui.hud({ title: R.label, sub: R.co.name, money: G.money, stress: null, combo: G.combo, rage: G.rage, time: R.rush != null ? '남은 시간 ' + Math.ceil(R.rush / 60) + '초' + (R.rush < 900 ? ' · 막판 2배!' : '') : '시간 제한 없음', clock: '', weapon: weaponLabel() }); promptTick(); }
  // 1분 난동: 60초 동안 얼마나 부수나. 마지막 15초는 피해액 2배
  if (R.rush != null && !R.moving) { R.rush--; if (R.rush === 900) { G.mult = 2; ui.big('막판 15초!', '피해액 2배'); later(70, () => ui.over('')); sfx('special'); } if (R.rush <= 0) { R.rush = null; sfx('ding'); return bill(); } }
  // 엘리베이터: 다가가면 문이 열리고, 안에 들어서면 층 버튼(도착한 칸에서 한 번 나갔다 와야 뜬다). 보스 등장 장면·퇴사 처리 중에는 닫아 둔다
  if (!R.moving && !R.intro && !(R.fight && R.fight.ko) && G.elev && P.active) {
    const pp = P.body.position, inCab = Math.abs(pp.x - G.elev.x) < .75 && pp.z > 9.3, near = Math.hypot(pp.x - G.elev.x, pp.z - 9.1) < 2.6;
    if (pp.z < 8.4) R.cabArm = true;
    elev(near || inCab);
    const show = inCab && R.cabArm && !P.ride;
    if (show !== R.panel) { R.panel = show; ui.elev(show ? { cur: R.floor, floors: elevFloors() } : null); }
  }
  // 층마다 들리는 소리: 우리 팀은 회사 설정의 잔소리, 다른 층은 그 층 사람·방송. 보스전 중에는 싸움 대사
  if (G.tick % 620 === 300 && !R.intro && !(R.floor === 'exec' && R.bossBeat)) { const fl = G.combat ? BOSS_LINES : FLOOR_LINES[R.floor]; if (fl) { const [w, t] = pick(fl); say(w.replace('{who}', R.co.who), t); } else say(R.co.who, pick(R.lines).replace('{who}: ', '').replace('{who}', R.co.who)); }
  if (G.tick % 900 === 450) { const ph = G.props.filter(p => p.type === 'phone' && !p.dead); if (ph.length) { const p = pick(ph); sfx('ring'); p.punch = 10; fx.text({ x: p.body.position.x, y: p.body.position.y + .4, z: p.body.position.z }, '따르릉!', 'note'); } }
  if (R.fight) fightTick();
}

// ───── 12층 보스전: 사장님 + 비서 2 + 경호원 2. 사람 쪽(people.js)이 적을 움직이고, 여기서는 시작·체력 표시·승패를 맡는다
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const bossName = () => (G.boss && G.boss.name) || '사장님';
const foes = () => { if (typeof PE.foesLeft !== 'function') return null; try { return PE.foesLeft(); } catch (e) { return null; } };
// 사장님이 서 있는 자리(못 찾으면 null)
function bossAt() {
  const b = G.boss, L = (G.people && G.people.list) || [];
  const n = (b && (b.n || b.npc)) || L.find(q => q.boss || q.isBoss || q.role === 'boss') || L.find(q => q.id === 'sajang') || L[0];
  const bp = (b && b.body && b.body.position) || (n && n.body && n.body.position);
  return bp ? { x: bp.x, z: bp.z } : null;
}
// 등장: 엘리베이터 문이 닫힌 채 사장님을 비추고 자막 → 문이 열리면 싸움 시작
function bossIntro() {
  const f = R.fight; f.started = true; R.intro = true;
  const short = f.n > 1, ok = () => R.mode === 'free' && R.fight === f && R.floor === 'exec';
  elev(false); P.lock = 9999; P.auto = null; ui.clearTips(); music('rage'); R.panel = false; ui.elev(null);
  camHold([EX + 2.3, 1.75, 4.9], [EX, 1.15, 9.2]);
  const lines = short ? [[300, '사장님', pick(['또 왔어?', '아직도 안 나갔나?', '이번엔 안 봐준다!'])]]
    : [[700, '사장님', '감히 여기까지 올라와?'], [2500, '비서', '사장님, 인사팀 부를까요?'], [4100, '사장님', '경호원! 저 친구 내보내!']];
  after(short ? 150 : 400, () => {
    if (!ok()) return; const b = bossAt();
    if (b) { let dx = EX - b.x, dz = 8 - b.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; camTo({ pos: V3(b.x + dx * 2.4, 1.75, b.z + dz * 2.4), look: V3(b.x, 1.4, b.z) }, .9); }
    else camTo({ pos: V3(EX + 1.2, 2.7, 7.4), look: V3(-7, 1.2, -4) }, .9);
    ui.big(short ? '다시 보스전' : '보스전', short ? '이번엔 끝장을 본다' : '12층 임원층 · ' + bossName()); sfx('special'); G.shake = Math.max(G.shake, .25); buzz(40);
  });
  for (const [t, w, s] of lines) after(t, () => { if (ok()) say(w, s); });
  after(short ? 2100 : 5600, () => {
    if (!ok()) return; R.intro = false; ui.over('');
    camHold([EX + 2.3, 1.75, 4.9], [EX, 1.15, 9.2]); elev(true); sfx('ding'); P.lock = 0; P.auto = { x: EX, z: 6.7, spd: 1.8 };
    G.combat = true; G.onPlayerKO = playerKO; f.t0 = G.tick; combatHud(); ui.toast('보스를 쓰러뜨리세요! 맞으면 체력이 줄어요');
    after(1500, () => { if (ok() && !R.moving) camTo('follow', .7); });
  });
}
function combatHud() {
  if (!R.fight || !G.combat) return;
  const b = G.boss;
  ui.combat({ hp: P.hp, maxHp: P.maxHp || 100, boss: b ? { name: b.name || '사장님', hp: b.hp, maxHp: b.maxHp, phase: b.phase } : null, left: foes() });
}
function fightTick() {
  const f = R.fight; if (!f || f.won || f.ko || !G.combat) return;
  const left = foes(), b = G.boss; if (left > 0) f.seen = true;
  // 사장님이 단계를 바꿀 때 한마디
  if (b && b.phase && b.phase !== f.phase) { f.phase = b.phase; const l = BOSS_PHASE[b.phase]; if (l) say(l[0], l[1]); G.shake = Math.max(G.shake, .2); sfx('special', .6); }
  if ((b && b.alive === false) || (!b && f.seen && left === 0)) return bossWin();
  if (P.ko === true && G.tick - f.t0 > 30) return playerKO();
  if (G.tick % 6 === 0) combatHud();
}
export function endCombat() { G.combat = false; G.onPlayerKO = null; R.fight = null; R.intro = false; ui.combat(null); }
// 쓰러짐: 느리게 → 「퇴사 처리…」 → 다시 도전 / 나가기
function playerKO() {
  const f = R.fight; if (f && !f.won && !f.ko && G.boss && G.boss.alive === false) return bossWin();
  if (!f || f.ko || f.won || R.mode !== 'free') return;
  f.ko = true; G.combat = false; G.onPlayerKO = null; R.panel = false; ui.elev(null);
  P.lock = 9999; if (P.ride) P.ride = null;
  if (!G.calm) slow(.25, 120); G.flash = 7; G.shake = Math.max(G.shake, .5); sfx('boom'); sfx('stamp', .8); buzz([60, 40, 140]);
  if (P.active) { const pp = P.body.position; camTo({ pos: V3(pp.x + 1.7, 2.5, pp.z + 2.1), look: V3(pp.x, .5, pp.z) }, 1.4); }
  ui.combat(null); ui.big('퇴사 처리…'); music('night');
  after(2300, () => {
    if (R.fight !== f || R.mode !== 'free') return; ui.over('');
    const b = G.boss, pct = b && b.maxHp ? Math.max(0, Math.ceil(b.hp / b.maxHp * 100)) : null;
    const sub = (pct != null ? `${bossName()} 체력 ${pct}% 남았어요. ` : '') + pick(['사장실 골프채를 들고 가 보세요.', '경호원부터 쓰러뜨리면 편해요.', '필살기는 아껴 두었다가 사장님에게!', '소화기로 날아올라 내려찍어 보세요.', '로비의 오함마도 엘리베이터로 가져올 수 있어요.']);
    ui.ko(true, { sub, retry: retryFight, leave: leaveFight });
  });
}
// 다시 도전: 12층을 새로 짓고 체력을 채워 다시 싸운다
function retryFight() {
  ui.ko(false); P.lock = 9999; music('rage');
  timeCut('12층', '다시 도전', () => { R.snap.exec = null; R.wet.exec = false; enterFloor('exec'); P.lock = 9999; heal(); }, () => { P.lock = 0; arrive(); });
}
// 나가기: 오기 전 층(없으면 7층)으로
function leaveFight() {
  ui.ko(false); endCombat(); heal(); P.lock = 0; if (P.ride) P.ride = null; music('rage');
  goFloor(R.prev && R.prev !== 'exec' && !floorLocked(R.prev) ? R.prev : 'office');
}
// 사장 퇴치: 축하 → 보상 1억 → 층은 그대로 자유롭게
function bossWin() {
  const f = R.fight; if (!f || f.won || f.ko) return;
  if (P.ko) heal();
  f.won = true; R.bossBeat = true; G.combat = false; G.onPlayerKO = null; R.intro = false; R.label = floorName('exec') + ' · 사장 퇴치';
  const gain = 1e8, c = G.counts.boss || (G.counts.boss = { n: 0, sum: 0, name: '사장 퇴치 보상' });
  G.money += gain; c.n++; c.sum += gain; S.bossWins = (S.bossWins || 0) + 1; save();
  if (!G.calm) slow(.3, 100); G.flash = 8; G.shake = Math.max(G.shake, .6); sfx('special'); sfx('boom', .8); later(20, () => sfx('up')); buzz([80, 40, 160]);
  ui.combat(null); ui.big('사장 퇴치!', '보상 +' + won(gain) + ' · 12층은 이제 내 세상'); music('win');
  P.cheer = true; setFace('relief');
  const C = ['#ff5c8a', '#ffd84d', '#2f6bff', '#2a8a45', '#ffffff'];
  for (let i = 0; i < 7; i++) later(4 + i * 14, () => { if (!P.active) return; const pp = P.body.position, q = { x: pp.x + rand(-2.5, 2.5), y: 2.5, z: pp.z + rand(-2.5, 2.5) }; C.forEach(col => fx.bitsAt(q, 14, col, 3.5, 3)); fx.sheet(q, 10, '#9fd69a', 4.5); if (i % 2 === 0) sfx('pop', .8); });
  if (P.active) { const pp = P.body.position; fx.text({ x: pp.x, y: pp.y + 2.4, z: pp.z }, '+' + won(gain), 'money'); }
  after(4800, () => { if (R.fight !== f || R.mode !== 'free') return; ui.over(''); P.cheer = false; setFace('normal'); music('rage'); ui.toast('남은 사람들은 얌전해졌어요. 12층을 마음껏!'); });
}

// 층 바꾸기: 문 닫힘 → 층 숫자 → 그 층을 다시 짓고(부순 기록을 입혀) → 문 열림. 든 무기·물건은 같이 간다
export function goFloor(id) {
  if (R.mode !== 'free' || R.moving || R.intro || !FLOORS[id] || id === R.floor || P.ride || (R.fight && R.fight.ko)) return;
  if (floorLocked(id)) { ui.toast('12층은 잠겨 있어요 · ' + lockText()); sfx('beep'); return; }
  // 싸우다 엘리베이터로 빠져나가면 보스전은 끝(다시 오면 처음부터)
  if (R.fight) endCombat();
  R.prev = R.floor; R.moving = true; R.panel = false; ui.elev(null); elev(false); sfx('ding'); P.lock = 9999;
  const keep = { weapon: P.weapon, wdur: P.wdur, fuel: P.fuel, carry: P.carry && P.carry !== true ? P.carry : null };
  after(650, () => timeCut(floorLv(id), FLOORS[id].n, () => {
    R.snap[R.floor] = snapshotFloor(keep.carry); R.wet[R.floor] = TOY.wet;
    const c = keep.carry, carried = c ? { type: c.type, opt: Object.fromEntries(Object.entries(c.opt || {}).filter(([k]) => !['v', 'av', 'life', 'tag'].includes(k))) } : null;
    R.floor = id; R.visited.add(id); enterFloor(id); P.lock = 9999;
    if (keep.weapon) { equip(keep.weapon, { fuel: keep.fuel }); P.wdur = keep.wdur; }
    if (carried) { const pp = P.body.position; carry(spawn(carried.type, pp.x, 2.4, pp.z, carried.opt)); }
  }, () => { R.moving = false; P.lock = 0; arrive(); }));
}
const need = g => g.n === 'name' ? [...R.co.name].filter(ch => ch.trim()).length : (g.n || 1);
function goalsHud() {
  const f = FLOORS[R.floor], e = R.ev[R.floor] || {};
  ui.goals(floorName(R.floor) + ' 도전과제', f.goals.map(g => ({ t: g.t, done: R.got.has(g.id), have: Math.min(e[g.k] || 0, need(g)), n: need(g) })), (isCleared(R.floor) ? '정복한 층 · ' : CLEAR_AT + '개 깨면 정복 · ') + (G.mobile ? '엘리베이터 = 다른 층' : '엘리베이터 안에서 숫자 키 = 다른 층'));
}
// 정복: 이번 판에 한 층에서 도전과제 4개 → 이 기기에 기억. 다른 층 3곳이면 12층이 열린다
function conquer(id) {
  if (isCleared(id) || FLOORS[id].goals.filter(g => R.got.has(g.id)).length < CLEAR_AT) return;
  const was = floorLocked('exec'); S.cleared = S.cleared || {}; S.cleared[id] = true; save();
  const opened = was && !floorLocked('exec'), left = Math.max(0, NEED_CLEAR - clearedN());
  after(1900, () => {
    if (R.mode !== 'free') return;
    ui.clearToast(floorLv(id) + ' 정복!', id === 'exec' ? '임원층까지 다 접수했다' : opened ? '12층 임원층이 열렸어요!' : floorLocked('exec') ? '12층 임원층까지 ' + left + '층 더' : '정복한 층 ' + clearedN() + '곳');
    sfx('special'); G.flash = Math.max(G.flash, 4);
    if (opened) after(3000, () => { if (R.mode !== 'free' || R.fight) return; ui.big('12층 임원층 열림!', '엘리베이터에서 12층 — 사장님이 기다립니다'); sfx('up'); after(2800, () => { if (!R.fight) ui.over(''); }); });
  });
}
function track(k, n = 1) {
  // 보스전 소식(people.js가 보낸다). 도전과제 셈에는 넣지 않는다
  if (k === 'bossdown') return bossWin(); if (k === 'foedown') return combatHud();
  if (R.mode !== 'free' || !R.got) return;
  const e = R.ev[R.floor] || (R.ev[R.floor] = {}); e[k] = (e[k] || 0) + n;
  let hit = false;
  for (const g of FLOORS[R.floor].goals) {
    if (g.k !== k) continue; hit = true;
    if (!R.got.has(g.id) && e[k] >= need(g)) {
      R.got.add(g.id); S.done = S.done || {}; S.done[g.id] = true; save();
      const gain = 3000000 * G.mult, c = G.counts.goal || (G.counts.goal = { n: 0, sum: 0, name: '도전과제 보너스' }); G.money += gain; c.n++; c.sum += gain;
      ui.goalToast(g.t, R.got.size); sfx('up'); later(18, () => sfx('stamp')); G.flash = Math.max(G.flash, 3);
      conquer(R.floor);
    }
  }
  if (hit) goalsHud();
}

export function bill() {
  clearTimers(); hush(); stopMission(); endCombat(); ui.ko(false); const was = R.mode; R.last = was === 'free' ? 'free' : R.course ? 'course' : 'single'; R.mode = 'bill'; G.onTick = null; G.interact = null;
  ui.objectives(null); ui.prompt(null); ui.hint(null); ui.band(null); fx.clearFxSoft();
  const nagSum = G.nags * 100000, total = Math.round(G.money + nagSum), r0 = rankOf(S.total);
  S.total += total; if (R.last === 'course') S.best = Math.max(S.best, total); S.runs++;
  for (const k in G.counts) S.counts[k] = (S.counts[k] || 0) + G.counts[k].n;
  save();
  const rush = was === 'free' && R.isRush ? { best: Math.max(S.rushBest || 0, total), isNew: total > (S.rushBest || 0), floor: floorName(R.floor) } : null; R.wasRush = !!rush; if (rush) { S.rushBest = rush.best; save(); }
  const r1 = rankOf(S.total), goals = was === 'free' && R.got ? { got: R.got.size, total: FLOOR_IDS.reduce((a, id) => a + FLOORS[id].goals.length, 0), floors: R.visited.size } : null;
  if (P.ride) P.ride = null; resetToys(); ui.elev(null); R.panel = false;
  ui.bill({ company: R.co.name, who: ui.charName(S.char), counts: G.counts, nags: G.nags, nagSum, total, maxCombo: G.maxCombo, sec: Math.round((Date.now() - R.t0) / 1000), promo: r1 > r0 ? RANKS[r1] : null, stressMax: was === 'free' ? null : G.stressMax, stressEnd: G.stress, goals, rush });
  music('win');
}
// 1분 난동: 아무 층에서나 60초. 기기별 최고 기록을 남긴다
export function startRush(floor) {
  // 잠긴 12층은 뽑지 않는다(1분 난동에는 보스전이 없다)
  const open = FLOOR_IDS.filter(id => !floorLocked(id));
  startFree(floor && !floorLocked(floor) ? floor : pick(open), { rush: true }); R.rush = 60 * 60;
  ui.big('1분 난동', '60초 동안 최대한 많이! 최고 기록 ' + Math.round(S.rushBest || 0).toLocaleString('ko-KR') + '원'); later(120, () => ui.over(''));
}
export function again() { if (R.last === 'free') (R.wasRush ? startRush() : startFree(R.startFloor)); else if (R.last === 'course') startCourse(); else startSingle(R.list[0]); }
void sit; void standUp;
