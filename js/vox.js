// 벽 부수기: 벽은 처음엔 매끈한 상자 하나다. 처음 맞는 순간 작은 칸(복셀)으로 바뀌고,
// 맞은 자리만 뚫린다. 바닥과 이어지지 않게 된 덩어리는 통째로 떨어져 부서진다.
import { THREE, X, bx } from './gfx.js';
import { G, rand, clamp, won } from './state.js';
import { PH, GR, CANNON, solid, chip, damage, release, addCombo } from './engine.js';
import * as fx from './fx.js';
import { sfx } from './audio.js';

const walls = [], chunks = [], bumps = [];
const geo = new THREE.BoxGeometry(1, 1, 1), mtx = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
const vmat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .9 });
const chipM = {};
const PRICE = 12000, tp = { x: 0, y: 0, z: 0 }, lv = new CANNON.Vec3(), wv = new CANNON.Vec3();

// 벽 재질의 평균색(무늬가 있으면 무늬 평균)
function avg(m) {
  if (Array.isArray(m)) m = m[0];
  if (m.userData.avg) return m.userData.avg;
  const c = new THREE.Color().copy(m.color), img = m.map && m.map.image;
  if (img && !img.width) return c;
  if (img) try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 4; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, 4, 4);
    const d = g.getImageData(0, 0, 4, 4).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 64; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    c.multiply(new THREE.Color().setRGB(r / 16 / 255, gg / 16 / 255, b / 16 / 255, THREE.SRGBColorSpace));
  } catch (e) { }
  return m.userData.avg = c;
}

// engine.solid가 벽을 만들 때마다 부른다. 얇고 넓은 것만 부술 수 있는 벽으로 적어 둔다
function reg(body, mesh, x, y, z, w, h, d) {
  const th = Math.min(w, d), len = Math.max(w, d);
  if (G.noVox || z > 8.7 || th > .35 || Math.max(len, h) < .5 || h < .2 || y - h / 2 < -.2) return;
  const cs = G.mobile ? .34 : .25, nx = Math.max(1, Math.round(len / cs)), ny = Math.max(1, Math.round(h / cs));
  const W = { i: walls.length, body, mesh, x, y, z, w, h, d, ax: w >= d ? 0 : 1, len, th, nx, ny, cw: len / nx, ch: h / ny, cells: null, inst: null, n: nx * ny, left: nx * ny, ground: y - h / 2 < .15, gone: false };
  body.vw = W; walls.push(W);
}
function cpos(W, i, j, o) { const a = (W.ax ? W.z : W.x) - W.len / 2 + (i + .5) * W.cw; o.x = W.ax ? W.x : a; o.z = W.ax ? a : W.z; o.y = W.y - W.h / 2 + (j + .5) * W.ch; return o; }

function voxelize(W) {
  if (W.cells) return;
  W.cells = new Uint8Array(W.n).fill(1);
  const base = avg(W.mesh.material), inst = W.inst = new THREE.InstancedMesh(geo, vmat, W.n);
  W.color = '#' + base.getHexString();
  for (let j = 0; j < W.ny; j++) for (let i = 0; i < W.nx; i++) {
    const k = j * W.nx + i; cpos(W, i, j, tp);
    mtx.makeScale(W.ax ? W.th : W.cw, W.ch, W.ax ? W.cw : W.th).setPosition(tp.x, tp.y, tp.z); inst.setMatrixAt(k, mtx);
    inst.setColorAt(k, col.copy(base).multiplyScalar(rand(.95, 1.02)));
  }
  inst.castShadow = !G.mobile; inst.receiveShadow = true; inst.frustumCulled = false; X.level.add(inst); W.mesh.visible = false;
  const ci = G.camBlock.indexOf(W.mesh); if (ci >= 0) G.camBlock[ci] = inst;
  // 바깥벽이 뚫려도 사람은 건물 밖으로 못 나간다(물건은 나간다)
  if (Math.abs(W.x) > 13.5 || W.z < -8.6) {
    solid(W.x, W.y, W.z, W.w, W.h, W.d, null, { group: GR.PWALL, mask: GR.PLAYER });
    // 지하층은 벽 뒤가 흙이다
    if (G.scene === 'parking' || G.scene === 'party') { const sx = Math.abs(W.x) > 13.5 ? Math.sign(W.x) * .3 : 0; bx(X.level, W.w, W.h, W.d, chipMat('#3a332d'), W.x + sx, W.y, W.z - (sx ? 0 : .3)).castShadow = false; }
  }
}

