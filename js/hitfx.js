// 사람을 때릴 때의 손맛: 맞은 자리에 터지는 별, 화면 집중선, 카메라가 맞은 쪽으로 툭 밀리고 살짝 당겨지는 느낌
// 머리 위를 도는 별(어지러움), 적이 휘두르기 전에 머리 위에 뜨는 '!', 내가 맞았을 때 붉어지는 화면도 여기서 만든다
import { THREE, X, canvasTex } from './gfx.js';
import { G, rand } from './state.js';

let starT, warnT, stars = [], si = 0, lines, linesT = 0, linesMax = 1, zoomT = 0, zoomMax = 1, zoomK = 0;
const kick = new THREE.Vector3(), kv = new THREE.Vector3();
let kickT = 0, kickMax = 1;
let hurtEl = null, hurtT = 0, hurtMax = 1, hurtK = 0, lowK = 0, hurtO = 0;

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
  // 내가 맞으면 화면 가장자리가 붉게 번쩍(번쩍임 막 바로 위)
  hurtEl = document.createElement('div');
  Object.assign(hurtEl.style, { position: 'absolute', inset: '0', pointerEvents: 'none', opacity: '0', background: 'radial-gradient(ellipse at center,rgba(255,40,30,0) 36%,rgba(214,18,18,.8) 100%)' });
  const fl = document.getElementById('flash');
  if (fl && fl.parentNode) fl.parentNode.insertBefore(hurtEl, fl.nextSibling); else document.body.appendChild(hurtEl);
}

const pv = new THREE.Vector3();
// p = 맞은 자리, dir = 날아가는 방향(x, z), power = 세기(0.6 ~ 1.7), tint = 별 색(막았을 때 파랗게, 내가 맞으면 붉게)
export function pow(p, dir, power = 1, tint) {
  const s = stars[si = (si + 1) % stars.length]; if (!s) return;
  s.life = s.max = 11; s.k = .55 + power * .45; s.sp.visible = true; s.sp.position.set(p.x, p.y, p.z); s.sp.material.rotation = rand(6.28); s.sp.material.opacity = 1;
  s.sp.material.color.set(tint || 0xffffff);
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
// 내가 맞았을 때: 붉은 테두리. k = 세기(0 ~ 1)
export function hurtFlash(k = 1) { hurtK = Math.min(.95, .45 + k * .5) * (G.calm ? .5 : 1); hurtT = hurtMax = 26; }
// 체력이 얼마 안 남았을 때 가장자리가 천천히 붉게 뛴다(0 = 끔)
export function lowHp(k) { lowK = k > 0 ? Math.min(1, k) : 0; }
export function hurtClear() { hurtT = 0; lowK = 0; hurtO = 0; if (hurtEl) hurtEl.style.opacity = '0'; }

// 매 화면마다(멈춤 연출 중에도) 부른다: renderPlayer 다음, render 전에
export function hitFrame(dt = 1 / 60) {
  const f = Math.min(3, Math.max(0, dt * 60));
  for (const s of stars) {
    if (s.life <= 0) continue; s.life -= f;
    const t = 1 - s.life / s.max, sc = s.k * (t < .25 ? .35 + t / .25 * .85 : 1.2 + (t - .25) * .25);
    s.sp.scale.set(sc, sc, 1); s.sp.material.opacity = t < .55 ? 1 : 1 - (t - .55) / .45; s.sp.material.rotation += .03 * f;
    if (s.life <= 0) { s.life = 0; s.sp.visible = false; }
  }
  if (hurtEl) {
    if (hurtT > 0) hurtT = Math.max(0, hurtT - f);
    const pulse = lowK > 0 ? lowK * (.2 + .12 * Math.sin(performance.now() * .006)) * (G.calm ? .5 : 1) : 0, o = Math.max(hurtK * hurtT / hurtMax, pulse);
    if (o > .004 || hurtO > .004) { hurtEl.style.opacity = o.toFixed(3); hurtO = o; }
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
// 적이 휘두르기 직전 머리 위에 뜨는 빨간 '!' (벽 너머에서도 보인다)
export function warnMark() {
  warnT = warnT || canvasTex(64, 64, c => {
    c.fillStyle = '#e8352b'; c.beginPath(); c.arc(32, 32, 27, 0, 7); c.fill(); c.lineWidth = 5; c.strokeStyle = '#ffffff'; c.stroke();
    c.fillStyle = '#ffffff'; c.font = '900 42px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 32, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: warnT, transparent: true, depthTest: false, depthWrite: false }));
  s.renderOrder = 21; s.scale.set(.34, .34, 1); s.visible = false; X.scene.add(s); return s;
}
