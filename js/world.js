import { resetWorld, solid, spawn, kill, release, setScreen, settleFrags, flush, GR, PH, CANNON } from './engine.js';
import { THREE, X, M, bx, pl, textMat, setTime, shade, shafts, windowTrim } from './gfx.js';
import { DEFS } from './data/props.js';
import { G, rand, pick, clamp } from './state.js';
import * as fx from './fx.js';

export const TAG = {};
// 태그 달린 물건을 처음 놓은 자리와 방법. 총무팀이 같은 것을 다시 들여놓을 때 쓴다
export const RECIPE = {};
export const find = t => (TAG[t] && !TAG[t].dead ? TAG[t] : null);
export function tagged(prefix) { return Object.keys(TAG).filter(k => k.startsWith(prefix)).map(k => TAG[k]).filter(p => p && !p.dead); }
const PI = Math.PI;
// 층을 지을 때 놓은 순서. 층을 떠났다 돌아오면 이 번호로 부서진 것·옮긴 것을 되살린다
const SEQ = { n: 0 };
export function beginFloor() { SEQ.n = 0; for (const k in TAG) delete TAG[k]; for (const k in RECIPE) delete RECIPE[k]; }

// 바닥(또는 base 높이)에 세워 놓기
export function put(type, x, z, o = {}) {
  const size = o.size || DEFS[type].size, y = (o.base || 0) + size[1] / 2 + .004, p = spawn(type, x, y, z, o);
  if (o.tag) { TAG[o.tag] = p; RECIPE[o.tag] = { type, x, y, z, o: Object.assign({}, o) }; }
  p.seq = SEQ.n++;
  return p;
}
// 다른 물건 위에 올려놓기 (dx,dz는 그 물건 기준)
export function on(par, type, dx = 0, dz = 0, o = {}) {
  const ry = par.ry || 0, c = Math.cos(ry), s = Math.sin(ry), bp = par.body.position;
  return put(type, bp.x + dx * c + dz * s, bp.z - dx * s + dz * c, Object.assign({}, o, { base: bp.y + par.size[1] / 2, ry: ry + (o.ry || 0) }));
}
export function hang(type, x, y, z, ry = 0, o = {}) {
  const oo = Object.assign({ fixed: true, ry }, o), p = spawn(type, x, y, z, oo);
  if (o.tag) { TAG[o.tag] = p; RECIPE[o.tag] = { type, x, y, z, o: oo }; }
  p.seq = SEQ.n++;
  return p;
}

// ───── 층 기억: 떠날 때 적고, 돌아와 다시 지은 뒤 그대로 맞춘다
export function snapshotFloor(carried) {
  settleFrags();
  const gone = [], live = [], extra = [], bySeq = new Map();
  for (const p of G.props) if (p.seq != null && !p.dead) bySeq.set(p.seq, p);
  for (let s = 0; s < SEQ.n; s++) {
    const p = bySeq.get(s);
    if (!p || p.out || p === carried) { gone.push(s); continue; }
    const b = p.body, q = b.quaternion;
    live.push([s, b.position.x, b.position.y, b.position.z, q.x, q.y, q.z, q.w, p.hp, p.fixed, p.screen || null, p.lift || 0]);
  }
  for (const p of G.props) {
    if (p.seq != null || p.kind !== 'obj' || p.dead || p.out || p.held || p === carried) continue;
    const b = p.body, q = b.quaternion, { v, av, life, ...opt } = p.opt || {};
    extra.push([p.type, opt, b.position.x, b.position.y, b.position.z, q.x, q.y, q.z, q.w, p.hp]);
  }
  return { gone, live, extra, fx: fx.snapshot(), vox: G.vox ? G.vox.snap() : null };
}
export function applyFloor(s) {
  if (!s) return;
  const gone = new Set(s.gone), rec = new Map(s.live.map(r => [r[0], r]));
  // 없어진 것은 바로 치워야 그 자리에 다시 들여놓는 물건과 겹치지 않는다
  for (const p of G.props) if (p.seq != null && gone.has(p.seq)) kill(p);
  flush();
  for (const p of G.props.slice()) {
    if (p.seq == null) continue;
    const r = rec.get(p.seq); if (!r) continue;
    if (p.fixed && !r[9]) release(p);
    const b = p.body; b.position.set(r[1], r[2], r[3]); b.quaternion.set(r[4], r[5], r[6], r[7]); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
    if (r[8] != null) { p.hp = r[8]; if (G.vox && p.hp > 0) G.vox.scar(p); } if (r[10] && r[10] !== p.screen) setScreen(p, r[10]); if (r[11]) p.lift = r[11];
    p.g.position.copy(b.position); p.g.quaternion.copy(b.quaternion); if (b.mass > 0) b.sleep();
    p.def.onRestore && p.def.onRestore(p);
  }
  for (const [type, opt, x, y, z, qx, qy, qz, qw, hp] of s.extra) {
    const p = spawn(type, x, y, z, opt); p.body.quaternion.set(qx, qy, qz, qw); if (hp != null) { p.hp = hp; if (G.vox && p.hp > 0) G.vox.scar(p); } p.g.position.copy(p.body.position); p.g.quaternion.copy(p.body.quaternion); p.body.sleep();
  }
  fx.restore(s.fx); if (G.vox && s.vox) G.vox.restore(s.vox);
  G.settle = G.tick + 90;
}

