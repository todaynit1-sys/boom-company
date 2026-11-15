import { resetWorld, solid, spawn, GR } from './engine.js';
import { THREE, X, M, bx, pl, tex, textMat, setTime } from './gfx.js';
import { DEFS } from './data/props.js';
import { G, rand, pick } from './state.js';

export const TAG = {};
export const find = t => (TAG[t] && !TAG[t].dead ? TAG[t] : null);
export function tagged(prefix) { return Object.keys(TAG).filter(k => k.startsWith(prefix)).map(k => TAG[k]).filter(p => p && !p.dead); }
const PI = Math.PI;

// 바닥(또는 base 높이)에 세워 놓기
export function put(type, x, z, o = {}) {
  const size = o.size || DEFS[type].size, p = spawn(type, x, (o.base || 0) + size[1] / 2 + .004, z, o);
  if (o.tag) TAG[o.tag] = p; return p;
}
// 다른 물건 위에 올려놓기 (dx,dz는 그 물건 기준)
export function on(par, type, dx = 0, dz = 0, o = {}) {
  const ry = par.ry || 0, c = Math.cos(ry), s = Math.sin(ry), bp = par.body.position;
  return put(type, bp.x + dx * c + dz * s, bp.z - dx * s + dz * c, Object.assign({}, o, { base: bp.y + par.size[1] / 2, ry: ry + (o.ry || 0) }));
}
export function hang(type, x, y, z, ry = 0, o = {}) { const p = spawn(type, x, y, z, Object.assign({ fixed: true, ry }, o)); if (o.tag) TAG[o.tag] = p; return p; }

function deskSet(x, z, i, mine) {
  const t = mine ? 'my' : 'd' + i + '_', d = put('desk', x, z, { tag: t + 'Desk' });
  on(d, 'monitor', 0, -.2, { tag: t + 'Monitor', screen: mine ? 'sheet' : pick(['sheet', 'chat', 'update', 'sheet']) });
  on(d, 'keyboard', 0, .14, { tag: t + 'Keyboard' }); on(d, 'mouse', .36, .16);
  if (i % 2 === 0) on(d, 'mug', -.58, .12); else on(d, 'phone', .6, -.12, { tag: 'phone_d' + i });
  if (i % 3 !== 1) on(d, 'papers', -.56, -.16, { size: [.22, rand(.08, .2), .3] });
  if (i % 3 === 1) on(d, 'binder', .58, -.24, { ry: .2 });
  put('pc', x + .98, z + .08, { tag: t + 'Pc' }); put('chair', x + rand(-.1, .1), z + .86, { ry: PI + rand(-.3, .3), tag: t + 'Chair' });
  put('trash', x - .96, z + .15); put('partition', x, z - .47);
}

