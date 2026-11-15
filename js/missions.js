import { G, rand, pick, clamp } from './state.js';
import { find, on, put, TAG, elev } from './world.js';
import { spawn, kill, later, slow, explode, setScreen, breakProp, shove, damage, distTo } from './engine.js';
import { P, CAM, sit, setFace, tremble, camTo, camHold, faceCam, flipProp } from './player.js';
import { mount } from './toys.js';
import { THREE, X } from './gfx.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import * as ui from './ui.js';
import { say } from './voice.js';
import { music } from './music.js';

const PI = Math.PI, PH2 = PI / 2;
const top = p => ({ x: p.body.position.x, y: p.body.position.y + p.size[1] / 2 + .2, z: p.body.position.z });
const my = k => find('my' + k);
function placeOn(item, desk, dx, dz) { if (!item || !desk) return; if (P.carry === item) { P.carry = null; item.held = false; item.body.collisionResponse = true; } const b = desk.body.position; item.body.position.set(b.x + dx, b.y + desk.size[1] / 2 + item.size[1] / 2 + .01, b.z + dz); item.body.velocity.set(0, 0, 0); item.body.angularVelocity.set(0, 0, 0); item.body.quaternion.set(0, 0, 0, 1); item.body.wakeUp(); }
function ring(tag) { sfx('ring'); const p = find(tag); if (p) { p.punch = 10; fx.text(top(p), '따르릉!', 'note'); } }
// ① 일과: 내 자리에 앉은 채 시작. 카메라가 사무실을 훑고 등 뒤로 내려온다
const idle = (sec, lines, extra = {}) => Object.assign({ t: '(일과)', type: 'cut', hide: true, idle: true, sec, lines, cam: 'swoop' }, extra);

