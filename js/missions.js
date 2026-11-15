import { G, rand, pick, clamp } from './state.js';
import { find, on, put, TAG } from './world.js';
import { spawn, kill, later, slow, explode, setScreen, breakProp, shove } from './engine.js';
import { P, flipProp, throwCarry } from './player.js';
import { THREE, X } from './gfx.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { say } from './voice.js';

const PI = Math.PI, PH2 = PI / 2;
const top = p => ({ x: p.body.position.x, y: p.body.position.y + p.size[1] / 2 + .2, z: p.body.position.z });
function setClock(h, m) { const c = find('clock'); if (!c) return; c.g.userData.hh.rotation.z = -((h % 12) + m / 60) / 12 * 6.283; c.g.userData.mh.rotation.z = -m / 60 * 6.283; }
function placeOn(item, desk, dx, dz) { if (!item || !desk) return; if (P.carry === item) { P.carry = null; item.held = false; item.body.collisionResponse = true; } const b = desk.body.position; item.body.position.set(b.x + dx, b.y + desk.size[1] / 2 + item.size[1] / 2 + .01, b.z + dz); item.body.velocity.set(0, 0, 0); item.body.angularVelocity.set(0, 0, 0); item.body.quaternion.set(0, 0, 0, 1); item.body.wakeUp(); }