export function buildOffice(co, time = 'day') {
  const L = resetWorld(); G.scene = 'office'; for (const k in TAG) delete TAG[k];
  setTime(time);
  // 바닥·천장·바깥벽
  solid(0, -.5, 0, 28.4, 1, 18.4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), M('carpet')); fl.rotation.x = -PI / 2; fl.receiveShadow = true; L.add(fl);
  const lob = new THREE.Mesh(new THREE.PlaneGeometry(28, 5.4), new THREE.MeshStandardMaterial({ color: '#d9d5cb', roughness: .28, metalness: .05 })); lob.rotation.x = -PI / 2; lob.position.set(0, .003, 6.3); lob.receiveShadow = true; L.add(lob);
  solid(0, 3.5, 0, 28.4, 1, 18.4);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), M('ceiling')); ce.rotation.x = PI / 2; ce.position.y = 3; L.add(ce);
  for (let x = -12; x <= 12; x += 4) for (let z = -6.5; z <= 6.5; z += 4.3) { const m = bx(L, 1.3, .03, .6, 'lightPanel', x, 2.985, z); m.castShadow = false; }
  solid(-14.1, 1.5, 0, .2, 3, 18.4, 'wall'); solid(14.1, 1.5, 0, .2, 3, 18.4, 'wall'); solid(0, 1.5, 9.1, 28.4, 3, .2, 'wall');
  solid(0, .45, -9.1, 28.4, .9, .2, 'wall'); solid(0, 2.75, -9.1, 28.4, .5, .2, 'wall');
  for (let i = 0; i < 8; i++) solid(-14 + i * 4, 1.7, -9.1, .3, 1.6, .22, 'wall');
  for (let i = 0; i < 7; i++) hang('window', -12 + i * 4, 1.7, -9.1, 0, { tag: 'win' + i });
  solid(0, 1.5, -9.02, 28, 3, .06, null, { group: GR.PWALL, mask: GR.PLAYER });
  // 기둥
  solid(-2, 1.5, -3.6, .5, 3, .5, 'wallDark'); solid(2, 1.5, -3.6, .5, 3, .5, 'wallDark');
  hang('clock', 2, 2.15, -3.32, 0, { tag: 'clock' }); hang('frame', -2, 1.95, -3.32, 0, { text: co.motto, size: [.46, .34, .05], tag: 'frame_col' });
  // 사무실 책상 6개
  let i = 0; for (const z of [-5.6, -1.6]) for (const x of [-4, 0, 4]) { deskSet(x, z, i, x === 0 && z === -1.6); i++; }
  put('cabinet', 11.6, 8.7, { ry: PI }); put('cabinet', 12.55, 8.7, { ry: PI }); put('plant', -7.2, -8.4); put('plant', 7.2, -8.4); put('watercooler', -7.3, 2.3, { ry: PI / 2 });
  put('box', 6.9, 1.6); put('box', 6.9, 2.05, { ry: .3 });
  // 부장실 (서북쪽)
  solid(-11.05, 1.5, -3.2, 5.9, 3, .15, 'wallDark'); solid(-8.1, 1.5, -3.5, .15, 3, .6, 'wallDark'); solid(-8.1, 2.8, -6.4, .12, .4, 5.2, 'wallDark', { block: false });
  hang('glasspane', -8.1, 1.3, -8, PI / 2, { frost: true, tag: 'bg0' }); hang('glasspane', -8.1, 1.3, -6, PI / 2, { frost: true, tag: 'bg1' });
  const bd = put('bossdesk', -11.2, -6.6, { tag: 'bossDesk' });
  on(bd, 'nameplate', 0, .32, { text: co.who, tag: 'nameplate' }); on(bd, 'monitor', -.62, -.1, { ry: PI, screen: 'chat' }); on(bd, 'papers', .62, .1, { size: [.22, .14, .3] }); on(bd, 'mug', .35, -.22); on(bd, 'binder', -.2, -.25, { ry: .3 }); on(bd, 'phone', .7, -.25, { tag: 'phone_boss' });
  put('chair', -11.2, -7.55, { boss: true, tag: 'bossChair' });
  const lc = put('lowcab', -13.7, -5.4, { ry: PI / 2 }); on(lc, 'trophy', -.28, 0, { tag: 'trophy0' }); on(lc, 'trophy', 0, 0, { tag: 'trophy1' }); on(lc, 'trophy', .28, 0, { tag: 'trophy2' });
  put('golfbag', -13.45, -8.35, { tag: 'golfbag' }); put('golfclub', -12.6, -8.5, { ry: PI / 2, tag: 'golfclub' }); put('plant', -8.75, -8.4);
  put('safe', -13.55, -3.85, { ry: PI / 2, tag: 'safe' });
  hang('frame', -10.4, 1.9, -3.31, PI, { text: co.motto, tag: 'frame_boss' }); hang('portrait', -12.3, 1.9, -3.31, PI, { tag: 'portrait' });
  // 회의실 (동북쪽, 유리벽)
  solid(8.1, 1.5, -3.3, .15, 3, .35, 'wall'); solid(8.1, 2.8, -6.2, .12, .4, 5.6, 'wallDark', { block: false }); solid(11.05, 2.8, -3.2, 5.9, .4, .12, 'wallDark', { block: false });
  hang('glasspane', 8.1, 1.3, -8, PI / 2, { tag: 'mg0' }); hang('glasspane', 8.1, 1.3, -6, PI / 2, { tag: 'mg1' });
  [9.15, 11.1, 13.05].forEach((x, k) => hang('glasspane', x, 1.3, -3.2, 0, { size: [1.95, 2.6, .05], tag: 'mg' + (k + 2) }));
  const mt = put('table', 11.1, -6.2, { tag: 'mtgTable' });
  on(mt, 'laptop', -.9, -.15); on(mt, 'laptop', .8, .2, { ry: PI });[-1.3, -.3, .3, 1.3].forEach(dx => on(mt, 'bottle', dx, rand(-.1, .1), { col: '#9fd8ff' })); on(mt, 'mug', .1, -.35);
  [10.1, 11.1, 12.1].forEach(x => { put('chair', x, -7.2, { ry: rand(-.2, .2) }); put('chair', x, -5.2, { ry: PI + rand(-.2, .2) }); });
  hang('screen', 13.96, 1.7, -6.2, -PI / 2, { tag: 'screen' }); hang('projector', 11.1, 2.5, -6.2, PI / 2, { tag: 'projector' });
  put('whiteboard', 9.1, -8.25, { ry: .45, tag: 'whiteboard' }); put('plant', 13.4, -8.4);
  // 탕비실 (서쪽)
  const ct = put('counter', -13.65, -.3, { tag: 'counter' });
  on(ct, 'coffee', 0, -1.0, { ry: PI / 2, tag: 'coffee' }); on(ct, 'microwave', 0, -.35, { ry: PI / 2, tag: 'microwave' }); on(ct, 'phone', 0, .12, { ry: PI / 2, tag: 'phone_pantry' });
  [.42, .56, .7, .84].forEach((dz, k) => on(ct, 'mug', k % 2 ? .1 : -.08, dz)); on(ct, 'noodle', -.05, 1.02); on(ct, 'noodle', .1, 1.14, { tag: 'noodle' });
  put('fridge', -13.62, 2.35, { ry: PI / 2 }); put('watercooler', -11.5, -2.88, { tag: 'cooler' }); put('watercooler', -10.9, -2.88);
  const st = put('table', -10.4, 1.1, { size: [1.2, .74, .8] }); on(st, 'mug', .2, .1); on(st, 'noodle', -.2, 0); put('chair', -10.4, 1.95, { ry: PI }); put('chair', -10.4, .25);
  put('trash', -9.4, 2.6); put('plant', -9.3, -2.75);
  // 복사실 (동쪽)
  put('printer', 13.45, -.4, { ry: -PI / 2, tag: 'printer' });
  const b1 = put('box', 13.55, 1.5, { ry: PI / 2 }), b2 = put('box', 13.55, 2.0, { ry: PI / 2 }), b3 = on(b1, 'box', 0, 0), b4 = on(b2, 'box', 0, 0); on(b3, 'box', 0, 0); put('box', 13.0, 2.4);
  const tc = put('lowcab', 11.7, -2.92);['#1aa7c7', '#d6338a', '#e8c41c', '#222222'].forEach((c, k) => on(tc, 'toner', -.3 + k * .2, 0, { ry: PI / 2, col: c }));
  put('cabinet', 10.3, -2.95); put('extinguisher', 13.7, -2.85); put('trash', 12.7, -1.5); put('bat', 12.6, -2.75, { ry: PI / 2, tag: 'bat' });
  // 로비 (남쪽)
  put('reception', 3.5, 6.7, { ry: PI, text: co.name, tag: 'reception' }); hang('logo', 3.5, 2.15, 8.96, PI, { text: co.name, tag: 'logo' });
  hang('banner', -9, 2.35, 8.98, PI, { text: '월요일도 파이팅^^', tag: 'banner' }); hang('frame', 9.5, 1.9, 8.97, PI, { text: '주인의식', tag: 'frame_lobby' });
  put('sofa', 9.5, 8.3, { ry: PI }); put('plant', 13.3, 8.3); put('plant', -13.3, 8.3); put('plant', 6.9, 8.4); put('extinguisher', -6.2, 8.75); put('hammer', -13.2, 6.6, { tag: 'hammer' }); put('box', -13.3, 5.8);
  // 엘리베이터 (장식)
  const ex = -3.5; bx(L, 2.3, 2.4, .08, 'metalDark', ex, 1.2, 8.97); bx(L, .98, 2.15, .04, 'chrome', ex - .5, 1.08, 8.93); bx(L, .98, 2.15, .04, 'chrome', ex + .5, 1.08, 8.93);
  const sign = pl(L, .7, .22, textMat('퇴근 ▼', { w: 256, h: 80, size: 46, bg: '#10151c', fg: '#6fe08a', lit: false }), ex, 2.55, 8.92, PI); sign.userData.keep = true;
  bx(L, .1, .18, .03, 'metal', ex + 1.35, 1.2, 8.95);
  G.elev = { x: ex, z: 8.2 };
  return L;
}

