// 건물 층: 12층 임원층 · 7층 우리 팀(사무실) · 1층 로비·카페 · B2 지하주차장
// 모든 층은 같은 바닥 넓이(28×18m)이고, 엘리베이터는 남쪽 벽 x=-3.5 같은 자리에 있다
import { resetWorld, solid, GR } from './engine.js';
import { THREE, X, M, bx, cyl, sph, pl, textMat, labelMat, speckle, tex, setTime } from './gfx.js';
import { G } from './state.js';
import { put, on, hang, beginFloor, elevatorBay, sprinklers, buildOffice, EX } from './world.js';

const PI = Math.PI;

// ───── 층 소개와 도전과제 (k = 세는 사건, n = 몇 번)
export const FLOORS = {
  exec: {
    lv: '12', n: '임원층', sub: '사장실 · 대회의실 · 비서실', desc: '비싼 건 다 여기 있다. 수족관·도자기·금고', goals: [
      { id: 'e1', t: '사장님 수족관 깨기', k: 'tag:aquarium' },
      { id: 'e2', t: '회장님 도자기 깨기', k: 'tag:vase' },
      { id: 'e3', t: '사장실 금고 털기', k: 'tag:ceoSafe' },
      { id: 'e4', t: '대회의실 의자 8개 부수기', k: 'break:chair', n: 8 },
      { id: 'e5', t: '사장님 초상화 창밖으로', k: 'outtag:ceoPortrait' },
      { id: 'e6', t: '12층 창밖으로 10개 던지기', k: 'out', n: 10 },
    ],
  },
  office: {
    lv: '7', n: '우리 팀', sub: '내 자리 · 부장실 · 회의실 · 탕비실', desc: '매일 출근하는 그 층', goals: [
      { id: 'o1', t: '모니터 10대 박살', k: 'break:monitor', n: 10 },
      { id: 'o2', t: '복합기 부수기', k: 'break:printer' },
      { id: 'o3', t: '책상·캐비닛 5번 엎기', k: 'flip', n: 5 },
      { id: 'o4', t: '부장님 명패 창밖으로', k: 'outtag:nameplate' },
      { id: 'o5', t: '비상벨 눌러 스프링클러 켜기', k: 'alarm' },
      { id: 'o6', t: '바퀴의자 타고 10번 들이받기', k: 'ram:chair', n: 10 },
    ],
  },
  lobby: {
    lv: '1', n: '로비 · 카페', sub: '보안 게이트 · 회사 카페 · 로고 조형물', desc: '천장이 높다. 소화기 뿜으며 날아 보자', goals: [
      { id: 'l1', t: '보안 게이트 5개 다 부수기', k: 'break:gate', n: 5 },
      { id: 'l2', t: '로고 조형물 글자 다 날리기', k: 'break:letter', n: 'name' },
      { id: 'l3', t: '케이크 진열장 깨기', k: 'break:showcase' },
      { id: 'l4', t: '자판기 쓰러뜨리기', k: 'flip:vending' },
      { id: 'l5', t: '소화기 뿜으며 날기', k: 'fly' },
      { id: 'l6', t: '택배 카트로 5번 들이받기', k: 'ram:cart', n: 5 },
    ],
  },
  parking: {
    lv: 'B2', n: '지하주차장', sub: '사장님 차 · 지게차 · 드럼통', desc: '사장님 차가 여기 서 있다', goals: [
      { id: 'p1', t: '사장님 차 유리 깨기', k: 'carglass:bossCar' },
      { id: 'p2', t: '사장님 차 폐차시키기', k: 'tag:bossCar' },
      { id: 'p3', t: '지게차로 차 들어 올리기', k: 'liftcar' },
      { id: 'p4', t: '드럼통 3개 터뜨리기', k: 'break:drum', n: 3 },
      { id: 'p5', t: '차단봉 부러뜨리기', k: 'break:gatearm' },
      { id: 'p6', t: '라바콘 8개 날리기', k: 'break:cone', n: 8 },
    ],
  },
};
export const FLOOR_IDS = ['exec', 'office', 'lobby', 'parking'];
export const floorLv = id => FLOORS[id].lv === 'B2' ? 'B2' : FLOORS[id].lv + '층';
export const floorName = id => floorLv(id) + ' ' + FLOORS[id].n;