// ───── 모든 층에 같은 자리(남쪽 벽 x=-3.5)에 있는 엘리베이터
export const EX = -3.5;
export function elevatorBay(L, o = {}) {
  // span: 남쪽 벽을 어디부터 어디까지 세울지(옥상은 엘리베이터실 둘레만)
  const ex = EX, gw = 1.2, gh = 2.3, H = o.H || 3, wm = o.wall || 'wall', x0 = o.span ? o.span[0] : -14.2, x1 = o.span ? o.span[1] : 14.2;
  solid((x0 + ex - gw / 2) / 2, H / 2, 9.1, ex - gw / 2 - x0, H, .2, wm);
  solid((ex + gw / 2 + x1) / 2, H / 2, 9.1, x1 - (ex + gw / 2), H, .2, wm);
  solid(ex, (gh + H) / 2, 9.1, gw, H - gh, .2, wm);
  solid(ex, -.25, 9.95, 1.8, .5, 1.7);
  bx(L, 1.5, .02, 1.5, 'metal', ex, .01, 9.95).castShadow = false;
  solid(ex - .82, 1.2, 9.95, .1, 2.4, 1.7, 'metalDark'); solid(ex + .82, 1.2, 9.95, .1, 2.4, 1.7, 'metalDark'); solid(ex, 1.2, 10.82, 1.74, 2.4, .1, 'metalDark'); solid(ex, 2.45, 9.95, 1.74, .1, 1.74, 'metal');
  bx(L, .9, .02, .5, 'lightPanelOn', ex, 2.39, 9.95).castShadow = false; bx(L, 1.4, .05, .03, 'chrome', ex, .95, 10.75);
  bx(L, .08, gh + .08, .04, 'metalDark', ex - gw / 2 - .02, gh / 2, 8.98); bx(L, .08, gh + .08, .04, 'metalDark', ex + gw / 2 + .02, gh / 2, 8.98); bx(L, gw + .12, .08, .04, 'metalDark', ex, gh + .02, 8.98);
  const dL = bx(L, .6, gh - .02, .04, 'chrome', ex - .3, gh / 2, 9.1), dR = bx(L, .6, gh - .02, .04, 'chrome', ex + .3, gh / 2, 9.1);
  const db = new CANNON.Body({ mass: 0, collisionFilterGroup: GR.STATIC, collisionFilterMask: GR.PROP | GR.FRAG | GR.PLAYER | GR.NPC }); db.addShape(new CANNON.Box(new CANNON.Vec3(gw / 2, gh / 2, .05))); db.position.set(ex, gh / 2, 9.1); PH.world.addBody(db);
  G.elevDoors = { L: dL, R: dR, t: 0, target: 0, body: db };
  pl(L, .7, .22, textMat(o.label || '퇴근 ▼', { w: 256, h: 80, size: 46, bg: '#10151c', fg: '#6fe08a', lit: false }), ex, 2.55, 8.95, PI);
  bx(L, .1, .18, .03, 'metal', ex + .85, 1.2, 8.97);
  G.elev = { x: ex, z: 8.2 };
}
// 천장 스프링클러 머리(한 번에 그리는 작은 원반들). 물은 여기서 떨어진다
export function sprinklers(L, y) {
  const pts = []; for (let x = -12; x <= 12; x += 4) for (let z = -7; z <= 7; z += 3.5) pts.push({ x, z });
  const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(.045, .03, .04, 10), M('chrome'), pts.length), d = new THREE.Object3D();
  pts.forEach((p, i) => { d.position.set(p.x, y - .02, p.z); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }); L.add(m);
  G.heads = pts; G.ceilH = y;
}

