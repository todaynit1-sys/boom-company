// 번외 게임: 30~60초짜리 짧은 판. 층 짓기·캐릭터·화면 표시는 원래 것을 그대로 쓰고, 점수와 최고 기록만 따로 센다
// 보스전(G.combat)은 쓰지 않는다
import { G, rand, pick, clamp, won } from './state.js';
import { S, save } from './save.js';
import { THREE, X, labelMat, FONT } from './gfx.js';
import { spawn, setScreen, later } from './engine.js';
import { buildOffice, put, on } from './world.js';
import { buildFloor } from './floors.js';
import { P, spawnPlayer, updatePlayer, equip } from './player.js';
import { tickToys, yawOf } from './toys.js';
import { R, reset, promptTick, weaponLabel } from './run.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { music } from './music.js';

const PI = Math.PI;
export const B = { id: null };
const top = p => ({ x: p.body.position.x, y: p.body.position.y + p.size[1] / 2 + .3, z: p.body.position.z });
const fmt = (g, n) => g.unit === '원' ? won(n) : Math.round(n).toLocaleString('ko-KR') + g.unit;
const grade = (list, n) => (list.find(([v]) => n < v) || list[list.length - 1])[1];

// ───── 게임 목록
const GAMES = {
  car: {
    n: '차 뿌시기', lv: 'B2', sub: 'B2 주차장 · 45초', desc: '주차장 차를 최대한 많이. 점수는 피해액', sec: 45, unit: '원', toys: true,
    goal: '차를 최대한 많이 부수기', foot: '드럼통을 던지면 터져요 · 지게차로 들이받아도 돼요',
    build: buildCar, score: () => Math.round(G.money),
    grade: n => grade([[3e7, '주차 딱지 수준'], [1e8, '문콕 전문가'], [2.5e8, '견인차 호출'], [Infinity, '폐차장 사장님']], n),
    rows: () => [['부순 차', ((G.counts.car && G.counts.car.n) || 0) + '대'], ['깨진 차 유리', ((G.counts.carglass && G.counts.carglass.n) || 0) + '번'], ['최고 연타', G.maxCombo + '']],
  },
  mole: {
    n: '모니터 두더지', lv: '7', sub: '7층 우리 팀 · 60초', desc: '빨갛게 켜진 모니터만 부수기. 꺼진 걸 부수면 감점', sec: 60, unit: '점',
    goal: '빨간 모니터만 부수기', foot: '꺼진 모니터를 부수면 −50점 · 빨리 부술수록 점수 더',
    build: buildMole, tick: tickMole, score: () => Math.max(0, B.score),
    grade: n => grade([[800, '결재 지연'], [1800, '칼답 사원'], [3000, '결재 머신'], [Infinity, '두더지 장인']], n),
    rows: () => [['맞힘', B.hits + '번'], ['헛방(감점)', B.miss + '번'], ['놓침', B.lost + '번'], ['최고 연속', B.bestStreak + '번']],
  },
  punch: {
    n: '펀치 측정기', lv: '1', sub: '1층 로비 · 3번', desc: '가장 센 한 방이 점수. 무기를 들어도 돼요', sec: 45, unit: '점',
    goal: '측정기를 세게 3번 치기', foot: '바짝 붙어서 강타(발차기)·무기 강타가 세요',
    build: buildPunch, tick: tickPunch, score: () => B.best || 0,
    grade: n => punchGrade(n),
    rows: () => [0, 1, 2].map(i => [(i + 1) + '번째', B.tries[i] != null ? B.tries[i] + '점' : '—']),
  },
  toss: {
    n: '옥상 투척', lv: 'R', sub: '옥상 · 40초', desc: '난간 너머로 최대한 많이 던지기', sec: 40, unit: '개',
    goal: '난간 너머로 던지기', foot: 'E 집기 · 든 채 때리기 = 던지기 · 위를 보고 던지면 멀리',
    build: buildToss, score: () => B.score,
    grade: n => grade([[5, '바람 쐬는 중'], [10, '투척 신입'], [18, '옥상 투수'], [Infinity, '창밖의 지배자']], n),
    rows: () => [['던진 물건', B.score + '개'], ['창밖 보너스', won(G.money)]],
  },
};
export const BONUS_LIST = Object.entries(GAMES).map(([id, g]) => ({ id, n: g.n, lv: g.lv, sub: g.sub, desc: g.desc, unit: g.unit, best: () => (S.bonusBest && S.bonusBest[id]) || 0, fmt: n => fmt(g, n) }));