// 남은 칸을 큰 직사각형으로 묶어 충돌 상자를 다시 만든다
function rebuild(W) {
  if (W.gone) return;
  const b = W.body, c = W.cells, nx = W.nx, ny = W.ny, used = new Uint8Array(W.n);
  b.shapes.length = 0; b.shapeOffsets.length = 0; b.shapeOrientations.length = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!c[j * nx + i] || used[j * nx + i]) continue;
    let i1 = i; while (i1 + 1 < nx && c[j * nx + i1 + 1] && !used[j * nx + i1 + 1]) i1++;
    let j1 = j; grow: while (j1 + 1 < ny) { for (let k = i; k <= i1; k++) if (!c[(j1 + 1) * nx + k] || used[(j1 + 1) * nx + k]) break grow; j1++; }
    for (let jj = j; jj <= j1; jj++) for (let k = i; k <= i1; k++) used[jj * nx + k] = 1;
    const hl = (i1 - i + 1) * W.cw / 2, hh = (j1 - j + 1) * W.ch / 2, oa = -W.len / 2 + (i + i1 + 1) / 2 * W.cw, oy = -W.h / 2 + (j + j1 + 1) / 2 * W.ch;
    b.addShape(new CANNON.Box(new CANNON.Vec3(W.ax ? W.th / 2 : hl, hh, W.ax ? hl : W.th / 2)), new CANNON.Vec3(W.ax ? 0 : oa, oy, W.ax ? oa : 0));
  }
  if (!b.shapes.length) { W.gone = true; PH.world.removeBody(b); }
  else { b.updateBoundingRadius(); b.aabbNeedsUpdate = true; b.updateAABB(); }
}
const chipMat = c => chipM[c] || (chipM[c] = new THREE.MeshStandardMaterial({ color: c, roughness: .9 }));
function pay(W, n, at, loud) {
  const gain = n * PRICE * G.mult; G.money += gain;
  const c = G.counts.wall || (G.counts.wall = { n: 0, sum: 0, name: '벽 철거(칸)' }); c.n += n; c.sum += gain;
  if (n >= 6 || loud) { fx.text({ x: at.x, y: at.y + .3, z: at.z }, loud ? '와르르!' : '쿠궁!', loud ? 'word big' : 'word'); fx.text({ x: at.x, y: at.y + .65, z: at.z }, '+' + won(gain), 'money'); addCombo(1); }
  G.emit && G.emit('wall', n);
}
// 칸을 없애고 그 자리에 조각을 튀긴다
function take(W, list, dir) {
  const at = { x: 0, y: 0, z: 0 }, max = G.mobile ? 3 : 5, s = Math.min(W.cw, W.ch, .3);
  for (const k of list) { W.cells[k] = 0; W.inst.setMatrixAt(k, zero); W.left--; cpos(W, k % W.nx, k / W.nx | 0, tp); at.x += tp.x; at.y += tp.y; at.z += tp.z; }
  W.inst.instanceMatrix.needsUpdate = true; at.x /= list.length; at.y /= list.length; at.z /= list.length;
  for (let n = 0; n < Math.min(max, list.length); n++) {
    const k = list[Math.random() * list.length | 0]; cpos(W, k % W.nx, k / W.nx | 0, tp);
    chip(tp.x + dir.x * .12, tp.y, tp.z + dir.z * .12, s * rand(.6, .95), chipMat(W.color), 'wood', { x: dir.x * rand(2, 6) + rand(-1, 1), y: rand(.5, 3.5), z: dir.z * rand(2, 6) + rand(-1, 1) });
  }
  fx.bitsAt(at, Math.min(26, 4 + list.length * 2), W.color, 4.5, 3);
  if (list.length > 8) { fx.cloud(at, 3, '#d8d0bf', .8, .5); G.shake = Math.max(G.shake, .12); }
  sfx(list.length > 8 ? 'boom' : 'wood', list.length > 8 ? .55 : .5);
  pay(W, list.length, at, false);
}
// 바닥(공중에 걸린 벽은 테두리)과 이어지지 않은 덩어리를 찾아 떨어뜨린다
function drop(W, dir) {
  const c = W.cells, nx = W.nx, ny = W.ny, seen = new Uint8Array(W.n), st = [];
  const seed = k => { if (c[k] && !seen[k]) { seen[k] = 1; st.push(k); } };
  const flood = () => { while (st.length) { const k = st.pop(), i = k % nx, j = k / nx | 0; if (i > 0) seed(k - 1); if (i < nx - 1) seed(k + 1); if (j > 0) seed(k - nx); if (j < ny - 1) seed(k + nx); } };
  for (let i = 0; i < nx; i++) { seed(i); if (!W.ground) seed((ny - 1) * nx + i); }
  if (!W.ground) for (let j = 0; j < ny; j++) { seed(j * nx); seed(j * nx + nx - 1); }
  flood();
  for (let k = 0; k < W.n; k++) {
    if (!c[k] || seen[k]) continue;
    const comp = [], from = st.length; seed(k);
    // 이 덩어리만 따로 모은다
    while (st.length > from) { const q = st.pop(), i = q % nx, j = q / nx | 0; comp.push(q); if (i > 0) seed(q - 1); if (i < nx - 1) seed(q + 1); if (j > 0) seed(q - nx); if (j < ny - 1) seed(q + nx); }
    if (comp.length <= 5 || chunks.length >= 6) take(W, comp, dir); else chunk(W, comp, dir);
  }
}
function chunk(W, comp, dir) {
  const n = comp.length, cen = { x: 0, y: 0, z: 0 };
  for (const k of comp) { cpos(W, k % W.nx, k / W.nx | 0, tp); cen.x += tp.x; cen.y += tp.y; cen.z += tp.z; }
  cen.x /= n; cen.y /= n; cen.z /= n;
  const body = new CANNON.Body({ mass: clamp(n * 3, 10, 300), material: PH.matD, linearDamping: .05, angularDamping: .3, collisionFilterGroup: GR.PROP, collisionFilterMask: GR.STATIC | GR.PROP | GR.FRAG | GR.FORK | GR.NPC });
  const inst = new THREE.InstancedMesh(geo, vmat, n), g = new THREE.Group(), cells = [];
  comp.sort((a, b) => (a % W.nx - b % W.nx) || (a - b));
  let run = null;
  const flushRun = () => { if (!run) return; const hh = (run.j1 - run.j0 + 1) * W.ch / 2 * .97; cpos(W, run.i, 0, tp); const a = W.ax ? tp.z : tp.x, y = W.y - W.h / 2 + (run.j0 + run.j1 + 1) / 2 * W.ch; body.addShape(new CANNON.Box(new CANNON.Vec3(W.ax ? W.th / 2 : W.cw / 2 * .97, hh, W.ax ? W.cw / 2 * .97 : W.th / 2)), new CANNON.Vec3(W.ax ? 0 : a - cen.x, y - cen.y, W.ax ? a - cen.z : 0)); run = null; };
  comp.forEach((k, m) => {
    const i = k % W.nx, j = k / W.nx | 0;
    if (run && run.i === i && run.j1 === j - 1) run.j1 = j; else { flushRun(); run = { i, j0: j, j1: j }; }
    cpos(W, i, j, tp);
    mtx.makeScale(W.ax ? W.th : W.cw, W.ch, W.ax ? W.cw : W.th).setPosition(tp.x - cen.x, tp.y - cen.y, tp.z - cen.z); inst.setMatrixAt(m, mtx);
    W.inst.getColorAt(k, col); inst.setColorAt(m, col); cells.push([tp.x - cen.x, tp.y - cen.y, tp.z - cen.z]);
    W.cells[k] = 0; W.inst.setMatrixAt(k, zero); W.left--;
  });
  flushRun(); W.inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = !G.mobile; inst.frustumCulled = false; g.add(inst); g.position.set(cen.x, cen.y, cen.z); X.level.add(g);
  body.position.set(cen.x, cen.y, cen.z); body.velocity.set(dir.x * 1.5, 0, dir.z * 1.5);
  // 벽 길이 방향을 축으로 넘어간다
  const tip = rand(.6, 1.4) * (Math.random() < .5 ? -1 : 1); body.angularVelocity.set(W.ax ? 0 : tip, 0, W.ax ? tip : 0);
  const c = { body, g, inst, cells, age: 0, hit: false, color: W.color, s: Math.min(W.cw, W.ch, .3) };
  body.addEventListener('collide', e => { if (c.age > 6 && Math.abs(e.contact.getImpactVelocityAlongNormal()) > 3) c.hit = true; });
  PH.world.addBody(body); chunks.push(c);
  pay(W, n, cen, true); sfx('boom', .5);
}
function shatter(c) {
  const b = c.body, bp = b.position, max = G.mobile ? 6 : 12;
  for (let n = 0; n < Math.min(max, c.cells.length); n++) {
    const o = c.cells[Math.random() * c.cells.length | 0]; lv.set(o[0], o[1], o[2]); b.quaternion.vmult(lv, wv);
    chip(bp.x + wv.x, Math.max(.1, bp.y + wv.y), bp.z + wv.z, c.s * rand(.6, .95), chipMat(c.color), 'wood', { x: rand(-3, 3), y: rand(1, 4.5), z: rand(-3, 3) });
  }
  fx.bitsAt(bp, 34, c.color, 5.5, 3.4); fx.cloud(bp, 5, '#d8d0bf', 1, .6); fx.burst(bp, .9);
  sfx('boom', .8); G.shake = Math.max(G.shake, .2);
  PH.world.removeBody(b); X.level.remove(c.g); c.inst.dispose();
}

