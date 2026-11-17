import { THREE, X, tex } from './gfx.js';
import { G, rand } from './state.js';

// 종이·얼룩·잔해는 하루 동안 남는다(풀이 차면 오래된 것부터 덮어쓴다)
const NB = 900, NS = 500, NC = 64, NT = 18, NST = 80;
let ND = 800;
let bits, bPos, bCol, bVel, bLife, bi = 0;
let sheets, sd = [], si = 0;
let deb, dd = [], di = 0;
const dummy = new THREE.Object3D(), col = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
const clouds = [], stains = []; let ci = 0, sti = 0;
const texts = []; let ti = 0;
const v3 = new THREE.Vector3();
// 부서지는 순간: 번쩍이는 섬광과 바닥으로 퍼지는 충격파 고리
const flashes = [], rings = []; let fli = 0, rni = 0;

export function initFx() {
  const s = X.scene, g = new THREE.BufferGeometry();
  ND = G.mobile ? 400 : 800;
  bPos = new Float32Array(NB * 3).fill(-999); bCol = new Float32Array(NB * 3); bVel = new Float32Array(NB * 3); bLife = new Float32Array(NB);
  g.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  bits = new THREE.Points(g, new THREE.PointsMaterial({ size: .105, vertexColors: true, sizeAttenuation: true })); bits.frustumCulled = false; s.add(bits);
  sheets = new THREE.InstancedMesh(new THREE.PlaneGeometry(.21, .297), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: .9 }), NS);
  sheets.frustumCulled = false; sheets.receiveShadow = true;
  for (let i = 0; i < NS; i++) { sheets.setMatrixAt(i, zero); sheets.setColorAt(i, col.set('#fff')); sd.push({ life: 0 }); }
  s.add(sheets);
  deb = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .78 }), ND);
  deb.frustumCulled = false; deb.receiveShadow = true;
  for (let i = 0; i < ND; i++) { deb.setMatrixAt(i, zero); deb.setColorAt(i, col.set('#888')); dd.push(null); }
  s.add(deb);
  for (let i = 0; i < NC; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('soft'), transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; s.add(sp); clouds.push({ sp, life: 0 }); }
  const cg = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < NST; i++) { const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; s.add(m); stains.push(m); }
  for (let i = 0; i < 10; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('soft'), color: '#fff0b8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); sp.visible = false; s.add(sp); flashes.push({ sp, life: 0 }); }
  const rg = new THREE.RingGeometry(.84, 1, 40);
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; s.add(m); rings.push({ m, life: 0 }); }
  const box = document.getElementById('fxt');
  for (let i = 0; i < NT; i++) { const e = document.createElement('span'); box.appendChild(e); texts.push({ e, life: 0, p: new THREE.Vector3() }); }
}
// 장면이 바뀌어도 남길 것(종이·얼룩·잔해)은 두고, 날아다니는 것만 지운다
export function clearFxSoft() {
  bPos.fill(-999); bLife.fill(0); bits.geometry.attributes.position.needsUpdate = true;
  clouds.forEach(c => { c.life = 0; c.sp.visible = false; }); flashes.forEach(f => { f.life = 0; f.sp.visible = false; }); rings.forEach(r => { r.life = 0; r.m.visible = false; }); texts.forEach(t => { t.life = 0; t.e.style.display = 'none'; });
}
export function clearFx() {
  clearFxSoft();
  sd.forEach((d, i) => { d.life = 0; sheets.setMatrixAt(i, zero); }); sheets.instanceMatrix.needsUpdate = true;
  dd.fill(null); for (let i = 0; i < ND; i++) deb.setMatrixAt(i, zero); deb.instanceMatrix.needsUpdate = true;
  stains.forEach(m => m.visible = false);
}

