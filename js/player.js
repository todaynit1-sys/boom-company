import { G, rand, clamp, lerp, angLerp } from './state.js';
import { CHARS } from './data/chars.js';
import { DEFS } from './data/props.js';
import { S } from './save.js';
import { THREE, X, M, bx, colorMat, textMat, pl, canvasTex, speckle, labelMat, boxGeo, sphGeo, cylGeo, FONT } from './gfx.js';
import { CANNON, PH, GR, attack, damage, spawn, shove, explode, later, slow, addCombo, kill, distTo } from './engine.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';

export const I = { mx: 0, mz: 0, jump: false, a: false, b: false, c: false, e: false, lookX: 0, lookY: 0 };
export const P = { active: false };
export const CAM = { yaw: 0, pitch: .28, dist: 4.3, mode: 'follow', t: 0, look: new THREE.Vector3(0, 1, 0) };
const FIST = { n: '맨손', dmg: 10, r: .75, reach: .7, push: 3, cd: 210, snd: 'punch' };
const HIPY = .97, SEATY = .585;

// ───── 몸 모양 (도형은 한 번만 만들어 둔다)
const GEO = {};
function grp(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function limbGeo(r1, r2, h, open = false) { const k = 'L' + [r1, r2, h, open].join('|'); if (GEO[k]) return GEO[k]; const g = new THREE.CylinderGeometry(r1, r2, h, 16, 1, open, Math.PI, Math.PI * 2); g.translate(0, -h / 2, 0); return GEO[k] = g; }
// 몸통: 골반 → 허리 → 가슴 → 어깨 → 목. 텍스처는 앞 가운데가 u=0.5
const Y0 = -.13, Y1 = .56;
const PROF = [[-.13, .152], [-.04, .146], [.06, .136], [.16, .145], [.26, .159], [.36, .166], [.43, .163], [.48, .152], [.52, .124], [.545, .088], [.56, .055]];
function profR(y) { for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) { const [y0, r0] = PROF[i - 1], [y1, r1] = PROF[i], t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); } return .058; }
function torsoGeo(key, k, belly) {
  if (GEO[key]) return GEO[key];
  const pts = []; for (let i = 0; i <= 20; i++) { const y = Y0 + (Y1 - Y0) * i / 20; let r = profR(y) * k; if (belly) r += belly * Math.max(0, 1 - Math.abs(y - .1) / .22); pts.push(new THREE.Vector2(Math.max(.01, r), y)); }
  return GEO[key] = new THREE.LatheGeometry(pts, 28, Math.PI, Math.PI * 2);
}
// 머리: 턱 쪽이 좁은 달걀형. 머리카락·얼굴 무늬도 같은 모양을 조금 크게 만들어 덮는다
const HEAD = { rx: .079, ry: .116, rz: .1 };
function deform(v) { const low = Math.max(0, -v.y); v.x *= 1 - .3 * low * low; v.z *= 1 - .1 * low; if (v.y < -.4 && v.z > 0) v.z += .06 * (-.4 - v.y); if (v.z < 0) v.z *= 1.05; }
function shell(key, mul, keep, opt = {}) {
  if (GEO[key]) return GEO[key];
  const g = new THREE.SphereGeometry(1, opt.w || 30, opt.h || 22, opt.ps ?? 0, opt.pl ?? Math.PI * 2, opt.ts ?? 0, opt.tl ?? Math.PI);
  const pos = g.attributes.position, nor = g.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3(), ang = [];
  const rx = HEAD.rx * mul, ry = HEAD.ry * mul, rz = HEAD.rz * mul;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const th = Math.acos(clamp(v.y, -1, 1)), ph = Math.atan2(v.z, -v.x); ang.push([th, ph]);
    deform(v); if (opt.post) opt.post(v, th, ph);
    v.set(v.x * rx, v.y * ry, v.z * rz); pos.setXYZ(i, v.x, v.y, v.z);
    n.set(v.x / (rx * rx), v.y / (ry * ry), v.z / (rz * rz)).normalize(); nor.setXYZ(i, n.x, n.y, n.z);
  }
  if (keep) { const idx = g.index.array, out = []; for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; if (keep(ang[a]) && keep(ang[b]) && keep(ang[c])) out.push(a, b, c); } g.setIndex(out); }
  return GEO[key] = g;
}
const FRONT = Math.PI / 2;
function dPhi(ph) { let d = Math.abs(ph - FRONT) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; }
const sm = t => t * t * (3 - 2 * t);
function hairline(f, s, b) { return ([th, ph]) => { const d = dPhi(ph); return th <= (d < FRONT ? lerp(f, s, sm(d / FRONT)) : lerp(s, b, sm((d - FRONT) / FRONT))); }; }
function stick(parent, a, b, r, mat) { const d = new THREE.Vector3().subVectors(b, a), len = d.length(), m = mesh(parent, cylGeo(r, r, len, 6), mat); m.position.copy(a).addScaledVector(d, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; }
function shade(hex, l) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return '#' + c.getHexString(); }