export function buildFloor(id, co, time) {
  if (id === 'exec') return buildExec(co, time);
  if (id === 'lobby') return buildLobby(co, time);
  if (id === 'parking') return buildParking(co);
  return buildOffice(co, time);
}

// ───── 공통: 바닥·천장·조명·창
function plane(L, mat, w, d, x = 0, y = 0, z = 0, down = false) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), typeof mat === 'string' ? M(mat) : mat); m.rotation.x = down ? PI / 2 : -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; L.add(m); return m; }
function shell(L, H, floorMat, wallMat, ceilMat = 'ceiling') {
  solid(0, -.5, 0, 28.4, 1, 18.4); solid(0, H + .5, 0, 28.4, 1, 18.4);
  plane(L, floorMat, 28, 18); plane(L, ceilMat, 28, 18, 0, H, 0, true);
  solid(-14.1, H / 2, 0, .2, H, 18.4, wallMat); solid(14.1, H / 2, 0, .2, H, 18.4, wallMat);
}
function panels(L, y) { for (let x = -12; x <= 12; x += 4) for (let z = -6.5; z <= 6.5; z += 4.3) bx(L, 1.3, .03, .6, 'lightPanel', x, y - .016, z).castShadow = false; }
function northWindows(H) {
  solid(0, .45, -9.1, 28.4, .9, .2, 'wall'); solid(0, (2.5 + H) / 2, -9.1, 28.4, H - 2.5, .2, 'wall');
  for (let i = 0; i < 8; i++) solid(-14 + i * 4, 1.7, -9.1, .3, 1.6, .22, 'wall');
  for (let i = 0; i < 7; i++) hang('window', -12 + i * 4, 1.7, -9.1, 0, { tag: 'win' + i });
  solid(0, H / 2, -9.02, 28, H, .06, null, { group: GR.PWALL, mask: GR.PLAYER });
}
const tiledM = {};
function tiled(key, rep, rough = .18) { const k = key + rep; if (tiledM[k]) return tiledM[k]; const t = tex(key).clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; return tiledM[k] = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: .05 }); }
function lamps(a, b) { if (X.lamps[0]) { X.lamps[0].position.set(...a); X.lamps[1].position.set(...b); } }