export function bitsAt(p, n, color, speed = 3, up = 2) {
  col.set(color);
  for (let i = 0; i < n; i++) {
    const k = bi = (bi + 1) % NB, a = rand(6.283), s = rand(.3, 1) * speed;
    bPos[k * 3] = p.x + rand(-.05, .05); bPos[k * 3 + 1] = p.y + rand(-.05, .05); bPos[k * 3 + 2] = p.z + rand(-.05, .05);
    bVel[k * 3] = Math.cos(a) * s; bVel[k * 3 + 1] = rand(.2, 1) * up + rand(-.5, .5) * speed * .4; bVel[k * 3 + 2] = Math.sin(a) * s;
    const j = rand(.8, 1.1); bCol[k * 3] = col.r * j; bCol[k * 3 + 1] = col.g * j; bCol[k * 3 + 2] = col.b * j; bLife[k] = rand(30, 70);
  }
}
export function burst(p, k = 1, ring = true) {
  const f = flashes[fli = (fli + 1) % flashes.length]; f.life = f.max = 9; f.k = k; f.sp.visible = true; f.sp.position.set(p.x, p.y, p.z);
  if (ring) { const r = rings[rni = (rni + 1) % rings.length]; r.life = r.max = 24; r.k = k; r.m.visible = true; r.m.position.set(p.x, .035, p.z); }
}
export const sparks = (p, n) => { bitsAt(p, n >> 1, '#ffd84d', 5, 3); bitsAt(p, n >> 1, '#ff8a1f', 4, 2); };
// 한 방향으로 뿜는 알갱이(소화기 분말)와 위에서 떨어지는 물방울(스프링클러)
export function jet(p, d, n, color, speed = 7, spread = .18) {
  col.set(color);
  for (let i = 0; i < n; i++) {
    const k = bi = (bi + 1) % NB, s = rand(.6, 1) * speed;
    bPos[k * 3] = p.x; bPos[k * 3 + 1] = p.y; bPos[k * 3 + 2] = p.z;
    bVel[k * 3] = (d.x + rand(-spread, spread)) * s; bVel[k * 3 + 1] = (d.y + rand(-spread, spread)) * s + 1; bVel[k * 3 + 2] = (d.z + rand(-spread, spread)) * s;
    bCol[k * 3] = col.r; bCol[k * 3 + 1] = col.g; bCol[k * 3 + 2] = col.b; bLife[k] = rand(14, 26);
  }
}
export function drops(p, n, color = '#9fd4ff', spread = 1.6) {
  col.set(color);
  for (let i = 0; i < n; i++) {
    const k = bi = (bi + 1) % NB, a = rand(6.283), s = rand(.2, 1) * spread;
    bPos[k * 3] = p.x + rand(-.05, .05); bPos[k * 3 + 1] = p.y; bPos[k * 3 + 2] = p.z + rand(-.05, .05);
    bVel[k * 3] = Math.cos(a) * s; bVel[k * 3 + 1] = rand(-3, -1); bVel[k * 3 + 2] = Math.sin(a) * s;
    bCol[k * 3] = col.r; bCol[k * 3 + 1] = col.g; bCol[k * 3 + 2] = col.b; bLife[k] = rand(40, 60);
  }
}
export function cloud(p, n, color, size = .7, spread = .4) {
  for (let i = 0; i < n; i++) {
    const c = clouds[ci = (ci + 1) % NC]; c.life = c.max = rand(50, 110); c.sp.visible = true; c.sp.material.color.set(color); c.size = size * rand(.6, 1.3); c.grow = rand(.004, .012);
    c.sp.position.set(p.x + rand(-spread, spread), p.y + rand(-spread, spread) * .6, p.z + rand(-spread, spread)); c.vx = rand(-.01, .01); c.vy = rand(.002, .014); c.vz = rand(-.01, .01);
  }
}
export function sheet(p, n, color = '#ffffff', power = 3) {
  if (G.mobile) n = Math.ceil(n * .6);
  for (let i = 0; i < n; i++) {
    const k = si = (si + 1) % NS, d = sd[k], a = rand(6.283), s = rand(.3, 1) * power;
    Object.assign(d, { x: p.x + rand(-.15, .15), y: p.y + rand(-.1, .2), z: p.z + rand(-.15, .15), vx: Math.cos(a) * s, vy: rand(1.5, 4.5) * (power / 3), vz: Math.sin(a) * s, rx: rand(6.28), ry: rand(6.28), rz: rand(6.28), wx: rand(-6, 6), wy: rand(-3, 3), wz: rand(-6, 6), life: 1, rest: false, done: false, ph: rand(6.28) });
    sheets.setColorAt(k, col.set(color));
  }
  sheets.instanceColor.needsUpdate = true;
}
export function stain(x, z, r, color, a = .5) { const m = stains[sti = (sti + 1) % NST]; m.visible = true; m.position.set(x, .012 + sti * .0003, z); m.scale.set(r * rand(.8, 1.2), r * rand(.6, 1), 1); m.rotation.z = rand(6.28); m.material.color.set(color); m.material.opacity = a; }
// 다 떨어진 조각을 물리 없는 잔해로 굳힌다
export function debris(p, color) {
  const k = di = (di + 1) % ND, b = p.body;
  dummy.position.set(b.position.x, b.position.y, b.position.z); dummy.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  dummy.scale.set(p.size[0], p.size[1], p.size[2]); dummy.updateMatrix();
  deb.setMatrixAt(k, dummy.matrix); deb.setColorAt(k, color); deb.instanceMatrix.needsUpdate = true; deb.instanceColor.needsUpdate = true;
  dd[k] = { x: b.position.x, z: b.position.z };
}
export function debrisCount() { let n = 0; for (const d of dd) if (d) n++; return n; }
// 층을 떠날 때 바닥에 남은 것(잔해·얼룩·종이)을 적어 두고, 돌아오면 그대로 깐다
const sm4 = new THREE.Matrix4(), sc = new THREE.Color();
export function snapshot() {
  const deb_ = [], st = [], sh = [];
  for (let k = 0; k < ND; k++) if (dd[k]) { deb.getMatrixAt(k, sm4); deb.getColorAt(k, sc); deb_.push([sm4.toArray(), sc.getHex(), dd[k].x, dd[k].z]); }
  for (const m of stains) if (m.visible) st.push([m.position.x, m.position.y, m.position.z, m.scale.x, m.scale.y, m.rotation.z, m.material.color.getHex(), m.material.opacity]);
  for (let k = 0; k < NS; k++) { const d = sd[k]; if (d.life > 0 && d.rest) { sheets.getColorAt(k, sc); sh.push([d.x, d.y, d.z, d.rx, d.ry, d.rz, sc.getHex()]); } }
  return { deb: deb_, st, sh };
}
export function restore(s) {
  clearFx(); if (!s) return;
  s.deb.slice(-ND).forEach(([a, hex, x, z], i) => { sm4.fromArray(a); deb.setMatrixAt(i, sm4); deb.setColorAt(i, sc.setHex(hex)); dd[i] = { x, z }; });
  di = Math.min(s.deb.length, ND) % ND; deb.instanceMatrix.needsUpdate = true; if (deb.instanceColor) deb.instanceColor.needsUpdate = true;
  s.st.slice(-NST).forEach(([x, y, z, sx, sy, rz, hex, op], i) => { const m = stains[i]; m.visible = true; m.position.set(x, y, z); m.scale.set(sx, sy, 1); m.rotation.z = rz; m.material.color.setHex(hex); m.material.opacity = op; });
  sti = Math.min(s.st.length, NST) % NST;
  s.sh.slice(-NS).forEach(([x, y, z, rx, ry, rz, hex], i) => { Object.assign(sd[i], { x, y, z, rx, ry, rz, vx: 0, vy: 0, vz: 0, life: 1, rest: true, done: false }); sheets.setColorAt(i, sc.setHex(hex)); });
  si = Math.min(s.sh.length, NS) % NS; sheets.instanceColor.needsUpdate = true;
}
// 총무팀이 새 물건을 들여놓을 자리를 치운다
export function clearArea(x, z, r) {
  let ch = false;
  for (let k = 0; k < ND; k++) { const d = dd[k]; if (d && Math.hypot(d.x - x, d.z - z) < r) { deb.setMatrixAt(k, zero); dd[k] = null; ch = true; } }
  if (ch) deb.instanceMatrix.needsUpdate = true;
  ch = false;
  for (let k = 0; k < NS; k++) { const d = sd[k]; if (d.life > 0 && d.rest && Math.hypot(d.x - x, d.z - z) < r) { d.life = 0; sheets.setMatrixAt(k, zero); ch = true; } }
  if (ch) sheets.instanceMatrix.needsUpdate = true;
  for (const m of stains) if (m.visible && Math.hypot(m.position.x - x, m.position.z - z) < r) m.visible = false;
}
export function text(p, str, kind = 'word') {
  const t = texts[ti = (ti + 1) % NT]; t.p.set(p.x, p.y, p.z); t.life = t.max = kind === 'word' ? 52 : 60; t.e.textContent = str; t.e.className = kind; t.e.style.display = 'block'; t.rot = kind === 'word' ? rand(-10, 10) : 0;
}