// ───── 옷 (몸통 텍스처): 정장·블레이저·후드·하와이안 셔츠
function paintTop(c, W, H, ch) {
  const Yc = y => (1 - (y - Y0) / (Y1 - Y0)) * H, cx = W / 2, base = ch.suit;
  c.fillStyle = base; c.fillRect(0, 0, W, H); speckle(c, W, H, 4000, .07); speckle(c, W, H, 1500, .05, false);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (ch.top === 'suit' || ch.top === 'blazer') {
    c.strokeStyle = shade(base, -.07); c.lineWidth = 2;
    for (const x of [W * .26, W * .74]) { c.beginPath(); c.moveTo(x, Yc(.47)); c.lineTo(x, H); c.stroke(); }
    c.beginPath(); c.moveTo(2, Yc(-.01)); c.lineTo(2, H); c.moveTo(W - 2, Yc(-.01)); c.lineTo(W - 2, H); c.stroke();
    const vb = Yc(.25), vw = 50, V = () => { c.beginPath(); c.moveTo(cx - vw, 0); c.lineTo(cx + vw, 0); c.lineTo(cx, vb); c.closePath(); };
    c.fillStyle = ch.shirt; V(); c.fill();
    c.save(); V(); c.clip();
    if (ch.tie) {
      c.fillStyle = shade(ch.tie, -.08); c.beginPath(); c.moveTo(cx - 10, 0); c.lineTo(cx + 10, 0); c.lineTo(cx + 6, Yc(.5)); c.lineTo(cx - 6, Yc(.5)); c.closePath(); c.fill();
      c.fillStyle = ch.tie; c.beginPath(); c.moveTo(cx - 6, Yc(.5)); c.lineTo(cx + 6, Yc(.5)); c.lineTo(cx + 13, Yc(.28)); c.lineTo(cx, Yc(.235)); c.lineTo(cx - 13, Yc(.28)); c.closePath(); c.fill();
      c.strokeStyle = shade(ch.tie, .13); c.lineWidth = 3; for (let k = 0; k < 8; k++) { const y = Yc(.49) + k * 11; c.beginPath(); c.moveTo(cx - 14, y + 7); c.lineTo(cx + 14, y - 6); c.stroke(); }
    } else { c.fillStyle = ch.skin; c.beginPath(); c.moveTo(cx - 22, 0); c.lineTo(cx + 22, 0); c.lineTo(cx, Yc(.45)); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, Yc(.4)); c.lineTo(cx, vb); c.stroke();
    c.restore();
    c.strokeStyle = shade(base, -.13); c.lineWidth = 13; c.beginPath(); c.moveTo(cx - vw - 6, 0); c.lineTo(cx - 3, vb + 3); c.moveTo(cx + vw + 6, 0); c.lineTo(cx + 3, vb + 3); c.stroke();
    c.strokeStyle = shade(base, .11); c.lineWidth = 2; c.beginPath(); c.moveTo(cx - vw - 14, 0); c.lineTo(cx - 9, vb - 2); c.moveTo(cx + vw + 14, 0); c.lineTo(cx + 9, vb - 2); c.stroke();
    c.fillStyle = base; for (const s of [-1, 1]) { const x = cx + s * (vw - 6), y = Yc(.49); c.beginPath(); c.moveTo(x, y); c.lineTo(x + s * 16, y - 5); c.lineTo(x + s * 14, y + 11); c.closePath(); c.fill(); }
    c.fillStyle = shade(base, -.25); for (const y of [.17, .07]) { c.beginPath(); c.arc(cx + 3, Yc(y), 4.6, 0, 7); c.fill(); }
    c.strokeStyle = shade(base, -.17); c.lineWidth = 3; c.beginPath(); c.moveTo(cx + 64, Yc(.35)); c.lineTo(cx + 102, Yc(.356)); c.stroke();
    for (const s of [-1, 1]) { c.fillStyle = shade(base, -.06); c.fillRect(cx + s * 100 - 28, Yc(.03), 56, 10); c.strokeStyle = shade(base, -.18); c.lineWidth = 1.5; c.strokeRect(cx + s * 100 - 28, Yc(.03), 56, 10); }
    const hem = () => { c.beginPath(); c.moveTo(cx, Yc(.0)); c.lineTo(cx + 32, H); c.lineTo(cx - 32, H); c.closePath(); };
    c.fillStyle = ch.shirt; hem(); c.fill(); c.save(); hem(); c.clip(); c.fillStyle = ch.pants; c.fillRect(cx - 40, Yc(-.1), 80, H); c.fillStyle = '#1c1a19'; c.fillRect(cx - 40, Yc(-.065), 80, Yc(-.1) - Yc(-.065)); c.fillStyle = '#c9ccd0'; c.fillRect(cx - 7, Yc(-.065) + 1, 14, Yc(-.1) - Yc(-.065) - 2); c.restore();
  } else if (ch.top === 'hoodie') {
    c.strokeStyle = shade(base, -.28); c.lineWidth = 3; c.beginPath(); c.moveTo(cx, 0); c.lineTo(cx, H); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; for (let y = 4; y < H; y += 5) { c.beginPath(); c.moveTo(cx - 3, y); c.lineTo(cx + 3, y); c.stroke(); }
    for (const s of [-1, 1]) { c.strokeStyle = '#f2f0ea'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + s * 14, 3); c.lineTo(cx + s * 17, Yc(.36)); c.stroke(); c.fillStyle = '#cfccc4'; c.fillRect(cx + s * 17 - 3, Yc(.36), 6, 9); }
    c.strokeStyle = shade(base, -.2); c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 72, Yc(.13)); c.lineTo(cx + 72, Yc(.13)); c.lineTo(cx + 92, Yc(-.06)); c.lineTo(cx - 92, Yc(-.06)); c.closePath(); c.stroke();
    c.fillStyle = shade(base, -.08); c.fillRect(0, Yc(-.09), W, H - Yc(-.09)); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; for (let x = 0; x < W; x += 5) { c.beginPath(); c.moveTo(x, Yc(-.09)); c.lineTo(x, H); c.stroke(); }
  } else if (ch.top === 'aloha') {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 48; i++) {
      const x = rnd() * W, y = rnd() * H, r = 9 + rnd() * 8;
      c.fillStyle = '#2f7d3c'; c.beginPath(); c.ellipse(x + r, y + 4, r * .9, r * .35, rnd() * 3, 0, 7); c.fill();
      c.fillStyle = rnd() < .5 ? '#fff4e0' : '#ffd84d'; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; c.beginPath(); c.ellipse(x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .45, r * .3, a, 0, 7); c.fill(); }
      c.fillStyle = '#c9281f'; c.beginPath(); c.arc(x, y, r * .22, 0, 7); c.fill();
    }
    c.strokeStyle = shade(base, -.2); c.lineWidth = 2; c.beginPath(); c.moveTo(cx + 8, Yc(.44)); c.lineTo(cx + 8, H); c.stroke();
    c.fillStyle = '#f4efe2'; for (let y = Yc(.4); y < H; y += 34) { c.beginPath(); c.arc(cx + 2, y, 3.5, 0, 7); c.fill(); }
    c.fillStyle = ch.skin; c.beginPath(); c.moveTo(cx - 26, 0); c.lineTo(cx + 26, 0); c.lineTo(cx, Yc(.44)); c.closePath(); c.fill();
    c.fillStyle = shade(base, .08); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * 26, 0); c.lineTo(cx + s * 62, 0); c.lineTo(cx + s * 6, Yc(.44)); c.closePath(); c.fill(); }
  }
}
const TOPS = {};
function topMat(id) { return TOPS[id] || (TOPS[id] = new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (c, w, h) => paintTop(c, w, h, CHARS[id])), roughness: .82 })); }
function badgeMat(id) {
  return labelMat('badge' + id, 64, 96, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6bff'; c.fillRect(0, 0, w, 16);
    c.fillStyle = '#c9d3e6'; c.fillRect(16, 23, 32, 38); c.fillStyle = '#7b8aa6'; c.beginPath(); c.arc(32, 37, 9, 0, 7); c.fill(); c.fillRect(21, 49, 22, 12);
    c.fillStyle = '#222'; c.font = '700 11px ' + FONT; c.textAlign = 'center'; c.fillText(CHARS[id].n, 32, 78); c.fillStyle = '#999'; c.fillRect(14, 85, 36, 3);
  }, true);
}