// ───── 시작 → 3·2·1 → 진행 → 끝 → 결과 카드
export function startBonus(id) {
  const g = GAMES[id]; if (!g) return;
  reset(); R.mode = 'bonus'; R.course = false; ui.only(null); ui.hudShow(true); ui.band(null); ui.objectives(null);
  for (const k in B) delete B[k];
  Object.assign(B, { id, g, phase: 'ready', t: 0, left: g.sec * 60, score: 0, hits: 0, miss: 0, lost: 0, streak: 0, bestStreak: 0, tries: [], cool: 0, best: 0 });
  G.toys = !!g.toys; G.paused = false; G.mult = 1; G.combat = false;
  g.build();
  P.lock = 9999; G.onTick = tick;
  ui.goals(g.n, [{ t: g.goal, done: false, have: 0, n: 1 }], g.foot);
  hud(); music('rage');
}
export function bonusQuit() { if (R.mode === 'bonus') end(true); }

function tick(dt) {
  updatePlayer(dt); tickToys(dt);
  const g = B.g; if (!g) return; B.t++;
  if (B.phase === 'ready') {
    // 크게 3 · 2 · 1 · 시작!
    const k = B.t;
    if (k === 1 || k === 50 || k === 100) { ui.big(k === 1 ? '3' : k === 50 ? '2' : '1', g.n); sfx('beep'); }
    if (k === 150) { ui.big('시작!', g.goal); sfx('special'); buzz(30); P.lock = 0; B.phase = 'play'; later(55, () => { if (B.phase === 'play') ui.over(''); }); }
  } else if (B.phase === 'play') {
    if (g.sec) {
      B.left--; const s = B.left / 60;
      // 마지막 5초는 크게
      if (B.left % 60 === 0 && s > 0 && s <= 5) { ui.big(String(s)); sfx('beep'); later(36, () => { if (B.phase === 'play') ui.over(''); }); }
      if (B.left <= 0) { hud(); return end(); }
    }
    g.tick && g.tick(dt);
  } else if (g.tick && B.phase === 'end') g.tick(dt, true);
  if (G.tick % 6 === 0 && (B.phase === 'ready' || B.phase === 'play')) { hud(); if (B.phase === 'play') promptTick(); }
}
function scoreText() {
  if (B.id === 'punch') return `${B.tries.length}/3번 · 최고 ${B.best || 0}점`;
  if (B.id === 'mole') return `${Math.max(0, B.score).toLocaleString('ko-KR')}점` + (B.streak > 1 ? ` · 연속 ${B.streak}` : '');
  if (B.id === 'toss') return `${B.score}개`;
  return won(G.money);
}
function hud() {
  const g = B.g;
  ui.hud({ title: g.n, sub: g.sub, money: G.money, stress: null, combo: G.combo, rage: G.rage, time: '', clock: '', weapon: weaponLabel() });
  ui.bonusHud({ time: Math.max(0, Math.ceil(B.left / 60)), score: scoreText(), hurry: B.phase === 'play' && B.left <= 600 });
}
function end(early) {
  if (B.phase !== 'play' && B.phase !== 'ready') return;
  B.phase = 'end'; B.early = !!early; P.lock = 9999; G.mult = 1; ui.prompt(null); ui.hint(null);
  ui.big(early ? '그만!' : B.id === 'punch' && B.tries.length >= 3 ? '측정 끝!' : '시간 끝!'); sfx('ding'); buzz(40);
  const id = B.id; setTimeout(() => { if (R.mode === 'bonus' && B.id === id && B.phase === 'end') result(); }, 1500);
}
function result() {
  B.phase = 'done'; R.mode = 'bres'; G.onTick = null;
  const g = B.g, score = g.score(), prev = (S.bonusBest && S.bonusBest[B.id]) || 0, isNew = !B.early && score > prev;
  S.bonusBest = S.bonusBest || {}; if (isNew) S.bonusBest[B.id] = score;
  // 부순 것은 도감·누적 피해액에도 더한다
  const money = Math.round(G.money); S.total += money; for (const k in G.counts) S.counts[k] = (S.counts[k] || 0) + G.counts[k].n; save();
  if (document.pointerLockElement) document.exitPointerLock();
  ui.over(''); ui.bonusHud(null);
  ui.bonusResult({ id: B.id, n: g.n, score: fmt(g, score), isNew, had: prev > 0, best: fmt(g, Math.max(prev, isNew ? score : 0)), grade: g.grade ? g.grade(score) : '', rows: g.rows ? g.rows() : [], money, early: B.early });
  sfx(isNew ? 'up' : 'stamp'); music('win');
}