// 벽에 붙어 있던 물건(액자·시계…)은 뒤의 벽이 사라지면 떨어진다
function loose(W) {
  for (const p of G.props) {
    if (!p.fixed || p.dead) continue; const bp = p.body.position;
    if (Math.abs(W.ax ? bp.x - W.x : bp.z - W.z) > W.th / 2 + .35) continue;
    const i = Math.floor(((W.ax ? bp.z : bp.x) - ((W.ax ? W.z : W.x) - W.len / 2)) / W.cw), j = Math.floor((bp.y - (W.y - W.h / 2)) / W.ch);
    if (i < 0 || j < 0 || i >= W.nx || j >= W.ny || W.cells[j * W.nx + i]) continue;
    if (p.def.fixedOnly) damage(p, 500, bp, true); else release(p);
  }
}
function wake(W) {
  for (const b of PH.world.bodies) {
    if (b.type !== CANNON.Body.DYNAMIC || b.sleepState !== 2) continue; const p = b.position;
    if (Math.abs(p.x - W.x) < W.w / 2 + .7 && Math.abs(p.z - W.z) < W.d / 2 + .7 && p.y < W.y + W.h / 2 + 1) b.wakeUp();
  }
}

// (a, yy) = 벽 면 위의 맞은 자리, r = 뚫리는 반지름
function carve(W, a, yy, r, dir) {
  if (W.gone) return 0;
  voxelize(W);
  const ci = (a - ((W.ax ? W.z : W.x) - W.len / 2)) / W.cw, cj = (yy - (W.y - W.h / 2)) / W.ch, list = [], low = {};
  for (let j = Math.max(0, Math.floor(cj - r / W.ch)); j <= Math.min(W.ny - 1, Math.ceil(cj + r / W.ch)); j++)
    for (let i = Math.max(0, Math.floor(ci - r / W.cw)); i <= Math.min(W.nx - 1, Math.ceil(ci + r / W.cw)); i++) {
      const k = j * W.nx + i; if (!W.cells[k] || Math.hypot((i + .5 - ci) * W.cw, (j + .5 - cj) * W.ch) > r) continue;
      list.push(k); if (low[i] == null || j < low[i]) low[i] = j;
    }
  if (!list.length) return 0;
  // 구멍이 바닥 가까이까지 났으면 밑단도 함께 무너져 사람이 지나갈 수 있다
  if (W.ground) for (const i in low) for (let j = low[i] - 1; j >= 0 && low[i] <= 2; j--) { const k = j * W.nx + +i; if (W.cells[k]) list.push(k); }
  take(W, list, dir); drop(W, dir); rebuild(W); loose(W); wake(W);
  return list.length;
}
const dv = { x: 0, y: 0, z: 0 };
function near(W, c) { tp.x = clamp(c.x, W.x - W.w / 2, W.x + W.w / 2); tp.y = clamp(c.y, W.y - W.h / 2, W.y + W.h / 2); tp.z = clamp(c.z, W.z - W.d / 2, W.z + W.d / 2); return Math.hypot(c.x - tp.x, c.y - tp.y, c.z - tp.z); }
function away(W, c) { if (W.ax) { dv.x = c.x > W.x ? -1 : 1; dv.z = 0; } else { dv.x = 0; dv.z = c.z > W.z ? -1 : 1; } return dv; }