// ───── 얼굴: 표정마다 그린 무늬를 머리 앞에 덮는다
const FACES = {};
export function faceTex(id, ex) {
  const key = id + ':' + ex; if (FACES[key]) return FACES[key];
  const ch = CHARS[id], brow = ch.hair === 'bald' ? shade(ch.hairCol, -.18) : ch.hairCol;
  return FACES[key] = canvasTex(256, 256, c => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const L = 74, R = 182, EY = 104, BY = 76, MY = 166, ink = '#22160f', lip = '#a5554a';
    c.fillStyle = 'rgba(225,120,105,.15)'; for (const x of [58, 198]) { c.beginPath(); c.ellipse(x, 137, 20, 11, 0, 0, 7); c.fill(); }
    const brows = (inner, outer, arch, w) => { c.strokeStyle = brow; c.lineWidth = w; for (const x of [L, R]) { const d = x < 128 ? 1 : -1; c.beginPath(); c.moveTo(x - d * 19, BY + outer); c.quadraticCurveTo(x, BY + (inner + outer) / 2 - arch, x + d * 19, BY + inner); c.stroke(); } };
    const eyes = (ry, iris, pupil, hl, lid) => {
      for (const x of [L, R]) {
        c.fillStyle = '#fbf8f3'; c.beginPath(); c.ellipse(x, EY, 16, ry, 0, 0, 7); c.fill();
        c.save(); c.beginPath(); c.ellipse(x, EY, 16, ry, 0, 0, 7); c.clip();
        c.fillStyle = '#4a3326'; c.beginPath(); c.arc(x, EY + 1, iris, 0, 7); c.fill();
        c.fillStyle = '#120c08'; c.beginPath(); c.arc(x, EY + 1, pupil, 0, 7); c.fill();
        if (hl) { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(x - 3, EY - 2.5, 2.3, 0, 7); c.fill(); }
        if (lid) { c.fillStyle = ch.skin; c.fillRect(x - 18, EY - ry - 2, 36, lid + 2); }
        c.restore();
        c.strokeStyle = ink; c.lineWidth = 3.2; c.beginPath(); c.ellipse(x, EY + (lid ? lid * .6 : 0), 16.5, Math.max(2, ry + .4 - (lid ? lid * .6 : 0)), 0, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
        c.strokeStyle = 'rgba(40,25,18,.35)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, EY, 15, ry, 0, Math.PI * .2, Math.PI * .8); c.stroke();
      }
    };
    const closed = dy => { c.strokeStyle = ink; c.lineWidth = 3.4; for (const x of [L, R]) { c.beginPath(); c.moveTo(x - 15, EY); c.quadraticCurveTo(x, EY + dy, x + 15, EY); c.stroke(); } };
    if (ex === 'normal' || ex === 'blink') {
      brows(0, 2, 3, 6.5); if (ex === 'blink') closed(4); else eyes(8.5, 8, 3.8, true, 0);
      c.strokeStyle = lip; c.lineWidth = 3.6; c.beginPath(); c.moveTo(128 - 25, MY); c.quadraticCurveTo(128, MY + 3, 128 + 25, MY); c.stroke();
    } else if (ex === 'endure' || ex === 'endureB') {
      brows(10, -5, -2, 7.5); if (ex === 'endureB') closed(2); else eyes(7, 7, 3.4, true, 3);
      c.strokeStyle = lip; c.lineWidth = 4; c.beginPath(); c.moveTo(102, MY + 1); for (let k = 1; k <= 7; k++) c.lineTo(102 + k * 7.5, MY + (k % 2 ? -3 : 3)); c.stroke();
      c.strokeStyle = 'rgba(120,60,50,.35)'; c.lineWidth = 2; for (const x of [L, R]) { const d = x < 128 ? 1 : -1; c.beginPath(); c.moveTo(x + d * 22, BY + 2); c.lineTo(x + d * 24, BY - 8); c.stroke(); }
    } else if (ex === 'rage') {
      brows(14, -9, -3, 8.5); eyes(11, 5.5, 2.6, false, 0);
      c.fillStyle = '#4a1712'; c.beginPath(); c.roundRect(98, MY - 12, 60, 28, 10); c.fill(); c.fillStyle = '#f6f3ee'; c.fillRect(103, MY - 10, 50, 6); c.fillStyle = '#c0574c'; c.beginPath(); c.ellipse(128, MY + 10, 18, 5, 0, 0, 7); c.fill();
    } else if (ex === 'relief') {
      brows(-4, -2, 6, 6); closed(-10);
      c.fillStyle = '#6e2219'; c.beginPath(); c.moveTo(102, MY - 5); c.quadraticCurveTo(128, MY + 24, 154, MY - 5); c.closePath(); c.fill(); c.fillStyle = '#f6f3ee'; c.fillRect(108, MY - 5, 40, 4);
    }
  });
}
let veinT;
function veinSprite() {
  veinT = veinT || canvasTex(64, 64, c => { c.strokeStyle = '#e0302a'; c.lineWidth = 7; c.lineCap = 'round'; for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = Math.atan2(-dy, -dx); c.beginPath(); c.arc(32 + dx * 13, 32 + dy * 13, 11, a - 1.1, a + 1.1); c.stroke(); } });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: veinT, transparent: true })); s.scale.set(.085, .085, 1); s.visible = false; return s;
}