// ───── 총무팀: 이번 상황에 꼭 필요한 물건만 다시 들여놓는다
const upY = q => 1 - 2 * (q.x * q.x + q.z * q.z);
function state(p, R) {
  if (!p || p.dead || p.out) return 'buy';
  if (p.maxHp && p.maxHp < 9999 && p.hp < p.maxHp * .45) return 'buy';
  if (R.o.fixed && !p.fixed && !p.def.fixedOnly) return 'buy';
  const b = p.body.position;
  if (Math.hypot(b.x - R.x, b.z - R.z) > 1.2 || Math.abs(b.y - R.y) > .35 || (!p.fixed && upY(p.body.quaternion) < .8)) return 'tidy';
  return 'ok';
}
export function restock(tags) {
  const bought = [], tidied = [];
  for (const tag of tags) {
    const R = RECIPE[tag]; if (!R) continue;
    const p = TAG[tag], st = state(p, R); if (st === 'ok') continue;
    if (p && p.held) continue;
    const sz = R.o.size || DEFS[R.type].size, rad = Math.max(sz[0], sz[2]) / 2 + .3;
    if (!R.o.base && !R.o.fixed) {
      for (const q of G.props) {
        if (q.dead || q.fixed || q === p || q.held) continue;
        const b = q.body.position, dx = b.x - R.x, dz = b.z - R.z, d = Math.hypot(dx, dz);
        if (d >= rad || b.y > R.y + sz[1] / 2 + .2) continue;
        const k = (rad + .08) / (d || 1); b.x = R.x + (d ? dx * k : rad + .08); b.z = R.z + (d ? dz * k : 0); q.body.velocity.set(0, 0, 0); q.body.angularVelocity.set(0, 0, 0); q.body.wakeUp();
      }
      fx.clearArea(R.x, R.z, rad * .9);
    }
    if (st === 'tidy') {
      const b = p.body; b.position.set(R.x, R.y, R.z); b.quaternion.setFromEuler(0, R.o.ry || 0, 0); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.wakeUp(); p.g.position.copy(b.position); p.g.quaternion.copy(b.quaternion);
      tidied.push(p); continue;
    }
    if (p && !p.dead) kill(p);
    const np = spawn(R.type, R.x, R.y, R.z, R.o); TAG[tag] = np;
    G.restocked[tag] = (G.restocked[tag] || 0) + 1; bought.push(np);
  }
  G.settle = G.tick + 90;
  return { bought, tidied };
}

// ───── 벽시계·엘리베이터
export function setWallClock(min) {
  const c = find('clock'); if (!c || !c.g.userData.hh) return;
  c.g.userData.hh.rotation.z = -((min / 60) % 12) / 12 * 6.2832; c.g.userData.mh.rotation.z = -(min % 60) / 60 * 6.2832;
}
export function elev(open) {
  const E = G.elevDoors; if (!E) return; E.target = open ? 1 : 0;
  if (open && E.body.world) PH.world.removeBody(E.body);
  if (!open && !E.body.world) PH.world.addBody(E.body);
}
export function tickWorld() {
  const E = G.elevDoors; if (!E || E.t === E.target) return;
  E.t = clamp(E.t + Math.sign(E.target - E.t) * .035, 0, 1);
  E.L.position.x = G.elev.x - .3 - .6 * E.t; E.R.position.x = G.elev.x + .3 + .6 * E.t;
}

function deskSet(x, z, i, mine) {
  const t = mine ? 'my' : 'd' + i + '_', d = put('desk', x, z, { tag: t + 'Desk' });
  on(d, 'monitor', 0, -.2, { tag: t + 'Monitor', screen: mine ? 'work' : pick(['sheet', 'chat', 'update', 'work']) });
  on(d, 'keyboard', 0, .14, { tag: t + 'Keyboard' }); on(d, 'mouse', .36, .16);
  if (i % 2 === 0) on(d, 'mug', -.58, .12); else on(d, 'phone', .6, -.12, { tag: 'phone_d' + i });
  if (i % 3 !== 1) on(d, 'papers', -.56, -.16, { size: [.22, rand(.08, .2), .3] });
  if (i % 3 === 1) on(d, 'binder', .58, -.24, { ry: .2 });
  put('pc', x + .98, z + .08, { tag: t + 'Pc' });
  if (mine) put('chair', x, z + .86, { ry: PI, tag: 'myChair' }); else put('chair', x + rand(-.1, .1), z + .86, { ry: PI + rand(-.3, .3), tag: t + 'Chair' });
  put('trash', x - .96, z + .15); put('partition', x, z - .47);
}