// 주먹·발차기·무기
function hit(c, r, dmg, heavy) {
  let n = 0;
  for (const W of walls) {
    if (W.gone || near(W, c) > Math.min(r * .8, 1.7)) continue;
    const a = W.ax ? tp.z : tp.x, y = tp.y, cr = Math.max(G.mobile ? .27 : .2, clamp(.1 + dmg * .012, .2, 1.3) * (heavy ? 1.2 : 1));
    n += carve(W, a, y, cr, away(W, c));
  }
  return n;
}
// 폭발
function blast(c, r) {
  for (const W of walls) { if (W.gone || near(W, c) > r) continue; const a = W.ax ? tp.z : tp.x, y = tp.y; carve(W, a, y, clamp(r * .5, .4, 1.6), away(W, c)); }
}
// 세게 날아와 부딪힌 물건(물리 계산 중에 불리므로 적어 두었다가 tick에서 처리)
function bump(W, p, v) {
  const e = v * Math.sqrt(p.body.mass); if (v < 5 || e < 14 || (p.vbT && G.tick - p.vbT < 10)) return;
  p.vbT = G.tick; const bp = p.body.position; bumps.push({ W, x: bp.x, y: bp.y, z: bp.z, r: clamp(e * .02, .2, .9) });
}
function tick() {
  if (bumps.length) { for (const b of bumps.splice(0)) { if (b.W.gone) continue; near(b.W, b); carve(b.W, b.W.ax ? tp.z : tp.x, tp.y, b.r, away(b.W, b)); } }
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i]; c.age++; c.g.position.copy(c.body.position); c.g.quaternion.copy(c.body.quaternion);
    if (c.hit || c.age > 360 || c.body.position.y < -6) { shatter(c); chunks.splice(i, 1); }
  }
}
function reset() { for (const p of G.props) if (p.vx) p.vx.inst.dispose(); for (const W of walls) if (W.inst) W.inst.dispose(); for (const c of chunks) c.inst.dispose(); walls.length = 0; chunks.length = 0; bumps.length = 0; }
// 층 기억: 뚫린 자리만 적는다(떨어지는 중인 덩어리는 이미 없어진 것으로 친다)
function snap() { return walls.filter(W => W.cells).map(W => [W.i, Array.from(W.cells).join('')]); }
function restore(list) {
  for (const [i, s] of list || []) {
    const W = walls[i]; if (!W || s.length !== W.n) continue; voxelize(W);
    for (let k = 0; k < W.n; k++) if (s[k] === '0' && W.cells[k]) { W.cells[k] = 0; W.inst.setMatrixAt(k, zero); W.left--; }
    W.inst.instanceMatrix.needsUpdate = true; rebuild(W);
  }
}