// ───── 12층 임원층: 사장실(서쪽) · 전망 복도 · 대회의실(동쪽) · 비서실과 엘리베이터 홀(남쪽)
export function buildExec(co, time = 'day') {
  const L = resetWorld(); G.scene = 'exec'; beginFloor(); setTime(time);
  const H = 3.2; G.outZone = { x: 14.4, z0: -9.5, z1: 9.4, label: '12층 창밖으로!', k: 3 }; G.ceil = H - .14;
  shell(L, H, 'carpetExec', 'wallWarm'); plane(L, tiled('marble', [24, 6.3]), 28, 7.4, 0, .003, 5.4);
  panels(L, H); elevatorBay(L, { H, wall: 'wallWarm', label: '12F ▲▼' }); northWindows(H);
  // 사장실: 나무 벽, 반쯤 열린 유리문
  solid(-1.5, H / 2, -3.75, .2, H, 10.5, 'wallWood');
  solid(-11.4, H / 2, 1.5, 5.2, H, .2, 'wallWood'); solid(-4.05, H / 2, 1.5, 5.1, H, .2, 'wallWood'); solid(-7.7, (2.4 + H) / 2, 1.5, 2.2, H - 2.4, .2, 'wallWood');
  hang('glasspane', -8.25, 1.2, 1.5, 0, { size: [1.1, 2.38, .05], frost: true, tag: 'ceoDoor' }); hang('glasspane', -6.62, 1.2, .95, PI / 2, { size: [1.1, 2.38, .05], frost: true });
  pl(L, 1.0, .22, textMat('대표이사실', { w: 320, h: 72, size: 44, bg: '#2b2420', fg: '#e3b23c' }), -9.6, 1.75, 1.62);
  const cd = put('ceodesk', -8, -6.2, { tag: 'ceoDesk' });
  on(cd, 'nameplate', 0, .42, { text: '대표이사', tag: 'ceoPlate' }); on(cd, 'monitor', -.75, -.15, { ry: PI, screen: 'chat' }); on(cd, 'papers', .8, .1, { size: [.22, .1, .3] }); on(cd, 'phone', .98, -.3); on(cd, 'mug', .45, -.3); on(cd, 'binder', -.2, -.32, { ry: .2 });
  put('chair', -8, -7.25, { boss: true, tag: 'ceoChair' });
  hang('portrait', -13.96, 1.95, -5.2, PI / 2, { size: [.8, 1.05, .05], price: 3000000, tag: 'ceoPortrait' });
  put('bookshelf', -13.75, -7.7, { ry: PI / 2 }); put('bookshelf', -13.75, -2.7, { ry: PI / 2 });
  put('aquarium', -11.4, 1.03, { ry: PI, tag: 'aquarium' });
  const ped = put('pedestal', -3.1, .75); on(ped, 'vase', 0, 0, { tag: 'vase' });
  put('sofa', -4.7, -4.45, { tag: 'ceoSofa' }); put('sofa', -4.7, -1.55, { ry: PI });
  const lt = put('table', -4.7, -3, { size: [1.3, .42, .62] }); on(lt, 'mug', -.3, 0); on(lt, 'mug', .3, .06); on(lt, 'papers', 0, -.1, { size: [.22, .05, .3] });
  const tc = put('lowcab', -1.82, -6.6, { ry: -PI / 2 }); on(tc, 'trophy', -.28, 0); on(tc, 'trophy', 0, 0); on(tc, 'trophy', .28, 0);
  put('safe', -2.0, -8.5, { ry: -PI / 2, price: 30000000, tag: 'ceoSafe' });
  put('golfbag', -13.4, -.4); put('golfclub', -12.4, -.7, { ry: .6, tag: 'golfclub' }); put('globe', -10.5, -7.9);
  put('orchid', -9.5, 1.05, { text: '축 연임' }); put('orchid', -5.7, 1.05, { text: '축 취임' }); put('bigplant', -13.3, .85);
  hang('frame', -1.62, 2.0, -3.6, -PI / 2, { text: co.motto, tag: 'ceoFrame' });
  // 전망 복도
  put('sofa', 0, -7.7, { ry: PI }); put('bigplant', -.95, .9); put('bigplant', .95, .9);
  // 대회의실: 16인 탁자, 유리벽
  solid(1.5, H / 2, -3.75, .2, H, 10.5, 'wallWarm'); solid(7.75, (2.6 + H) / 2, 1.5, 12.5, H - 2.6, .15, 'wallDark', { block: false });
  [[2.5, 1.9], [4.4, 1.9], [8.1, 1.9], [10.0, 1.9], [11.9, 1.9], [13.43, 1.06]].forEach(([x, w], i) => hang('glasspane', x, 1.3, 1.5, 0, { size: [w, 2.6, .05], tag: 'bgl' + i }));
  pl(L, 1.0, .22, textMat('대회의실', { w: 320, h: 72, size: 44, bg: '#2b2420', fg: '#e3b23c' }), 6.25, 2.85, 1.6);
  const bt = put('table', 7.9, -4.2, { size: [6.4, .76, 1.7], price: 4000000, tag: 'boardTable' });
  [-2.7, -.9, .9, 2.7].forEach((dx, i) => on(bt, 'laptop', dx, i % 2 ? .45 : -.45, { ry: i % 2 ? PI : 0 }));
  [-3, -1.8, -.6, .6, 1.8, 3].forEach((dx, i) => on(bt, 'bottle', dx, i % 2 ? .18 : -.18, { col: '#9fd8ff' }));
  [-2.25, 0, 2.25].forEach(dx => on(bt, 'binder', dx, .05, { ry: .3 }));
  ['상무', '전무', '부사장', '사장'].forEach((t, i) => on(bt, 'nameplate', -2.4 + i * 1.6, -.6, { text: t }));
  for (const x of [5.2, 6.1, 7.0, 7.9, 8.8, 9.7, 10.6]) { put('chair', x, -5.45); put('chair', x, -2.95, { ry: PI }); }
  put('chair', 11.65, -4.2, { ry: -PI / 2, boss: true }); put('chair', 4.15, -4.2, { ry: PI / 2 });
  hang('tv', 13.95, 1.7, -4.2, -PI / 2, { tag: 'boardTv', screen: 'slide' }); hang('projector', 7.9, H - .25, -4.2, PI / 2);
  put('whiteboard', 2.6, -8.3, { ry: .5 }); put('bigplant', 13.3, -8.4); put('bigplant', 13.3, .85);
  // 비서실·엘리베이터 홀
  const sd = put('desk', 5.0, 4.6, { ry: PI, tag: 'secDesk' }); on(sd, 'monitor', 0, -.2, { screen: 'chat' }); on(sd, 'keyboard', 0, .14); on(sd, 'phone', .6, -.12); on(sd, 'papers', -.56, -.16, { size: [.22, .14, .3] });
  put('chair', 5.0, 3.74); put('pc', 6.0, 4.5); put('printer', 7.6, 3.0, { ry: -PI / 2 }); put('cabinet', 2.6, 2.05);
  put('sofa', 10.5, 8.3, { ry: PI }); put('sofa', 13.3, 6.3, { ry: -PI / 2 }); const wt = put('table', 11.4, 6.6, { size: [1.1, .42, .6] }); on(wt, 'mug', 0, 0);
  put('orchid', -1.9, 8.72, { text: '축 영전' }); put('orchid', -5.2, 8.72, { text: '축 발전' });
  const bar = put('lowcab', -9.5, 8.6, { ry: PI }); on(bar, 'coffee', -.2, 0, { ry: PI }); on(bar, 'mug', .25, .05); on(bar, 'mug', .36, -.05);
  put('watercooler', -11.4, 8.6); put('bigplant', -13.3, 8.4); put('bigplant', 13.3, 2.6);
  hang('alarm', EX - 1.7, 1.4, 8.97, PI, { tag: 'alarm' }); hang('alarm', 1.38, 1.4, -1.0, -PI / 2);
  put('extinguisher', -1.0, 8.75); put('extinguisher', 1.9, 2.0);
  hang('logo', 4.0, 2.3, 8.96, PI, { text: co.name, tag: 'logo' }); hang('frame', -9.5, 1.95, 8.97, PI, { text: '정도경영' }); hang('banner', 9.6, 2.6, 8.98, PI, { text: '고객 감동 · 정도 경영' });
  sprinklers(L, H); lamps([-8, 2.75, -6.2], [7.9, 2.75, -4.2]);
  return L;
}