export function buildOffice(co, time = 'day') {
  const L = resetWorld(); G.scene = 'office'; beginFloor();
  G.outZone = { x: 14.4, z0: -9.5, z1: 9.4, label: '창밖으로!', k: 2 }; G.ceil = 2.86;
  setTime(time);
  // 바닥·천장·바깥벽
  solid(0, -.5, 0, 28.4, 1, 18.4);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), M('carpet')); fl.rotation.x = -PI / 2; fl.receiveShadow = true; L.add(fl);
  const lob = new THREE.Mesh(new THREE.PlaneGeometry(28, 5.4), new THREE.MeshStandardMaterial({ color: '#d9d5cb', roughness: .28, metalness: .05 })); lob.rotation.x = -PI / 2; lob.position.set(0, .003, 6.3); lob.receiveShadow = true; L.add(lob);
  solid(0, 3.5, 0, 28.4, 1, 18.4);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), M('ceiling')); ce.rotation.x = PI / 2; ce.position.y = 3; L.add(ce); shade(L, 3);
  for (let x = -12; x <= 12; x += 4) for (let z = -6.5; z <= 6.5; z += 4.3) { const m = bx(L, 1.3, .03, .6, x === 0 && Math.abs(z + 2.2) < .1 ? 'lightPanelOn' : 'lightPanel', x, 2.985, z); m.castShadow = false; }
  // 남쪽 벽은 엘리베이터 자리를 비워 둔다
  const ex = EX;
  elevatorBay(L, { H: 3, label: '퇴근 ▼' });
  solid(-14.1, 1.5, 0, .2, 3, 18.4, 'wall'); solid(14.1, 1.5, 0, .2, 3, 18.4, 'wall');
  solid(0, .45, -9.1, 28.4, .9, .2, 'wall'); solid(0, 2.75, -9.1, 28.4, .5, .2, 'wall');
  for (let i = 0; i < 8; i++) solid(-14 + i * 4, 1.7, -9.1, .3, 1.6, .22, 'wall');
  for (let i = 0; i < 7; i++) { hang('window', -12 + i * 4, 1.7, -9.1, 0, { tag: 'win' + i }); shafts(L, -12 + i * 4, -8.95, 3.6, .95, 2.45); windowTrim(L, -12 + i * 4, -9.02); }
  solid(0, 1.5, -9.02, 28, 3, .06, null, { group: GR.PWALL, mask: GR.PLAYER });
  hang('timeclock', ex + 1.45, 1.35, 8.96, PI, { tag: 'timeclock' });
  // 기둥
  solid(-2, 1.5, -3.6, .5, 3, .5, 'wallDark'); solid(2, 1.5, -3.6, .5, 3, .5, 'wallDark');
  hang('clock', 2, 2.15, -3.32, 0, { tag: 'clock' }); hang('frame', -2, 1.95, -3.32, 0, { text: co.motto, size: [.46, .34, .05], tag: 'frame_col' });
  // 사무실 책상 6개 (가운데 아래가 내 자리)
  let i = 0; for (const z of [-5.6, -1.6]) for (const x of [-4, 0, 4]) { deskSet(x, z, i, x === 0 && z === -1.6); i++; }
  put('cabinet', 11.6, 8.7, { ry: PI }); put('cabinet', 12.55, 8.7, { ry: PI }); put('plant', -7.2, -8.4); put('plant', 7.2, -8.4); put('watercooler', -7.3, 2.3, { ry: PI / 2 });
  put('box', 6.9, 1.6); put('box', 6.9, 2.05, { ry: .3 });
  // 부장실 (서북쪽)
  solid(-11.05, 1.5, -3.2, 5.9, 3, .15, 'wallDark'); solid(-8.1, 1.5, -3.5, .15, 3, .6, 'wallDark'); solid(-8.1, 2.8, -6.4, .12, .4, 5.2, 'wallDark', { block: false });
  hang('glasspane', -8.1, 1.3, -8, PI / 2, { frost: true, tag: 'bg0' }); hang('glasspane', -8.1, 1.3, -6, PI / 2, { frost: true, tag: 'bg1' });
  const bd = put('bossdesk', -11.2, -6.6, { tag: 'bossDesk' });
  on(bd, 'nameplate', 0, .32, { text: co.who, tag: 'nameplate' }); on(bd, 'monitor', -.62, -.1, { ry: PI, screen: 'chat' }); on(bd, 'papers', .62, .1, { size: [.22, .14, .3] }); on(bd, 'mug', .35, -.22); on(bd, 'binder', -.2, -.25, { ry: .3 }); on(bd, 'phone', .7, -.25, { tag: 'phone_boss' });
  put('chair', -11.2, -7.55, { boss: true, tag: 'bossChair' });
  const lc = put('lowcab', -13.7, -5.4, { ry: PI / 2, tag: 'trophyCab' }); on(lc, 'trophy', -.28, 0, { tag: 'trophy0' }); on(lc, 'trophy', 0, 0, { tag: 'trophy1' }); on(lc, 'trophy', .28, 0, { tag: 'trophy2' });
  put('golfbag', -13.45, -8.35, { tag: 'golfbag' }); put('golfclub', -12.6, -8.5, { ry: PI / 2, tag: 'golfclub' }); put('plant', -8.75, -8.4);
  put('safe', -13.55, -3.85, { ry: PI / 2, tag: 'safe' });
  hang('frame', -10.4, 1.9, -3.31, PI, { text: co.motto, tag: 'frame_boss' }); hang('portrait', -12.3, 1.9, -3.31, PI, { tag: 'portrait' });
  // 회의실 (동북쪽, 유리벽)
  solid(8.1, 1.5, -3.3, .15, 3, .35, 'wall'); solid(8.1, 2.8, -6.2, .12, .4, 5.6, 'wallDark', { block: false }); solid(11.05, 2.8, -3.2, 5.9, .4, .12, 'wallDark', { block: false });
  hang('glasspane', 8.1, 1.3, -8, PI / 2, { tag: 'mg0' }); hang('glasspane', 8.1, 1.3, -6, PI / 2, { tag: 'mg1' });
  [9.15, 11.1, 13.05].forEach((x, k) => hang('glasspane', x, 1.3, -3.2, 0, { size: [1.95, 2.6, .05], tag: 'mg' + (k + 2) }));
  const mt = put('table', 11.1, -6.2, { tag: 'mtgTable' });
  on(mt, 'laptop', -.9, -.15); on(mt, 'laptop', .8, .2, { ry: PI });[-1.3, -.3, .3, 1.3].forEach(dx => on(mt, 'bottle', dx, rand(-.1, .1), { col: '#9fd8ff' })); on(mt, 'mug', .1, -.35);
  [10.1, 11.1, 12.1].forEach(x => { put('chair', x, -7.2, { ry: rand(-.2, .2) }); put('chair', x, -5.2, x === 11.1 ? { ry: PI, tag: 'mtgChair' } : { ry: PI + rand(-.2, .2) }); });
  hang('screen', 13.96, 1.7, -6.2, -PI / 2, { tag: 'screen' }); hang('projector', 11.1, 2.5, -6.2, PI / 2, { tag: 'projector' });
  put('whiteboard', 9.1, -8.25, { ry: .45, tag: 'whiteboard' }); put('plant', 13.4, -8.4);
  // 탕비실 (서쪽)
  const ct = put('counter', -13.65, -.3, { tag: 'counter' });
  on(ct, 'coffee', 0, -1.0, { ry: PI / 2, tag: 'coffee' }); on(ct, 'microwave', 0, -.35, { ry: PI / 2, tag: 'microwave' }); on(ct, 'phone', 0, .12, { ry: PI / 2, tag: 'phone_pantry' });
  [.42, .56, .7, .84].forEach((dz, k) => on(ct, 'mug', k % 2 ? .1 : -.08, dz)); on(ct, 'noodle', -.05, 1.02); on(ct, 'noodle', .1, 1.14, { tag: 'noodle' });
  put('fridge', -13.62, 2.35, { ry: PI / 2 }); put('watercooler', -11.5, -2.88, { tag: 'cooler' }); put('watercooler', -10.9, -2.88);
  const st = put('table', -10.4, 1.1, { size: [1.2, .74, .8], tag: 'pantryTable' }); on(st, 'mug', .2, -.1); put('chair', -10.4, 1.95, { ry: PI, tag: 'pantryChair' }); put('chair', -10.4, .25);
  put('trash', -9.4, 2.6); put('plant', -9.3, -2.75);
  // 복사실 (동쪽)
  put('printer', 13.45, -.4, { ry: -PI / 2, tag: 'printer' });
  const b1 = put('box', 13.55, 1.5, { ry: PI / 2 }), b2 = put('box', 13.55, 2.0, { ry: PI / 2 }), b3 = on(b1, 'box', 0, 0); on(b2, 'box', 0, 0); on(b3, 'box', 0, 0); put('box', 13.0, 2.4);
  const tc = put('lowcab', 11.7, -2.92);['#1aa7c7', '#d6338a', '#e8c41c', '#222222'].forEach((c, k) => on(tc, 'toner', -.3 + k * .2, 0, { ry: PI / 2, col: c }));
  put('cabinet', 10.3, -2.95); put('extinguisher', 13.7, -2.85); put('trash', 12.7, -1.5); put('bat', 12.6, -2.75, { ry: PI / 2, tag: 'bat' });
  // 로비 (남쪽)
  put('reception', 3.5, 6.7, { ry: PI, text: co.name, tag: 'reception' }); hang('logo', 3.5, 2.15, 8.96, PI, { text: co.name, tag: 'logo' });
  hang('banner', -9, 2.35, 8.98, PI, { text: '월요일도 파이팅^^', tag: 'banner' }); hang('frame', 9.5, 1.9, 8.97, PI, { text: '주인의식', tag: 'frame_lobby' });
  put('sofa', 9.5, 8.3, { ry: PI }); put('plant', 13.3, 8.3); put('plant', -13.3, 8.3); put('plant', 6.9, 8.4); put('extinguisher', -6.2, 8.75); put('hammer', -13.2, 6.6, { tag: 'hammer' }); put('box', -13.3, 5.8);
  // 자유 난동에서만: 비상벨·택배 카트·스프링클러
  if (G.toys) {
    hang('alarm', ex - 1.7, 1.4, 8.97, PI, { tag: 'alarm' }); hang('alarm', -2, 1.3, -3.32, 0);
    const ct = put('cart', 10.6, .9, { ry: PI / 2, tag: 'cart' }); on(ct, 'box', 0, .25); on(ct, 'box', 0, -.25, { ry: .2 });
    sprinklers(L, 3);
  }
  // 밤에 켜는 등: 내 자리 위, 부장실(회식 층에서 바꾼 색을 되돌린다)
  if (X.lamps[0]) { X.lamps[0].position.set(0, 2.55, -1.9); X.lamps[1].position.set(-11.2, 2.4, -6.3); X.lamps.forEach(l => l.color.set('#ffd6a0')); }
  return L;
}