// ───── 가구도 칸으로: 처음 맞을 때 그 물건의 모양·색을 칸으로 옮겨 그리고, 맞은 자리부터 파먹는다.
// 충돌 상자와 체력은 그대로 두고 그림만 바뀐다. 칸이 30% 아래로 남으면 완전히 부서진다.
const im = new THREE.Matrix4(), mm = new THREE.Matrix4(), bb = new THREE.Box3(), qc = new CANNON.Quaternion();
function shown(o, root) { for (let a = o; a && a !== root; a = a.parent) if (!a.visible) return false; return true; }
function pvox(p) {
  if (p.vx !== undefined) return p.vx;
  p.vx = null;
  const [w, h, d] = p.size, vol = w * h * d, u = p.g.userData;
  if (p.kind !== 'obj' || p.hp == null || p.maxHp >= 9000 || vol < .02 || p.def.fixedOnly || p.def.onDamage || p.def.onRestore || u.spin || u.hh || u.screen || u.lid) return null;
  const cs = Math.max(.06, Math.cbrt(vol / (G.mobile ? 700 : 1800))), nx = Math.max(1, Math.round(w / cs)), ny = Math.max(1, Math.round(h / cs)), nz = Math.max(1, Math.round(d / cs));
  const cx = w / nx, cy = h / ny, cz = d / nz, N = nx * ny * nz, colr = new Int32Array(N).fill(-1);
  p.g.updateMatrixWorld(true); im.copy(p.g.matrixWorld).invert();
  p.g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || !shown(o, p.g)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (!mat || !mat.color || mat.transparent) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    bb.copy(o.geometry.boundingBox).applyMatrix4(mm.multiplyMatrices(im, o.matrixWorld));
    const hex = avg(mat).getHex(), t = o.geometry.type || '', up = Math.abs(o.rotation.x) < .2 && Math.abs(o.rotation.z) < .2;
    const round = t.includes('Sphere') ? 2 : (t.includes('Cylinder') || t.includes('Cone')) && up ? 1 : 0;
    const i0 = clamp(Math.floor((bb.min.x + w / 2) / cx), 0, nx - 1), i1 = clamp(Math.ceil((bb.max.x + w / 2) / cx) - 1, i0, nx - 1);
    const j0 = clamp(Math.floor((bb.min.y + h / 2) / cy), 0, ny - 1), j1 = clamp(Math.ceil((bb.max.y + h / 2) / cy) - 1, j0, ny - 1);
    const k0 = clamp(Math.floor((bb.min.z + d / 2) / cz), 0, nz - 1), k1 = clamp(Math.ceil((bb.max.z + d / 2) / cz) - 1, k0, nz - 1);
    const mx = (bb.min.x + bb.max.x) / 2, my = (bb.min.y + bb.max.y) / 2, mz = (bb.min.z + bb.max.z) / 2;
    const rx = Math.max((bb.max.x - bb.min.x) / 2, cx * .6), ry = Math.max((bb.max.y - bb.min.y) / 2, cy * .6), rz = Math.max((bb.max.z - bb.min.z) / 2, cz * .6);
    for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      if (round) { const ex = (-w / 2 + (i + .5) * cx - mx) / rx, ey = (-h / 2 + (j + .5) * cy - my) / ry, ez = (-d / 2 + (k + .5) * cz - mz) / rz; if (ex * ex + ez * ez + (round === 2 ? ey * ey : 0) > 1.2) continue; }
      colr[(j * nz + k) * nx + i] = hex;
    }
  });
  let n = 0; for (let k = 0; k < N; k++) if (colr[k] >= 0) n++;
  if (n < 4) return null;
  const inst = new THREE.InstancedMesh(geo, vmat, n), idx = new Int32Array(N).fill(-1); let m = 0;
  for (let k = 0; k < N; k++) {
    if (colr[k] < 0) continue; const i = k % nx, kk = (k / nx | 0) % nz, j = k / (nx * nz) | 0;
    mtx.makeScale(cx, cy, cz).setPosition(-w / 2 + (i + .5) * cx, -h / 2 + (j + .5) * cy, -d / 2 + (kk + .5) * cz); inst.setMatrixAt(m, mtx);
    inst.setColorAt(m, col.setHex(colr[k]).multiplyScalar(rand(.94, 1.03))); idx[k] = m++;
  }
  // 원래 그림은 한 묶음에 넣어 숨긴다(다른 코드가 조각의 visible을 바꿔도 다시 보이지 않게)
  const hold = new THREE.Group(); for (const c of p.g.children.slice()) { const cm = Array.isArray(c.material) ? c.material[0] : c.material; if (!(c.isMesh && cm && cm.transparent)) hold.add(c); } hold.visible = false; p.g.add(hold);
  inst.castShadow = !G.mobile; inst.receiveShadow = true; inst.computeBoundingSphere(); p.g.add(inst);
  return p.vx = { nx, ny, nz, cx, cy, cz, idx, colr, inst, left: n, total: n };
}
// 물건이 피해를 입을 때마다 engine.damage가 부른다. true를 돌려주면 다 파먹힌 것 → 완전히 부순다
function prop(p, dmg, pt, quiet) {
  const v = pvox(p); if (!v) return false;
  const [w, h, d] = p.size, b = p.body, bp = b.position, { nx, ny, nz, cx, cy, cz } = v;
  if (pt && pt !== bp && Math.hypot(pt.x - bp.x, pt.y - bp.y, pt.z - bp.z) > .02) { lv.set(pt.x - bp.x, pt.y - bp.y, pt.z - bp.z); b.quaternion.conjugate(qc); qc.vmult(lv, wv); }
  else { wv.set(rand(-w / 2, w / 2), rand(-h / 2, h / 2), rand(-d / 2, d / 2)); const a = Math.random() * 3 | 0, s = Math.random() < .5 ? -1 : 1; if (a === 0) wv.x = s * w / 2; else if (a === 1) wv.y = s * h / 2; else wv.z = s * d / 2; }
  // 맞은 자리에서 가장 가까운 칸을 중심으로
  let best = -1, bd = 1e9;
  for (let k = 0; k < v.idx.length; k++) { if (v.idx[k] < 0) continue; const i = k % nx, kk = (k / nx | 0) % nz, j = k / (nx * nz) | 0, dx = -w / 2 + (i + .5) * cx - wv.x, dy = -h / 2 + (j + .5) * cy - wv.y, dz = -d / 2 + (kk + .5) * cz - wv.z, q = dx * dx + dy * dy + dz * dz; if (q < bd) { bd = q; best = k; } }
  if (best < 0) return true;
  const bi = best % nx, bk = (best / nx | 0) % nz, bj = best / (nx * nz) | 0, cs = (cx + cy + cz) / 3;
  const r = clamp(Math.cbrt(clamp(dmg / p.maxHp, 0, 1) * v.total * .75 / Math.PI) * cs * 1.25, cs * .9, Math.max(w, h, d) * .6), r2 = r * r;
  const ri = Math.ceil(r / cx), rj = Math.ceil(r / cy), rk = Math.ceil(r / cz), max = quiet ? 0 : G.mobile ? 2 : 3; let n = 0, hex = v.colr[best];
  for (let j = Math.max(0, bj - rj); j <= Math.min(ny - 1, bj + rj); j++) for (let kk = Math.max(0, bk - rk); kk <= Math.min(nz - 1, bk + rk); kk++) for (let i = Math.max(0, bi - ri); i <= Math.min(nx - 1, bi + ri); i++) {
    const k = (j * nz + kk) * nx + i; if (v.idx[k] < 0 || (quiet && v.left / v.total < .36)) continue;
    const dx = (i - bi) * cx, dy = (j - bj) * cy, dz = (kk - bk) * cz; if (dx * dx + dy * dy + dz * dz > r2) continue;
    v.inst.setMatrixAt(v.idx[k], zero); v.idx[k] = -1; v.left--;
    if (n++ < max) { lv.set(-w / 2 + (i + .5) * cx, -h / 2 + (j + .5) * cy, -d / 2 + (kk + .5) * cz); b.quaternion.vmult(lv, wv); const l = Math.hypot(wv.x, wv.z) || 1; chip(bp.x + wv.x, bp.y + wv.y, bp.z + wv.z, Math.min(cs, .22) * rand(.7, 1), chipMat('#' + col.setHex(v.colr[k]).getHexString()), p.mat, { x: wv.x / l * rand(1, 4) + rand(-1, 1), y: rand(1, 4), z: wv.z / l * rand(1, 4) + rand(-1, 1) }); }
  }
  if (n) { v.inst.instanceMatrix.needsUpdate = true; if (!quiet && n > 3) { lv.set(-w / 2 + (bi + .5) * cx, -h / 2 + (bj + .5) * cy, -d / 2 + (bk + .5) * cz); b.quaternion.vmult(lv, wv); fx.bitsAt({ x: bp.x + wv.x, y: bp.y + wv.y, z: bp.z + wv.z }, Math.min(18, n), '#' + col.setHex(hex).getHexString(), 4, 2.5); } }
  return v.left / v.total < .3;
}
// 층에 돌아왔을 때: 깎인 체력만큼 다시 파먹은 모습으로
function scar(p) { const lost = p.maxHp - p.hp; if (lost <= 0) return; for (let n = 0; n < 3; n++) prop(p, lost / 3, null, true); }
G.vox = { reg, hit, blast, bump, tick, reset, snap, restore, walls, chunks, prop, scar };