export function buildRig(id, acc) {
  const ch = CHARS[id], root = new THREE.Group(), R = { root, id };
  const skin = colorMat(ch.skin, .58), pants = colorMat(ch.pants, .85), shoe = colorMat(ch.shoes, .35), sole = colorMat('#1a1a1a', .9), shirt = colorMat(ch.shirt, .75);
  const hairM = new THREE.MeshStandardMaterial({ color: ch.hairCol, roughness: .55, side: THREE.DoubleSide }), sleeve = colorMat(ch.suit, .82);
  const jacket = ch.top === 'suit' || ch.top === 'blazer';
  // 다리
  const hips = R.hips = grp(root, 0, HIPY, 0);
  mesh(hips, limbGeo(.138, .13, .17), pants, 0, -.035, 0).scale.z = .8;
  mesh(hips, sphGeo(.07, 14), pants, 0, -.17, 0).scale.set(1.2, .8, .9);
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R', hip = grp(hips, s * .088, -.07, 0), knee = grp(hip, 0, -.43, 0), ank = grp(knee, 0, -.42, 0);
    mesh(hip, limbGeo(.078, .057, .43), pants); mesh(hip, sphGeo(.077, 14), pants).scale.set(1, .7, 1);
    mesh(knee, sphGeo(.056, 12), pants); mesh(knee, limbGeo(.056, .042, .42), pants);
    mesh(ank, boxGeo(.096, .024, .27, .008), sole, 0, -.048, .045); mesh(ank, boxGeo(.092, .062, .24, .03), shoe, 0, -.012, .04);
    R['hip' + k] = hip; R['knee' + k] = knee; R['ank' + k] = ank;
  }
  // 몸통
  const sp = R.spine = grp(hips, 0, 0, 0);
  mesh(sp, torsoGeo('t' + ch.top + (ch.belly ? 'b' : ''), ch.top === 'aloha' ? .98 : 1, ch.belly ? .032 : 0), topMat(id)).scale.z = .74;
  for (const s of [-1, 1]) mesh(sp, sphGeo(.06, 14), sleeve, s * .186, .452, 0).scale.set(1.12, .8, 1.02);
  mesh(sp, limbGeo(.046, .05, .13), skin, 0, .7, .002);
  if (jacket) { mesh(sp, limbGeo(.058, .064, .05, true), shirt, 0, .6, .004).scale.z = .92; if (ch.tie) mesh(sp, boxGeo(.034, .036, .02, .006), colorMat(ch.tie, .6), 0, .548, .058); }
  if (ch.top === 'hoodie') mesh(sp, sphGeo(.1, 16), sleeve, 0, .53, -.075).scale.set(1.35, .62, .75);
  if (ch.badge) {
    const lm = colorMat('#2f6bff', .7), V = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const s of [-1, 1]) { stick(sp, V(s * .05, .55, .07), V(s * .026, .43, .129), .0045, lm); stick(sp, V(s * .026, .43, .129), V(0, .32, .133), .0045, lm); }
    const b = R.badge = grp(sp, 0, .32, .133); mesh(b, boxGeo(.056, .082, .004, .004), M('white'), 0, -.047, 0); pl(b, .052, .078, badgeMat(id), 0, -.047, .0025);
  }
  // 팔과 손
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R', sh = grp(sp, s * .2, .45, 0), el = grp(sh, 0, -.29, 0), hd = grp(el, 0, -.255, 0);
    if (ch.top === 'aloha') { mesh(sh, limbGeo(.057, .053, .15), sleeve); mesh(sh, limbGeo(.046, .04, .29), skin); mesh(el, sphGeo(.04, 12), skin); mesh(el, limbGeo(.04, .033, .25), skin); }
    else { mesh(sh, limbGeo(.051, .043, .29), sleeve); mesh(el, sphGeo(.044, 12), sleeve); mesh(el, limbGeo(.044, .036, .245), sleeve); if (jacket) mesh(el, limbGeo(.037, .037, .025), shirt, 0, -.228, 0); }
    mesh(hd, boxGeo(.03, .085, .074, .013), skin, 0, -.045, .004);
    const fg = grp(hd, 0, -.086, .002); mesh(fg, boxGeo(.026, .07, .07, .012), skin, 0, -.032, 0);
    const th = grp(hd, -s * .006, -.032, .036); mesh(th, boxGeo(.022, .052, .022, .009), skin, 0, -.02, 0); th.rotation.set(-.35, 0, s * .25);
    R['sh' + k] = sh; R['el' + k] = el; R['hand' + k] = hd; R['fing' + k] = fg;
  }
  // 머리
  const head = R.head = grp(sp, 0, .72, .008);
  mesh(head, shell('head', 1), skin);
  R.face = new THREE.Mesh(shell('face', 1.01, null, { ps: FRONT - .95, pl: 1.9, ts: .72, tl: 2.0, w: 22, h: 20 }), new THREE.MeshStandardMaterial({ map: faceTex(id, 'normal'), transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  head.add(R.face);
  for (const s of [-1, 1]) mesh(head, sphGeo(.026, 10), skin, s * .078, -.008, -.006).scale.set(.42, 1, .78);
  mesh(head, boxGeo(.019, .036, .022, .008), skin, 0, -.017, .097).rotation.x = -.3;
  const st = ch.hair;
  if (st === 'short') mesh(head, shell('h_short', 1.075, hairline(1.0, 1.45, 2.2)), hairM);
  else if (st === 'slick') mesh(head, shell('h_slick', 1.065, hairline(.9, 1.4, 2.15)), hairM);
  else if (st === 'mop') mesh(head, shell('h_mop', 1.12, hairline(1.22, 1.62, 2.28)), hairM);
  else if (st === 'bob') mesh(head, shell('h_bob', 1.1, hairline(1.2, 2.3, 2.42), { post: (v, t) => { if (t > 1.65) { const k = 1 + (t - 1.65) * .2; v.x *= k; v.z *= k; } } }), hairM);
  else if (st === 'bald') mesh(head, shell('h_bald', 1.045, ([t, p]) => t > 1.36 && t < 2.08 && dPhi(p) > 1.15), hairM);
  else if (st === 'cap') {
    const cm = colorMat(ch.capCol || ch.suit, .6);
    mesh(head, shell('h_capb', 1.07, ([t, p]) => t > 1.25 && t < 2.1 && dPhi(p) > 1.25), hairM); mesh(head, shell('h_cap', 1.115, ([t]) => t < 1.33), cm);
    mesh(head, boxGeo(.15, .012, .1, .005), cm, 0, .052, .104).rotation.x = .18; mesh(head, sphGeo(.012, 8), cm, 0, .128, 0);
  }
  const gm = M('plasticDark');
  if (ch.glasses && acc !== 'sun') { for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.021, .0035, 6, 16), gm); t.position.set(s * .031, .004, .1); head.add(t); bx(head, .004, .004, .08, gm, s * .056, .008, .062); } bx(head, .02, .004, .004, gm, 0, .008, .104); }
  if (ch.sun || acc === 'sun') { bx(head, .135, .034, .014, 'glassDark', 0, .004, .099, .008); for (const s of [-1, 1]) bx(head, .004, .004, .08, gm, s * .064, .008, .062); }
  if (acc === 'band') { const b = mesh(head, new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#c9281f', roughness: .6, side: THREE.DoubleSide }), 0, .052, 0); b.scale.set(.087, .028, .109); pl(head, .07, .024, textMat('투쟁', { w: 128, h: 44, size: 32, bg: '#c9281f', fg: '#ffffff' }), 0, .052, .111); }
  if (acc === 'helmet') { const ym = colorMat('#f2c21a', .35); mesh(head, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ym, 0, .03, 0).scale.set(.1, .11, .122); mesh(head, cylGeo(.13, .13, .012, 20), ym, 0, .03, .015).scale.z = 1.12; }
  if (acc === 'chain') { const t = new THREE.Mesh(new THREE.TorusGeometry(.07, .009, 6, 20), M('gold')); t.position.set(0, .5, .07); t.rotation.x = 1.25; sp.add(t); }
  R.vein = veinSprite(); R.vein.position.set(.07, .078, .06); head.add(R.vein);
  root.scale.set(ch.build, 1, ch.build);
  return R;
}

export function poseRig(R, st) {
  const ph = st.walk || 0, sp = Math.min(1.2, st.speed || 0), s = Math.sin(ph), t = st.t || 0, run = clamp((sp - .6) / .45, 0, 1), idle = 1 - Math.min(1, sp * 2);
  const sw = (.5 + .22 * run) * sp;
  R.hipL.rotation.set(-s * sw, 0, 0); R.hipR.rotation.set(s * sw, 0, 0);
  R.kneeL.rotation.set(.04 + Math.max(0, Math.sin(ph + 1.3)) * (.8 + .6 * run) * sp, 0, 0); R.kneeR.rotation.set(.04 + Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * (.8 + .6 * run) * sp, 0, 0);
  R.hips.position.set(Math.sin(ph) * .016 * sp + Math.sin(t * .013) * .008 * idle, HIPY - Math.abs(Math.cos(ph)) * .03 * sp - .02 * run, 0);
  R.hips.rotation.set(0, s * .1 * sp, Math.sin(ph) * .03 * sp + Math.sin(t * .013) * .012 * idle);
  R.spine.rotation.set(.03 + .06 * sp + .1 * run, -s * .17 * sp, -Math.sin(ph) * .025 * sp - Math.sin(t * .013) * .01 * idle);
  const br = Math.sin(t * .05) * .007 * idle; R.spine.scale.set(1, 1 + br, 1 + br * .8);
  const aw = (.5 + .2 * run) * sp;
  R.shL.rotation.set(s * aw, 0, .1 + .04 * idle); R.shR.rotation.set(-s * aw, 0, -.1 - .04 * idle);
  R.elL.rotation.set(-.15 - (.35 + 1.05 * run) * sp - Math.max(0, s) * .15 * sp, 0, 0); R.elR.rotation.set(-.15 - (.35 + 1.05 * run) * sp - Math.max(0, -s) * .15 * sp, 0, 0);
  R.head.rotation.set(-.03 * sp, st.look || 0, 0);
  let fL = .35, fR = .35;
  if (st.seated) {
    R.hips.position.set(0, SEATY, -.05); R.hips.rotation.set(0, 0, 0);
    R.hipL.rotation.set(-1.5, 0, .06); R.hipR.rotation.set(-1.5, 0, -.06); R.kneeL.rotation.set(1.48, 0, 0); R.kneeR.rotation.set(1.48, 0, 0);
    R.spine.rotation.set(st.clench ? .05 : -.05, 0, 0);
    if (st.typing) { R.shL.rotation.set(-.62, 0, .16); R.shR.rotation.set(-.62, 0, -.16); R.elL.rotation.set(-1 + Math.sin(t * .4) * .04, 0, 0); R.elR.rotation.set(-1 + Math.sin(t * .4 + 2) * .04, 0, 0); fL = fR = .5; }
    else { R.shL.rotation.set(-.42, 0, .14); R.shR.rotation.set(-.42, 0, -.14); R.elL.rotation.set(-.7, 0, 0); R.elR.rotation.set(-.7, 0, 0); fL = fR = st.clench ? 1.5 : .5; }
  }
  R.ankL.rotation.x = -(R.hipL.rotation.x + R.kneeL.rotation.x) * .7; R.ankR.rotation.x = -(R.hipR.rotation.x + R.kneeR.rotation.x) * .7;
  if (st.seated) R.ankL.rotation.x = R.ankR.rotation.x = 0;
  if (st.air) { R.hipL.rotation.x = -.6; R.hipR.rotation.x = -.15; R.kneeL.rotation.x = 1.0; R.kneeR.rotation.x = .55; R.shL.rotation.z = .55; R.shR.rotation.z = -.55; }
  if (st.slam) { R.spine.rotation.x = .45; R.shL.rotation.set(-2.7, 0, .2); R.shR.rotation.set(-2.7, 0, -.2); fL = fR = 1.6; }
  if (st.carry) { R.shL.rotation.set(-2.95, 0, .28); R.shR.rotation.set(-2.95, 0, -.28); R.elL.rotation.x = -.15; R.elR.rotation.x = -.15; fL = fR = 1.2; }
  if (st.cheer) { const b = Math.sin(t * .25); R.shL.rotation.set(-2.85 + b * .08, 0, .5); R.shR.rotation.set(-2.85 - b * .08, 0, -.5); R.elL.rotation.x = -.25; R.elR.rotation.x = -.25; fL = fR = 1.6; R.head.rotation.x = -.18; }
  if (st.relief && !st.seated && !st.cheer) { R.spine.rotation.x = -.1; R.head.rotation.x = -.22; R.shL.rotation.set(.1, 0, .16); R.shR.rotation.set(.1, 0, -.16); R.elL.rotation.x = -.1; R.elR.rotation.x = -.1; }
  const a = st.atk;
  if (a) {
    const k = a.t, up = k < .35 ? k / .35 : 1, hit = k < .35 ? 0 : Math.min(1, (k - .35) / .22), back = k > .7 ? (k - .7) / .3 : 0;
    if (a.type === 'kick') {
      const q = up * (1 - back); R.hipR.rotation.x = -1.75 * (k < .35 ? up * .5 : hit) * (1 - back); R.kneeR.rotation.x = (k < .35 ? 1.3 * up : 1.3 * (1 - hit)) * (1 - back); R.ankR.rotation.x = .3 * q; R.spine.rotation.x = -.28 * q; R.shL.rotation.x = -.6 * q; R.shR.rotation.x = .5 * q;
    } else {
      const ang = lerp(lerp(0, -2.75, up), a.type === 'smash' ? -.25 : -.75, hit) * (1 - back), side = a.alt ? -1 : 1;
      R.shR.rotation.set(ang, 0, -.1 - (a.alt ? .5 * up * (1 - hit) : 0)); R.elR.rotation.x = -.35 * (1 - hit); fR = 1.6;
      if (a.type === 'smash') { R.shL.rotation.set(ang, 0, .35); R.elL.rotation.x = -.5 * (1 - hit); fL = 1.6; }
      R.spine.rotation.y = side * lerp(-.45 * up, .45, hit) * (1 - back); R.spine.rotation.x = lerp(-.12 * up, .3, hit) * (1 - back);
    }
  }
  if (st.armed) fR = 1.7;
  R.fingL.rotation.z = fL; R.fingR.rotation.z = -fR;
  if (R.badge) { R.badge.rotation.x = .06 + Math.sin(ph * 2) * .16 * sp + (a ? .2 : 0); R.badge.rotation.z = Math.sin(ph) * .08 * sp; }
}

// ───── 생성·자리
const rigs = {};
function setMask() { if (P.body) P.body.collisionFilterMask = (P.seated || P.ghost > 0) ? (GR.STATIC | GR.PWALL) : (GR.STATIC | GR.PROP | GR.PWALL); }
export function spawnPlayer(id, x, z, yaw = 0) {
  const key = id + '|' + (S.acc || '');
  const R = rigs[key] || (rigs[key] = buildRig(id, S.acc));
  if (P.wmesh && P.R) P.R.handR.remove(P.wmesh);
  if (P.R && P.R !== R) X.scene.remove(P.R.root);
  X.scene.add(R.root); R.shown = null;
  const body = new CANNON.Body({ mass: 70, material: PH.matP, fixedRotation: true, allowSleep: false, collisionFilterGroup: GR.PLAYER, collisionFilterMask: GR.STATIC | GR.PROP | GR.PWALL });
  body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .3, 0)); body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .9, 0));
  body.position.set(x, .02, z); body.isPlayer = true; body.updateMassProperties(); PH.world.addBody(body);
  Object.assign(P, { id, ch: CHARS[id], R, body, yaw, walk: 0, speed: 0, atk: null, cdB: 0, n3: 0, air: 0, jumps: 0, slam: false, rush: 0, storm: 0, carry: null, weapon: null, wdef: null, wdur: 0, wmesh: null, lock: 0, pj: false, pb: false, pc: false, pe: false, pa: false, eHold: 0, active: true, t: 0, onG: true, cand: null, seated: null, ghost: 0, auto: null, cheer: false, expr: 'normal', blinkT: 2.5, tremble: 0, look: 0 });
  CAM.yaw = yaw + Math.PI; CAM.pitch = .28; CAM.mode = 'follow';
  R.root.visible = true; R.root.position.set(x, 0, z); R.root.rotation.y = yaw;
}
export function hidePlayer() { P.active = false; if (P.R) P.R.root.visible = false; }
export function placeAt(x, z, yaw) { if (P.seated) standUp(); P.ghost = 0; setMask(); P.body.position.set(x, .02, z); P.body.velocity.set(0, 0, 0); P.yaw = yaw; CAM.yaw = yaw + Math.PI; P.auto = null; }
// 의자가 바라보는 쪽(의자 앞 = +z)과 앉는 자리
export function seatOf(ch) { const b = ch.body, q = b.quaternion, fx_ = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y), yaw = Math.atan2(fx_, fz); return { x: b.position.x + Math.sin(yaw) * .04, z: b.position.z + Math.cos(yaw) * .04, yaw }; }
export function sit(chair) {
  if (!chair || chair.dead || !P.active) return;
  if (P.carry) throwCarry(true);
  const b = chair.body, st = seatOf(chair);
  b.quaternion.setFromEuler(0, st.yaw, 0); b.position.y = chair.size[1] / 2 + .004; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.sleep(); chair.g.position.copy(b.position); chair.g.quaternion.copy(b.quaternion);
  P.seated = chair; P.auto = null; P.body.position.set(st.x, .02, st.z); P.body.velocity.set(0, 0, 0); P.yaw = st.yaw; setMask(); sfx('step', .6);
}
export function standUp() {
  const ch = P.seated; P.seated = null; P.ghost = 36;
  if (ch && !ch.dead) { ch.body.wakeUp(); ch.body.velocity.set(-Math.sin(P.yaw) * 2.2, 0, -Math.cos(P.yaw) * 2.2); }
  setMask();
}
export function setFace(e) { P.expr = e; }
export function tremble() { P.tremble = 12; }

