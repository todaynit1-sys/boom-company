import { THREE, X, tex } from './gfx.js';
import { G, rand } from './state.js';

const NB = 520, NS = 280, NC = 44, NT = 18, NST = 26;
let bits, bPos, bCol, bVel, bLife, bi = 0;
let sheets, sd = [], si = 0; const dummy = new THREE.Object3D(), col = new THREE.Color();
const clouds = [], stains = []; let ci = 0, sti = 0;
const texts = []; let ti = 0;
const v3 = new THREE.Vector3();

export function initFx() {
  const s = X.scene, g = new THREE.BufferGeometry();
  bPos = new Float32Array(NB * 3).fill(-999); bCol = new Float32Array(NB * 3); bVel = new Float32Array(NB * 3); bLife = new Float32Array(NB);
  g.setAttribute('position', new THREE.BufferAttribute(bPos, 3)); g.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  bits = new THREE.Points(g, new THREE.PointsMaterial({ size: .075, vertexColors: true, sizeAttenuation: true })); bits.frustumCulled = false; s.add(bits);
  sheets = new THREE.InstancedMesh(new THREE.PlaneGeometry(.21, .297), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: .9 }), NS);
  sheets.frustumCulled = false; dummy.scale.set(0, 0, 0); dummy.updateMatrix();
  for (let i = 0; i < NS; i++) { sheets.setMatrixAt(i, dummy.matrix); sheets.setColorAt(i, col.set('#fff')); sd.push({ life: 0 }); }
  s.add(sheets);
  for (let i = 0; i < NC; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex('soft'), transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; s.add(sp); clouds.push({ sp, life: 0 }); }
  const cg = new THREE.CircleGeometry(1, 20);
  for (let i = 0; i < NST; i++) { const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ transparent: true, opacity: .5, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; s.add(m); stains.push(m); }
  const box = document.getElementById('fxt');
  for (let i = 0; i < NT; i++) { const e = document.createElement('span'); box.appendChild(e); texts.push({ e, life: 0, p: new THREE.Vector3() }); }
}
export function clearFx() {
  bPos.fill(-999); bLife.fill(0); bits.geometry.attributes.position.needsUpdate = true;
  dummy.scale.set(0, 0, 0); dummy.updateMatrix(); sd.forEach((d, i) => { d.life = 0; sheets.setMatrixAt(i, dummy.matrix); }); sheets.instanceMatrix.needsUpdate = true;
  clouds.forEach(c => { c.life = 0; c.sp.visible = false; }); stains.forEach(m => m.visible = false); texts.forEach(t => { t.life = 0; t.e.style.display = 'none'; });
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
export const sparks = (p, n) => { bitsAt(p, n >> 1, '#ffd84d', 5, 3); bitsAt(p, n >> 1, '#ff8a1f', 4, 2); };
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
    Object.assign(d, { x: p.x + rand(-.15, .15), y: p.y + rand(-.1, .2), z: p.z + rand(-.15, .15), vx: Math.cos(a) * s, vy: rand(1.5, 4.5) * (power / 3), vz: Math.sin(a) * s, rx: rand(6.28), ry: rand(6.28), rz: rand(6.28), wx: rand(-6, 6), wy: rand(-3, 3), wz: rand(-6, 6), life: 1300, rest: false, ph: rand(6.28) });
    sheets.setColorAt(k, col.set(color));
  }
  sheets.instanceColor.needsUpdate = true;
}
export function stain(x, z, r, color, a = .5) { const m = stains[sti = (sti + 1) % NST]; m.visible = true; m.position.set(x, .012 + sti * .0006, z); m.scale.set(r * rand(.8, 1.2), r * rand(.6, 1), 1); m.rotation.z = rand(6.28); m.material.color.set(color); m.material.opacity = a; }
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
    const d = sd[k]; if (d.life <= 0) continue; ch = true;
    if (!d.rest) {
      d.vy = Math.max(-1.3, d.vy - 7 * dt); d.vx = d.vx * .965 + Math.sin(G.tick * .08 + d.ph) * .012; d.vz = d.vz * .965 + Math.cos(G.tick * .07 + d.ph) * .012;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      if (d.y <= .015) { d.rest = true; d.y = .012 + k * .0003; d.rx = -Math.PI / 2; d.ry = 0; d.life = Math.min(d.life, 900); }
      if (d.y > 2.9) { d.y = 2.9; d.vy = -.2; }
    }
    d.life--; dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.rx, d.ry, d.rz); const s = d.life <= 0 ? 0 : Math.min(1, d.life / 30); dummy.scale.set(s, s, s); dummy.updateMatrix(); sheets.setMatrixAt(k, dummy.matrix);
  }
  if (ch) sheets.instanceMatrix.needsUpdate = true;
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