// ───── 차 뿌시기: B2 주차장, 차 한 대 더, 오함마·방망이를 발밑에
function buildCar() {
  buildFloor('parking', R.co);
  put('car', 10, 6.4, { ry: PI, col: '#8a1c2b', price: 40000000, plate: '33아 4444', fm: ['#8a1c2b', '#8a1c2b', 'carInside', 'metalDark'] });
  put('hammer', -1.4, 1.2, { ry: .4 }); put('bat', 1.3, 1.0, { ry: 1.1 });
  spawnPlayer(S.char, 0, 1.6, PI);
  // 차는 한 대를 끝까지 부수기 오래 걸리니, 때릴 때마다 수리비가 붙는다
  G.onHit = (p, dmg, heavy, by) => {
    if (!by || p.type !== 'car' || B.phase !== 'play') return;
    const gain = Math.round(dmg * 30000 / 1000) * 1000; if (gain <= 0) return;
    G.money += gain; const c = G.counts.carhit || (G.counts.carhit = { n: 0, sum: 0, name: '차 수리비' }); c.n++; c.sum += gain;
    if (heavy || gain >= 600000) fx.text(top(p), '+' + won(gain), 'money');
  };
}

// ───── 모니터 두더지: 빨갛게 켜진 모니터만. 부서진 자리에는 총무팀이 새 모니터를 놓는다
const LIT = 150;
let mkGeo, mkMat;
const litMat = () => labelMat('Smole', 512, 320, (c, w, h) => {
  c.fillStyle = '#e5342b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 18; c.strokeRect(9, 9, w - 18, h - 18);
  c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = '700 120px ' + FONT; c.fillText('지금!', w / 2, h * .56); c.font = '700 40px ' + FONT; c.fillText('긴급 결재 요청', w / 2, h * .84);
});
function marker() {
  mkGeo = mkGeo || new THREE.ConeGeometry(.11, .24, 12); mkMat = mkMat || new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
  const m = new THREE.Mesh(mkGeo, mkMat); m.rotation.x = PI; m.visible = false; X.level.add(m); return m;
}
function buildMole() {
  buildOffice(R.co, 'day');
  // 가운데 통로에 모니터 진열대 4개를 더 놓는다
  for (const x of [-6, -2, 2, 6]) { const c = put('lowcab', x, 4.4); on(c, 'monitor', 0, 0, { screen: 'work' }); }
  spawnPlayer(S.char, 0, 6.2, PI); equip('bat');
  B.slots = G.props.filter(p => p.type === 'monitor' && !p.dead).map(p => {
    p.hp = p.maxHp = 30; const b = p.body.position;
    return { p, kind: p.screen || 'work', x: b.x, y: b.y, z: b.z, ry: yawOf(p.body.quaternion), lit: 0, back: 0, mk: marker() };
  });
  B.next = 30; G.onBreak = moleBreak;
}
function light(s) {
  const p = s.p, u = p.g.userData; if (u.screen) u.screen.material = litMat();
  p.screen = 'mole'; s.lit = LIT; p.punch = 8; s.mk.visible = true; sfx('beep', .5);
}
function unlight(s) { if (s.p && !s.p.dead) setScreen(s.p, s.kind); s.lit = 0; s.mk.visible = false; }
function tickMole(dt, over) {
  const prog = 1 - B.left / (B.g.sec * 60);
  for (const s of B.slots) {
    // 부서지지 않고 사라진 모니터(건물 밖으로 떨어짐 등)도 빈자리로 돌린다
    if (s.p && s.p.dead && !s.back) { s.p = null; s.lit = 0; s.mk.visible = false; s.back = 80; }
    if (s.lit > 0 && s.p && !s.p.dead && (over || --s.lit <= 0)) { unlight(s); if (!over) { B.lost++; B.streak = 0; fx.text(top(s.p), '놓침', 'note'); } }
    if (s.back > 0 && --s.back === 0 && !over) respawn(s);
    if (s.mk.visible && s.p) { const b = s.p.body.position; s.mk.position.set(b.x, b.y + .58 + Math.sin(B.t * .2) * .07, b.z); }
  }
  if (over) return;
  // 시간이 갈수록 자주, 여러 개가 함께 켜진다
  if (--B.next <= 0) {
    const litN = B.slots.filter(s => s.lit > 0).length, max = prog < .35 ? 1 : prog < .7 ? 2 : 3;
    const free = B.slots.filter(s => s.p && !s.p.dead && !s.p.held && s.lit <= 0);
    if (litN < max && free.length) light(pick(free));
    B.next = Math.round(68 - prog * 32 + rand(-8, 8));
  }
}
function moleBreak(p) {
  if (p.type !== 'monitor' || B.phase !== 'play' || !B.slots) return;
  const s = B.slots.find(q => q.p === p); if (!s) return;
  const pos = top(p);
  if (s.lit > 0) {
    const pts = 100 + Math.round(s.lit / LIT * 50); B.score += pts; B.hits++; B.streak++; B.bestStreak = Math.max(B.bestStreak, B.streak);
    fx.text(pos, '+' + pts + (B.streak >= 3 ? ' · ' + B.streak + '연속' : ''), 'word big'); sfx('up', .6);
  } else { B.score -= 50; B.miss++; B.streak = 0; fx.text(pos, '헛방! −50', 'word'); sfx('beep'); G.shake = Math.max(G.shake, .12); }
  s.lit = 0; s.mk.visible = false; s.p = null; s.back = 80;
}
function respawn(s) {
  const p = spawn('monitor', s.x, s.y + .03, s.z, { ry: s.ry, screen: s.kind, hp: 30 }); s.p = p; p.punch = 8;
  fx.cloud({ x: s.x, y: s.y, z: s.z }, 2, '#ffffff', .4, .2);
}