export function equip(type) {
  dropWeapon();
  const def = DEFS[type]; P.weapon = type; P.wdef = def.weapon; P.wdur = def.weapon.dur || 0;
  const g = new THREE.Group(); def.build(g, {}, def.size); g.position.set(0, 0, def.size[2] * .36); const holder = new THREE.Group(); holder.add(g); holder.position.set(0, -.07, 0); P.R.handR.add(holder); P.wmesh = holder;
  sfx('up', .6); fx.text(headPos(.5), def.weapon.n + ' 장착!', 'note');
}
export function dropWeapon(broke) {
  if (!P.weapon) return; P.R.handR.remove(P.wmesh);
  const p = P.body.position;
  if (!broke) spawn(P.weapon, p.x + Math.sin(P.yaw) * .5, .6, p.z + Math.cos(P.yaw) * .5, { ry: rand(6.28) });
  P.weapon = null; P.wdef = null; P.wmesh = null;
}
const headPos = (dy = 0) => ({ x: P.body.position.x, y: P.body.position.y + 1.85 + dy, z: P.body.position.z });
const fwd = () => ({ x: Math.sin(P.yaw), z: Math.cos(P.yaw) });
const aim = () => ({ x: -Math.sin(CAM.yaw), z: -Math.cos(CAM.yaw) });