const STY = { glass: ['bglass', 'winLit'], brick: ['brick', 'winLit'], gov: ['concrete', 'glassDark'] };
export function buildExterior(co, time = 'day') {
  const L = resetWorld(); G.scene = 'ext'; G.elevDoors = null; G.elev = null; G.outZone = null; G.ceil = null; G.heads = null; beginFloor();
  setTime(time);
  // 건물 앞: 해가 정면에서 비추고, 멀리까지 보이게 안개는 옅게
  X.sun.position.set(12, 18, 16); X.scene.fog.density *= .35;
  solid(0, -.5, 0, 120, 1, 120);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M('asphalt')); gr.rotation.x = -PI / 2; gr.receiveShadow = true; L.add(gr);
  const wm = (STY[co.style] || STY.glass)[0];
  for (let f = 0; f < 5; f++) for (const x of [-3, 0, 3]) for (const z of [-1.5, 1.5]) put('block', x, z, { base: f * 2.4, wallMat: wm, lit: (f * 7 + x + z) % 3 !== 0, tag: `blk${f}_${x}_${z}` });
  const name = [...(co.name || '회사')], sp = Math.min(1.15, 8.6 / name.length);
  name.forEach((ch, k) => put('letter', (k - (name.length - 1) / 2) * sp, 2.7, { base: 12, text: ch, size: [Math.min(1.1, sp - .05), 1.2, .3], tag: 'ltr' + k }));
  for (const [x, z, h] of [[-16, -6, 9], [16, -8, 12], [-24, 4, 7], [24, 2, 10], [-12, -20, 14], [12, -22, 11]]) bx(L, 7, h, 7, 'concrete', x, h / 2, z);
  return L;
}