// ───── 펀치 측정기: 1층 로비. 3번 쳐서 가장 센 한 방(피해량)을 점수로 바꾼다
const PG = [[250, '인턴 펀치'], [380, '사원급 한 방'], [520, '대리급 분노'], [650, '과장급 울분'], [780, '차장급 폭발'], [900, '부장님 긴장'], [Infinity, '사장님 도망감']];
const punchGrade = n => grade(PG, n);
function buildPunch() {
  buildFloor('lobby', R.co, 'day');
  B.box = put('punchbox', 1.4, 5.0, { ry: -PI / 2, tag: 'punchbox' });
  put('bat', -.4, 6.4, { ry: .3 });
  spawnPlayer(S.char, .15, 5.0, PI / 2);
  G.onHit = punchHit;
  const u = B.box.g.userData; u.show && u.show('READY', '1번째 · 세게 치세요!', '#6fe08a');
}
function punchHit(p, dmg, heavy, byPlayer) {
  if (p.type !== 'punchbox' || !byPlayer || B.phase !== 'play' || B.cool > 0 || B.tries.length >= 3) return;
  const sc = clamp(Math.round(Math.sqrt(Math.max(0, dmg)) * 82 + rand(-4, 4)), 1, 999), gr = punchGrade(sc), u = p.g.userData, pos = top(p);
  B.tries.push(sc); B.best = Math.max(B.best, sc); B.cool = 80;
  u.show && u.show(sc + '점', B.tries.length + '번째 · ' + gr, sc >= 780 ? '#ffd84d' : '#ff5247');
  ui.big(sc + '점', B.tries.length + '번째 · ' + gr); later(75, () => { if (B.phase === 'play') ui.over(''); });
  fx.text(pos, sc >= 650 ? '쾅!!' : '퍽!', 'word big'); sfx(sc >= 650 ? 'boom' : 'punch'); later(12, () => sfx('up', .7));
  G.shake = Math.max(G.shake, sc / 2500); G.flash = Math.max(G.flash, sc >= 780 ? 5 : 2); buzz(sc >= 650 ? 60 : 25);
  if (B.tries.length >= 3) later(95, () => { if (B.phase === 'play') end(); });
}
function tickPunch() {
  const box = B.box; if (!box || box.dead) return; const u = box.g.userData;
  if (u.pad) { if (u.padT > 0) { u.padT--; u.pad.rotation.x = -Math.sin(u.padT / 14 * PI) * .85 * (u.padK || 1); } else u.pad.rotation.x = 0; }
  if (B.cool > 0 && --B.cool === 0 && B.tries.length < 3 && B.phase === 'play') u.show && u.show('READY', (B.tries.length + 1) + '번째 · 최고 ' + B.best + '점', '#6fe08a');
}

// ───── 옥상 투척: 상자 더미와 의자를 난간 너머로
function buildToss() {
  buildFloor('roof', R.co, 'day');
  for (const [x, z] of [[7.5, 1.0], [8.1, 1.0], [7.8, 1.6], [8.4, 1.6], [7.5, 2.2], [8.1, 2.2], [8.7, 2.2], [7.8, .4], [8.4, .4], [9.0, 1.0]]) put('box', x, z, { ry: rand(-.3, .3) });
  for (const [x, z] of [[9.6, -1.5], [10.4, -1.5], [9.6, 3.0], [10.4, 3.0]]) put('cafechair', x, z, { ry: rand(6.28) });
  spawnPlayer(S.char, 6.4, 1.3, PI / 2);
  G.onOut = p => { if (B.phase !== 'play') return; B.score++; sfx('pop', .7); if (B.score % 5 === 0) { ui.toast(B.score + '개째!'); G.flash = Math.max(G.flash, 2); } };
}