// 단계 종류: cut(장면) · use(E, hold 꾹, mash 연타) · sit(앉기) · hit(때리기 n번) · break(부수기) · reach(가기) · wait(참기) · pick(집기) · carryTo(들고 가서 E) · equip(무기) · out(창밖으로)
// · ride(엘리베이터 안에 들어서면 to 층으로) · until(ok()가 참이 될 때까지)
const carWash = () => { const c = find('bossCar'); if (c && G.tick % 3 === 0) { const b = c.body.position; fx.drops({ x: b.x + rand(-.8, .8), y: 1.6, z: b.z + rand(-2, 2) }, 3, '#9fd4ff', 1.2); if (G.tick % 18 === 0) sfx('water', .35); } };
export const MISSIONS = {
  arrive: {
    id: 'arrive', n: '출근', sub: '오늘도 무사히', slot: 0, clock: [8, 55], sky: 'morning', rampage: 0, noStamp: true, place: 'elevator', needs: [],
    steps: [
      { t: '(엘리베이터)', type: 'cut', hide: true, sec: 3.8, cam: () => ({ pos: [G.elev.x + 1.9, 1.5, 6.1], look: [G.elev.x, 1.3, 9.3] }), lines: [[2.6, '나', '오늘도 무사히 지나가자.']],
        enter() { CAM.yaw = Math.PI; CAM.pitch = .34; later(20, () => { elev(true); sfx('ding'); }); later(72, () => { P.auto = { x: G.elev.x, z: 8.3, spd: 1.3, then: { x: G.elev.x + 1.4, z: 7.7, spd: 1.2, face: 0 } }; }); } },
      { t: '사원증 찍기', type: 'use', at: () => find('timeclock'), label: '사원증 찍기', done(c) {
        const late = Math.random() < .3; setScreen(find('timeclock'), late ? 'clocklate' : 'clockok'); sfx('beep'); elev(false);
        c.say('단말기', late ? '삑. 오전 9시 1분. 지각입니다.' : '삑. 오전 8시 59분. 정상 출근입니다.'); if (late) later(150, () => c.say('나', '…1분인데.'));
      } },
      { t: '내 자리로 가기', type: 'reach', at: () => { const ch = my('Chair'); return ch ? ch.body.position : { x: 0, z: -.74 }; }, r: 1.7,
        enter() { ui.tips(G.mobile ? ['왼쪽 원을 끌어서 걷기', '오른쪽 화면을 끌어서 둘러보기', '점프 버튼으로 뛰어오르기'] : ['<b>W A S D</b> 걷기', '<b>마우스</b> 둘러보기 · 화면을 한 번 누르면 고정', '<b>스페이스</b> 점프']); } },
      { t: '자리에 앉기', type: 'sit', at: () => my('Chair') },
      { t: '컴퓨터 켜기', type: 'use', at: () => my('Desk'), label: '컴퓨터 켜기', done(c) { setScreen(my('Monitor'), 'update'); sfx('beep'); c.say('컴퓨터', '업데이트 중입니다. PC를 끄지 마세요.'); } },
      { t: '(업데이트)', type: 'cut', hide: true, sec: 3.6, lines: [[2, '나', '37퍼센트… 오늘 하루도 길겠다.']] },
    ],
  },
  meeting: {
    id: 'meeting', n: '끝나지 않는 회의', sub: '지금 3쪽, 전체 126쪽', slot: 1, clock: [9, 55], sky: 'morning', rampage: 18, after: '…후. 회의록은 내가 안 쓴다.',
    needs: ['mtgTable', 'mtgChair', 'projector', 'screen', 'whiteboard', 'mg0', 'mg1', 'mg2', 'mg3', 'mg4'],
    setup() { setScreen(find('screen'), 'slide'); },
    steps: [
      idle(3.8, [[.4, '나', '오늘은 조용히 지나가려나.']]),
      { t: '메신저 확인하기', type: 'use', at: () => my('Desk'), label: '메신저 확인', enter() { const mo = my('Monitor'); setScreen(mo, 'msg', '팀장님: 10시 회의실. 전원 참석.'); sfx('beep'); later(10, () => sfx('beep')); if (mo) mo.punch = 8; }, done(c) { c.say('팀장님', '{me}, 회의 시작합니다. 얼른 들어와요.'); } },
      { t: '회의실 들어가기', type: 'reach', at: () => ({ x: 9.6, z: -4.6 }), r: 1.3 },
      { t: '회의실 의자에 앉기', type: 'sit', at: () => find('mtgChair'), done(c) { c.say('팀장님', '자, 오늘 안건이 좀 많습니다.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 9, lines: [[1.8, '팀장님', '그래서 결론이 뭐죠?'], [4.3, 'who', '이건 다음 회의에서 다시 얘기하죠.'], [6.8, '팀장님', '회의 끝나고 잠깐 회의 좀 합시다.']] },
      { t: '빔 프로젝터 떨어뜨리기', type: 'break', list: () => [TAG.projector], hint: '의자를 들어 던지거나 점프해서 때리기', done() { setScreen(find('screen'), 'off'); } },
      { t: '회의 탁자 엎기', type: 'use', at: () => find('mtgTable'), label: '탁자 엎기 (꾹 누르기)', hold: .7, done() { flipProp(find('mtgTable')); } },
      { t: '유리벽 깨고 나가기', type: 'break', list: () => [TAG.mg0, TAG.mg1, TAG.mg2, TAG.mg3, TAG.mg4], need: 2, hint: '의자를 던지면 한 번에 깨집니다' },
      { t: '화이트보드 부수기', type: 'break', list: () => [TAG.whiteboard] },
    ],
  },
  report: {
    id: 'report', n: '보고서 7차 반려', sub: '「폰트가 좀…」', slot: 1, clock: [11, 20], sky: 'day', rampage: 18, screen: 'doc', after: '…후. 이번엔 진짜 최종이다.',
    needs: ['bossDesk', 'frame_boss', 'trophyCab', 'trophy0', 'trophy1', 'trophy2'],
    setup() { const d = my('Desk'); if (d) on(d, 'report', -.3, .25, { tag: 'report' }); },
    steps: [
      idle(3.8, [[.4, '나', '일곱 번째 수정. 이번엔 진짜 최종.']]),
      { t: '보고서 저장하기', type: 'use', at: () => my('Desk'), label: '저장하기 (꾹 누르기)', hold: 1, done(c) { setScreen(my('Monitor'), 'save'); sfx('beep'); later(50, () => c.say('who', '{me}, 보고서 다 됐으면 가져와 봐.')); } },
      { t: '보고서 집어 들기', type: 'pick', at: () => find('report') },
      { t: '부장실 책상에 올려놓기', type: 'carryTo', item: () => find('report'), at: () => ({ x: -11.2, z: -5.7 }), label: '보고서 올려놓기', done() { placeOn(find('report'), find('bossDesk'), .15, .2); sfx('paper'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8.5, lines: [[.8, 'who', '음… 폰트가 좀…'], [3.4, 'who', '줄 간격이 마음에 안 드네.'], [6, 'who', '처음 게 낫다. 다시 해 와.']], onLine() { const r = find('report'); if (r) { fx.text(top(r), '반려', 'stamp'); sfx('stamp'); G.shake = .12; } } },
      { t: '보고서 찢어 버리기', type: 'use', at: () => find('report'), label: '보고서 찢기 (연타)', mash: 8, onMash() { const r = find('report'); if (r) fx.sheet(top(r), 3, '#ffffff', 2.5); sfx('paper'); }, done(c) { const r = find('report'); if (r) { fx.sheet(top(r), 36, '#ffffff', 5); fx.text(top(r), '쫘악—!', 'word big'); kill(r); } sfx('paper'); G.shake = .2; slow(.4, 40); c.say('나', '다시는… 안 합니다.'); } },
      { t: '사훈 액자 깨기', type: 'break', list: () => [TAG.frame_boss], hint: '결재판이나 명패를 집어 던져도 됩니다' },
      { t: '부장 책상 엎기', type: 'use', at: () => find('bossDesk'), label: '책상 엎기 (꾹 누르기)', hold: .7, done(c) { flipProp(find('bossDesk')); c.say('who', '자, 자네 지금 뭐 하는 건가!'); } },
      { t: '트로피 전부 부수기', type: 'break', list: () => [TAG.trophy0, TAG.trophy1, TAG.trophy2] },
    ],
  },
  lunch: {
    id: 'lunch', n: '점심시간', sub: '컵라면 3분도 못 기다리게 한다', slot: 2, clock: [11, 58], sky: 'day', rampage: 18, after: '…라면 다 불었다.',
    needs: ['counter', 'cooler', 'phone_pantry', 'microwave', 'coffee', 'noodle', 'pantryTable', 'pantryChair', 'd3_Desk', 'phone_d3', 'd5_Desk', 'phone_d5'],
    setup() { const ct = find('counter'); if (ct) on(ct, 'cellphone', .1, -.72, { ry: PH2, tag: 'cell' }); },
    steps: [
      idle(4.2, [[.4, '나', '2분만 더…']], { tick(c, t) { G.clock = 11 * 60 + 58 + Math.min(2, t / 60 / 3.6 * 2); } }),
      { t: '(점심 종)', type: 'cut', hide: true, sec: 2.2, lines: [[.3, '나', '드디어 점심.']], enter() { sfx('ding'); setScreen(my('Monitor'), 'off'); G.clock = 12 * 60; } },
      { t: '탕비실로 가기', type: 'reach', at: () => ({ x: -10.8, z: -.5 }), r: 1.6 },
      { t: '컵라면 집어 들기', type: 'pick', at: () => find('noodle') },
      { t: '정수기에서 뜨거운 물 받기', type: 'carryTo', item: () => find('noodle'), at: () => find('cooler'), label: '뜨거운 물 받기', done() { sfx('water'); G.steam = find('noodle'); } },
      { t: '탁자에 컵라면 놓기', type: 'carryTo', item: () => find('noodle'), at: () => find('pantryTable'), label: '컵라면 내려놓기', done() { placeOn(find('noodle'), find('pantryTable'), 0, .22); } },
      { t: '의자에 앉기', type: 'sit', at: () => find('pantryChair'), done(c) { c.say('나', '3분만 기다리면 된다. 3분만.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 6, lines: [[1.8, '전화', '따르릉— 따르릉—'], [4, '전화', '따르릉— 따르릉— 따르릉—']], onTick(c, t) { if (t % 70 === 40) ring('phone_pantry'); } },
      { t: '전화 받기', type: 'use', at: () => find('phone_pantry'), label: '전화 받기', done(c) { c.say('거래처', '식사 중에 죄송한데요~ 메일 보냈는데 보셨어요?'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 6.5, lines: [[2.6, '단톡방', '@전체 필독. 다들 주말에 시간 되죠?'], [4.8, '단톡방', '넵! 넵넵! 확인 부탁드립니다!']], onTick(c, t) { if (t > 150 && t % 36 === 0) { sfx('beep', .7); const p = find('cell'); if (p) p.punch = 8; buzz(20); } } },
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
  printer: {
    id: 'printer', n: '복합기 용지 걸림', sub: '급한 인쇄 한 장이 안 나온다', slot: 3, clock: [14, 20], sky: 'afternoon', rampage: 18, screen: 'doc', after: '…후. 다음부턴 손으로 쓰겠습니다.',
    needs: ['printer', 'bat'],
    setup() { const p = find('printer'); if (p) { p.armor = .1; setScreen(p, 'ready'); if (p.g.userData.lid) p.g.userData.lid.visible = true; } },
    steps: [
      idle(4.9, [[.4, '나', '오후엔 왜 이렇게 졸리지…'], [2.6, 'who', '{me}, 아까 그 자료 5부만 뽑아 와.']]),
      { t: '인쇄 보내기', type: 'use', at: () => my('Desk'), label: '인쇄하기', done() { setScreen(my('Monitor'), 'print'); sfx('beep'); } },
      { t: '복사실로 가기', type: 'reach', at: () => ({ x: 12.2, z: -.4 }), r: 1.4 },
      { t: '출력물 확인하기', type: 'use', at: () => find('printer'), label: '출력물 확인', done(c) { const p = find('printer'); setScreen(p, 'jam'); [0, 9, 18].forEach(d => later(d, () => sfx('beep'))); c.say('복합기', '삐빅. 용지가 걸렸습니다. 트레이 2를 확인하세요.'); } },
      { t: '걸린 종이 뽑기', type: 'use', at: () => find('printer'), label: '걸린 종이 뽑기 (꾹 누르기)', hold: 1.4, done(c) { const p = find('printer'); fx.sheet(top(p), 7, '#ffffff', 2.5); sfx('paper'); setScreen(p, 'toner'); c.say('복합기', '토너가 부족합니다.'); later(120, () => c.say('나', '…방금 갈았는데요.')); } },
      { t: '복합기 걷어차기', type: 'hit', at: () => find('printer'), n: 3, heavy: true, hint: '강타 3번', done() { fx.text(top(find('printer')), '덜컹!', 'word big'); sfx('metal'); G.shake = .25; } },
      { t: '덮개 뜯어내기', type: 'use', at: () => find('printer'), label: '덮개 뜯어내기 (연타)', mash: 6, onMash() { sfx('plastic'); G.shake = .1; }, done() { const p = find('printer'), b = p.body.position; p.g.userData.lid.visible = false; const l = spawn('lid', b.x - .7, b.y + .9, b.z, { v: { x: -3, y: 6, z: rand(-1, 1) }, av: { x: 3, y: 2, z: 4 } }); l.thrownT = G.tick; fx.text(top(p), '우지끈!', 'word big'); sfx('plastic'); sfx('metal'); fx.sheet(top(p), 12); } },
      { t: '야구방망이 집어 들기', type: 'equip', weapon: 'bat', at: () => find('bat') },
      { t: '복합기 박살 내기', type: 'break', list: () => [TAG.printer], enter() { const p = find('printer'); if (p) p.armor = 1; }, done(c) { later(45, () => c.say('나', '서비스 기사님은… 이제 안 오셔도 됩니다.')); } },
    ],
  },
  overtime: {
    id: 'overtime', n: '퇴근 5분 전', sub: '「이것만 하고 가~」', slot: 3, clock: [17, 50], sky: 'evening', rampage: 18, after: '…후. 내일 보고는 내일의 내가.',
    needs: ['clock', 'win2', 'win3', 'win4'],
    steps: [
      idle(4, [[.4, '나', '5시 50분. 가방은 싸 놨다.']], { tick(c, t) { G.clock = 17 * 60 + 50 + Math.min(5, t / 60 / 3.6 * 5); } }),
      { t: '컴퓨터 끄고 퇴근 준비', type: 'use', at: () => my('Desk'), label: '컴퓨터 끄기', done(c) { setScreen(my('Monitor'), 'update'); sfx('beep'); c.say('컴퓨터', '업데이트 중입니다. 37퍼센트. PC를 끄지 마세요.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8.5, lines: [[.9, 'who', '퇴근 전에 이것만~'], [3.6, 'who', '금방 끝나, 금방.'], [6.2, 'who', '내일 아침 9시 보고니까.']], onLine(c, k) { const d = my('Desk'); if (!d) return; const b = d.body.position; TAG['ot' + k] = spawn('papers', b.x - .42 + k * .42, 2.3, b.z + .12, { size: [.22, .2 + k * .07, .3] }); later(22, () => { sfx('wood', .7); G.shake = .1; }); } },
      { t: '모니터 내리치기', type: 'hit', at: () => my('Monitor'), n: 3, hint: '때리기 3번' },
      { t: '쌓인 서류 날려 버리기', type: 'break', list: () => [TAG.ot0, TAG.ot1, TAG.ot2] },
      { t: '본체를 창밖으로 던지기', type: 'out', item: () => TAG.myPc, hint: 'E로 들고, 창문을 보고 때리기 버튼' },
      { t: '벽시계 떨어뜨리기', type: 'break', list: () => [TAG.clock], hint: '물건을 던지거나 점프해서 때리기', done(c) { fx.text({ x: 2, y: 2.2, z: -3 }, '6시다!', 'word big'); c.say('나', '6시다. 퇴근합니다.'); } },
    ],
  },
  // ───── 다른 층으로 올라가고 내려가는 상황: 내 자리에서 불려 나가 엘리베이터를 탄다
  exec: {
    id: 'exec', n: '임원 보고', sub: '사장님 앞에서 3쪽까지', slot: 1, floor: 'exec', clock: [10, 25], sky: 'day', rampage: 18, screen: 'doc', after: '…후. 다음 분기 보고는 메일로 하겠습니다.', needs: [],
    steps: [
      idle(4.4, [[.4, '나', '임원 보고… 오늘 내가 하는 거 맞지?'], [2.5, 'who', '{me}, 12층! 사장님 들어오셨다. 빨리!']]),
      { t: '보고 자료 챙기기', type: 'use', at: () => my('Desk'), label: '자료 챙기기 (꾹 누르기)', hold: .8, done(c) { setScreen(my('Monitor'), 'save'); sfx('beep'); c.say('나', '…USB 어디 뒀더라.'); } },
      { t: '엘리베이터 타고 12층으로', type: 'ride', to: 'exec' },
      { t: '대회의실 들어가기', type: 'reach', at: () => ({ x: 6.25, z: 1.0 }), r: 1.3, enter(c) { c.say('비서', '들어가세요. 사장님 기다리십니다.'); } },
      { t: '발표 화면 켜기', type: 'use', at: () => find('boardTv'), range: 2.7, label: '화면 켜기', done(c) { setScreen(find('boardTv'), 'slide'); sfx('beep'); c.say('사장님', '시작해 봐.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 9.5, lines: [[1.2, '사장님', '3쪽까지 봤는데, 그래서 결론이 뭐야?'], [3.6, '전무님', '사장님 말씀은 처음부터 다시 하라는 거야.'], [6.1, 'who', '(작게) 그러게 내가 그렇게 하라고 했지?'], [8.3, '사장님', '다음 주까지. 주말 있잖아?']], onLine() { const t = find('boardTv'); if (t) { fx.text(top(t), '반려', 'stamp'); sfx('stamp'); G.shake = .12; } } },
      { t: '대형 화면 부수기', type: 'break', list: () => [TAG.boardTv], hint: '의자를 들어 던지면 한 번에' },
      { t: '16인 탁자 엎기', type: 'use', at: () => find('boardTable'), range: 2.6, label: '탁자 엎기 (꾹 누르기)', hold: .7, done(c) { flipProp(find('boardTable')); c.say('전무님', '자, 자네 지금 뭐 하는 건가!'); } },
      { t: '「사장」 명패 창밖으로', type: 'out', item: () => TAG.boardPlate, hint: 'E로 들고, 창문을 보고 때리기 버튼' },
      { t: '대회의실 의자 4개 날리기', type: 'break', list: () => Object.keys(TAG).filter(k => /^bc\d+$/.test(k)).map(k => TAG[k]), need: 4 },
    ],
  },
  cafe: {
    id: 'cafe', n: '커피 심부름', sub: '「아아 12잔, 자네 카드로」', slot: 2, floor: 'lobby', clock: [12, 10], sky: 'day', rampage: 18, after: '…후. 커피는 각자 사 드세요.', needs: [],
    steps: [
      idle(4.4, [[.4, '나', '점심 먹었으니 커피 한 잔…'], [2.5, 'who', '{me}, 내려가는 김에 팀 커피 좀. 아아 12잔! 자네 카드로~']]),
      { t: '엘리베이터 타고 1층으로', type: 'ride', to: 'lobby' },
      { t: '카페 카운터로 가기', type: 'reach', at: () => ({ x: -10.0, z: -1.6 }), r: 1.4 },
      { t: '아아 12잔 주문하기', type: 'use', at: () => find('cafeCounter'), label: '주문하기', done(c) { c.say('카페', '아이스 아메리카노 12잔이요? 잠시만요~'); sfx('beep'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8, lines: [[1.2, '단톡방', '{me}님 제 건 샷 추가요~'], [3.4, '단톡방', '저는 디카페인 오트라떼 미지근하게요!'], [5.8, 'who', '카드값은 나중에 줄게~']], onTick(c, t) { if (t > 60 && t % 40 === 0) { sfx('beep', .6); buzz(15); } } },
      { t: '커피 캐리어 받기', type: 'pick', at: () => find('cuptray'), enter(c) { const cc = find('cafeCounter'); if (cc && !find('cuptray')) on(cc, 'cuptray', 1.0, .12, { tag: 'cuptray' }); c.say('카페', '아아 12잔 나왔습니다~ 54,000원이요!'); sfx('ding'); } },
      { t: '엘리베이터로 가기', type: 'reach', at: () => ({ x: G.elev.x, z: 7.5 }), r: 1.3, enter() { if (!find('notice')) put('notice', G.elev.x + 1.05, 8.45, { tag: 'notice' }); }, done(c) { c.say('안내 방송', '엘리베이터 정기 점검 중입니다. 계단을 이용해 주십시오.'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 6.5, lines: [[.9, '나', '…7층까지.'], [2.9, '단톡방', '{me}님 커피 언제 와요? 얼음 다 녹겠어요'], [5, 'who', '오는 길에 빨대도 챙겨~']] },
      { t: '커피 캐리어 집어 던지기', type: 'break', list: () => [TAG.cuptray], hint: '들고 있는 채로 때리기 버튼 = 던지기' },
      { t: '케이크 진열장 깨기', type: 'break', list: () => [TAG.showcase] },
      { t: '보안 게이트 3개 부수기', type: 'break', list: () => [TAG.gate0, TAG.gate1, TAG.gate2, TAG.gate3, TAG.gate4], need: 3 },
      { t: '자판기 쓰러뜨리기', type: 'use', at: () => find('vending'), label: '자판기 쓰러뜨리기 (꾹 누르기)', hold: .7, done() { flipProp(find('vending')); } },
    ],
  },
  valet: {
    id: 'valet', n: '사장님 차 빼 주기', sub: '「세차도 좀 해 놓고」', slot: 3, floor: 'parking', clock: [15, 30], sky: 'afternoon', rampage: 18, after: '…후. 세차비는 청구서에 넣겠습니다.', needs: [],
    steps: [
      idle(4.4, [[.4, '나', '오후 3시 반. 졸리다…'], [2.5, '비서', '{me} 씨죠? 사장님이 차 좀 빼 달래요. 세차도 해 놓으시고요.']]),
      { t: '엘리베이터 타고 B2로', type: 'ride', to: 'parking', arrive() { const c = find('bossCar'); if (c) c.hp = c.maxHp = 900; } },
      { t: '사장님 차 찾기', type: 'reach', at: () => ({ x: -5, z: -3.3 }), r: 1.6, done(c) { c.say('나', '…이중 주차는 사장님이 하셨네.'); } },
      { t: '세차하기', type: 'use', at: () => find('bossCar'), range: 2.7, label: '세차하기 (꾹 누르기)', hold: 1.8, whileHold: carWash, done(c) { c.say('비서', '광택도 내 주시래요. 왁스는 사비로~'); } },
      { t: '참는다… 참는다…', type: 'wait', sec: 8, lines: [[1, '경비실 방송', '{me} 님, 사장님 차 앞 차량 이동 바랍니다.'], [3.4, '비서', '그냥 지게차로 들어서 옮기시래요. 빨리요.'], [6, 'who', '{me}, 끝났으면 내 차도 세차 좀~']] },
      { t: '지게차 타기', type: 'use', at: () => find('forklift'), range: 2.4, label: '지게차 타기', enter() { G.toys = true; }, done() { mount(find('forklift')); } },
      { t: '지게차로 사장님 차 들어 올리기', type: 'until', ok: () => { const c = find('bossCar'); return !c || c.lifted; }, at: () => find('bossCar'), hint: '포크를 차 앞쪽 밑으로 · 좌클릭 꾹 = 올리기', bot() { const c = find('bossCar'); if (c) c.lifted = true; } },
      { t: '사장님 차 유리 깨기', type: 'until', ok: () => { const c = find('bossCar'); return !c || c.g.userData.glassGone; }, at: () => find('bossCar'), hint: 'E = 지게차에서 내리기 · 빠루는 하역장에', bot() { const c = find('bossCar'); if (c) damage(c, c.maxHp * .3, c.body.position, true, true); } },
      { t: '사장님 차 폐차시키기', type: 'break', list: () => [TAG.bossCar], hint: '드럼통을 던져도 터집니다' },
    ],
  },
  resign: {
    id: 'resign', n: '사직서', sub: '가슴속에 품고 다니던 그것', slot: 4, clock: [23, 0], sky: 'night', rampage: 0, final: true, screen: 'sheet',
    needs: ['bossDesk', 'safe', 'portrait', 'frame_boss'],
    setup() { const s = find('safe'); if (s) s.hp = s.maxHp = 900; },
    steps: [
      idle(4, () => [[.4, '나', (G.dayList || []).includes('overtime') ? '…칼퇴한다며. 결국 밤 11시.' : '밤 11시. 오늘도 야근.']]),
      { t: '저장하기', type: 'use', at: () => my('Desk'), label: '저장하기 (꾹 누르기)', hold: 1, done(c) { setScreen(my('Monitor'), 'blue'); sfx('zap', .5); c.say('나', '…저장 안 했는데.'); } },
      { t: '(정적)', type: 'cut', hide: true, sec: 3.2, cam: 'face', face: 'endure' },
      { t: '서랍 열기', type: 'use', at: () => my('Desk'), label: '서랍 열기', done(c) { const d = my('Desk'); if (d) on(d, 'envelope', .3, .25, { tag: 'env' }); sfx('wood', .5); setFace('normal'); c.say('나', '…오늘이다.'); } },
      { t: '사직서 집어 들기', type: 'pick', at: () => find('env') },
      { t: '부장 책상에 사직서 내려치기', type: 'carryTo', item: () => find('env'), at: () => ({ x: -11.2, z: -5.7 }), label: '사직서 내려치기', done(c) {
        const d = find('bossDesk'); placeOn(find('env'), d, 0, .15); slow(.25, 80); sfx('stamp'); sfx('boom', .7); G.shake = .5; G.flash = 6; buzz([60, 40, 100]); setFace('rage');
        if (d) { fx.text(top(d), '쾅!!', 'word big'); for (const q of G.props) if (!q.dead && !q.fixed && q !== d && q.type !== 'envelope' && Math.hypot(q.body.position.x - d.body.position.x, q.body.position.z - d.body.position.z) < 1.3 && q.body.position.y > .8) shove(q, rand(-1, 1), rand(3, 5), rand(-1, 1)); }
        c.say('who', '자, 자네… 이게 뭔가?'); later(150, () => c.say('나', '어차피 다 부쉈습니다. 그동안 감사했습니다.'));
      } },
      { t: '부장 책상 엎기', type: 'use', at: () => find('bossDesk'), label: '책상 엎기 (꾹 누르기)', hold: .7, done() { flipProp(find('bossDesk')); } },
      { t: '금고 부수기', type: 'break', list: () => [TAG.safe], hint: '오함마는 로비 왼쪽 구석, 골프채는 이 방에 있습니다' },
      { t: '초상화와 사훈 떼어 버리기', type: 'break', list: () => [TAG.portrait, TAG.frame_boss] },
      { t: '엘리베이터 타기', type: 'reach', at: () => ({ x: G.elev.x, z: 8.1 }), r: 1.0, enter() { elev(true); sfx('ding'); } },
      { t: '(퇴근)', type: 'cut', hide: true, sec: 3.4, cam: () => ({ pos: [G.elev.x + 1.7, 1.45, 5.9], look: [G.elev.x, 1.3, 9.4] }), face: 'relief',
        enter() { P.auto = { x: G.elev.x, z: 9.95, spd: 1.4, face: Math.PI }; later(125, () => elev(false)); later(175, () => sfx('ding')); } },
    ],
  },
};
export const MISSION_IDS = ['meeting', 'exec', 'report', 'lunch', 'cafe', 'printer', 'valet', 'overtime'];

// ───── 진행
export const MS = { m: null, i: -1, step: null, phase: 'idle', lines: [] };
let marker;
function mk() {
  if (marker) return marker;
  marker = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: .92, depthTest: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(.16, .34, 12), mat); cone.rotation.x = PI; cone.renderOrder = 9; marker.add(cone);
  const ringM = new THREE.Mesh(new THREE.RingGeometry(.45, .55, 28), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false })); ringM.rotation.x = -PH2; marker.add(ringM); marker.userData = { cone, ring: ringM };
  X.scene.add(marker); return marker;
}
const ctx = { say: (who, text) => say(who === 'who' ? MS.co.who : who, text.replace('{me}', MS.me).replace('{who}', MS.co.who)) };
const linesOf = s => typeof s.lines === 'function' ? s.lines() : (s.lines || []);
const shown = new Set();
function tipFor(s) {
  const k = s.type === 'hit' || s.type === 'break' ? 'hit' : s.type === 'pick' || s.type === 'carryTo' || s.type === 'out' ? 'carry' : s.hold ? 'hold' : null;
  if (!k || shown.has(k)) return; shown.add(k);
  ui.tips([{ hit: G.mobile ? '때리기 버튼: 때리기 · 강타 버튼: 강타(공중에서 내려찍기)' : '<b>좌클릭</b> 때리기 · <b>우클릭</b> 강타 (공중에서 내려찍기)', carry: G.mobile ? '행동 버튼: 집기 · 든 채 때리기 버튼: 던지기' : '<b>E</b> 집기 · 든 채 <b>좌클릭</b> 던지기', hold: G.mobile ? '행동 버튼을 꾹 누르세요' : '<b>E</b>를 꾹 누르세요' }[k]]);
}

export function startMission(m, co, me, onEnd, pre = []) {
  Object.assign(MS, { m, co, me, i: -1, step: null, phase: 'play', onEnd, zero: false, rt: 0, pre, riding: false, lastMoney: G.money, lastWait: m.steps.map(s => s.type).lastIndexOf('wait') });
  G.onHit = onHit; G.interact = interact; G.steam = null;
  setFace('normal');
  next();
}
export function stopMission() { MS.phase = 'idle'; MS.step = null; MS.riding = false; G.interact = null; G.onHit = null; G.want = null; G.lookAt = null; if (marker) marker.visible = false; ui.prompt(null); }
// 층을 다시 지으면(resetWorld) 맞은 물건 알림이 지워지므로 다시 건다. 표시(marker)도 새 장면에 다시 붙인다
export function rebind() { if (MS.phase === 'idle' || MS.phase === 'done') return; G.onHit = onHit; G.interact = interact; if (marker && !marker.parent) X.scene.add(marker); }
function visInfo() { const st = MS.m.steps; let k = 0; for (let j = 0; j < MS.i && j < st.length; j++) if (!st[j].hide) k++; return { list: st.filter(s => !s.hide).map(s => s.t), idx: MS.i >= st.length ? 99 : k }; }
function next() {
  const m = MS.m, prev = MS.step; MS.i++;
  let s = m.steps[MS.i];
  // 연출 카메라를 쓰던 단계가 끝나면 등 뒤 시점으로 돌아온다
  if (prev && (prev.type === 'wait' || (prev.type === 'cut' && prev.cam && prev.cam !== 'swoop')) && !(s && (s.type === 'wait' || (s.type === 'cut' && s.cam)))) camTo('follow', .9);
  if (!s) { MS.step = null; const v = visInfo(); ui.objectives(v.list, 99); ui.prompt(null); return m.rampage ? rampage() : finish(); }
  if (s.type === 'cut' || s.type === 'wait') {
    let lines = linesOf(s);
    if (s.idle && MS.pre.length) { const off = MS.pre.length * 2.5; lines = MS.pre.map((l, k) => [.3 + k * 2.5, l[0], l[1]]).concat(lines.map(([t, w, x]) => [t + off, w, x])); s = Object.assign({}, s, { sec: s.sec + off }); MS.pre = []; }
    MS.lines = lines;
  }
  MS.step = s; Object.assign(MS, { t: 0, n: 0, hold: 0, mash: 0, lineK: 0 });
  if (s.type === 'break') MS.total = s.list().filter(Boolean).length;
  if (s.type === 'cut') {
    P.lock = Math.round(s.sec * 60);
    if (s.cam === 'swoop') camTo('follow', s.sec * .8); else if (s.cam === 'face') faceCam(); else if (typeof s.cam === 'function') { const c = s.cam(); camHold(c.pos, c.look); }
    if (s.face) setFace(s.face);
  }
  if (s.type === 'wait') { P.lock = Math.round(s.sec * 60); setFace('endure'); faceCam(); music('tense'); }
  s.enter && s.enter(ctx);
  const v = visInfo(); ui.objectives(v.list, v.idx, s.hint);
  tipFor(s);
}
function complete(skip) {
  const s = MS.step; if (!s) return;
  if (!skip && s.done) s.done(ctx);
  if (s.type === 'wait') { const last = MS.i >= MS.lastWait; setFace(last ? 'rage' : 'normal'); music(last ? 'rage' : G.bgmBase || 'office'); }
  if (!s.hide) sfx('up', .5);
  next();
}
function rampage() { music('rage'); MS.phase = 'rampage'; MS.rt = MS.m.rampage * 60; G.mult = Math.max(G.mult, 2); ui.big('뚜껑 열렸다!', '자유 난동 ' + MS.m.rampage + '초 · 피해액 2배'); later(100, () => ui.over('')); sfx('special'); G.flash = 6; G.rage = 100; setFace('rage'); if (marker) marker.visible = false; ui.tips([G.mobile ? '필살기 버튼 · 행동 꾹: 책상 엎기' : '<b>Q</b> 필살기 · <b>E</b> 꾹: 책상 엎기 · 들고 던지기']); }
function finish() { if (MS.phase === 'done') return; const m = MS.m; stopMission(); MS.phase = 'done'; MS.onEnd && MS.onEnd({ stress: G.stress, final: m.final }); }

function targetPos(s) {
  if (s.type === 'cut' || s.type === 'wait') return null;
  if (s.type === 'ride') return MS.riding ? null : { x: G.elev ? G.elev.x : -3.5, y: 1.3, z: 9.75 };
  if (s.type === 'break') { const p = s.list().find(q => q && !q.dead); return p ? top(p) : null; }
  if (s.type === 'out') { const it = s.item(); if (!it || it.dead || it.out) return null; return P.carry === it ? { x: clamp(P.body.position.x, -11, 11), y: 2.2, z: -8.7 } : top(it); }
  if (s.type === 'carryTo') { const it = s.item(); if (it && P.carry !== it) return top(it); }
  if (!s.at) return null; const a = s.at(); if (!a) return null;
  return a.body ? top(a) : { x: a.x, y: a.y ?? 1.2, z: a.z };
}
const near = (pos, r) => pos && Math.hypot(pos.x - P.body.position.x, pos.z - P.body.position.z) < r;
// 할 일 대상 가까이: 가운데까지 r 안이거나, 큰 물건(차·긴 탁자)은 겉면에서 팔 닿는 거리
const reach = (a, r) => { if (!a) return false; if (!a.body) return near(a, r); if (near(a.body.position, r)) return true; const pp = P.body.position; return distTo(a, { x: pp.x, y: a.body.position.y, z: pp.z }) < 1.3; };

function interact(press, held, dt) {
  const s = MS.step; if (!s || MS.phase !== 'play') return false;
  if (s.type === 'sit') { const ch = s.at(); if (!ch || !press || !near(ch.body.position, 1.6)) return false; sit(ch); return true; }
  if (s.type === 'carryTo') { const it = s.item(); if (!it || P.carry !== it) return false; const a = s.at(), pos = a.body ? a.body.position : a; if (!near(pos, 2.2)) return false; if (press) complete(); return press; }
  if (s.type !== 'use') return false;
  const a = s.at(); if (!a) return false; if (!reach(a, s.range || 2.2)) return false;
  if (s.hold) { if (held) { MS.hold += dt; s.whileHold && s.whileHold(ctx); if (MS.hold >= s.hold) complete(); return true; } return false; }
  if (!press) return false;
  if (s.mash) { MS.mash++; s.onMash && s.onMash(ctx); if (MS.mash >= s.mash) complete(); return true; }
  complete(); return true;
}
function onHit(p, dmg, heavy, byPlayer) {
  const s = MS.step; if (!s || s.type !== 'hit' || !byPlayer || p !== s.at() || (s.heavy && !heavy)) return;
  MS.n++; fx.text(top(p), MS.n + ' / ' + s.n, 'note'); if (MS.n >= s.n) later(1, () => { if (MS.step === s) complete(); });
}

export function tickMission(dt) {
  // 스트레스: 하루 동안 이어진다. 참으면 오르고, 부순 만큼 내려간다
  const dm = G.money - MS.lastMoney; MS.lastMoney = G.money;
  if (dm > 0 && MS.m) G.stress = Math.max(0, G.stress - dm / 1.2e7 * 100);
  if (G.steam && !G.steam.dead && G.tick % 14 === 0) fx.cloud(top(G.steam), 1, '#ffffff', .2, .02);
  if (MS.phase === 'rampage') { if (--MS.rt <= 0) finish(); G.stressMax = Math.max(G.stressMax, G.stress); return; }
  const s = MS.step; if (!s || MS.phase !== 'play') return;
  MS.t++;
  if (s.type === 'cut' || s.type === 'wait') {
    while (MS.lineK < MS.lines.length && MS.t >= MS.lines[MS.lineK][0] * 60) {
      const [, w, t] = MS.lines[MS.lineK]; ctx.say(w, t);
      if (s.type === 'wait') { G.stress = Math.min(100, G.stress + 12); tremble(); if (MS.i === MS.lastWait && MS.lineK === MS.lines.length - 1) { G.stress = 100; ui.boil(); } }
      s.onLine && s.onLine(ctx, MS.lineK); MS.lineK++;
    }
    s.tick && s.tick(ctx, MS.t); s.onTick && s.onTick(ctx, MS.t);
  }
  G.stressMax = Math.max(G.stressMax, G.stress);
  if (G.stress <= 0 && !MS.zero && !MS.m.noStamp) { MS.zero = true; G.mult = Math.max(G.mult, 1.5); ui.toast('스트레스 0%! 보너스 ×1.5'); sfx('up'); }
  const pos = targetPos(s), Mk = mk(); G.lookAt = pos;
  if (pos) { Mk.visible = true; Mk.position.set(pos.x, 0, pos.z); Mk.userData.cone.position.y = pos.y + .45 + Math.sin(G.tick * .12) * .08; Mk.userData.ring.position.y = .03; Mk.userData.ring.scale.setScalar(1 + Math.sin(G.tick * .1) * .08); } else Mk.visible = false;
  let prompt = null, prog = 0;
  if (s.type === 'cut') { if (MS.t >= s.sec * 60) return complete(); }
  else if (s.type === 'wait') { prompt = '참는 중…'; prog = MS.t / (s.sec * 60); if (MS.t >= s.sec * 60) return complete(); }
  else if (s.type === 'use') { const a = s.at(); if (!a) return complete(true); if (reach(a, s.range || 2.2)) { prompt = s.label; prog = s.hold ? MS.hold / s.hold : s.mash ? MS.mash / s.mash : 0; } if (s.hold && MS.hold > 0) MS.hold = Math.max(0, MS.hold - dt * .4); }
  else if (s.type === 'sit') { const ch = s.at(); if (!ch) return complete(true); if (P.seated === ch) return complete(); if (near(ch.body.position, 1.6)) prompt = '앉기'; }
  else if (s.type === 'hit') { if (!s.at()) return complete(true); }
  else if (s.type === 'break') { const alive = s.list().filter(q => q && !q.dead && !q.out).length, need = s.need || MS.total; if (MS.total - alive >= need || alive === 0) return complete(); }
  else if (s.type === 'reach') { if (near(pos, s.r || 1.5)) return complete(); }
  else if (s.type === 'pick') { const a = s.at(); if (!a) return complete(true); if (P.carry === a) return complete(); if (near(a.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'equip') { if (P.weapon === s.weapon) return complete(); let a = s.at(); if (!a || a.out) { const q = P.body.position; put(s.weapon, q.x + 1, q.z, { tag: s.weapon }); a = find(s.weapon); } if (near(a.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'carryTo') { const it = s.item(); if (!it) return complete(true); if (P.carry === it) { const a = s.at(), ap = a.body ? a.body.position : a; if (near(ap, 2.2)) prompt = s.label; } else if (near(it.body.position, 2)) prompt = '집어 들기'; }
  else if (s.type === 'out') { const it = s.item(); if (!it || it.dead || it.out) return complete(); }
  else if (s.type === 'ride') {
    // 엘리베이터 앞에 오면 문이 열리고, 안에 들어서면 층을 옮긴다(옮기는 일은 run.js의 G.rideTo)
    if (MS.riding) return;
    const pp = P.body.position, ex = G.elev ? G.elev.x : -3.5, d = Math.hypot(pp.x - ex, pp.z - 9.1);
    if (d < 3) elev(true);
    if (Math.abs(pp.x - ex) < .75 && pp.z > 9.3) { MS.riding = true; ui.prompt(null); G.rideTo(s.to, () => { MS.riding = false; s.arrive && s.arrive(ctx); if (MS.step === s) complete(); }); return; }
    if (d < 2.4) prompt = '엘리베이터 안으로 들어가기';
  }
  else if (s.type === 'until') { if (s.ok()) return complete(); if (G.auto && s.bot && MS.t > 90) s.bot(); }
  G.want = s.type === 'pick' || s.type === 'equip' ? s.at() : s.type === 'carryTo' ? s.item() : null;
  ui.prompt(prompt, prog, s.type === 'wait', s.type === 'ride');
}
export function missionHud() { return { left: MS.phase === 'rampage' ? Math.ceil(MS.rt / 60) : null }; }
void pick; void camHold;