export function carry(p) { P.carry = p; p.held = true; p.body.collisionResponse = false; p.body.wakeUp(); sfx('jump', .5); }
export function throwCarry(soft) {
  const p = P.carry; if (!p || p === true) return; P.carry = null; p.held = false;
  const a = soft ? fwd() : aim(), b = p.body, pp = P.body.position, k = (P.ch.thr || 1) * clamp(4 / Math.sqrt(b.mass), .55, 1.25);
  if (!soft) P.yaw = Math.atan2(a.x, a.z);
  b.collisionResponse = true; b.position.set(pp.x + a.x * .75, pp.y + (soft ? 1.0 : 1.75), pp.z + a.z * .75); b.wakeUp();
  if (soft) b.velocity.set(a.x * 1.5, 0, a.z * 1.5);
  else { const up = Math.max(.12, .5 - CAM.pitch) * 9; b.velocity.set(a.x * 15 * k, up * k + 1.5, a.z * 15 * k); b.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); p.thrownT = G.tick; sfx('whoosh'); P.atk = { type: 'swing', t: .35, dur: .25, hit: true }; }
}
export function flipProp(p) {
  if (!p || p.dead) return;
  const a = fwd(), b = p.body, r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
  b.wakeUp(); b.velocity.set(a.x * 3, 6.5, a.z * 3); b.angularVelocity.set(r.x * 7, 0, r.z * 7);
  for (const q of G.props) { if (q === p || q.dead || q.fixed) continue; const d = distTo(q, { x: b.position.x, y: b.position.y + p.size[1] / 2 + .2, z: b.position.z }); if (d < Math.max(p.size[0], p.size[2]) * .6) shove(q, a.x * 5 + rand(-2, 2), rand(5, 9), a.z * 5 + rand(-2, 2)); }
  damage(p, p.maxHp * .3, b.position, true); const gain = 200000 * G.mult; G.money += gain; addCombo(3); G.rage = Math.min(100, G.rage + 12);
  fx.text({ x: b.position.x, y: b.position.y + 1.2, z: b.position.z }, '와르르!', 'word big'); fx.text({ x: b.position.x, y: b.position.y + 1.6, z: b.position.z }, '엎기 +' + Math.round(gain).toLocaleString('ko-KR') + '원', 'money');
  sfx('wood'); sfx('boom', .6); G.shake = .3; G.hitstop = 70; buzz(50); P.atk = { type: 'smash', t: .3, dur: .4, hit: true };
}