// 단계 종류: use(E) · hit(때리기 n번) · break(부수기) · reach(가기) · wait(참기) · pick(집기) · carryTo(들고 가서 E) · equip(무기) · out(창밖으로)
export const MISSIONS = {
  printer: {
    n: '복합기 용지 걸림', time: '오후 2:30', sky: 'day', sub: '급한 인쇄 한 장이 안 나온다', start: [10.2, .4, PH2], rampage: 25,
    intro: [['나', '급한 건데… 한 장만 뽑으면 되는데.']],
    setup() { const p = find('printer'); p.armor = .1; },
    steps: [
      { t: '복합기에서 인쇄 누르기', type: 'use', at: () => find('printer'), label: '인쇄 누르기', done(c) { const p = find('printer'); setScreen(p, 'jam'); [0, 9, 18].forEach(d => later(d, () => sfx('beep'))); c.say('복합기', '삐빅. 용지가 걸렸습니다. 트레이 2를 확인하세요.'); } },
      { t: '걸린 종이 뽑기', type: 'use', at: () => find('printer'), label: '걸린 종이 뽑기 (꾹 누르기)', hold: 1.4, done(c) { const p = find('printer'); fx.sheet(top(p), 7, '#ffffff', 2.5); sfx('paper'); setScreen(p, 'toner'); c.say('복합기', '토너가 부족합니다.'); later(120, () => c.say('나', '…방금 갈았는데요.')); } },
      { t: '복합기 걷어차기', type: 'hit', at: () => find('printer'), n: 3, heavy: true, hint: '강타 3번', done() { fx.text(top(find('printer')), '덜컹!', 'word big'); sfx('metal'); G.shake = .25; } },
      { t: '덮개 뜯어내기', type: 'use', at: () => find('printer'), label: '덮개 뜯어내기 (연타)', mash: 6, onMash() { sfx('plastic'); G.shake = .1; }, done() { const p = find('printer'), b = p.body.position; p.g.userData.lid.visible = false; const l = spawn('lid', b.x - .7, b.y + .9, b.z, { v: { x: -3, y: 6, z: rand(-1, 1) }, av: { x: 3, y: 2, z: 4 } }); l.thrownT = G.tick; fx.text(top(p), '우지끈!', 'word big'); sfx('plastic'); sfx('metal'); fx.sheet(top(p), 12); } },
      { t: '야구방망이 집어 들기', type: 'equip', weapon: 'bat', at: () => find('bat') },
      { t: '복합기 박살 내기', type: 'break', list: () => [TAG.printer], enter() { const p = find('printer'); if (p) p.armor = 1; }, done(c) { later(45, () => c.say('나', '서비스 기사님은… 이제 안 오셔도 됩니다.')); } },
    ],
  },
  report: {
    n: '보고서 7차 반려', time: '오전 11:30', sky: 'day', sub: '「폰트가 좀…」', start: [.9, -.45, PI], rampage: 25,
    intro: [['who', '{me}, 보고서 다 됐으면 가져와 봐.']],
    setup() { on(find('myDesk'), 'report', -.28, .24, { tag: 'report' }); },
    steps: [
      { t: '내 자리에서 보고서 집어 들기', type: 'pick', at: () => find('report') },
      { t: '부장실 책상에 올려놓기', type: 'carryTo', item: () => find('report'), at: () => ({ x: -11.2, z: -5.7 }), label: '보고서 올려놓기', done() { placeOn(find('report'), find('bossDesk'), .15, .2); sfx('paper'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8.5, lines: [[.6, 'who', '음… 폰트가 좀…'], [3.3, 'who', '줄 간격이 마음에 안 드네.'], [6, 'who', '처음 게 낫다. 다시 해 와.']], onLine() { const r = find('report'); if (r) { fx.text(top(r), '반려', 'stamp'); sfx('stamp'); G.shake = .12; } } },
      { t: '보고서 찢어 버리기', type: 'use', at: () => find('report'), label: '보고서 찢기 (연타)', mash: 8, onMash() { const r = find('report'); if (r) fx.sheet(top(r), 3, '#ffffff', 2.5); sfx('paper'); }, done(c) { const r = find('report'); if (r) { fx.sheet(top(r), 36, '#ffffff', 5); fx.text(top(r), '쫘악—!', 'word big'); kill(r); } sfx('paper'); G.shake = .2; slow(.4, 40); c.say('나', '다시는… 안 합니다.'); } },
      { t: '사훈 액자 깨기', type: 'break', list: () => [TAG.frame_boss], hint: '결재판이나 명패를 집어 던져도 됩니다' },
      { t: '부장 책상 엎기', type: 'use', at: () => find('bossDesk'), label: '책상 엎기 (꾹 누르기)', hold: .7, done(c) { flipProp(find('bossDesk')); c.say('who', '자, 자네 지금 뭐 하는 건가!'); } },
      { t: '트로피 전부 부수기', type: 'break', list: () => [TAG.trophy0, TAG.trophy1, TAG.trophy2] },
    ],
  },
  overtime: {
    n: '퇴근 5분 전', time: '오후 5:55', sky: 'evening', sub: '「이것만 하고 가~」', start: [.2, -.5, PI], rampage: 25,
    intro: [['나', '5시 55분. 오늘은 진짜 칼퇴다.']],
    setup() { setClock(5, 55); },
    steps: [
      { t: '컴퓨터 끄고 퇴근 준비', type: 'use', at: () => find('myDesk'), label: '컴퓨터 끄기', done(c) { setScreen(find('myMonitor'), 'update'); sfx('beep'); c.say('컴퓨터', '업데이트 중입니다. 37퍼센트. PC를 끄지 마세요.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8.5, lines: [[.8, 'who', '퇴근 전에 이것만~'], [3.6, 'who', '금방 끝나, 금방.'], [6.2, 'who', '내일 아침 9시 보고니까.']], onLine(c, k) { const d = find('myDesk'); if (!d) return; const b = d.body.position; TAG['ot' + k] = spawn('papers', b.x - .42 + k * .42, 2.3, b.z + .12, { size: [.22, .2 + k * .07, .3] }); later(22, () => { sfx('wood', .7); G.shake = .1; }); } },
      { t: '모니터 내리치기', type: 'hit', at: () => find('myMonitor'), n: 3, hint: '때리기 3번' },
      { t: '쌓인 서류 날려 버리기', type: 'break', list: () => [TAG.ot0, TAG.ot1, TAG.ot2] },
      { t: '본체를 창밖으로 던지기', type: 'out', item: () => TAG.myPc, hint: 'E로 들고, 창문을 보고 때리기 버튼' },
      { t: '벽시계 떨어뜨리기', type: 'break', list: () => [TAG.clock], hint: '물건을 던지거나 점프해서 때리기', done(c) { fx.text({ x: 2, y: 2.2, z: -3 }, '6시다!', 'word big'); c.say('나', '6시다. 퇴근합니다.'); } },
    ],
  },
  meeting: {
    n: '끝나지 않는 회의', time: '오전 10:00', sky: 'day', sub: '지금 3쪽, 전체 126쪽', start: [6.9, -4.4, PH2], rampage: 25,
    intro: [['팀장님', '{me}, 회의 시작합니다. 얼른 들어와요.']],
    steps: [
      { t: '회의실 들어가기', type: 'reach', at: () => ({ x: 9.4, z: -5.2 }), r: 1.3, done(c) { c.say('팀장님', '자, 오늘 안건이 좀 많습니다.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8.5, lines: [[1.2, '팀장님', '그래서 결론이 뭐죠?'], [3.8, 'who', '이건 다음 회의에서 다시 얘기하죠.'], [6.3, '팀장님', '회의 끝나고 잠깐 회의 좀 합시다.']] },
      { t: '빔 프로젝터 떨어뜨리기', type: 'break', list: () => [TAG.projector], hint: '의자를 들어 던지거나 점프해서 때리기', done() { setScreen(find('screen'), 'off'); } },
      { t: '회의 탁자 엎기', type: 'use', at: () => find('mtgTable'), label: '탁자 엎기 (꾹 누르기)', hold: .7, done() { flipProp(find('mtgTable')); } },
      { t: '유리벽 깨고 나가기', type: 'break', list: () => [TAG.mg0, TAG.mg1, TAG.mg2, TAG.mg3, TAG.mg4], need: 2, hint: '의자를 던지면 한 번에 깨집니다' },
      { t: '화이트보드 부수기', type: 'break', list: () => [TAG.whiteboard] },
    ],
  },
  lunch: {
    n: '점심시간에 울리는 전화', time: '낮 12:10', sky: 'day', sub: '컵라면 3분도 못 기다리게 한다', start: [-9.6, .3, -PH2], rampage: 25,
    intro: [['나', '드디어 점심. 컵라면이라도 먹자.']],
    setup() { on(find('counter'), 'cellphone', .1, -.72, { ry: PH2, tag: 'cell' }); },
    steps: [
      { t: '컵라면에 물 붓기', type: 'use', at: () => find('cooler'), label: '뜨거운 물 받기 (꾹 누르기)', hold: 1, done(c) { sfx('water'); c.say('나', '3분만 기다리면 된다. 3분만.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 5, lines: [[.4, '전화', '따르릉— 따르릉—'], [2.6, '전화', '따르릉— 따르릉— 따르릉—']], onTick(c, t) { if (t % 70 === 5) { sfx('ring'); const p = find('phone_pantry'); if (p) { p.punch = 10; fx.text(top(p), '따르릉!', 'note'); } } } },
      { t: '전화 받기', type: 'use', at: () => find('phone_pantry'), label: '전화 받기', done(c) { c.say('거래처', '식사 중에 죄송한데요~ 메일 보냈는데 보셨어요?'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 6.5, lines: [[3, '단톡방', '@전체 필독. 다들 주말에 시간 되죠?'], [5, '단톡방', '넵! 넵넵! 확인 부탁드립니다!']], onTick(c, t) { if (t > 170 && t % 36 === 0) { sfx('beep', .7); const p = find('cell'); if (p) p.punch = 8; buzz(20); } } },
      { t: '업무폰 집어 들기', type: 'pick', at: () => find('cell') },
      { t: '전자레인지에 넣고 돌리기', type: 'carryTo', item: () => find('cell'), at: () => find('microwave') || { x: -13, z: -.6 }, label: '전자레인지에 넣기', done(c) {
        const cell = find('cell'), mw = find('microwave'); if (cell) { P.carry = null; cell.held = false; kill(cell); }
        c.say('나', '3분이면… 딱 되겠네.'); sfx('beep');
        if (mw) { [40, 80, 115].forEach(d => later(d, () => { if (!mw.dead) { fx.sparks(top(mw), 10); sfx('zap', .6); mw.punch = 10; } })); later(150, () => { if (mw.dead) return; const b = mw.body.position, pos = { x: b.x, y: b.y, z: b.z }; fx.text(top(mw), '퍼엉!', 'word big'); breakProp(mw); explode(pos, 3.4, 70, 9); fx.cloud(pos, 12, '#333333', 1.1, .6); sfx('boom'); }); }
      } },
      { t: '전화기 전부 부수기', type: 'break', list: () => [TAG.phone_pantry, TAG.phone_d3, TAG.phone_d5], hint: '사무실 책상 위에도 있습니다' },
      { t: '「고장」 커피머신 부수기', type: 'break', list: () => [TAG.coffee] },
    ],
  },
  resign: {
    n: '사직서', time: '밤 11:00', sky: 'night', sub: '가슴속에 품고 다니던 그것', start: [.2, -.5, PI], rampage: 0, final: true,
    intro: [['나', '…오늘이다.']],
    setup() { on(find('myDesk'), 'envelope', .3, .24, { tag: 'env' }); const s = find('safe'); s.hp = s.maxHp = 900; setClock(11, 0); },
    steps: [
      { t: '서랍에서 사직서 꺼내기', type: 'pick', at: () => find('env') },
      { t: '부장 책상에 사직서 내려치기', type: 'carryTo', item: () => find('env'), at: () => ({ x: -11.2, z: -5.7 }), label: '사직서 내려치기', done(c) {
        const d = find('bossDesk'); placeOn(find('env'), d, 0, .15); slow(.25, 80); sfx('stamp'); sfx('boom', .7); G.shake = .5; G.flash = 6; buzz([60, 40, 100]);
        if (d) { fx.text(top(d), '쾅!!', 'word big'); for (const q of G.props) if (!q.dead && !q.fixed && q !== d && q.type !== 'envelope' && Math.hypot(q.body.position.x - d.body.position.x, q.body.position.z - d.body.position.z) < 1.3 && q.body.position.y > .8) shove(q, rand(-1, 1), rand(3, 5), rand(-1, 1)); }
        c.say('who', '자, 자네… 이게 뭔가?'); later(150, () => c.say('나', '그동안 감사했습니다. 진심은 아닙니다.'));
      } },
      { t: '부장 책상 엎기', type: 'use', at: () => find('bossDesk'), label: '책상 엎기 (꾹 누르기)', hold: .7, done() { flipProp(find('bossDesk')); } },
      { t: '금고 부수기', type: 'break', list: () => [TAG.safe], hint: '오함마는 로비 왼쪽 구석, 골프채는 이 방에 있습니다' },
      { t: '초상화와 사훈 떼어 버리기', type: 'break', list: () => [TAG.portrait, TAG.frame_boss] },
      { t: '엘리베이터 타고 퇴근', type: 'reach', at: () => ({ x: G.elev.x, z: G.elev.z }), r: 1.4, done() { sfx('ding'); } },
    ],
  },
};
export const MISSION_IDS = ['meeting', 'report', 'lunch', 'printer', 'overtime'];

// ───── 진행
export const MS = { m: null, i: -1, step: null, phase: 'idle' };
let marker;
function mk() {
  if (marker) return marker;
  marker = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: .92, depthTest: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.16, .34, 12), mat); cone.rotation.x = PI; cone.renderOrder = 9; marker.add(cone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.45, .55, 28), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -PH2; marker.add(ring); marker.userData = { cone, ring };
  X.scene.add(marker); return marker;
}
const ctx = { say: (who, text) => say(who === 'who' ? MS.co.who : who, text.replace('{me}', MS.me)) };

export function startMission(m, co, me, onEnd) {
  Object.assign(MS, { m, co, me, i: -1, step: null, phase: 'play', onEnd, m0: G.money, target: 1.2e7, zero: false, rt: 0 });
  G.onHit = onHit; G.interact = interact;
  (m.intro || []).forEach(([w, t], k) => later(20 + k * 150, () => ctx.say(w, t)));
  next();
}
export function stopMission() { MS.phase = 'idle'; MS.step = null; G.interact = null; G.onHit = null; G.want = null; if (marker) marker.visible = false; ui.prompt(null); }
function next() {
  const m = MS.m; MS.i++;
  if (MS.i >= m.steps.length) { MS.step = null; ui.objectives(m.steps.map(s => s.t), MS.i); ui.prompt(null); return m.rampage ? rampage() : finish(); }
  const s = MS.step = m.steps[MS.i]; Object.assign(MS, { t: 0, n: 0, hold: 0, mash: 0, lineK: 0 });
  if (s.type === 'break') MS.total = s.list().filter(Boolean).length;
  s.enter && s.enter(ctx);
  if (s.type === 'wait') P.lock = s.sec * 60;
  ui.objectives(m.steps.map(x => x.t), MS.i, s.hint);
}
function complete(skip) { const s = MS.step; if (!s) return; if (!skip && s.done) s.done(ctx); sfx('up', .5); next(); }
function rampage() { MS.phase = 'rampage'; MS.rt = MS.m.rampage * 60; G.mult = Math.max(G.mult, 2); ui.big('뚜껑 열렸다!', '자유 난동 · 피해액 2배'); setTimeout(() => ui.over(''), 1600); sfx('special'); G.flash = 6; G.rage = 100; if (marker) marker.visible = false; }
function finish() { if (MS.phase === 'done') return; MS.phase = 'done'; stopMission(); MS.phase = 'done'; MS.onEnd && MS.onEnd({ stress: stress(), final: MS.m.final }); }
const stress = () => clamp(100 - 100 * (G.money - MS.m0) / MS.target, 0, 100);

function targetPos(s) {
  if (s.type === 'break') { const p = s.list().find(q => q && !q.dead); return p ? top(p) : null; }
  if (s.type === 'out') { const it = s.item(); if (!it || it.dead || it.out) return null; return P.carry === it ? { x: clamp(P.body.position.x, -11, 11), y: 2.2, z: -8.7 } : top(it); }
  if (s.type === 'carryTo') { const it = s.item(); if (it && P.carry !== it) return top(it); }
  if (!s.at) return null; const a = s.at(); if (!a) return null;
  return a.body ? top(a) : { x: a.x, y: a.y ?? 1.2, z: a.z };
}
const near = (pos, r) => pos && Math.hypot(pos.x - P.body.position.x, pos.z - P.body.position.z) < r;

function interact(press, held, dt) {
  const s = MS.step; if (!s || MS.phase !== 'play') return false;
  if (s.type === 'carryTo') { const it = s.item(); if (!it || P.carry !== it) return false; const a = s.at(), pos = a.body ? a.body.position : a; if (!near(pos, 2.2)) return false; if (press) complete(); return press; }
  if (s.type !== 'use') return false;
  const a = s.at(); if (!a) return false; if (!near(a.body ? a.body.position : a, s.range || 2.2)) return false;
  if (s.hold) { if (held) { MS.hold += dt; if (MS.hold >= s.hold) complete(); return true; } return false; }
  if (!press) return false;
  if (s.mash) { MS.mash++; s.onMash && s.onMash(ctx); if (MS.mash >= s.mash) complete(); return true; }
  complete(); return true;
}
function onHit(p, dmg, heavy, byPlayer) {
  const s = MS.step; if (!s || s.type !== 'hit' || !byPlayer || p !== s.at() || (s.heavy && !heavy)) return;
  MS.n++; fx.text(top(p), MS.n + ' / ' + s.n, 'note'); if (MS.n >= s.n) later(1, () => { if (MS.step === s) complete(); });
}

export function tickMission(dt) {
  if (MS.phase === 'rampage') { if (--MS.rt <= 0) finish(); return; }
  const s = MS.step; if (!s || MS.phase !== 'play') return;
  MS.t++;
  const pos = targetPos(s), M = mk();
  if (pos) { M.visible = true; M.position.set(pos.x, 0, pos.z); M.userData.cone.position.y = pos.y + .45 + Math.sin(G.tick * .12) * .08; M.userData.ring.position.y = .03; M.userData.ring.scale.setScalar(1 + Math.sin(G.tick * .1) * .08); } else M.visible = false;
  let prompt = null, prog = 0;
  if (s.type === 'use') { const a = s.at(); if (!a) return complete(true); if (near(a.body ? a.body.position : a, s.range || 2.2)) { prompt = s.label; prog = s.hold ? MS.hold / s.hold : s.mash ? MS.mash / s.mash : 0; } if (s.hold && MS.hold > 0) MS.hold = Math.max(0, MS.hold - dt * .4); }
  else if (s.type === 'hit') { if (!s.at()) return complete(true); }
  else if (s.type === 'break') { const alive = s.list().filter(q => q && !q.dead && !q.out).length, need = s.need || MS.total; if (MS.total - alive >= need || alive === 0) return complete(); }
  else if (s.type === 'reach') { if (near(pos, s.r || 1.5)) return complete(); }
  else if (s.type === 'wait') {
    while (s.lines && MS.lineK < s.lines.length && MS.t >= s.lines[MS.lineK][0] * 60) { const [, w, t] = s.lines[MS.lineK]; ctx.say(w, t); s.onLine && s.onLine(ctx, MS.lineK); MS.lineK++; }
    s.onTick && s.onTick(ctx, MS.t); prompt = '참는 중…'; prog = MS.t / (s.sec * 60); if (MS.t >= s.sec * 60) return complete();
  }
  else if (s.type === 'pick') { const a = s.at(); if (!a) return complete(true); if (P.carry === a) return complete(); if (near(a.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'equip') { if (P.weapon === s.weapon) return complete(); let a = s.at(); if (!a || a.out) { const q = P.body.position; put(s.weapon, q.x + 1, q.z, { tag: s.weapon }); a = find(s.weapon); } if (near(a.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'carryTo') { const it = s.item(); if (!it) return complete(true); if (P.carry === it) { const a = s.at(), ap = a.body ? a.body.position : a; if (near(ap, 2.2)) prompt = s.label; } else if (near(it.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'out') { const it = s.item(); if (!it || it.dead || it.out) return complete(); }
  G.want = s.type === 'pick' || s.type === 'equip' ? s.at() : s.type === 'carryTo' ? s.item() : null;
  ui.prompt(prompt, prog, s.type === 'wait');
  const st = stress(); if (st === 0 && !MS.zero) { MS.zero = true; G.mult = Math.max(G.mult, 1.5); ui.toast('스트레스 0%! 보너스 ×1.5'); sfx('up'); }
}
export function missionHud() { return { stress: MS.phase === 'idle' ? null : stress(), left: MS.phase === 'rampage' ? Math.ceil(MS.rt / 60) : null }; }
void pick; void throwCarry;
