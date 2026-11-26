// 사람을 때릴 때의 손맛: 맞은 자리에 터지는 별, 화면 집중선, 카메라가 맞은 쪽으로 툭 밀리고 살짝 당겨지는 느낌
// 머리 위를 도는 별(어지러움)도 여기서 만든다
import { THREE, X, canvasTex } from './gfx.js';
import { G, rand } from './state.js';

let starT, stars = [], si = 0, lines, linesT = 0, linesMax = 1, zoomT = 0, zoomMax = 1, zoomK = 0;
const kick = new THREE.Vector3(), kv = new THREE.Vector3();
let kickT = 0, kickMax = 1;

// 만화식 충돌 별: 흰 가운데 → 노랑 → 주황 테두리, 뾰족뾰족
export function starTex() {
  return starT || (starT = canvasTex(128, 128, (c, w) => {
    const r0 = 60, r1 = 30, n = 12, cx = w / 2;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? r1 * (.85 + Math.random() * .3) : r0 * (.82 + Math.random() * .18); c.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r); }
    c.closePath();
    const g = c.createRadialGradient(cx, cx, 0, cx, cx, r0); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#fff6b0'); g.addColorStop(.7, '#ffd23f'); g.addColorStop(1, '#ff8a1f');
    c.fillStyle = g; c.fill(); c.lineWidth = 4; c.strokeStyle = '#3a2410'; c.stroke();
  }));
}
export function initHitfx() {
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), transparent: true, depthTest: false, depthWrite: false }));
    sp.renderOrder = 20; sp.visible = false; X.scene.add(sp); stars.push({ sp, life: 0, max: 1, k: 1 });
  }
  lines = document.getElementById('hitlines');
}

const pv = new THREE.Vector3();
// p = 맞은 자리, dir = 날아가는 방향(x, z), power = 세기(0.6 ~ 1.7)
export function pow(p, dir, power = 1) {
  const s = stars[si = (si + 1) % stars.length];
  s.life = s.max = 11; s.k = .55 + power * .45; s.sp.visible = true; s.sp.position.set(p.x, p.y, p.z); s.sp.material.rotation = rand(6.28); s.sp.material.opacity = 1;
  if (G.calm) return;
  // 카메라: 맞은 쪽으로 툭, 그리고 살짝 당겨졌다 돌아온다
  const l = Math.hypot(dir.x, dir.z) || 1;
  kick.set(dir.x / l * .16 * power, -.05 * power, dir.z / l * .16 * power); kickT = kickMax = 9;
  zoomK = Math.max(zoomK * (zoomT / zoomMax), .05 + .05 * power); zoomT = zoomMax = 14;
  // 화면 집중선: 맞은 자리를 가운데로
  if (lines && X.camera) {
    pv.set(p.x, p.y, p.z).project(X.camera);
    if (pv.z < 1 && Number.isFinite(pv.x) && Number.isFinite(pv.y)) { lines.style.setProperty('--x', ((pv.x * .5 + .5) * 100).toFixed(1) + '%'); lines.style.setProperty('--y', ((-pv.y * .5 + .5) * 100).toFixed(1) + '%'); lines.style.setProperty('--r', (Math.random() * 7 | 0) + 'deg'); linesT = linesMax = power > 1 ? 10 : 7; }
  }
}

// 매 화면마다(멈춤 연출 중에도) 부른다: renderPlayer 다음, render 전에
export function hitFrame(dt = 1 / 60) {
  const f = Math.min(3, Math.max(0, dt * 60));
  for (const s of stars) {
    if (s.life <= 0) continue; s.life -= f;
    const t = 1 - s.life / s.max, sc = s.k * (t < .25 ? .35 + t / .25 * .85 : 1.2 + (t - .25) * .25);
    s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = t < .55 ? 1 : 1 - (t - .55) / .45; s.sp.material.rotation += .03 * f;
    if (s.life <= 0) { s.life = 0; s.sp.visible = false; }
  }
  const cam = X.camera; if (!cam) return;
  if (kickT > 0) { kickT = Math.max(0, kickT - f); const k = kickT / kickMax; kv.copy(kick).multiplyScalar(k * k); cam.position.add(kv); }
  if (zoomT > 0) { zoomT = Math.max(0, zoomT - f); const k = zoomT / zoomMax; cam.zoom = 1 + zoomK * k * k; cam.updateProjectionMatrix(); if (zoomT <= 0) { cam.zoom = 1; cam.updateProjectionMatrix(); zoomK = 0; } }
  if (lines) { if (linesT > 0) { linesT = Math.max(0, linesT - f); lines.style.opacity = (linesT / linesMax * .85).toFixed(2); } else if (lines.style.opacity !== '0') lines.style.opacity = '0'; }
}

// 머리 위를 도는 별 세 개
export function dizzyStars() {
  const g = new THREE.Group(), m = new THREE.SpriteMaterial({ map: starTex(), transparent: true, depthWrite: false });
  for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(m); sp.scale.set(.2, .2, 1); g.add(sp); }
  g.visible = false; X.scene.add(g); return g;
}
export function spinStars(g, x, y, z, t) {
  g.visible = true; g.position.set(x, y, z);
  g.children.forEach((sp, i) => { const a = t * .12 + i * 2.094; sp.position.set(Math.cos(a) * .26, Math.sin(t * .2 + i) * .04, Math.sin(a) * .26); sp.material.rotation = t * .1; });
}