// E로 집거나 엎을 수 있는 가장 가까운 물건
function findCand() {
  const pp = P.body.position, f = fwd(), c = { x: pp.x + f.x * .7, y: .9, z: pp.z + f.z * .7 }; let best = null, bd = 1.5;
  if (G.want && !G.want.dead && !G.want.held && distTo(G.want, c, .9) < 1.9) return G.want;
  for (const p of G.props) {
    if (p.dead || p.kind !== 'obj' || p.fixed || p.held || p === P.seated) continue; const def = p.def;
    const can = def.weapon || def.flip || (def.grab !== false && p.body.mass <= 25); if (!can) continue;
    const d = distTo(p, c, .7) + (def.weapon ? -.4 : 0) + (def.flip ? .25 : 0); if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function startAtk(kind) {
  const W = P.wdef || FIST, ch = P.ch, pp = P.body.position;
  if (!I.mx && !I.mz) { let best = null, bd = 2.6; const f = fwd(); for (const p of G.props) { if (p.dead || p.hp == null || p.held) continue; const d = distTo(p, { x: pp.x, y: .9, z: pp.z }, .8); if (d > bd) continue; const bp = p.body.position, dx = bp.x - pp.x, dz = bp.z - pp.z, l = Math.hypot(dx, dz) || 1; if ((dx * f.x + dz * f.z) / l < -.2) continue; bd = d; best = p; } if (best) P.yaw = Math.atan2(best.body.position.x - pp.x, best.body.position.z - pp.z); }
  const rate = ch.rate * (P.rush > 0 ? 1.8 : 1);
  if (kind === 'a') { P.n3 = (P.n3 + 1) % 3; P.atk = { type: 'swing', t: 0, dur: W.cd / 1000 / rate, alt: P.n3 === 1, third: P.n3 === 0, k: 'a' }; }
  else { P.atk = { type: P.weapon ? 'smash' : 'kick', t: 0, dur: (P.weapon ? W.cd * 1.7 : 430) / 1000 / Math.sqrt(rate), k: 'b' }; P.cdB = 8; }
}
function doHit(a) {
  const W = P.wdef || FIST, ch = P.ch, pp = P.body.position, f = fwd(), heavy = a.k === 'b';
  let dmg, r, reach, imp;
  if (!heavy) { dmg = W.dmg * ch.pow * (a.third ? 1.5 : 1); r = W.r; reach = W.reach; const pu = W.push * (a.third ? 1.8 : 1); imp = { x: f.x * pu, y: 1.2 + (W.up || 0) * 3 * (ch.launch || 1), z: f.z * pu }; }
  else if (P.weapon) { dmg = W.dmg * 1.9 * ch.pow; r = W.r * 1.15; reach = W.reach; const pu = W.push * 1.5 * (ch.launch || 1); imp = { x: f.x * pu, y: 3.5 + (W.up || 0) * 4, z: f.z * pu }; }
  else { dmg = 30 * ch.pow; r = .9; reach = .85; imp = { x: f.x * 8 * (ch.launch || 1), y: 4.5, z: f.z * 8 * (ch.launch || 1) }; }
  const hits = attack({ x: pp.x + f.x * reach, y: pp.y + .9, z: pp.z + f.z * reach }, r, dmg, imp, { heavy: heavy || W.heavy, tall: .65, skip: P.carry });
  if (hits.length) {
    addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 1.5 + (heavy ? 2 : 0)); G.shake = Math.max(G.shake, heavy ? .16 : .05); if (heavy || W.heavy) G.hitstop = Math.max(G.hitstop, 55); buzz(8);
    sfx(W.snd, .6); if (heavy && W.word) fx.text(headPos(.2), W.word, 'note');
    if (P.wdur > 0 && --P.wdur <= 0) { fx.text(headPos(.3), P.wdef.n + ' 사망', 'note'); fx.bitsAt(headPos(-.6), 20, '#e4e1d8', 4, 3); sfx('plastic'); dropWeapon(true); }
  } else sfx('whoosh', .6);
}

function special() {
  const sp = P.ch.sp;
  G.rage = 0; G.hitstop = 110; G.flash = 6; sfx('special'); fx.text(headPos(.4), sp.name + '!', 'word big'); buzz([40, 30, 80]);
  if (sp.type === 'quake') { for (let i = 0; i < sp.n; i++) later(3 + i * 26, () => { const q = P.body.position; explode({ x: q.x, y: .2, z: q.z }, 7.5, sp.dmg, 9); fx.cloud({ x: q.x, y: .3, z: q.z }, 10, '#b9b2a2', 1.2, 1.5); sfx('boom'); }); if (sp.slow) later(5, () => slow(.3, 100)); }
  else if (sp.type === 'rush') P.rush = 480;
  else if (sp.type === 'storm') P.storm = 210;
  else if (sp.type === 'line') for (let i = 0; i < 9; i++) later(3 + i * 5, () => { const q = P.body.position, a = aim(); P.yaw = Math.atan2(a.x, a.z); const b = spawn('ball', q.x + a.x * .7 + rand(-.3, .3), 1.1 + rand(-.3, .4), q.z + a.z * .7 + rand(-.3, .3), { mass: 4, life: 240, v: { x: a.x * 30, y: 1, z: a.z * 30 } }); b.thrownT = G.tick; explode({ x: q.x + a.x * 2.2, y: 1, z: q.z + a.z * 2.2 }, 1.6, 30, 10); sfx('plastic', .7); });
  else if (sp.type === 'rain') for (let i = 0; i < 11; i++) later(6 + i * 7, () => { const q = P.body.position, c = { x: clamp(q.x + rand(-6, 6), -13, 13), y: .4, z: clamp(q.z + rand(-6, 6), -8, 8) }; fx.sheet({ x: c.x, y: 2.4, z: c.z }, 6, '#ffffff', 2); explode(c, 3, 55, 9); fx.cloud(c, 6, '#ffffff', 1, .6); sfx('boom', .7); });
}

const rayFrom = new CANNON.Vec3(), rayTo = new CANNON.Vec3(), rayRes = new CANNON.RaycastResult();
export function updatePlayer(dt) {
  if (!P.active) return;
  const b = P.body, ch = P.ch, v = b.velocity, pp = b.position; P.t++;
  const locked = P.lock > 0; if (locked) P.lock--;
  if (!locked) { CAM.yaw -= I.lookX; CAM.pitch = clamp(CAM.pitch + I.lookY, -.2, 1.15); }
  I.lookX = I.lookY = 0;
  if (P.ghost > 0 && --P.ghost === 0) setMask();
  // 고개: 할 일 쪽을 본다(±40도)
  let lk = 0; if (G.lookAt && !P.seated) { const t = Math.atan2(G.lookAt.x - pp.x, G.lookAt.z - pp.z); let d = t - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); lk = clamp(d, -.7, .7); }
  P.look = lerp(P.look, lk, .08);
  const done = () => { P.pj = I.jump; P.pa = I.a; P.pb = I.b; P.pc = I.c; P.pe = I.e; };
  // 앉아 있을 때: 움직이거나 때리면 일어난다. E는 할 일에만 쓴다
  if (P.seated) {
    const c = P.seated;
    if (c.dead) standUp();
    else {
      const st = seatOf(c); pp.x = st.x; pp.z = st.z; v.x = v.z = 0; P.yaw = st.yaw; P.speed = 0; P.onG = true;
      const ePress = I.e && !P.pe;
      let want = !locked && !P.auto && (Math.hypot(I.mx, I.mz) > .25 || (I.jump && !P.pj) || I.a || I.b || (I.c && G.rage >= 100));
      if (!want && !locked && G.interact && G.interact(ePress, I.e, dt)) { P.cand = null; done(); return; }
      // 집어야 할 물건이 있으면 E 한 번에 일어나서 집는다
      if (!want && !locked && ePress && G.want && !G.want.dead) want = true;
      if (!want) { P.cand = null; done(); return; }
      standUp(); P.cand = findCand();
    }
  }
  rayFrom.set(pp.x, pp.y + .35, pp.z); rayTo.set(pp.x, pp.y - .14, pp.z); rayRes.reset();
  PH.world.raycastClosest(rayFrom, rayTo, { collisionFilterMask: GR.STATIC | GR.PROP, skipBackfaces: true }, rayRes);
  const onG = P.onG = rayRes.hasHit && v.y < 2.5;
  // 정해진 곳으로 걸어가기(장면 연출)
  if (P.auto) {
    const a = P.auto, dx = a.x - pp.x, dz = a.z - pp.z, d = Math.hypot(dx, dz);
    if (d > .06) { const s = Math.min(a.spd || 1.4, d * 5); v.x = dx / d * s; v.z = dz / d * s; P.yaw = angLerp(P.yaw, Math.atan2(dx, dz), .18); }
    else { v.x = v.z = 0; if (a.face != null) P.yaw = angLerp(P.yaw, a.face, .15); if (a.face == null || Math.abs(Math.atan2(Math.sin(a.face - P.yaw), Math.cos(a.face - P.yaw))) < .04) P.auto = a.then || null; }
    const hs = Math.hypot(v.x, v.z); P.speed = lerp(P.speed, clamp(hs / 5.5, 0, 1.2), .25); if (hs > .3) P.walk += hs * dt * 2.6;
    done(); return;
  }
  let mx = locked ? 0 : I.mx, mz = locked ? 0 : I.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const a = aim(), wx = a.x * mz + Math.cos(CAM.yaw) * mx, wz = a.z * mz - Math.sin(CAM.yaw) * mx;
  const spd = ch.spd * (P.rush > 0 ? 1.7 : 1) * (P.carry ? .85 : 1) * (P.slam ? .2 : 1) * (P.atk && P.atk.k === 'b' ? .35 : 1);
  v.x = lerp(v.x, wx * spd, .3); v.z = lerp(v.z, wz * spd, .3);
  if (l > .1) P.yaw = angLerp(P.yaw, Math.atan2(wx, wz), .25);
  if (onG) {
    if (P.slam) { P.slam = false; const hits = attack({ x: pp.x, y: .4, z: pp.z }, 2.7, 30 * ch.pow, { x: 5, y: 6.5, z: 5 }, { max: 12, radial: true, heavy: true, tall: .5 }); addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 2); G.shake = .3; G.hitstop = 70; sfx('wood'); sfx('boom', .5); fx.cloud({ x: pp.x, y: .2, z: pp.z }, 6, '#b9b2a2', .9, .8); buzz(40); }
    P.jumps = 0; P.air = 0;
  } else P.air++;
  if (I.jump && !P.pj && !locked) {
    if (onG) { v.y = ch.jump; P.jumps = 1; sfx('jump'); } else if (ch.dj && P.jumps < 2) { v.y = ch.jump * .92; P.jumps = 2; sfx('jump'); fx.bitsAt({ x: pp.x, y: pp.y, z: pp.z }, 6, '#ffffff', 2, 0); }
  }
  if (P.atk) { P.atk.t += dt / P.atk.dur; if (!P.atk.hit && P.atk.t >= .45) { P.atk.hit = true; doHit(P.atk); } if (P.atk.t >= 1) P.atk = null; }
  P.cdB--;
  if (!locked && !P.atk) {
    if (P.carry) { if ((I.a && !P.pa) || (I.b && !P.pb)) throwCarry(); }
    else if (I.b && !P.pb && P.cdB <= 0) { if (!onG && P.air > 4) { P.slam = true; v.y = -17; sfx('whoosh'); } else startAtk('b'); }
    else if (I.a) startAtk('a');
  }
  if (I.c && !P.pc && G.rage >= 100 && !locked) special();
  // E: 할 일 → 내려놓기 → 집기/장착/엎기
  if (G.tick % 5 === 0) P.cand = P.carry ? null : findCand();
  const ePress = I.e && !P.pe;
  if (!locked) {
    if (G.interact && G.interact(ePress, I.e, dt)) { P.eHold = 0; }
    else if (ePress && P.carry) throwCarry(true);
    else if (P.cand && !P.cand.dead) {
      const c = P.cand;
      if (c.def.flip) { if (I.e) { P.eHold += dt; if (P.eHold >= .45) { P.eHold = 0; flipProp(c); P.cand = null; } } else P.eHold = 0; }
      else if (ePress) { if (c.def.weapon) { equip(c.type); kill(c); } else carry(c); P.cand = null; }
    } else P.eHold = 0;
  }
  if (P.carry && P.carry !== true) { const c = P.carry; if (c.dead) P.carry = null; else { const cb = c.body; cb.position.set(pp.x, pp.y + 1.95 + c.size[1] / 2, pp.z); cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0); cb.quaternion.setFromEuler(0, P.yaw, 0); } }
  if (P.rush > 0) { P.rush--; if (G.tick % 3 === 0) fx.bitsAt({ x: pp.x, y: .1, z: pp.z }, 2, '#f2b705', 1, 1); }
  if (P.storm > 0) { P.storm--; if (P.storm % 8 === 0) { fx.sheet({ x: pp.x + rand(-2, 2), y: 1.2, z: pp.z + rand(-2, 2) }, 8, '#ffffff', 5); const h = attack({ x: pp.x, y: 1, z: pp.z }, 4.6, 10, { x: 3, y: 2.5, z: 3 }, { max: 14, radial: true, tall: 1 }); addCombo(Math.min(3, h.length)); sfx('paper', .4); } }
  const hs = Math.hypot(v.x, v.z); P.speed = lerp(P.speed, clamp(hs / 5.5, 0, 1.2), .25); if (onG && hs > .4) { P.walk += hs * dt * 2.6; if (Math.sin(P.walk) * Math.sin(P.walk - hs * dt * 2.6) < 0) sfx('step', .25); }
  if (pp.y < -2) { b.position.set(0, .5, 5); v.set(0, 0, 0); }
  done();
}