// ───── 1층 로비·회사 카페: 통유리, 로고 조형물, 보안 게이트, 카페, 라운지
export function buildLobby(co, time = 'day') {
  const L = resetWorld(); G.scene = 'lobby'; beginFloor(); setTime(time);
  const H = 5; G.outZone = { x: 14.4, z0: -9.5, z1: 9.4, label: '로비 밖으로!', k: 2 }; G.ceil = H - .15;
  shell(L, H, 'marble', 'wallWarm'); panels(L, H); elevatorBay(L, { H, wall: 'wallWarm', label: '1F ▲▼' });
  // 북쪽 통유리와 밖 광장
  solid(0, H - .2, -9.1, 28.4, .4, .25, 'metalDark');
  for (let i = 0; i <= 8; i++) solid(-14 + i * 3.5, H / 2, -9.1, .14, H, .25, 'metalDark');
  for (let i = 0; i < 8; i++) hang('glasspane', -12.25 + i * 3.5, (H - .4) / 2, -9.1, 0, { size: [3.36, H - .42, .05], tag: 'curtain' + i });
  solid(0, H / 2, -9.02, 28, H, .06, null, { group: GR.PWALL, mask: GR.PLAYER });
  solid(0, -.5, -29.6, 80, 1, 40.8); plane(L, 'plaza', 80, 40, 0, -.002, -29.3);
  for (const [x, z, h] of [[-18, -27, 14], [-6, -31, 22], [8, -28, 16], [21, -33, 26]]) bx(L, 9, h, 7, 'concrete', x, h / 2, z);
  for (const x of [-12, -4, 4, 12]) { cyl(L, .08, .1, 1.6, colorTrunk(), x, .8, -13, 8); sph(L, 1.1, 'leaf', x, 2.2, -13); }
  hang('logo', 0, H - .7, -8.93, 0, { text: co.name, size: [4.2, .8, .08], tag: 'logoIn' });
  // 로고 조형물
  const name = [...(co.name || '회사')].filter(c => c.trim()), sp = Math.min(1.2, 9 / name.length), len = name.length * sp;
  solid(0, .2, -3.6, len + .8, .4, 1.4, 'marbleDark');
  pl(L, Math.min(3.2, len), .26, textMat(co.name + ' — 고객과 함께 30년', { w: 768, h: 64, size: 40, bg: '#33373d', fg: '#e3b23c' }), 0, .2, -2.89);
  name.forEach((ch, k) => put('letter', (k - (name.length - 1) / 2) * sp, -3.6, { base: .4, text: ch, size: [Math.min(1.05, sp - .08), 1.3, .3], price: 1500000, tag: 'sc' + k }));
  // 보안 게이트·데스크
  [-3.2, -1.6, 0, 1.6, 3.2].forEach((x, i) => put('gate', x, 1.6, { tag: 'gate' + i }));
  const rd = put('reception', 6.8, 2.0, { ry: PI, text: co.name, tag: 'reception' }); on(rd, 'monitor', .5, .1, { ry: PI, screen: 'chat' }); on(rd, 'phone', -.6, .1, { ry: PI });
  put('chair', 6.8, 2.85, { ry: PI }); put('hammer', 8.6, 3.5, { ry: .4, tag: 'hammer' }); put('kiosk', 4.9, -1.6, { ry: .35 });
  // 회사 카페
  const cc = put('cafecounter', -11.1, -1.6, { ry: PI / 2, tag: 'cafeCounter' });
  on(cc, 'coffee', -.75, -.05, { ry: PI, size: [.62, .46, .5], price: 6000000 }); on(cc, 'coffee', .25, -.05, { ry: PI, size: [.62, .46, .5], price: 6000000 });
  on(cc, 'monitor', 1.15, .12, { screen: 'pos' }); [-1.3, -1.15, .95].forEach(dx => on(cc, 'mug', dx, .2));
  put('showcase', -11.15, .7, { ry: PI / 2, tag: 'showcase' });
  const back = put('counter', -13.65, -1.6); on(back, 'microwave', 0, -.6, { ry: PI / 2 }); [-.1, .1, .3, .5, .7, .9].forEach((dz, k) => on(back, 'mug', k % 2 ? .1 : -.08, dz)); on(back, 'coffee', 0, -1.05, { ry: PI / 2 });
  put('fridge', -13.62, 1.3, { ry: PI / 2 }); hang('menuboard', -13.97, 2.7, -1.6, PI / 2); hang('logo', -13.97, 4.0, -1.6, PI / 2, { text: '사내 카페', size: [2.6, .6, .08] });
  for (const [x, z] of [[-8.5, -6.6], [-6.3, -6.6], [-8.5, -4.3], [-6.3, -4.3]]) { const t = put('cafetable', x, z); on(t, 'mug', .1, 0); put('cafechair', x - .62, z, { ry: PI / 2 }); put('cafechair', x + .62, z, { ry: -PI / 2 }); }
  put('standee', -5.2, 3.6, { ry: PI * .92, tag: 'standee' });
  // 라운지·자판기·전광판
  put('sofa', 9.2, -6.7); put('sofa', 9.2, -3.7, { ry: PI }); const lt = put('table', 9.2, -5.2, { size: [1.2, .42, .6] }); on(lt, 'papers', -.2, 0, { size: [.22, .05, .3] }); on(lt, 'mug', .3, 0);
  put('vending', 13.58, -7.9, { ry: -PI / 2, col: '#c9281f', tag: 'vending' }); put('vending', 13.58, -6.8, { ry: -PI / 2, col: '#2f5fb3' });
  hang('tv', 13.95, 3.1, -2.4, -PI / 2, { size: [5.0, 2.4, .1], screen: 'led', sarg: co.name, price: 25000000, tag: 'led' });
  // 택배 모서리·우산꽂이
  const ct = put('cart', 10.4, 6.4, { ry: PI / 2, tag: 'cart' }); on(ct, 'box', 0, .28, { size: [.5, .4, .45] }); on(ct, 'box', 0, -.28, { size: [.5, .4, .45], ry: .2 });
  for (const [x, z] of [[12.6, 8.5], [13.2, 8.5], [12.9, 7.9]]) { const b = put('box', x, z, { size: [.5, .4, .45] }); on(b, 'box', 0, 0, { size: [.45, .35, .4], ry: .3 }); }
  put('umbstand', 2.9, -8.4); put('umbrella', 3.6, -8.1, { ry: 1.2 }); put('umbrella', 2.2, -7.9, { ry: -.8 });
  put('sofa', -9.6, 8.3, { ry: PI }); put('bigplant', -13.3, -8.3); put('bigplant', 13.3, 5.0); put('bigplant', -13.3, 8.3); put('bigplant', -5.6, -8.3);
  hang('hydrant', 9.0, 1.0, 8.95, PI); hang('alarm', EX - 1.7, 1.4, 8.97, PI, { tag: 'alarm' }); hang('alarm', 13.97, 1.4, 3.5, -PI / 2);
  put('extinguisher', -1.0, 8.75); put('extinguisher', 12.9, -8.6); put('extinguisher', -7.2, -8.6);
  hang('logo', EX, 3.4, 8.96, PI, { text: co.name }); hang('banner', 6.5, 3.6, 8.98, PI, { text: '고객 감동 원년' });
  sprinklers(L, H); lamps([-11, 4.4, -1.6], [0, 4.4, -3.6]);
  return L;
}
let trunkM; function colorTrunk() { return trunkM || (trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: .9 })); }