export function update(dt) {
  for (let k = 0; k < NB; k++) {
    if (bLife[k] <= 0) continue;
    const i = k * 3; bVel[i + 1] -= 12 * dt; bPos[i] += bVel[i] * dt; bPos[i + 1] += bVel[i + 1] * dt; bPos[i + 2] += bVel[i + 2] * dt;
    if (bPos[i + 1] < .03) { bPos[i + 1] = .03; bVel[i + 1] *= -.3; bVel[i] *= .6; bVel[i + 2] *= .6; }
    if (--bLife[k] <= 0) bPos[i + 1] = -999;
  }
  bits.geometry.attributes.position.needsUpdate = true; bits.geometry.attributes.color.needsUpdate = true;
  let ch = false;
  for (let k = 0; k < NS; k++) {
    const d = sd[k]; if (d.life <= 0 || d.done) continue; ch = true;
    if (!d.rest) {
      d.vy = Math.max(-1.3, d.vy - 7 * dt); d.vx = d.vx * .965 + Math.sin(G.tick * .08 + d.ph) * .012; d.vz = d.vz * .965 + Math.cos(G.tick * .07 + d.ph) * .012;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      if (d.y <= .015) { d.rest = true; d.y = .012 + k * .00002; d.rx = -Math.PI / 2; d.ry = 0; }
      const top = G.ceil ? G.ceil + .04 : 2.9; if (d.y > top) { d.y = top; d.vy = -.2; }
    }
    dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.rx, d.ry, d.rz); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); sheets.setMatrixAt(k, dummy.matrix);
    if (d.rest) d.done = true;
  }
  if (ch) sheets.instanceMatrix.needsUpdate = true;
  for (const f of flashes) { if (f.life <= 0) continue; f.life--; const t = 1 - f.life / f.max, sc = f.k * (.7 + t * 2.8); f.sp.scale.set(sc, sc, 1); f.sp.material.opacity = (1 - t) * .95; if (f.life <= 0) f.sp.visible = false; }
  for (const r of rings) { if (r.life <= 0) continue; r.life--; const t = 1 - r.life / r.max, sc = r.k * (.4 + (1 - (1 - t) * (1 - t)) * 3.4); r.m.scale.set(sc, sc, 1); r.m.material.opacity = (1 - t) * .6; if (r.life <= 0) r.m.visible = false; }
  for (const c of clouds) {
    if (c.life <= 0) continue; c.life--; const sp = c.sp, k = c.life / c.max;
    sp.position.x += c.vx; sp.position.y += c.vy; sp.position.z += c.vz; c.size += c.grow; sp.scale.set(c.size, c.size, 1); sp.material.opacity = Math.min(.55, k * 1.2) * (1 - Math.max(0, k - .85) * 5);
    if (c.life <= 0) sp.visible = false;
  }
}
// 화면 좌표로 옮겨 그리는 글자
export function drawTexts(w, h) {
  for (const t of texts) {
    if (t.life <= 0) continue;
    t.life--; if (t.life <= 0) { t.e.style.display = 'none'; continue; }
    v3.copy(t.p); v3.y += (1 - t.life / t.max) * .5; v3.project(X.camera);
    if (v3.z > 1) { t.e.style.opacity = 0; continue; }
    const k = 1 - t.life / t.max, sc = k < .12 ? k / .12 * 1.25 : k < .22 ? 1.25 - (k - .12) * 2.5 : 1;
    t.e.style.opacity = Math.min(1, t.life / 14);
    t.e.style.transform = `translate(${(v3.x * .5 + .5) * w}px,${(-v3.y * .5 + .5) * h}px) translate(-50%,-50%) rotate(${t.rot}deg) scale(${sc})`;
  }
}