// ───── 카메라
const tgt = new THREE.Vector3(), des = new THREE.Vector3(), dirv = new THREE.Vector3(), ray = new THREE.Raycaster(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), hv = new THREE.Vector3();
const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
function followPose(pos, look) {
  const pp = P.body.position, cy = Math.cos(CAM.pitch), sx = Math.cos(CAM.yaw) * .42, sz = -Math.sin(CAM.yaw) * .42;
  look.set(pp.x + sx, pp.y + (P.seated ? 1.2 : 1.5), pp.z + sz);
  dirv.set(Math.sin(CAM.yaw) * cy, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cy);
  let dist = CAM.dist; ray.set(look, dirv); ray.far = dist + .3; const hit = ray.intersectObjects(G.camBlock, false)[0]; if (hit) dist = Math.max(.9, hit.distance - .3);
  pos.copy(look).addScaledVector(dirv, dist); if (G.scene === 'office') pos.y = Math.min(pos.y, 2.86);
}
export function camTo(to, dur = .8) { CAM.from = { pos: X.camera.position.clone(), look: CAM.look.clone() }; CAM.to = to; CAM.ct = 0; CAM.dur = Math.max(.05, dur); CAM.mode = 'cut'; }
export function camHold(pos, look) { CAM.mode = 'hold'; CAM.hp = new THREE.Vector3(...pos); CAM.hl = new THREE.Vector3(...look); X.camera.position.copy(CAM.hp); CAM.look.copy(CAM.hl); X.camera.lookAt(CAM.look); }
export function camGlide(pos, look) { CAM.mode = 'glide'; CAM.hp = new THREE.Vector3(...pos); CAM.hl = new THREE.Vector3(...look); }
// 참는 얼굴을 비스듬한 앞에서 잡는다(막힌 쪽은 피한다)
export function faceCam(dur = 1.1) {
  if (!P.active || !P.R) return;
  P.R.root.updateMatrixWorld(true); P.R.head.getWorldPosition(hv);
  const f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }, r = { x: Math.cos(P.yaw), z: -Math.sin(P.yaw) };
  let best = null;
  for (const side of [1, -1]) {
    const pos = new THREE.Vector3(hv.x + f.x * .8 + r.x * side * .55, hv.y + .05, hv.z + f.z * .8 + r.z * side * .55), dir = pos.clone().sub(hv), dist = dir.length(); dir.normalize();
    ray.set(hv, dir); ray.far = dist; const hit = ray.intersectObject(X.level, true).find(h => h.object.visible && !(h.object.material && h.object.material.transparent));
    const d = hit ? hit.distance : dist; if (!best || d > best.d) best = { d, dist, dir, pos }; if (!hit) break;
  }
  const pos = best.d < best.dist ? hv.clone().addScaledVector(best.dir, Math.max(.42, best.d - .08)) : best.pos;
  camTo({ pos, look: hv.clone().add(new THREE.Vector3(0, -.03, 0)) }, dur);
}
export function renderPlayer(dt = 1 / 60) {
  if (P.active && P.R) {
    const pp = P.body.position, R = P.R;
    R.root.position.set(pp.x, pp.y, pp.z); R.root.rotation.y = P.yaw;
    P.blinkT -= dt; let ex = P.expr;
    if (P.blinkT < 0) { if (P.blinkT < -.12) P.blinkT = 2.6 + Math.random() * 2.4; else if (ex === 'normal') ex = 'blink'; else if (ex === 'endure') ex = 'endureB'; }
    if (ex !== R.shown) { R.face.material.map = faceTex(R.id, ex); R.shown = ex; }
    if (P.tremble > 0) { P.tremble--; R.face.position.x = (Math.random() - .5) * .004; } else R.face.position.x = 0;
    R.vein.visible = P.expr === 'endure' || P.expr === 'rage'; if (R.vein.visible) { const k = .08 + Math.sin(performance.now() * .012) * .012; R.vein.scale.set(k, k, 1); }
    poseRig(R, { walk: P.walk, speed: P.onG && !P.seated ? P.speed : 0, air: !P.onG && P.air > 5 && !P.seated, slam: P.slam, carry: !!P.carry && P.carry !== true, atk: P.atk, t: P.t, seated: !!P.seated, typing: !!P.seated && P.seated.tag === 'myChair' && P.expr === 'normal', clench: P.expr === 'endure', cheer: P.cheer, relief: P.expr === 'relief', look: P.look, armed: !!P.weapon });
  }
  const cam = X.camera, m = CAM.mode;
  if (m === 'follow' && P.active) { followPose(des, tgt); cam.position.lerp(des, .5); CAM.look.copy(tgt); }
  else if (m === 'orbit') { CAM.t += .004; const c = CAM.center || { x: 0, y: 1.2, z: 0 }, r = CAM.r || 9, ang = (CAM.base || 0) + Math.sin(CAM.t) * (CAM.sway || 0); cam.position.set(c.x + Math.sin(ang) * r, CAM.h || 2.5, c.z + Math.cos(ang) * r); CAM.look.set(c.x, c.y, c.z); }
  else if (m === 'hold') { cam.position.copy(CAM.hp); CAM.look.copy(CAM.hl); }
  else if (m === 'glide') { cam.position.lerp(CAM.hp, .06); CAM.look.lerp(CAM.hl, .08); }
  else if (m === 'cut') {
    CAM.ct += dt / CAM.dur; const e = ease(Math.min(1, CAM.ct)); let tp, tl;
    if (CAM.to === 'follow') { if (P.active) followPose(tA, tB); else { tA.copy(cam.position); tB.copy(CAM.look); } tp = tA; tl = tB; } else { tp = CAM.to.pos; tl = CAM.to.look; }
    cam.position.lerpVectors(CAM.from.pos, tp, e); CAM.look.lerpVectors(CAM.from.look, tl, e);
    if (CAM.ct >= 1) { if (CAM.to === 'follow') CAM.mode = 'follow'; else { CAM.mode = 'hold'; CAM.hp = tp.clone(); CAM.hl = tl.clone(); } }
  }
  cam.lookAt(CAM.look);
  if (G.shake > 0 && !G.calm) { cam.position.x += (Math.random() - .5) * G.shake; cam.position.y += (Math.random() - .5) * G.shake; cam.position.z += (Math.random() - .5) * G.shake * .6; }
}