// ───── B2 지하주차장: 기둥·주차칸·사장님 차·하역장(지게차·드럼통)·출구 차단기
function parkFloorMat() {
  return labelMat('parkfloor', 2048, 1316, (c, W, Hh) => {
    const X_ = x => (x + 14) / 28 * W, Z_ = z => (z + 9) / 18 * Hh, m = W / 28;
    c.fillStyle = '#7f827e'; c.fillRect(0, 0, W, Hh); speckle(c, W, Hh, 70000, .13); speckle(c, W, Hh, 25000, .05, false);
    for (let i = 0; i < 26; i++) { const x = Math.random() * W, y = Math.random() * Hh, r = 30 + Math.random() * 70, g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(30,28,26,.22)'); g.addColorStop(1, 'rgba(30,28,26,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(0, Z_(-3.95), W, Z_(3.95) - Z_(-3.95));
    c.fillStyle = '#ecebe4'; for (let k = 0; k <= 11; k++) c.fillRect(X_(-13.75 + k * 2.5) - 4, Z_(-9), 8, Z_(-4.1) - Z_(-9));
    for (let k = 0; k <= 4; k++) c.fillRect(X_(3.75 + k * 2.5) - 4, Z_(4.1), 8, Z_(9) - Z_(4.1));
    c.fillStyle = '#e8c41c'; for (let x = -13; x < 12; x += 2) c.fillRect(X_(x), Z_(0) - 5, 1.1 * m, 10);
    c.save(); c.globalAlpha = .55; c.fillStyle = '#e8c41c'; c.beginPath(); c.rect(X_(-14), Z_(4.1), X_(-5.6) - X_(-14), Z_(9) - Z_(4.1)); c.clip(); for (let x = -40; x < 30; x += 1.2) { c.beginPath(); c.moveTo(X_(x), Z_(9)); c.lineTo(X_(x + .5), Z_(9)); c.lineTo(X_(x + 5.4), Z_(4.1)); c.lineTo(X_(x + 4.9), Z_(4.1)); c.fill(); } c.restore();
    c.fillStyle = '#ecebe4'; c.textAlign = 'center'; c.font = '700 64px "Noto Sans KR",sans-serif';
    for (const x of [-6, 6]) { c.save(); c.translate(X_(x), Z_(1.8)); c.fillText('→ 출구', 0, 20); c.restore(); }
    c.fillStyle = '#d9a531'; c.font = '700 60px "Noto Sans KR",sans-serif'; c.fillText('사장님 전용', X_(-5), Z_(-3.45));
    c.fillStyle = 'rgba(236,235,228,.85)'; c.font = '700 120px "Noto Sans KR",sans-serif'; c.fillText('B2', X_(-1.2), Z_(7.4));
    c.font = '700 44px "Noto Sans KR",sans-serif'; ['A-1', 'A-2', 'A-3', 'A-4', 'A-5', 'A-6', 'A-7', 'A-8', 'A-9', 'A-10', 'A-11'].forEach((t, k) => { if (k !== 3) c.fillText(t, X_(-12.5 + k * 2.5), Z_(-4.6)); });
  }, true);
}
// 차: 부서진 조각도 그 차 색으로
const car = (x, z, o) => put('car', x, z, Object.assign({ fm: [o.col || '#15171b', o.col || '#15171b', 'carInside', 'metalDark'] }, o));
export function buildParking(co) {
  const L = resetWorld(); G.scene = 'parking'; beginFloor(); setTime('garage');
  const H = 2.75; G.outZone = null; G.ceil = H - .15;
  shell(L, H, parkFloorMat(), 'concreteWall', 'concreteTex'); elevatorBay(L, { H, wall: 'concreteWall', label: 'B2 ▲' });
  solid(0, H / 2, -9.1, 28.4, H, .2, 'concreteWall');
  for (const z of [-6, 0, 6]) bx(L, 28, .32, .4, 'concreteWall', 0, H - .16, z).castShadow = false;
  for (const z of [-8.55, -8.3]) { const p = cyl(L, .06, .06, 28, z < -8.4 ? 'red' : 'metal', 0, H - .25, z, 8); p.rotation.z = PI / 2; p.castShadow = false; }
  for (let x = -12; x <= 12; x += 4) for (const z of [-6.6, -.0, 6.6]) bx(L, 1.2, .05, .12, 'lightPanel', x, H - .34, z + (z ? 0 : .9)).castShadow = false;
  for (const x of [-8, 0, 8]) for (const z of [-3.6, 3.6]) { solid(x, H / 2, z, .7, H, .7, 'concreteWall'); bx(L, .72, .55, .72, 'hazard', x, .275, z).castShadow = false; for (const s of [-1, 1]) pl(L, .4, .3, textMat('B2', { w: 128, h: 96, size: 70, bg: '#2f6bff', fg: '#ffffff' }), x, 1.6, z + s * .356, s < 0 ? PI : 0); }
  // 북쪽 줄: 사장님 차 · 임원 차 · 직원 차 (뒤로 대 놓아 앞이 통로 쪽)
  car(-5, -6.6, { col: '#111317', price: 150000000, plate: '01가 0001', tag: 'bossCar' });
  hang('banner', -5, 2.05, -8.98, 0, { text: '사장님 전용', size: [2.2, .42, .03] }); put('cone', -6.5, -3.95); put('cone', -3.5, -3.95);
  car(-2.5, -6.6, { col: '#b9bec4', price: 70000000, plate: '12가 1004' });
  car(2.5, -6.6, { col: '#eceeef', price: 60000000, plate: '34나 2580' });
  car(7.5, -6.6, { col: '#22355e', price: 55000000, plate: '56다 7777' });
  car(-12.5, -7.05, { col: '#b3261e', size: [1.65, 1.45, 3.7], price: 15000000, plate: '78라 3333' });
  car(12.5, -7.05, { col: '#7fb069', size: [1.65, 1.45, 3.7], price: 15000000, plate: '90마 5678' });
  // 남동쪽 줄
  car(7.5, 6.6, { ry: PI, col: '#3a3d42', size: [1.95, 1.6, 4.7], price: 45000000, plate: '11바 2222' });
  car(12.5, 7.05, { ry: PI, col: '#e8c41c', size: [1.65, 1.45, 3.7], price: 15000000, plate: '22사 9090' });
  // 하역장: 지게차·팔레트·드럼통·타이어
  put('forklift', -9.4, 6.0, { ry: PI / 2, tag: 'forklift' });
  for (const [x, z] of [[-12.9, 7.9], [-12.9, 5.5]]) { const pa = put('pallet', x, z); const a = on(pa, 'box', -.24, -.24, { size: [.5, .4, .45] }); on(pa, 'box', .26, -.24, { size: [.5, .4, .45] }); const b = on(pa, 'box', -.24, .26, { size: [.5, .4, .45] }); on(pa, 'box', .26, .26, { size: [.5, .4, .45] }); on(a, 'box', .1, .2, { size: [.5, .4, .45], ry: .2 }); on(b, 'box', .1, 0, { size: [.45, .35, .4] }); }
  put('pallet', -6.9, 4.7);
  for (const [x, z] of [[-7.0, 8.45], [-6.35, 8.45], [-6.7, 7.85], [-7.6, 8.45]]) put('drum', x, z);
  for (const [x, z] of [[-13.4, 3.9], [-12.75, 3.9]]) put('drum', x, z, { col: '#b3261e', oil: true });
  put('tirestack', -10.9, 8.5); put('tirestack', -10.1, 8.55);
  const kc = put('cart', -5.6, 5.4, { tag: 'cart', top: 'metalDark' }); on(kc, 'box', 0, .25, { size: [.5, .4, .45] });
  put('crowbar', -11.6, 4.5, { ry: .5, tag: 'crowbar' });
  // 라바콘·출구 차단기
  for (const [x, z] of [[-10, -5.4], [-10, -6.4], [0, -5.2], [5, -5.6], [10, -5.4], [10.6, -1.7], [10.6, 1.6], [4.8, 5.4], [3.6, 4.7]]) put('cone', x, z);
  put('gatebox', 11.6, -2.45, { tag: 'gatebox' }); hang('gatearm', 11.6, 1.0, -.62, PI / 2, { tag: 'gatearm' });
  pl(L, 3.8, 2.3, M('carInside'), 13.99, 1.15, 0, -PI / 2); pl(L, 1.6, .4, textMat('출구 →', { w: 320, h: 80, size: 54, bg: '#1f7a46', fg: '#ffffff' }), 13.98, 2.5, 0, -PI / 2);
  hang('hydrant', 0, 1.0, -8.95, 0); hang('hydrant', 9.6, 1.0, 8.95, PI);
  hang('alarm', EX - 1.7, 1.4, 8.97, PI, { tag: 'alarm' }); hang('alarm', -13.97, 1.4, -1.5, PI / 2);
  put('extinguisher', -2.1, 8.75); put('extinguisher', 8.6, -3.0); put('extinguisher', -13.6, 1.8);
  hang('banner', 1.2, 2.15, 8.98, PI, { text: 'B2 주차장 · 엘리베이터', size: [2.4, .4, .03] });
  sprinklers(L, H - .05); lamps([-5, 2.35, -6.2], [-10, 2.35, 6.2]);
  return L;
}