const STY = { glass: ['bglass', 'winLit'], brick: ['brick', 'winLit'], gov: ['concrete', 'glassDark'] };
export function buildExterior(co) {
  const L = resetWorld(); G.scene = 'ext'; for (const k in TAG) delete TAG[k];
  setTime('day');
  solid(0, -.5, 0, 120, 1, 120);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M('asphalt')); gr.rotation.x = -PI / 2; gr.receiveShadow = true; L.add(gr);
  const wm = (STY[co.style] || STY.glass)[0];
  for (let f = 0; f < 5; f++) for (const x of [-3, 0, 3]) for (const z of [-1.5, 1.5]) put('block', x, z, { base: f * 2.4, wallMat: wm, lit: (f * 7 + x + z) % 3 !== 0, tag: `blk${f}_${x}_${z}` });
  const name = [...(co.name || '회사')], sp = Math.min(1.15, 8.6 / name.length);
  name.forEach((ch, k) => put('letter', (k - (name.length - 1) / 2) * sp, 2.7, { base: 12, text: ch, size: [Math.min(1.1, sp - .05), 1.2, .3], tag: 'ltr' + k }));
  for (const [x, z, h] of [[-16, -6, 9], [16, -8, 12], [-24, 4, 7], [24, 2, 10], [-12, -20, 14], [12, -22, 11]]) bx(L, 7, h, 7, 'concrete', x, h / 2, z);
  return L;
}
