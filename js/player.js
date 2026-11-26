import { G, rand, pick, clamp, lerp, angLerp } from './state.js';
import { CHARS, NPCS, look } from './data/chars.js';
import { DEFS } from './data/props.js';
import { S } from './save.js';
import { THREE, X, M, bx, colorMat, textMat, pl, canvasTex, speckle, labelMat, boxGeo, sphGeo, cylGeo, FONT } from './gfx.js';
import { CANNON, PH, GR, attack, damage, spawn, shove, explode, later, slow, addCombo, kill, distTo } from './engine.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import { mount, unmount, updateRide, sprayTick, useProp, shout, TOY } from './toys.js';
import { pow, hurtFlash, hurtClear, lowHp } from './hitfx.js';

export const I ={ mx: 0, mz: 0, jump: false, a: false, b: false, c: false, e: false, lookX: 0, lookY: 0 };
export const P = { active: false };
export const CAM = { yaw: 0, pitch: .28, dist: 4.3, mode: 'follow', t: 0, look: new THREE.Vector3(0, 1, 0) };
const FIST = { n: '맨손', dmg: 10, r: .75, reach: .7, push: 3, cd: 210, snd: 'jab' };
const HIPY = .97, SEATY = .585;

// ───── 몸 모양 (도형은 한 번만 만들어 둔다)
const GEO = {};
function grp(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function limbGeo(r1, r2, h, open = false) { const k = 'L' + [r1, r2, h, open].join('|'); if (GEO[k]) return GEO[k]; const g = new THREE.CylinderGeometry(r1, r2, h, 16, 1, open, Math.PI, Math.PI * 2); g.translate(0, -h / 2, 0); return GEO[k] = g; }
// 몸통: 골반 → 허리 → 가슴 → 어깨 → 목. 텍스처는 앞 가운데가 u=0.5
const Y0 = -.13, Y1 = .56;
const PROF = [[-.13, .152], [-.04, .146], [.06, .136], [.16, .145], [.26, .159], [.36, .166], [.43, .163], [.48, .152], [.52, .124], [.545, .088], [.56, .055]];
// 여자: 어깨가 좁고 허리가 잘록하다
const PROF_F = [[-.13, .156], [-.04, .152], [.06, .128], [.16, .132], [.26, .15], [.36, .156], [.43, .15], [.48, .136], [.52, .11], [.545, .08], [.56, .05]];
function profR(y, pf) { for (let i = 1; i < pf.length; i++) if (y <= pf[i][0]) { const [y0, r0] = pf[i - 1], [y1, r1] = pf[i], t = (y - y0) / (y1 - y0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); } return .055; }
function torsoGeo(key, k, belly, fem) {
  if (GEO[key]) return GEO[key];
  const pf = fem ? PROF_F : PROF, pts = []; for (let i = 0; i <= 20; i++) { const y = Y0 + (Y1 - Y0) * i / 20; let r = profR(y, pf) * k; if (belly) r += belly * Math.max(0, 1 - Math.abs(y - .1) / .22); pts.push(new THREE.Vector2(Math.max(.01, r), y)); }
  return GEO[key] = new THREE.LatheGeometry(pts, 28, Math.PI, Math.PI * 2);
}
// 머리: 턱 쪽이 좁은 달걀형. 머리카락·얼굴 무늬도 같은 모양을 조금 크게 만들어 덮는다
const HEAD = { rx: .079, ry: .116, rz: .1 };
function deform(v) { const low = Math.max(0, -v.y); v.x *= 1 - .3 * low * low; v.z *= 1 - .1 * low; if (v.y < -.4 && v.z > 0) v.z += .06 * (-.4 - v.y); if (v.z < 0) v.z *= 1.05; }
function shell(key, mul, keep, opt = {}) {
  if (GEO[key]) return GEO[key];
  // 머리카락처럼 잘라 쓰는 껍질은 촘촘하게 나눠야 경계가 계단처럼 보이지 않는다
  const g = new THREE.SphereGeometry(1, opt.w || (keep ? 64 : 40), opt.h || (keep ? 46 : 30), opt.ps ?? 0, opt.pl ?? Math.PI * 2, opt.ts ?? 0, opt.tl ?? Math.PI);
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
// 긴 머리 뒤쪽: 뒤통수를 감싸고 내려오는 휜 장막. 양옆이 짧아 끝이 둥글다
function curtain(key, top, bot, len, half) {
  if (GEO[key]) return GEO[key];
  const g = new THREE.CylinderGeometry(top, bot, len, 22, 6, true, Math.PI - half, half * 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), side = (Math.PI - Math.abs(Math.atan2(p.getX(i), p.getZ(i)))) / half, v = (len / 2 - y) / len;
    p.setY(i, y + v * .1 * side * side);
  }
  g.translate(0, -len / 2, 0); g.computeVertexNormals();
  return GEO[key] = g;
}
// 포니테일: 묶은 곳에서 부풀었다가 끝으로 가늘어진다
function ponyGeo() {
  if (GEO.pony) return GEO.pony;
  const r = [.004, .015, .026, .033, .035, .028, .016], n = r.length - 1;
  return GEO.pony = new THREE.LatheGeometry(r.map((x, i) => new THREE.Vector2(x, -.26 * (1 - i / n))), 12);
}
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
    } else if (ch.scarf) {
      c.fillStyle = ch.skin; c.beginPath(); c.moveTo(cx - 16, 0); c.lineTo(cx + 16, 0); c.lineTo(cx, Yc(.5)); c.closePath(); c.fill();
      c.fillStyle = ch.scarf; c.beginPath(); c.ellipse(cx, Yc(.505), 15, 8, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(cx - 6, Yc(.5)); c.lineTo(cx - 20, Yc(.35)); c.lineTo(cx - 6, Yc(.37)); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + 5, Yc(.5)); c.lineTo(cx + 14, Yc(.32)); c.lineTo(cx + 2, Yc(.35)); c.closePath(); c.fill();
      c.strokeStyle = shade(ch.scarf, -.15); c.lineWidth = 2; c.beginPath(); c.moveTo(cx - 9, Yc(.505)); c.lineTo(cx + 9, Yc(.505)); c.stroke();
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
function topMat(L) { return TOPS[L.key] || (TOPS[L.key] = new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (c, w, h) => paintTop(c, w, h, L)), roughness: .82 })); }
function badgeMat(id) {
  return labelMat('badge' + id, 64, 96, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6bff'; c.fillRect(0, 0, w, 16);
    c.fillStyle = '#c9d3e6'; c.fillRect(16, 23, 32, 38); c.fillStyle = '#7b8aa6'; c.beginPath(); c.arc(32, 37, 9, 0, 7); c.fill(); c.fillRect(21, 49, 22, 12);
    c.fillStyle = '#222'; c.font = '700 11px ' + FONT; c.textAlign = 'center'; c.fillText((CHARS[id] || NPCS[id]).n, 32, 78); c.fillStyle = '#999'; c.fillRect(14, 85, 36, 3);
  }, true);
}

// ───── 얼굴: 표정마다 그린 무늬를 머리 앞에 덮는다
const FACES = {};
export function faceTex(ch, ex) {
  const key = ch.key + ':' + ex; if (FACES[key]) return FACES[key];
  const fem = ch.gender === 'f', brow = ch.hair === 'bald' ? shade(ch.hairCol, -.18) : ch.hairCol;
  return FACES[key] = canvasTex(256, 256, c => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const L = 74, R = 182, EY = 104, BY = 76, MY = 166, ink = '#22160f', lip = fem ? '#b5525c' : '#a5554a';
    c.fillStyle = fem ? 'rgba(232,118,118,.22)' : 'rgba(225,120,105,.15)'; for (const x of [58, 198]) { c.beginPath(); c.ellipse(x, 137, 20, 11, 0, 0, 7); c.fill(); }
    const brows = (inner, outer, arch, w) => { c.strokeStyle = brow; c.lineWidth = fem ? w * .7 : w; if (fem) arch += 3; for (const x of [L, R]) { const d = x < 128 ? 1 : -1; c.beginPath(); c.moveTo(x - d * 19, BY + outer); c.quadraticCurveTo(x, BY + (inner + outer) / 2 - arch, x + d * 19, BY + inner); c.stroke(); } };
    const lashes = () => { if (!fem) return; c.strokeStyle = ink; c.lineWidth = 2.6; for (const x of [L, R]) { const o = x < 128 ? -1 : 1; c.beginPath(); c.moveTo(x + o * 15, EY - 3); c.lineTo(x + o * 21, EY - 8); c.moveTo(x + o * 11, EY - 6); c.lineTo(x + o * 15, EY - 11); c.stroke(); } };
    const eyes = (ry, iris, pupil, hl, lid) => {
      for (const x of [L, R]) {
        c.fillStyle = '#fbf8f3'; c.beginPath(); c.ellipse(x, EY, 16, ry, 0, 0, 7); c.fill();
        c.save(); c.beginPath(); c.ellipse(x, EY, 16, ry, 0, 0, 7); c.clip();
        c.fillStyle = '#4a3326'; c.beginPath(); c.arc(x, EY + 1, iris, 0, 7); c.fill();
        c.fillStyle = '#120c08'; c.beginPath(); c.arc(x, EY + 1, pupil, 0, 7); c.fill();
        if (hl) { c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(x - 3, EY - 2.5, 2.3, 0, 7); c.fill(); }
        if (lid) { c.fillStyle = ch.skin; c.fillRect(x - 18, EY - ry - 2, 36, lid + 2); }
        c.restore();
        c.strokeStyle = ink; c.lineWidth = fem ? 4.2 : 3.2; c.beginPath(); c.ellipse(x, EY + (lid ? lid * .6 : 0), 16.5, Math.max(2, ry + .4 - (lid ? lid * .6 : 0)), 0, Math.PI * 1.06, Math.PI * 1.94); c.stroke();
        c.strokeStyle = 'rgba(40,25,18,.35)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, EY, 15, ry, 0, Math.PI * .2, Math.PI * .8); c.stroke();
      }
    };
    const closed = dy => { c.strokeStyle = ink; c.lineWidth = 3.4; for (const x of [L, R]) { c.beginPath(); c.moveTo(x - 15, EY); c.quadraticCurveTo(x, EY + dy, x + 15, EY); c.stroke(); } };
    if (ex === 'normal' || ex === 'blink') {
      brows(0, 2, 3, 6.5); if (ex === 'blink') closed(4); else { eyes(fem ? 9.5 : 8.5, 8, 3.8, true, 0); lashes(); }
      if (fem) { c.fillStyle = lip; c.beginPath(); c.ellipse(128, MY + 1, 19, 5.5, 0, 0, 7); c.fill(); c.strokeStyle = shade(lip, -.18); c.lineWidth = 2; c.beginPath(); c.moveTo(110, MY + 1); c.quadraticCurveTo(128, MY + 3, 146, MY + 1); c.stroke(); }
      else { c.strokeStyle = lip; c.lineWidth = 3.6; c.beginPath(); c.moveTo(128 - 25, MY); c.quadraticCurveTo(128, MY + 3, 128 + 25, MY); c.stroke(); }
    } else if (ex === 'endure' || ex === 'endureB') {
      brows(10, -5, -2, 7.5); if (ex === 'endureB') closed(2); else { eyes(7, 7, 3.4, true, 3); lashes(); }
      c.strokeStyle = lip; c.lineWidth = 4; c.beginPath(); c.moveTo(102, MY + 1); for (let k = 1; k <= 7; k++) c.lineTo(102 + k * 7.5, MY + (k % 2 ? -3 : 3)); c.stroke();
      c.strokeStyle = 'rgba(120,60,50,.35)'; c.lineWidth = 2; for (const x of [L, R]) { const d = x < 128 ? 1 : -1; c.beginPath(); c.moveTo(x + d * 22, BY + 2); c.lineTo(x + d * 24, BY - 8); c.stroke(); }
    } else if (ex === 'rage') {
      brows(14, -9, -3, 8.5); eyes(11, 5.5, 2.6, false, 0); lashes();
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

export function buildRig(id, acc, g) {
  const ch = look(id, g), F = ch.gender === 'f', root = new THREE.Group(), R = { root, id, L: ch };
  const skin = colorMat(ch.skin, .58), pants = colorMat(ch.pants, .85), shoe = colorMat(ch.shoes, .35), sole = colorMat('#1a1a1a', .9), shirt = colorMat(ch.shirt, .75);
  const hairM = new THREE.MeshStandardMaterial({ color: ch.hairCol, roughness: .55, side: THREE.DoubleSide }), sleeve = colorMat(ch.suit, .82);
  const jacket = ch.top === 'suit' || ch.top === 'blazer', legM = ch.skirt ? colorMat(ch.legs, .5) : pants;
  // 몸 치수: 여자는 다리가 조금 짧고 어깨가 좁다
  const thL = F ? .31 : .32, shL = F ? .305 : .315, hipX = F ? .082 : .088, shX = F ? .166 : .186, ua = F ? [.039, .034, .27] : [.045, .039, .285], fa = F ? [.035, .029, .235] : [.04, .034, .245];
  // 다리
  const hips = R.hips = grp(root, 0, R.hipY = F ? .735 : .755, 0);
  if (!ch.skirt) { mesh(hips, limbGeo(F ? .132 : .138, F ? .128 : .13, .17), pants, 0, -.035, 0).scale.z = .8; mesh(hips, sphGeo(.07, 14), pants, 0, -.17, 0).scale.set(1.2, .8, .9); }
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R', hip = grp(hips, s * hipX, -.07, 0), knee = grp(hip, 0, -thL, 0), ank = grp(knee, 0, -shL, 0);
    mesh(hip, limbGeo(F ? .074 : .078, F ? .052 : .057, thL), legM); mesh(hip, sphGeo(F ? .073 : .077, 14), legM).scale.set(1, .7, 1);
    mesh(knee, sphGeo(F ? .05 : .056, 12), legM); mesh(knee, limbGeo(F ? .05 : .056, F ? .035 : .042, shL), legM);
    if (ch.heels) { mesh(ank, boxGeo(.078, .014, .22, .005), sole, 0, -.038, .055); mesh(ank, boxGeo(.076, .05, .2, .024), shoe, 0, -.012, .055); mesh(ank, boxGeo(.032, .046, .034, .005), shoe, 0, -.034, -.045); }
    else { mesh(ank, boxGeo(F ? .086 : .096, .024, F ? .25 : .27, .008), sole, 0, -.048, .045); mesh(ank, boxGeo(F ? .082 : .092, .062, F ? .22 : .24, .03), shoe, 0, -.012, .04); }
    hip.scale.set(1.16, 1, 1.16); R['hip' + k] = hip; R['knee' + k] = knee; R['ank' + k] = ank;
  }
  if (ch.skirt) { const sg = new THREE.CylinderGeometry(.138, .2, .4, 24, 1, true, Math.PI, Math.PI * 2); sg.translate(0, -.2, 0); const sk = R.skirt = mesh(hips, sg, new THREE.MeshStandardMaterial({ color: ch.pants, roughness: .82, side: THREE.DoubleSide }), 0, -.07, 0); sk.scale.z = .8; }
  // 몸통
  const sp = R.spine = grp(hips, 0, 0, 0);
  mesh(sp, torsoGeo('t' + ch.top + (ch.belly ? 'b' : '') + (F ? 'f' : ''), ch.top === 'aloha' ? .98 : 1, ch.belly ? .032 : 0, F), topMat(ch)).scale.z = .74;
  for (const s of [-1, 1]) mesh(sp, sphGeo(F ? .046 : .052, 14), sleeve, s * (F ? .155 : .176), .452, 0).scale.set(1.12, .8, 1.02);
  mesh(sp, limbGeo(F ? .04 : .046, F ? .044 : .05, .13), skin, 0, .7, .002);
  if (jacket) { mesh(sp, limbGeo(F ? .052 : .058, F ? .057 : .064, .05, true), shirt, 0, .6, .004).scale.z = .92; if (ch.tie) mesh(sp, boxGeo(.034, .036, .02, .006), colorMat(ch.tie, .6), 0, .548, .058); }
  if (ch.top === 'hoodie') mesh(sp, sphGeo(.1, 16), sleeve, 0, .53, -.075).scale.set(F ? 1.2 : 1.35, .62, .75);
  if (ch.badge) {
    const lm = colorMat('#2f6bff', .7), V = (x, y, z) => new THREE.Vector3(x, y, z), bz = F ? .122 : .133;
    for (const s of [-1, 1]) { stick(sp, V(s * .046, .55, .066), V(s * .024, .43, bz - .004), .0045, lm); stick(sp, V(s * .024, .43, bz - .004), V(0, .32, bz), .0045, lm); }
    const b = R.badge = grp(sp, 0, .32, bz); mesh(b, boxGeo(.056, .082, .004, .004), M('white'), 0, -.047, 0); pl(b, .052, .078, badgeMat(id), 0, -.047, .0025);
  }
  // 팔과 손
  for (const s of [-1, 1]) {
    const k = s < 0 ? 'L' : 'R', sh = grp(sp, s * shX, .45, 0), el = grp(sh, 0, -ua[2], 0), hd = grp(el, 0, -(fa[2] + .01), 0);
    if (ch.top === 'aloha') { mesh(sh, limbGeo(ua[0] + .006, ua[1] + .01, .15), sleeve); mesh(sh, limbGeo(ua[0] - .005, ua[1] - .003, ua[2]), skin); mesh(el, sphGeo(fa[0] - .004, 12), skin); mesh(el, limbGeo(fa[0] - .004, fa[1] - .003, fa[2]), skin); }
    else { mesh(sh, limbGeo(ua[0], ua[1], ua[2]), sleeve); mesh(el, sphGeo(fa[0], 12), sleeve); mesh(el, limbGeo(fa[0], fa[1], fa[2]), sleeve); if (jacket) mesh(el, limbGeo(fa[1] + .001, fa[1] + .001, .025), shirt, 0, -fa[2] + .017, 0); }
    hd.scale.setScalar(F ? 1.3 : 1.45);
    mesh(hd, boxGeo(.03, .085, .074, .013), skin, 0, -.045, .004);
    const fg = grp(hd, 0, -.086, .002); mesh(fg, boxGeo(.026, .07, .07, .012), skin, 0, -.032, 0);
    const th = grp(hd, -s * .006, -.032, .036); mesh(th, boxGeo(.022, .052, .022, .009), skin, 0, -.02, 0); th.rotation.set(-.35, 0, s * .25);
    R['sh' + k] = sh; R['el' + k] = el; R['hand' + k] = hd; R['fing' + k] = fg;
  }
  // 머리
  const head = R.head = grp(sp, 0, .72, .008); { const S = F ? 1.66 : 1.72; sp.scale.set(1.12, 1, 1.14); head.scale.set(S / 1.12, S, S / 1.14); head.position.y = .795; }
  mesh(head, shell('head', 1), skin);
  R.face = new THREE.Mesh(shell('face', 1.01, null, { ps: FRONT - .95, pl: 1.9, ts: .72, tl: 2.0, w: 22, h: 20 }), new THREE.MeshStandardMaterial({ map: faceTex(ch, 'normal'), transparent: true, roughness: .6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  head.add(R.face);
  for (const s of [-1, 1]) mesh(head, sphGeo(.026, 10), skin, s * .078, -.008, -.006).scale.set(.42, 1, .78);
  mesh(head, boxGeo(F ? .017 : .019, F ? .032 : .036, F ? .019 : .022, .008), skin, 0, -.017, .097).rotation.x = -.3;
  const st = ch.hair;
  const pony = () => { const pt = R.pony = grp(head, 0, .03, -.11); mesh(pt, sphGeo(.026, 10), hairM); mesh(pt, ponyGeo(), hairM, 0, -.008, -.004).scale.z = .85; const tie = new THREE.Mesh(new THREE.TorusGeometry(.021, .006, 6, 14), colorMat('#c9281f', .5)); tie.rotation.x = Math.PI / 2; tie.position.y = -.012; pt.add(tie); pt.rotation.x = .5; };
  const cap = () => { const cm = colorMat(ch.capCol || ch.suit, .6); mesh(head, shell('h_cap', 1.115, ([t]) => t < 1.33), cm); mesh(head, boxGeo(.15, .012, .1, .005), cm, 0, .052, .104).rotation.x = .18; mesh(head, sphGeo(.012, 8), cm, 0, .128, 0); };
  if (st === 'short') { mesh(head, shell('h_short', 1.1, hairline(1.06, 1.5, 2.22)), hairM); for (const [x, y, z, r] of [[-.05, .085, .07, .05], [.01, .095, .08, .055], [.06, .082, .065, .048], [0, .11, .02, .07]]) mesh(head, sphGeo(r, 12), hairM, x, y, z).scale.set(1.15, .7, 1); }
  else if (st === 'slick') mesh(head, shell('h_slick', 1.065, hairline(.9, 1.4, 2.15)), hairM);
  else if (st === 'mop') mesh(head, shell('h_mop', 1.12, hairline(1.22, 1.62, 2.28)), hairM);
  else if (st === 'bob') mesh(head, shell('h_bob', 1.1, hairline(1.2, 2.3, 2.42), { post: (v, t) => { if (t > 1.65) { const k = 1 + (t - 1.65) * .2; v.x *= k; v.z *= k; } } }), hairM);
  else if (st === 'long') { mesh(head, shell('h_long', 1.09, hairline(1.08, 2.3, 2.55), { post: (v, t) => { if (t > 1.6) { const k = 1 + (t - 1.6) * .22; v.x *= k; v.z *= k; } } }), hairM); mesh(head, curtain('h_curt', .098, .128, .3, 1.5), hairM, 0, -.045, -.008).scale.z = 1.18; }
  else if (st === 'pony') { mesh(head, shell('h_pony', 1.07, hairline(1.04, 1.5, 2.1)), hairM); pony(); }
  else if (st === 'perm') mesh(head, shell('h_perm', 1.15, hairline(1.12, 2.0, 2.3), { post: (v, t, p) => { const k = (1 + .06 * Math.sin(t * 17) * Math.sin(p * 15)) * (t > 1.6 ? 1 + (t - 1.6) * .3 : 1); v.x *= k; v.y *= 1 + .05 * Math.sin(t * 17) * Math.sin(p * 15); v.z *= k; } }), hairM);
  else if (st === 'bald') mesh(head, shell('h_bald', 1.045, ([t, p]) => t > 1.36 && t < 2.08 && dPhi(p) > 1.15), hairM);
  else if (st === 'cap') { mesh(head, shell('h_capb', 1.07, ([t, p]) => t > 1.25 && t < 2.1 && dPhi(p) > 1.25), hairM); cap(); }
  else if (st === 'capPony') { mesh(head, shell('h_capb', 1.07, ([t, p]) => t > 1.25 && t < 2.1 && dPhi(p) > 1.25), hairM); cap(); pony(); }
  const gm = M('plasticDark');
  if (ch.glasses && acc !== 'sun') { for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.021, .0035, 6, 16), gm); t.position.set(s * .031, .004, .1); head.add(t); bx(head, .004, .004, .08, gm, s * .056, .008, .062); } bx(head, .02, .004, .004, gm, 0, .008, .104); }
  if (ch.sun || acc === 'sun') { bx(head, .135, .034, .014, 'glassDark', 0, .004, .099, .008); for (const s of [-1, 1]) bx(head, .004, .004, .08, gm, s * .064, .008, .062); }
  if (acc === 'band') { const b = mesh(head, new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#c9281f', roughness: .6, side: THREE.DoubleSide }), 0, .052, 0); b.scale.set(.087, .028, .109); pl(head, .07, .024, textMat('투쟁', { w: 128, h: 44, size: 32, bg: '#c9281f', fg: '#ffffff' }), 0, .052, .111); }
  if (acc === 'helmet') { const ym = colorMat('#f2c21a', .35); mesh(head, new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ym, 0, .03, 0).scale.set(.1, .11, .122); mesh(head, cylGeo(.13, .13, .012, 20), ym, 0, .03, .015).scale.z = 1.12; }
  if (acc === 'chain') { const t = new THREE.Mesh(new THREE.TorusGeometry(.07, .009, 6, 20), M('gold')); t.position.set(0, .5, .07); t.rotation.x = 1.25; sp.add(t); }
  R.vein = veinSprite(); R.vein.position.set(.07, .078, .06); head.add(R.vein);
  const bw = ch.build * (F ? .96 : 1); root.scale.set(bw, 1, bw);
  return R;
}

export function poseRig(R, st) {
  const ph = st.walk || 0, sp = Math.min(1.2, st.speed || 0), s = Math.sin(ph), t = st.t || 0, run = clamp((sp - .6) / .45, 0, 1), idle = 1 - Math.min(1, sp * 2);
  const sw = (.5 + .22 * run) * sp;
  R.hipL.rotation.set(-s * sw, 0, 0); R.hipR.rotation.set(s * sw, 0, 0);
  R.kneeL.rotation.set(.04 + Math.max(0, Math.sin(ph + 1.3)) * (.8 + .6 * run) * sp, 0, 0); R.kneeR.rotation.set(.04 + Math.max(0, Math.sin(ph + 1.3 + Math.PI)) * (.8 + .6 * run) * sp, 0, 0);
  R.hips.position.set(Math.sin(ph) * .016 * sp + Math.sin(t * .013) * .008 * idle, (R.hipY || HIPY) - Math.abs(Math.cos(ph)) * .03 * sp - .02 * run, 0);
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
  // 서 있는 자세들: 웅크리기·구르기·비틀·쓰러짐·들려서 버둥·모으기
  const gt = G.tick;
  if (st.cower) {
    R.hips.position.y -= .3; R.hipL.rotation.set(-1.2, 0, .1); R.hipR.rotation.set(-1.2, 0, -.1); R.kneeL.rotation.x = R.kneeR.rotation.x = 1.9;
    R.spine.rotation.set(.75, 0, Math.sin(gt * .9) * .025); R.shL.rotation.set(-2.5, 0, .55); R.shR.rotation.set(-2.5, 0, -.55); R.elL.rotation.x = R.elR.rotation.x = -1.9; R.head.rotation.x = .45; fL = fR = 1.5;
  }
  if (st.roll) {
    R.hips.position.y -= .3; R.hipL.rotation.set(-2.0, 0, 0); R.hipR.rotation.set(-2.0, 0, 0); R.kneeL.rotation.x = R.kneeR.rotation.x = 2.3;
    R.spine.rotation.set(1.0, 0, 0); R.head.rotation.x = .6; R.shL.rotation.set(-1.2, 0, .25); R.shR.rotation.set(-1.2, 0, -.25); R.elL.rotation.x = R.elR.rotation.x = -1.6; fL = fR = 1.6;
  }
  if (st.stag) {
    const s = st.stag; R.spine.rotation.x = -.35 * s; R.spine.rotation.z = Math.sin(gt * .7) * .05 * s; R.head.rotation.x = -.35 * s;
    R.shL.rotation.set(-.5 * s, 0, .95 * s); R.shR.rotation.set(-.5 * s, 0, -.95 * s); R.elL.rotation.x = R.elR.rotation.x = -.6 * s; R.kneeL.rotation.x += .3 * s; R.kneeR.rotation.x += .3 * s; fL = fR = .3;
  }
  if (st.ko) {
    const k = st.ko; R.shL.rotation.set(-.3 * k, 0, 1.3 * k); R.shR.rotation.set(-.3 * k, 0, -1.3 * k); R.elL.rotation.x = R.elR.rotation.x = -.3 * k;
    R.hipL.rotation.set(-.1 * k, 0, .18 * k); R.hipR.rotation.set(.05 * k, 0, -.18 * k); R.kneeL.rotation.x = .35 * k; R.kneeR.rotation.x = .1 * k; R.spine.rotation.set(0, 0, 0); R.head.rotation.set(-.2 * k, .5 * k, 0); fL = fR = .3;
  }
  if (st.held) {
    const w = Math.sin(gt * .45); R.hipL.rotation.x = -.6 + w * .5; R.hipR.rotation.x = -.6 - w * .5; R.kneeL.rotation.x = .9 + w * .3; R.kneeR.rotation.x = .9 - w * .3;
    R.shL.rotation.set(-1.4 + w * .6, 0, 1.0); R.shR.rotation.set(-1.4 - w * .6, 0, -1.0); R.elL.rotation.x = R.elR.rotation.x = -.5; R.head.rotation.x = -.3; fL = fR = .3;
  }
  if (st.chg) {
    const c = st.chg, sh = c >= 1 ? Math.sin(gt * 1.7) * .02 : 0; R.hips.position.y -= .06 * c; R.hipL.rotation.x -= .2 * c; R.hipR.rotation.x -= .2 * c; R.kneeL.rotation.x += .35 * c; R.kneeR.rotation.x += .35 * c;
    R.spine.rotation.set(.22 * c + sh, .35 * c, sh); R.shR.rotation.set(.75 * c, 0, -.35 * c); R.elR.rotation.x = -1.5 * c; R.shL.rotation.set(-1.25 * c, 0, .3 * c); R.elL.rotation.x = -1.6 * c; fL = fR = 1.6;
  }
  if (st.guard) { R.shL.rotation.set(-1.55, 0, .45); R.elL.rotation.x = -1.35; fL = 1.6; }
  R.ankL.rotation.x = -(R.hipL.rotation.x + R.kneeL.rotation.x) * .7; R.ankR.rotation.x = -(R.hipR.rotation.x + R.kneeR.rotation.x) * .7;
  if (st.seated) R.ankL.rotation.x = R.ankR.rotation.x = 0;
  if (st.air) { R.hipL.rotation.x = -.6; R.hipR.rotation.x = -.15; R.kneeL.rotation.x = 1.0; R.kneeR.rotation.x = .55; R.shL.rotation.z = .55; R.shR.rotation.z = -.55; }
  if (st.slam) { R.spine.rotation.x = .45; R.shL.rotation.set(-2.7, 0, .2); R.shR.rotation.set(-2.7, 0, -.2); fL = fR = 1.6; }
  if (st.carry) { R.shL.rotation.set(-2.95, 0, .28); R.shR.rotation.set(-2.95, 0, -.28); R.elL.rotation.x = -.15; R.elR.rotation.x = -.15; fL = fR = 1.2; }
  if (st.push) { R.shL.rotation.set(-1.25, 0, .12); R.shR.rotation.set(-1.25, 0, -.12); R.elL.rotation.x = -.4; R.elR.rotation.x = -.4; R.spine.rotation.x = .22; fL = fR = 1.3; }
  if (st.cheer) { const b = Math.sin(t * .25); R.shL.rotation.set(-2.85 + b * .08, 0, .5); R.shR.rotation.set(-2.85 - b * .08, 0, -.5); R.elL.rotation.x = -.25; R.elR.rotation.x = -.25; fL = fR = 1.6; R.head.rotation.x = -.18; }
  if (st.relief && !st.seated && !st.cheer) { R.spine.rotation.x = -.1; R.head.rotation.x = -.22; R.shL.rotation.set(.1, 0, .16); R.shR.rotation.set(.1, 0, -.16); R.elL.rotation.x = -.1; R.elR.rotation.x = -.1; }
  const a = st.atk;
  if (a) {
    const k = a.t, up = k < .35 ? k / .35 : 1, hit = k < .35 ? 0 : Math.min(1, (k - .35) / .22), back = k > .7 ? (k - .7) / .3 : 0, e = 1 - back, q = up * e, ty = a.type;
    if (ty === 'kick') {
      R.hipR.rotation.x = -1.75 * (k < .35 ? up * .5 : hit) * e; R.kneeR.rotation.x = (k < .35 ? 1.3 * up : 1.3 * (1 - hit)) * e; R.ankR.rotation.x = .3 * q; R.spine.rotation.x = -.28 * q; R.shL.rotation.x = -.6 * q; R.shR.rotation.x = .5 * q;
    } else if (ty === 'flurry') {
      // 다다다: 양손이 번갈아 앞으로
      const w = Math.sin(k * 30), s = Math.min(1, k * 6) * e;
      R.shR.rotation.set(-1.5 * s, 0, -.15); R.elR.rotation.x = -1.5 * s * (1 - Math.max(0, w)); R.shL.rotation.set(-1.5 * s, 0, .15); R.elL.rotation.x = -1.5 * s * (1 - Math.max(0, -w));
      R.spine.rotation.y = .3 * w * s; R.spine.rotation.x = .12 * s; fL = fR = 1.6;
    } else if (ty === 'upper') {
      const c = up * (1 - hit); R.hips.position.y -= .12 * c; R.kneeL.rotation.x += .5 * c; R.kneeR.rotation.x += .5 * c; R.hipL.rotation.x -= .3 * c; R.hipR.rotation.x -= .3 * c;
      R.shR.rotation.set(lerp(.35 * up, -2.85, hit) * e, 0, -.15); R.elR.rotation.x = (-2.0 * c - .5 * hit) * e; R.spine.rotation.x = lerp(.25 * up, -.3, hit) * e; R.spine.rotation.y = lerp(.3 * up, -.25, hit) * e; R.head.rotation.x = -.25 * hit * e; R.shL.rotation.set(-.8 * q, 0, .3); R.elL.rotation.x = -1.4 * q; fL = fR = 1.6;
    } else if (ty === 'slide') {
      const s = Math.min(1, k * 5) * e;
      R.hips.position.y -= .42 * s; R.hipR.rotation.set(-1.45 * s, 0, 0); R.kneeR.rotation.x = .05; R.hipL.rotation.set(-.55 * s, 0, 0); R.kneeL.rotation.x = 1.5 * s; R.ankR.rotation.x = .3 * s;
      R.spine.rotation.set(-.85 * s, 0, 0); R.shL.rotation.set(.7 * s, 0, .5 * s); R.shR.rotation.set(.7 * s, 0, -.5 * s); R.elL.rotation.x = R.elR.rotation.x = -.3 * s; R.head.rotation.x = .35 * s;
    } else if (ty === 'file' || ty === 'throw') {
      // 어깨 뒤로 젖혔다가 던진다
      R.shR.rotation.set(lerp(1.0 * up, -1.7, hit) * e, 0, -.2 - .2 * up * (1 - hit)); R.elR.rotation.x = lerp(-1.7 * up, -.15, hit) * e;
      R.spine.rotation.y = lerp(.45 * up, -.4, hit) * e; R.spine.rotation.x = lerp(-.12 * up, .22, hit) * e; R.shL.rotation.set(-.9 * q, 0, .3); fR = hit > .3 ? .3 : 1.4;
    } else if (ty === 'round') {
      R.hipR.rotation.set(-.5 * q, 0, -1.35 * q); R.kneeR.rotation.x = 1.3 * up * (1 - hit) + .1; R.spine.rotation.z = .45 * q; R.spine.rotation.x = -.1 * q; R.shL.rotation.set(-.4 * q, 0, .9 * q); R.shR.rotation.set(.2 * q, 0, -.7 * q);
    } else if (ty === 'headbutt') {
      R.spine.rotation.x = lerp(-.35 * up, .75, hit) * e; R.head.rotation.x = lerp(-.3 * up, .45, hit) * e; R.shL.rotation.set(.5 * q, 0, .35 * q); R.shR.rotation.set(.5 * q, 0, -.35 * q); fL = fR = 1.5;
    } else if (ty === 'belly') {
      R.spine.rotation.x = lerp(-.4 * up, -.18, hit) * e; R.hips.position.z = lerp(-.1 * up, .16, hit) * e; R.head.rotation.x = -.2 * q;
      R.shL.rotation.set(lerp(.3, 1.0, hit) * q, 0, .6 * q); R.shR.rotation.set(lerp(.3, 1.0, hit) * q, 0, -.6 * q);
    } else if (ty === 'chop') {
      R.shR.rotation.set(lerp(-2.9 * up, -.7, hit) * e, 0, -.25 * q); R.elR.rotation.x = -.15 * q; R.spine.rotation.x = lerp(-.15 * up, .38, hit) * e; R.spine.rotation.y = lerp(.3 * up, -.2, hit) * e; fR = .2;
    } else if (ty === 'golf') {
      // 두 손을 모아 오른쪽 뒤로 젖혔다가 왼쪽 위로 휘두른다
      const sw = lerp(up, -1, hit);
      R.spine.rotation.y = .95 * sw * e; R.spine.rotation.x = .3 * e;
      R.shL.rotation.set((-1.0 - .9 * Math.abs(sw)) * e, 0, (.2 - .6 * sw) * e); R.shR.rotation.set((-1.0 - .9 * Math.abs(sw)) * e, 0, (-.2 - .6 * sw) * e);
      R.elL.rotation.x = R.elR.rotation.x = -.25 * e; fL = fR = 1.7;
    } else if (ty === 'spinkick') {
      R.hipR.rotation.set(.9 * q, 0, -.9 * q); R.kneeR.rotation.x = .2; R.spine.rotation.x = .35 * q; R.spine.rotation.z = .3 * q; R.shL.rotation.set(-.6 * q, 0, .8 * q); R.shR.rotation.set(.3 * q, 0, -.8 * q);
    } else if (ty === 'dropkick') {
      const s = Math.min(1, k * 4) * e;
      R.hipL.rotation.x = R.hipR.rotation.x = -1.5 * s; R.kneeL.rotation.x = R.kneeR.rotation.x = .1 + .9 * up * (1 - hit) * s; R.spine.rotation.x = -.7 * s;
      R.shL.rotation.set(.4 * s, 0, 1.0 * s); R.shR.rotation.set(.4 * s, 0, -1.0 * s); R.head.rotation.x = .3 * s;
    } else if (ty === 'spin') {
      R.shL.rotation.set(-.3, 0, 1.45 * e); R.shR.rotation.set(st.armed ? -1.45 * e : -.3, 0, st.armed ? -.6 : -1.45 * e); R.elL.rotation.x = R.elR.rotation.x = -.15; R.spine.rotation.x = .1; R.hips.position.y -= .05; fL = fR = 1.6;
    } else if (ty === 'dash') {
      // 왼쪽 어깨를 앞세워 들이받는다
      const s = Math.min(1, k * 6) * e; R.spine.rotation.x = .1 + .4 * s; R.spine.rotation.y = .55 * s;
      R.shL.rotation.set(-.5 * s, 0, .15); R.elL.rotation.x = -1.7 * s; R.shR.rotation.set(.6 * s, 0, -.3); R.elR.rotation.x = -.8 * s; R.head.rotation.x = .15 * s; fL = fR = 1.6;
    } else if (ty === 'dive') {
      R.hipR.rotation.x = -1.25; R.kneeR.rotation.x = .1; R.hipL.rotation.x = -.2; R.kneeL.rotation.x = 1.6; R.ankR.rotation.x = .4; R.spine.rotation.x = -.35;
      R.shL.rotation.set(.6, 0, 1.0); R.shR.rotation.set(.6, 0, -1.0); R.elL.rotation.x = R.elR.rotation.x = -.4;
    } else if (ty === 'punch') {
      // 적: 크게 뒤로 뺐다가 곧게 뻗는 주먹
      R.shR.rotation.set(lerp(.6 * up, -1.55, hit) * e, 0, -.1); R.elR.rotation.x = lerp(-1.7 * up, -.05, hit) * e; R.spine.rotation.y = lerp(.5 * up, -.35, hit) * e; R.spine.rotation.x = lerp(-.05, .2, hit) * e;
      R.shL.rotation.set(-1.1 * q, 0, .2); R.elL.rotation.x = -1.6 * q; fL = fR = 1.6;
    } else if (ty === 'bomb') {
      R.shL.rotation.set(lerp(-2.8 * up, -1.2, hit) * e, 0, lerp(.2, 1.5, hit) * q); R.shR.rotation.set(lerp(-2.8 * up, -1.2, hit) * e, 0, -lerp(.2, 1.5, hit) * q); R.spine.rotation.x = lerp(-.25 * up, .15, hit) * e; fL = fR = .4;
    } else if (ty === 'roar') {
      const sh = Math.sin(gt * 1.9) * .06; R.shL.rotation.set(.35 + sh, 0, 1.1 * q); R.shR.rotation.set(.35 - sh, 0, -1.1 * q); R.elL.rotation.x = R.elR.rotation.x = -1.3 * q; R.spine.rotation.x = -.3 * q; R.head.rotation.x = -.4 * q; fL = fR = 1.6;
    } else {
      // swing(때리기 1·2타, 무기) · smash(무기 강타) · stampk(두 손 내려찍는 결재 도장)
      const two = ty === 'smash' || ty === 'stampk', ang = lerp(lerp(0, -2.75, up), two ? -.25 : -.75, hit) * e, side = a.alt ? -1 : 1;
      R.shR.rotation.set(ang, 0, -.1 - (a.alt ? .5 * up * (1 - hit) : 0)); R.elR.rotation.x = -.35 * (1 - hit); fR = 1.6;
      if (two) { R.shL.rotation.set(ang, 0, .35); R.elL.rotation.x = -.5 * (1 - hit); fL = 1.6; }
      R.spine.rotation.y = side * lerp(-.45 * up, .45, hit) * e; R.spine.rotation.x = lerp(-.12 * up, .3, hit) * e;
    }
  }
  if (st.armed) fR = 1.7;
  R.fingL.rotation.z = fL; R.fingR.rotation.z = -fR;
  if (R.badge) { R.badge.rotation.x = .06 + Math.sin(ph * 2) * .16 * sp + (a ? .2 : 0); R.badge.rotation.z = Math.sin(ph) * .08 * sp; }
  // 치마: 앉으면 허벅지를 덮고, 걸을 때는 앞으로 나가는 다리를 따라 살짝 뜬다
  if (R.skirt) { if (st.seated) { R.skirt.rotation.x = -1.2; R.skirt.scale.y = .62; } else { R.skirt.rotation.x = Math.min(0, Math.min(R.hipL.rotation.x, R.hipR.rotation.x)) * .4; R.skirt.scale.y = 1; } }
  if (R.pony) { R.pony.rotation.x = .5 + Math.sin(ph * 2) * .12 * sp + (st.air ? -.35 : 0) + (st.seated ? .1 : 0); R.pony.rotation.z = Math.sin(ph) * .16 * sp; }
}

// ───── 생성·자리
const rigs = {};
function setMask() { if (P.body) P.body.collisionFilterMask = (P.seated || P.ghost > 0 || P.ride) ? (GR.STATIC | GR.PWALL) : (GR.STATIC | GR.PROP | GR.PWALL); }
export function spawnPlayer(id, x, z, yaw = 0) {
  const g = (S.gender && S.gender[id]) || CHARS[id].g || 'm', key = id + '|' + (S.acc || '') + '|' + g;
  const R = rigs[key] || (rigs[key] = buildRig(id, S.acc, g));
  if (P.wmesh && P.R) P.R.handR.remove(P.wmesh);
  if (P.R && P.R !== R) X.scene.remove(P.R.root);
  X.scene.add(R.root); R.shown = null;
  const body = new CANNON.Body({ mass: 70, material: PH.matP, fixedRotation: true, allowSleep: false, collisionFilterGroup: GR.PLAYER, collisionFilterMask: GR.STATIC | GR.PROP | GR.PWALL });
  body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .3, 0)); body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .9, 0));
  body.position.set(x, .02, z); body.isPlayer = true; body.updateMassProperties(); PH.world.addBody(body);
  Object.assign(P, { id, ch: CHARS[id], R, body, yaw, walk: 0, speed: 0, atk: null, cdB: 0, n3: 0, air: 0, jumps: 0, slam: false, rush: 0, storm: 0, carry: null, weapon: null, wdef: null, wdur: 0, wmesh: null, lock: 0, pj: false, pb: false, pc: false, pe: false, pa: false, eHold: 0, active: true, t: 0, onG: true, cand: null, seated: null, ghost: 0, auto: null, cheer: false, expr: 'normal', blinkT: 2.5, tremble: 0, look: 0, ride: null, fuel: 0, spraying: false, flyT: 0, flew: false,
    // 결전용 체력과 새 동작들의 상태
    hp: 100, maxHp: 100, ko: false, koT: 0, koK: 0, koSent: false, inv: 0, blink: 0, stag: 0, lag: 0, hurtF: 0, roll: 0, rollMax: 24, rollCd: 0, rdx: 0, rdz: 0, rollBack: false,
    bPend: false, bHold: 0, chgFull: false, grab: null, pcand: null, pd: 9, cd: 9, dive: false, ddx: 0, ddz: 0, runT: 0, jT: -99, cdD: 0, lastA: -99 });
  CAM.yaw = yaw + Math.PI; CAM.pitch = .28; CAM.mode = 'follow';
  R.root.rotation.order = 'YXZ'; R.root.visible = true; R.root.position.set(x, 0, z); R.root.rotation.set(0, yaw, 0); if (R.club) R.club.visible = false;
  hurtClear();
}
// 골프 스윙 때만 손에 나타나는 골프채(사장님도 같이 쓴다)
export function clubMesh(R, on) {
  if (!R.club) {
    if (!on) return;
    const g = new THREE.Group(); g.scale.setScalar(1 / (R.handR.scale.x || 1));
    mesh(g, cylGeo(.011, .011, .9, 6), M('chrome'), 0, -.5, 0); mesh(g, boxGeo(.05, .045, .11, .01), M('chrome'), 0, -.95, .035); mesh(g, cylGeo(.017, .017, .2, 6), M('rubber'), 0, -.06, 0);
    R.handR.add(g); R.club = g;
  }
  R.club.visible = on;
}
// 결재판(막는 사람이 왼손에 든다)
export function boardMesh(R, on) {
  if (!R.board) {
    if (!on) return;
    const g = new THREE.Group(); g.scale.setScalar(1 / (R.handL.scale.x || 1));
    mesh(g, boxGeo(.26, .34, .02, .006), M('plasticBlue'), 0, -.15, -.03); mesh(g, boxGeo(.21, .26, .004), M('paper'), 0, -.16, -.042);
    R.handL.add(g); R.board = g;
  }
  R.board.visible = on;
}
export function hidePlayer() { P.active = false; if (P.R) P.R.root.visible = false; }
export function placeAt(x, z, yaw) { if (P.seated) standUp(); P.ghost = 0; setMask(); P.body.position.set(x, .02, z); P.body.velocity.set(0, 0, 0); P.yaw = yaw; CAM.yaw = yaw + Math.PI; P.auto = null; }
// 의자가 바라보는 쪽(의자 앞 = +z)과 앉는 자리
export function seatOf(ch) { const b = ch.body, q = b.quaternion, fx_ = 2 * (q.x * q.z + q.w * q.y), fz = 1 - 2 * (q.x * q.x + q.y * q.y), yaw = Math.atan2(fx_, fz); return { x: b.position.x + Math.sin(yaw) * .04, z: b.position.z + Math.cos(yaw) * .04, yaw }; }
export function sit(chair) {
  if (!chair || chair.dead || !P.active) return;
  if (P.carry) throwCarry(true); if (P.grab) tossPerson(true); P.bPend = false; P.roll = 0;
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

export function equip(type, from) {
  dropWeapon();
  const def = DEFS[type]; P.weapon = type; P.wdef = def.weapon; P.wdur = def.weapon.dur || 0;
  P.fuel = def.weapon.spray ? (from && from.fuel != null ? from.fuel : 100) : 0;
  const g = new THREE.Group(); def.build(g, {}, def.size); g.position.set(0, 0, def.size[2] * .36); const holder = new THREE.Group(); holder.add(g); holder.position.set(0, -.07, 0); P.R.handR.add(holder); P.wmesh = holder;
  sfx('up', .6); fx.text(headPos(.5), def.weapon.n + ' 장착!', 'note');
}
export function dropWeapon(broke) {
  if (!P.weapon) return; P.R.handR.remove(P.wmesh);
  const p = P.body.position;
  if (!broke) spawn(P.weapon, p.x + Math.sin(P.yaw) * .5, .6, p.z + Math.cos(P.yaw) * .5, P.wdef && P.wdef.spray ? { ry: rand(6.28), fuel: P.fuel } : { ry: rand(6.28) });
  P.weapon = null; P.wdef = null; P.wmesh = null; P.fuel = 0; P.spraying = false;
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
  if (G.emit) { G.emit('flip'); G.emit('flip:' + p.type); }
}

// E로 집거나 엎을 수 있는 가장 가까운 물건
function findCand() {
  const pp = P.body.position, f = fwd(), c = { x: pp.x + f.x * .7, y: .9, z: pp.z + f.z * .7 }; let best = null, bd = 1.5;
  if (G.want && !G.want.dead && !G.want.held && distTo(G.want, c, .9) < 1.9) { P.cd = 0; return G.want; }
  for (const p of G.props) {
    if (p.dead || p.kind !== 'obj' || p.held || p === P.seated) continue; const def = p.def;
    // 비상벨처럼 벽에 붙은 것은 누를 수만 있다. 탈것은 자유 난동에서만
    if (p.fixed && !def.use) continue;
    const ride = def.ride && G.toys;
    const can = def.use || def.weapon || def.flip || ride || (def.grab !== false && p.body.mass <= 25); if (!can) continue;
    const d = distTo(p, c, .7) + (def.weapon ? -.4 : 0) + (def.flip ? .25 : 0); if (d < bd) { bd = d; best = p; }
  }
  P.cd = bd; return best;
}
// 앞에 있는 사람(잡을 수 있는). 거리는 몸 가운데까지라 물건과 비교할 때 조금 빼 준다
function findPerson() {
  if (!G.people || !G.people.near) return null;
  const pp = P.body.position, n = G.people.near(pp.x, pp.z, Math.sin(P.yaw), Math.cos(P.yaw), 1.35);
  P.pd = n ? Math.max(0, G.people.nd - .95) : 9; return n;
}

// 이동 입력이 없으면 가까운 부술 것(사람 포함) 쪽으로 몸을 돌린다
function autoAim() {
  if (I.mx || I.mz) return;
  const pp = P.body.position, f = fwd(), c = { x: pp.x, y: .9, z: pp.z }; let bd = 2.6, tx = 0, tz = 0, ok = false;
  for (const p of G.props) { if (p.dead || p.hp == null || p.held) continue; const d = distTo(p, c, .8); if (d > bd) continue; const bp = p.body.position, dx = bp.x - pp.x, dz = bp.z - pp.z, l = Math.hypot(dx, dz) || 1; if ((dx * f.x + dz * f.z) / l < -.2) continue; bd = d; tx = bp.x; tz = bp.z; ok = true; }
  const n = G.people && G.people.near ? G.people.near(pp.x, pp.z, f.x, f.z, 2.4, true, -.2) : null;
  if (n && G.people.nd - .35 < bd) { tx = n.body.position.x; tz = n.body.position.z; ok = true; }
  if (ok) P.yaw = Math.atan2(tx - pp.x, tz - pp.z);
}
function startAtk(kind) {
  const W = P.wdef || FIST, ch = P.ch;
  autoAim();
  const rate = ch.rate * (P.rush > 0 ? 1.8 : 1);
  if (kind === 'a') {
    // 잠깐 쉬었다 치면 1타부터. 맨손 3타째는 직급마다 다른 마무리
    if (G.tick - P.lastA > 50) P.n3 = 0;
    P.lastA = G.tick; P.n3 = (P.n3 + 1) % 3;
    if (P.n3 === 0 && !P.weapon && ch.mv && MV[ch.mv.fin]) { startMove(ch.mv.fin); return; }
    P.atk = { type: 'swing', t: 0, dur: W.cd / 1000 / rate, alt: P.n3 === 1, third: P.n3 === 0, k: 'a' };
  }
  else { P.atk = { type: P.weapon ? 'smash' : 'kick', t: 0, dur: (P.weapon ? W.cd * 1.7 : 430) / 1000 / Math.sqrt(rate), k: 'b' }; P.cdB = 8; }
}
// 강타: 무기를 들었으면 무기 강타, 맨손이면 직급 기술
function heavyAtk() {
  const mv = P.ch.mv;
  if (P.weapon || !mv || !MV[mv.hv]) return startAtk('b');
  autoAim(); startMove(mv.hv); P.cdB = 8;
}
function wear() { if (P.wdur > 0 && --P.wdur <= 0) { fx.text(headPos(.3), P.wdef.n + ' 사망', 'note'); fx.bitsAt(headPos(-.6), 20, '#e4e1d8', 4, 3); sfx('plastic'); dropWeapon(true); } }
function doHit(a) {
  const W = P.wdef || FIST, ch = P.ch, pp = P.body.position, f = fwd(), heavy = a.k === 'b';
  let dmg, r, reach, imp;
  if (!heavy) { dmg = W.dmg * ch.pow * (a.third ? 1.5 : 1); r = W.r; reach = W.reach; const pu = W.push * (a.third ? 1.8 : 1); imp = { x: f.x * pu, y: 1.2 + (W.up || 0) * 3 * (ch.launch || 1), z: f.z * pu }; }
  else if (P.weapon) { dmg = W.dmg * 1.9 * ch.pow; r = W.r * 1.15; reach = W.reach; const pu = W.push * 1.5 * (ch.launch || 1); imp = { x: f.x * pu, y: 3.5 + (W.up || 0) * 4, z: f.z * pu }; }
  else { dmg = 30 * ch.pow; r = .9; reach = .85; imp = { x: f.x * 8 * (ch.launch || 1), y: 4.5, z: f.z * 8 * (ch.launch || 1) }; }
  const hits = attack({ x: pp.x + f.x * reach, y: pp.y + .9, z: pp.z + f.z * reach }, r, dmg, imp, { heavy: heavy || W.heavy, tall: .65, skip: P.carry, pk: ch.pow * (heavy ? 1.3 : a.third ? 1.2 : 1), brk: heavy });
  const np = G.people ? G.people.lastN || 0 : 0;
  if (hits.length || np) {
    addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 1.5 + (heavy ? 2 : 0)); G.shake = Math.max(G.shake, heavy ? .16 : .05); if (heavy || W.heavy) G.hitstop = Math.max(G.hitstop, 55); buzz(8);
    sfx(heavy && !P.weapon ? 'kickh' : W.snd, .6); if (heavy && W.word) fx.text(headPos(.2), W.word, 'note');
    if (hits.length) { if (W.tamb) { if (G.emit) G.emit('tamb', hits.length); if (Math.random() < .35) fx.text(headPos(.2), '찰랑!', 'note'); } wear(); }
  } else sfx('whoosh', .6);
}

// ───── 새 동작들(직급 마무리·강타, 돌진, 모아치기, 내려찍기)
const feet = () => ({ x: P.body.position.x, y: .1, z: P.body.position.z });
// 앞쪽 한 점(reach 앞, dy 높이)을 친다. 피해는 직급 힘을 곱한다. 맞힌 물건 수 + 맞은 사람 수를 돌려준다
function strike(reach, dy, r, dmg, ix, iy, iz, o = {}) {
  const pp = P.body.position, f = fwd();
  const hits = attack({ x: pp.x + f.x * reach, y: pp.y + dy, z: pp.z + f.z * reach }, r, dmg * P.ch.pow, { x: ix, y: iy, z: iz }, { heavy: o.heavy !== false, radial: o.radial, tall: o.tall ?? .65, skip: P.carry, max: o.max, pk: (o.pk || 1.15) * P.ch.pow, brk: o.brk ?? o.heavy !== false });
  const n = hits.length + (G.people ? G.people.lastN || 0 : 0);
  if (n) {
    addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 2 + 1); G.shake = Math.max(G.shake, o.shake ?? .16); G.hitstop = Math.max(G.hitstop, o.stop ?? 55); buzz(o.buzz || 14);
    if (o.snd) sfx(o.snd, o.vol ?? .8); if (o.word) fx.text(headPos(.25), o.word, 'word');
  } else if (o.miss !== false) sfx('whoosh', .6);
  return n;
}
// 바로 앞(r 안)에 칠 것이 있나
function frontTarget(r) {
  const pp = P.body.position, f = fwd(), c = { x: pp.x + f.x * r * .55, y: pp.y + .9, z: pp.z + f.z * r * .55 };
  if (G.people && G.people.near && G.people.near(pp.x, pp.z, f.x, f.z, r, true)) return true;
  for (const p of G.props) { if (p.dead || p.hp == null || p.held || (p.fixed && p.def.wall)) continue; if (distTo(p, c, .65) < r * .55) return true; }
  return false;
}
const FLR = [.18, .36, .54, .74];
// dur 초(공격 속도로 나눈다: fast면 그대로, 아니면 제곱근) · at 맞히는 순간(2 = 직접 처리) · spd 그동안 걷는 속도 배수
// drive = 동작이 몸을 직접 움직인다 · sweep = [시작, 끝] 사이에서 무언가 맞을 때까지 계속 친다
const MV = {
  // 인턴 마무리: 다다다 4연타
  flurry: { dur: .62, at: 2, spd: .3, fast: true, k: 'a', start() { sfx('whoosh', .5); },
    tick(A) { while (A.n < 4 && A.t >= FLR[A.n]) { const last = A.n === 3, f = fwd(); A.n++; strike(.7, .95, .85, last ? 16 : 7, f.x * (last ? 7 : 1.6), last ? 3.5 : 1, f.z * (last ? 7 : 1.6), { heavy: last, snd: 'jab', vol: last ? .8 : .55, shake: last ? .14 : .04, stop: last ? 60 : 22, miss: false, word: last ? '다다다!' : null, pk: last ? 1.1 : .6 }); } } },
  // 인턴 강타: 미끄러져 들어가 다리를 걸어 띄운다
  slide: { dur: .62, at: 2, spd: 0, drive: true, sweep: [.08, .8], start(A) { const f = fwd(); A.dx = f.x; A.dz = f.z; sfx('slide'); },
    tick(A) { const v = P.body.velocity, s = A.done ? 1 : A.t < .8 ? 10 * (1 - A.t * .7) : 2; v.x = A.dx * s; v.z = A.dz * s; if (G.tick % 5 === 0) fx.bitsAt(feet(), 4, '#d8d0bf', 1.5, .8); },
    hit(A) { return strike(.55, .35, .8, 30, A.dx * 4, 9, A.dz * 4, { tall: .5, snd: 'kickh', stop: 70, shake: .2, miss: false, word: '슬라이딩!' }); } },
  // 주임 마무리: 두 손 결재 도장
  stampk: { dur: .56, at: .5, spd: .3, k: 'a',
    hit() { const pp = P.body.position, f = fwd(), n = strike(.85, .7, .95, 24, f.x * 3, 2.5, f.z * 3, { snd: 'stamp', vol: .75, stop: 70, shake: .22, miss: false }); const c = { x: pp.x + f.x * .95, y: .1, z: pp.z + f.z * .95 }; fx.burst(c, .7); fx.text({ x: c.x, y: 1.5, z: c.z }, '반려', 'stamp'); if (!n) sfx('stamp', .4); } },
  // 주임 강타: 가까우면 서류철로 후려치고, 멀면 화면이 보는 쪽으로 던진다
  file: { dur: .52, at: .45, spd: .4,
    hit() {
      const pp = P.body.position, f = fwd();
      if (frontTarget(1.4)) { strike(.8, .9, .9, 28, f.x * 7, 4, f.z * 7, { snd: 'chop', word: '서류철!' }); return; }
      const a = aim(), up = Math.max(.1, .45 - CAM.pitch) * 5; P.yaw = Math.atan2(a.x, a.z);
      const b = spawn('binder', pp.x + a.x * .75, pp.y + 1.45, pp.z + a.z * .75, { ry: P.yaw, life: 420, out: true, v: { x: a.x * 18, y: up + 1, z: a.z * 18 }, av: { x: rand(-2, 2), y: 16, z: rand(-2, 2) } });
      b.thrownT = G.tick; sfx('proj', .9); sfx('whoosh', .7); fx.text(headPos(.3), '서류철 슝!', 'note');
    } },
  // 대리 마무리: 어퍼컷(높이 띄운다)
  upper: { dur: .5, at: .45, spd: .3, k: 'a', hit() { const f = fwd(); P.body.velocity.y = Math.max(P.body.velocity.y, 3); strike(.65, 1.0, .9, 22, f.x * 1.5, 11, f.z * 1.5, { snd: 'upper', stop: 75, shake: .2, word: '어퍼컷!' }); } },
  // 대리 강타: 돌려차기(옆으로 넓게)
  round: { dur: .56, at: .5, spd: .35, start() { sfx('whoosh', .7); }, hit() { const f = fwd(), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw); strike(.75, .85, 1.3, 32, f.x * 7 - rx * 4, 4.5, f.z * 7 - rz * 4, { snd: 'kickh', stop: 65, word: '돌려차기!' }); } },
  // 과장 마무리: 박치기
  headbutt: { dur: .5, at: .45, spd: .2, k: 'a', hit() { const f = fwd(), v = P.body.velocity; v.x += f.x * 4; v.z += f.z * 4; if (strike(.6, 1.45, .85, 34, f.x * 10, 5, f.z * 10, { snd: 'bonk', stop: 85, shake: .26, word: '박치기!', pk: 1.3 })) fx.bitsAt(headPos(-.15), 8, '#ffd84d', 2, 2); } },
  // 과장 강타: 배치기(앞쪽 넓게 밀어낸다)
  belly: { dur: .6, at: .45, spd: .25, hit() { const pp = P.body.position, f = fwd(); sfx('belly', .9); strike(.45, .8, 1.9, 26, 10, 5, 0, { radial: true, max: 10, stop: 70, shake: .3, miss: false, word: '배치기!' }); fx.burst({ x: pp.x + f.x * .5, y: .1, z: pp.z + f.z * .5 }, 1.1); } },
  // 차장 마무리: 수도 내리치기
  chop: { dur: .5, at: .45, spd: .3, k: 'a', hit() { const f = fwd(); strike(.8, .8, .9, 26, f.x * 9, 2, f.z * 9, { snd: 'chop', stop: 70, shake: .2, word: '수도!' }); } },
  // 차장 강타: 골프 스윙(멀리 높이 날린다)
  golf: { dur: .72, at: .5, spd: .2, start() { sfx('whoosh', .5); }, hit() { const f = fwd(), L = P.ch.launch || 1; strike(1.0, .7, 1.15, 34, f.x * 12 * L, 9, f.z * 12 * L, { snd: 'golf', stop: 80, shake: .24, word: '나이스 샷!', pk: 1.3 }); } },
  // 자유인 마무리: 한 바퀴 돌며 뒤돌려차기(둘레 전부)
  spinkick: { dur: .56, at: .55, spd: .3, k: 'a', start() { sfx('whoosh', .6); }, hit() { strike(0, .9, 1.55, 24, 10, 5, 0, { radial: true, max: 8, snd: 'kickh', stop: 70, shake: .22, word: '뒤돌려차기!' }); } },
  // 자유인 강타: 앞으로 날아 두 발 드롭킥
  dropkick: { dur: .7, at: 2, spd: 0, drive: true, sweep: [.22, .68], start(A) { const f = fwd(); A.dx = f.x; A.dz = f.z; P.body.velocity.y = 5.2; sfx('whoosh', .8); },
    tick(A) { const v = P.body.velocity; if (A.t < .62 && !A.done) { v.x = A.dx * 7.5; v.z = A.dz * 7.5; } else { v.x *= .82; v.z *= .82; } },
    hit(A) { const n = strike(.75, .95, 1.0, 36, A.dx * 13, 5, A.dz * 13, { snd: 'kickh', stop: 85, shake: .28, miss: false, word: '드롭킥!', pk: 1.3 }); if (n) { const v = P.body.velocity; v.x = -A.dx * 2; v.z = -A.dz * 2; v.y = Math.max(v.y, 2.5); } return n; },
    end() { P.lag = 10; } },
  // 모아치기: 강타를 0.6초 넘게 모았다가 놓으면 두 바퀴 돌며 둘레를 날린다(무기를 들었으면 무기로)
  spin: { dur: .8, at: 2, spd: .55, start() { sfx('spin'); fx.text(headPos(.35), '모아치기!', 'word big'); },
    tick(A) {
      if (!((A.n === 0 && A.t >= .3) || (A.n === 1 && A.t >= .62))) return;
      A.n++; const k = A.chg || 1, W = P.wdef, pp = P.body.position, r = 1.8 + (W ? W.reach * .4 : 0);
      const n = strike(0, .9, r, (W ? W.dmg * 1.6 : 26) * k, 11 * k, 6, 0, { radial: true, max: 12, snd: A.n === 2 ? 'kickh' : 'smack', vol: .8, stop: A.n === 2 ? 90 : 45, shake: .3, brk: true, pk: 1.3 * k, miss: false });
      fx.burst({ x: pp.x, y: .1, z: pp.z }, 1.2 * k); if (n && W) wear();
    } },
  // 달리다가 때리기: 어깨로 들이받는다(처음 맞은 것에서 멈춘다)
  dash: { dur: .5, at: 2, spd: 0, drive: true, k: 'a', sweep: [.06, .8], start(A) { const f = fwd(); A.dx = f.x; A.dz = f.z; sfx('dash'); fx.cloud(feet(), 2, '#d8d0bf', .5, .2); },
    tick(A) { const v = P.body.velocity; if (!A.done) { const s = A.t < .8 ? 12 * (1 - A.t * .45) : 3; v.x = A.dx * s; v.z = A.dz * s; if (G.tick % 3 === 0) fx.bitsAt(feet(), 3, '#d8d0bf', 1.5, 1); } else { v.x *= .8; v.z *= .8; } },
    hit(A) { const n = strike(.5, 1.0, .9, 30, A.dx * 13, 5.5, A.dz * 13, { snd: 'dashhit', stop: 80, shake: .28, miss: false, word: '돌진!', pk: 1.3 }); if (n) { const v = P.body.velocity; v.x = -A.dx * 2.5; v.z = -A.dz * 2.5; A.t = Math.max(A.t, .8); } return n; } },
  // 공중에서 때리기: 비스듬히 내려꽂는 날아차기(자세만, 움직임은 diveTick)
  dive: { dur: 99, at: 2, spd: 1, drive: true, k: 'a' },
};
function startMove(type, o) {
  const M = MV[type]; if (!M) return null;
  const rate = P.ch.rate * (P.rush > 0 ? 1.8 : 1), A = { type, t: 0, dur: M.dur / (M.fast ? rate : Math.sqrt(rate)), k: M.k || 'b', hit: false, n: 0, done: false };
  if (o) Object.assign(A, o);
  P.atk = A; if (M.start) M.start(A); return A;
}
function startDive() {
  const f = fwd(), v = P.body.velocity; P.dive = true; P.ddx = f.x; P.ddz = f.z; v.x = f.x * 8.5; v.z = f.z * 8.5; v.y = Math.min(v.y, 0) - 8.5;
  P.atk = { type: 'dive', t: 0, dur: 99, k: 'a', hit: false, n: 0, done: false }; sfx('dive');
}
// 날아가는 동안: 무언가에 닿으면 차고 튕겨 오른다
function diveTick() {
  const v = P.body.velocity; v.x = P.ddx * 8.5; v.z = P.ddz * 8.5;
  if (G.tick & 1) return;
  if (strike(.45, .35, .7, 24, P.ddx * 9, 6, P.ddz * 9, { tall: .5, snd: 'kickh', stop: 60, shake: .2, miss: false, word: '날아차기!' })) {
    P.dive = false; if (P.atk && P.atk.type === 'dive') P.atk = null; v.y = 5.5; v.x = -P.ddx * 2; v.z = -P.ddz * 2;
  }
}
// 닿은 것 없이 내려앉으면 둘레를 쿵(작은 범위)
function diveLand() {
  P.dive = false; if (P.atk && P.atk.type === 'dive') P.atk = null;
  const pp = P.body.position, hits = attack({ x: pp.x, y: .45, z: pp.z }, 1.7, 22 * P.ch.pow, { x: 6.5, y: 5, z: 6.5 }, { radial: true, heavy: true, max: 8, tall: .5, pk: P.ch.pow, brk: true });
  addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 2);
  fx.cloud({ x: pp.x, y: .2, z: pp.z }, 5, '#b9b2a2', .8, .7); fx.burst({ x: pp.x, y: .1, z: pp.z }, .9); sfx('stomp'); G.shake = Math.max(G.shake, .24); G.hitstop = Math.max(G.hitstop, 50); buzz(30); P.lag = 9;
}
// 구르기: 0.4초 동안 맞지 않는다. 방향 입력이 없으면 뒤로
function startRoll(wx, wz, l) {
  let dx = wx, dz = wz; P.rollBack = l < .2;
  if (P.rollBack) { dx = -Math.sin(P.yaw); dz = -Math.cos(P.yaw); } else { const k = Math.hypot(dx, dz) || 1; dx /= k; dz /= k; P.yaw = Math.atan2(dx, dz); }
  P.rdx = dx; P.rdz = dz; P.roll = P.rollMax = 24; P.inv = Math.max(P.inv, 26); P.rollCd = 40;
  P.atk = null; P.bPend = false; P.dive = false; P.slam = false; P.stag = 0;
  sfx('dodge'); fx.bitsAt(feet(), 8, '#d8d0bf', 2, 1);
}
// 강타를 누르고 있는 동안: 모이는 표시와 소리
function chargeTick(dt) {
  const was = P.bHold; P.bHold += dt;
  if (P.bHold < .2) return;
  const pp = P.body.position, k = Math.min(1, P.bHold / .6);
  if (G.tick % 6 === 0) fx.bitsAt({ x: pp.x + rand(-.4, .4), y: .2, z: pp.z + rand(-.4, .4) }, 2, k >= 1 ? '#ffd84d' : '#ffffff', .6, 3);
  if (k < 1 && G.tick % 9 === 0) sfx('chargeup', .7, k);
  if (was < .6 && P.bHold >= .6) { sfx('chargefull'); fx.text(headPos(.3), '모았다!', 'note'); fx.burst({ x: pp.x, y: 1, z: pp.z }, .5, false); buzz(15); }
  if (k >= 1 && G.tick % 20 === 0) fx.cloud({ x: pp.x, y: 1, z: pp.z }, 1, '#fff3b0', .6, .3);
}

// ───── 사람 들어 올리기 · 던지기 · 내려놓기
function grabPerson(n) {
  if (!G.people || !G.people.grab || !G.people.grab(n)) return false;
  P.grab = n; P.cand = P.pcand = null; P.atk = null; P.bPend = false; sfx('grab'); buzz(15); return true;
}
// soft = 앞에 내려놓기, 아니면 화면이 보는 쪽으로 던진다(다른 사람·물건을 쓰러뜨린다)
export function tossPerson(soft) {
  const n = P.grab; P.grab = null; if (!n || !G.people || !P.body) return;
  const pp = P.body.position;
  if (soft) { const f = fwd(); G.people.drop(n, pp.x + f.x * .9, pp.z + f.z * .9); return; }
  const a = aim(), k = clamp(P.ch.thr || 1, 1, 1.5); P.yaw = Math.atan2(a.x, a.z);
  G.people.toss(n, a.x * 12 * k, 4 + Math.max(0, .5 - CAM.pitch) * 6, a.z * 12 * k);
  P.atk = { type: 'swing', t: .35, dur: .3, hit: true }; G.shake = Math.max(G.shake, .15); buzz(25);
}

// ───── 결전용 체력(G.combat일 때만 다친다)
const KB = { punch: 4.5, kick: 4, heavy: 7.5, blast: 6, proj: 3, push: 6, roar: 7 }, OUCH = ['아야!', '윽!', '으악!', '억!'];
// from = 때린 쪽 {x, z}, kind = punch·kick·heavy·blast·proj·push·roar. dmg 0 = 밀치기만. 다쳤으면 true
export function hurtPlayer(dmg, from, kind = 'punch') {
  if (!G.combat || !P.active || !P.body || P.ko || P.lock > 0 || P.auto) return false;
  const pp = P.body.position, v = P.body.velocity, sx = from ? from.x : pp.x - Math.sin(P.yaw), sz = from ? from.z : pp.z - Math.cos(P.yaw);
  let ux = pp.x - sx, uz = pp.z - sz; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
  if (P.inv > 0) { if (P.roll > 0 && G.tick - (P.missT || -99) > 20) { P.missT = G.tick; fx.text(headPos(.2), '회피!', 'note'); } return false; }
  // 강타를 모으는 자세로 앞쪽에서 오는 공격은 막는다(큰 공격·폭발은 못 막는다)
  const front = -(ux * Math.sin(P.yaw) + uz * Math.cos(P.yaw)) > .35;
  if (dmg > 0 && P.bPend && P.bHold > .1 && front && kind !== 'heavy' && kind !== 'blast' && kind !== 'roar') {
    v.x += ux * 3; v.z += uz * 3; P.inv = 14; P.bHold = Math.min(P.bHold, .3);
    const c = headPos(-.6); pow(c, { x: ux, z: uz }, .8, '#9fd8ff'); fx.sparks(c, 10); fx.text(headPos(.2), '막았다!', 'word'); sfx('block'); G.shake = Math.max(G.shake, .1); buzz(15);
    return false;
  }
  if (P.seated) standUp(); if (P.ride) unmount(); if (P.carry && P.carry !== true) throwCarry(true); if (P.grab) tossPerson(true);
  P.atk = null; P.bPend = false; P.dive = false; P.slam = false; P.roll = 0;
  const kb = KB[kind] || 4.5; v.x = ux * kb; v.z = uz * kb; v.y = Math.max(v.y, kind === 'heavy' || kind === 'roar' ? 4.5 : 2.6);
  P.yaw = Math.atan2(-ux, -uz);
  if (!(dmg > 0)) { P.stag = Math.max(P.stag, 12); return true; }
  P.hp = Math.max(0, P.hp - dmg); P.stag = kind === 'heavy' || kind === 'blast' ? 30 : 18; P.inv = 38; P.blink = 38; P.hurtF = 40;
  const c = headPos(-.65); hurtFlash(dmg / 22); pow(c, { x: ux, z: uz }, .9, '#ff7a6a'); fx.bitsAt(c, 10, '#ffffff', 4, 3);
  fx.text(headPos(.25), pick(OUCH) + ' -' + Math.round(dmg), 'word');
  sfx('hurt'); G.shake = Math.max(G.shake, .28); G.hitstop = Math.max(G.hitstop, 70); buzz([30, 20, 50]);
  if (P.hp <= 0) knockOut();
  return true;
}
function knockOut() {
  P.ko = true; P.koT = 0; P.stag = 0; P.inv = 0; P.blink = 0; P.bPend = false; P.lag = 0;
  fx.text(headPos(.3), '으윽… 퇴근하고 싶다', 'word big'); sfx('ko'); slow(.35, 50); G.flash = Math.max(G.flash || 0, 4);
  // 쓰러졌다는 알림은 이번 화면 계산이 끝난 뒤 딱 한 번
  if (!P.koSent) { P.koSent = true; const f = () => { if (G.onPlayerKO) G.onPlayerKO(); }; if (typeof queueMicrotask === 'function') queueMicrotask(f); else setTimeout(f, 0); }
}
// 체력을 채우고 일어난다(잠깐 무적)
export function healPlayer() {
  if (!P.active) return;
  P.hp = P.maxHp || 100; P.ko = false; P.koSent = false; P.stag = 0; P.lag = 0; P.inv = 60; P.blink = 0; P.hurtF = 0; hurtClear();
  if (P.body) P.body.velocity.set(0, 0, 0);
}

function special() {
  const sp = P.ch.sp, pp = P.body.position;
  G.rage = 0; G.hitstop = 110; G.flash = 6; sfx('special'); fx.text(headPos(.4), sp.name + '!', 'word big'); buzz([40, 30, 80]); P.bPend = false;
  if (sp.type === 'quake') {
    // 책상 쾅(한 번, 크게 띄움) · 지진(세 번)
    for (let i = 0; i < sp.n; i++) later(3 + i * 26, () => { const q = P.body.position, c = { x: q.x, y: .2, z: q.z }; explode(c, 7.5, sp.dmg, sp.slow ? 12 : 9); fx.cloud({ x: q.x, y: .3, z: q.z }, 10, '#b9b2a2', 1.2, 1.5); fx.burst(c, 2.2 + i * .5); sfx('boom'); sfx('stomp', .8); G.shake = Math.max(G.shake, .45); P.atk = { type: 'smash', t: .38, dur: .3, hit: true }; });
    if (sp.slow) later(5, () => slow(.3, 100));
  }
  else if (sp.type === 'rush') { P.rush = 480; fx.cloud({ x: pp.x, y: 1, z: pp.z }, 8, '#7a4a26', .8, .5); fx.text(headPos(.8), '카페인 충전!', 'note'); }
  else if (sp.type === 'storm') P.storm = 210;
  else if (sp.type === 'line') {
    for (let i = 0; i < 9; i++) later(3 + i * 5, () => { const q = P.body.position, a = aim(); P.yaw = Math.atan2(a.x, a.z); const b = spawn('ball', q.x + a.x * .7 + rand(-.3, .3), 1.1 + rand(-.3, .4), q.z + a.z * .7 + rand(-.3, .3), { mass: 4, life: 240, v: { x: a.x * 30, y: 1, z: a.z * 30 } }); b.thrownT = G.tick; explode({ x: q.x + a.x * 2.2, y: 1, z: q.z + a.z * 2.2 }, 1.6, 30, 10); sfx('plastic', .7); P.atk = { type: 'golf', t: .5, dur: .2, hit: true }; });
    // 마지막 한 방: 8m 앞이 홀컵처럼 터진다
    later(54, () => { const q = P.body.position, a = aim(), c = { x: clamp(q.x + a.x * 8, -13, 13), y: .5, z: clamp(q.z + a.z * 8, -8.5, 8.5) }; explode(c, 3.2, 60, 12); fx.burst(c, 1.8); fx.cloud(c, 8, '#ffffff', 1.1, .6); fx.text({ x: c.x, y: 1.8, z: c.z }, '홀인원!', 'word big'); sfx('golf'); sfx('boom', .8); G.shake = Math.max(G.shake, .4); });
  }
  else if (sp.type === 'rain') {
    for (let i = 0; i < 11; i++) later(6 + i * 7, () => { const q = P.body.position, c = { x: clamp(q.x + rand(-6, 6), -13, 13), y: .4, z: clamp(q.z + rand(-6, 6), -8, 8) }; fx.sheet({ x: c.x, y: 2.4, z: c.z }, 6, '#ffffff', 2); explode(c, 3, 55, 9); fx.cloud(c, 6, '#ffffff', 1, .6); sfx('boom', .7); });
    // 마지막: 내 둘레에 사직서 한 뭉치
    later(96, () => { const q = P.body.position, c = { x: q.x, y: .4, z: q.z }; fx.sheet({ x: c.x, y: 2.6, z: c.z }, 24, '#ffffff', 5); explode(c, 5.5, 70, 12); fx.burst(c, 2.4); fx.text({ x: c.x, y: 2.2, z: c.z }, '사직서 수리!', 'word big'); sfx('boom'); G.shake = Math.max(G.shake, .5); G.flash = 5; });
  }
}

// 든 물건은 머리 위에 붙어 다닌다
function holdCarry(pp) { if (!P.carry || P.carry === true) return; const c = P.carry; if (c.dead) { P.carry = null; return; } const cb = c.body; cb.position.set(pp.x, pp.y + 1.95 + c.size[1] / 2, pp.z); cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0); cb.quaternion.setFromEuler(0, P.yaw, 0); }
const rayFrom = new CANNON.Vec3(), rayTo = new CANNON.Vec3(), rayRes = new CANNON.RaycastResult();
export function updatePlayer(dt) {
  if (!P.active) return;
  const b = P.body, ch = P.ch, v = b.velocity, pp = b.position; P.t++;
  const locked = P.lock > 0; if (locked) P.lock--;
  if (!locked) { CAM.yaw -= I.lookX; CAM.pitch = clamp(CAM.pitch + I.lookY, -.2, 1.15); }
  I.lookX = I.lookY = 0;
  if (P.ghost > 0 && --P.ghost === 0) setMask();
  if (P.inv > 0) P.inv--; if (P.blink > 0) P.blink--; if (P.hurtF > 0) P.hurtF--; if (P.rollCd > 0) P.rollCd--; if (P.cdD > 0) P.cdD--;
  lowHp(G.combat && !P.ko && P.hp < 35 ? 1 - P.hp / 35 : 0);
  // 고개: 할 일 쪽을 본다(±40도)
  let lk = 0; if (G.lookAt && !P.seated) { const t = Math.atan2(G.lookAt.x - pp.x, G.lookAt.z - pp.z); let d = t - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); lk = clamp(d, -.7, .7); }
  P.look = lerp(P.look, lk, .08);
  const done = () => { P.pj = I.jump; P.pa = I.a; P.pb = I.b; P.pc = I.c; P.pe = I.e; };
  // 쓰러졌을 때: 누운 채로 아무것도 못 한다(healPlayer로 일어난다)
  if (P.ko) { P.koT++; v.x *= .85; v.z *= .85; P.cand = P.pcand = null; P.speed = 0; P.atk = null; P.bPend = false; done(); return; }
  if (P.grab && (P.ride || P.seated)) tossPerson(true);
  // 바퀴의자·카트·지게차를 탄 동안에는 운전만 한다
  if (P.ride) { P.bPend = false; P.roll = 0; updateRide(dt, locked); P.cand = null; done(); return; }
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
    holdCarry(pp); done(); return;
  }
  // 맞고 비틀거리거나(stag) 착지 직후(lag)에는 조작이 잠깐 안 된다
  if (P.stag > 0) P.stag--; if (P.lag > 0) P.lag--;
  const hold = locked || P.stag > 0 || P.lag > 0;
  let mx = hold ? 0 : I.mx, mz = hold ? 0 : I.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const a = aim(), wx = a.x * mz + Math.cos(CAM.yaw) * mx, wz = a.z * mz - Math.sin(CAM.yaw) * mx;
  const A0 = P.atk, M0 = A0 ? MV[A0.type] : null;
  const spd = ch.spd * (P.rush > 0 ? 1.7 : 1) * (P.carry || P.grab ? .85 : 1) * (P.slam ? .2 : 1) * (M0 ? M0.spd : A0 && A0.k === 'b' ? .35 : 1) * (P.bPend ? .3 : 1);
  // 소화기를 뿜는 동안엔 반동에 밀리고, 스프링클러로 젖은 바닥에서는 미끄러진다
  const grip = P.spraying ? .04 : P.stag > 0 ? .07 : TOY.wet && onG ? .08 : .3;
  if (P.roll > 0) { P.roll--; const k = P.roll > 5 ? 8.2 : 3.5; v.x = P.rdx * k; v.z = P.rdz * k; }
  else if (P.dive) { v.x = P.ddx * 8.5; v.z = P.ddz * 8.5; }
  else if (!(M0 && M0.drive)) { v.x = lerp(v.x, wx * spd, grip); v.z = lerp(v.z, wz * spd, grip); if (l > .1) P.yaw = angLerp(P.yaw, Math.atan2(wx, wz), P.bPend ? .08 : .25); }
  if (onG) {
    if (P.slam) { P.slam = false; const hits = attack({ x: pp.x, y: .4, z: pp.z }, 2.7, 30 * ch.pow, { x: 5, y: 6.5, z: 5 }, { max: 12, radial: true, heavy: true, tall: .5, pk: ch.pow * 1.2, brk: true }); addCombo(hits.length); G.rage = Math.min(100, G.rage + hits.length * 2); G.shake = .3; G.hitstop = 70; sfx('stomp', .7); sfx('boom', .5); fx.cloud({ x: pp.x, y: .2, z: pp.z }, 6, '#b9b2a2', .9, .8); buzz(40); }
    if (P.dive) diveLand();
    P.jumps = 0; P.air = 0;
  } else { P.air++; if (P.dive) { if (P.air > 100) { P.dive = false; if (P.atk && P.atk.type === 'dive') P.atk = null; } else diveTick(); } }
  // 달리는 중인지(돌진 공격): 빠르게 0.3초 넘게 달렸으면
  const hs0 = Math.hypot(v.x, v.z);
  P.runT = onG && !P.atk && !P.bPend && l > .6 && hs0 > ch.spd * .72 ? P.runT + dt : 0;
  // 점프 · 구르기(강타를 누른 채 점프, 또는 점프하자마자 0.15초 안에 강타)
  const jPress = I.jump && !P.pj && !hold, bPress = I.b && !P.pb && !hold, aPress = I.a && !P.pa;
  const canRoll = P.rollCd <= 0 && !P.carry && !P.grab && !P.dive;
  let rolled = false;
  if (jPress && onG && canRoll && (P.bPend || I.b)) { startRoll(wx, wz, l); rolled = true; }
  else if (bPress && canRoll && P.jumps === 1 && G.tick - P.jT < 10 && P.air < 12) { v.y = Math.min(v.y, 0) - 3; startRoll(wx, wz, l); rolled = true; }
  else if (jPress) {
    if (onG) { v.y = ch.jump; P.jumps = 1; P.jT = G.tick; sfx('jump'); } else if (ch.dj && P.jumps < 2) { v.y = ch.jump * .92; P.jumps = 2; sfx('jump'); fx.bitsAt({ x: pp.x, y: pp.y, z: pp.z }, 6, '#ffffff', 2, 0); }
  }
  // 동작 진행
  if (P.atk) {
    const A = P.atk, M = MV[A.type]; A.t += dt / A.dur;
    if (M) {
      if (M.tick) M.tick(A, dt);
      if (M.sweep && !A.done && A.t >= M.sweep[0] && A.t <= M.sweep[1] && (G.tick & 1) === 0 && M.hit(A)) A.done = true;
      if (!A.hit && A.t >= M.at) { A.hit = true; if (M.hit && !M.sweep) M.hit(A); }
    } else if (!A.hit && A.t >= .45) { A.hit = true; doHit(A); }
    if (A.t >= 1 && P.atk === A) { P.atk = null; if (M && M.end) M.end(A); }
  }
  P.cdB--; P.cdS = (P.cdS || 0) - 1;
  // 강타 모으기: 짧게 떼면 강타, 0.6초 넘게 모았다 떼면 모아치기
  if (P.bPend) {
    if (hold || P.carry || P.grab || P.roll > 0 || (!onG && P.air > 8)) P.bPend = false;
    else if (I.b) chargeTick(dt);
    else { P.bPend = false; if (P.bHold >= .6) { autoAim(); startMove('spin', { chg: clamp(.9 + P.bHold * .35, 1, 1.45) }); } else heavyAtk(); }
  }
  const spray = !!(P.wdef && P.wdef.spray), loud = !!(P.wdef && P.wdef.shout);
  if (spray && !P.carry && !P.grab) sprayTick(dt, hold); else P.spraying = false;
  if (!hold && !P.atk && P.roll <= 0 && !rolled) {
    if (P.grab) { if (aPress || bPress) tossPerson(); }
    else if (P.carry) { if (aPress || bPress) throwCarry(); }
    else if (bPress && P.cdB <= 0 && !P.bPend) { if (!onG) { P.slam = true; v.y = -17; sfx('whoosh'); } else { P.bPend = true; P.bHold = 0; } }
    // 확성기: 누를 때마다 외치기(꾹 누르고 있어도 잠깐씩 쉰다)
    else if (I.a && loud) { if (P.cdS <= 0) { shout(); P.cdS = 42; } }
    else if (I.a && !spray && !P.bPend) {
      // 공중에서 = 날아차기, 달리다가 = 돌진, 그 밖 = 연타
      if (aPress && !onG && P.air > 6 && !P.dive) startDive();
      else if (aPress && onG && P.cdD <= 0 && P.runT > (P.rush > 0 ? .1 : .3)) { P.cdD = 40; startMove('dash'); }
      else if (onG || !P.dive) startAtk('a');
    }
  }
  if (I.c && !P.pc && G.rage >= 100 && !locked && !P.stag) special();
  // E: 할 일 → 사람 내려놓기 → 물건 내려놓기 → 사람 들기(물건보다 가까울 때) → 집기/장착/엎기
  if (G.tick % 5 === 0) { const busy = P.carry || P.grab; P.cand = busy ? null : findCand(); P.pcand = busy ? null : findPerson(); }
  const ePress = I.e && !P.pe;
  if (!hold) {
    if (G.interact && G.interact(ePress, I.e, dt)) { P.eHold = 0; }
    else if (ePress && P.grab) tossPerson(true);
    else if (ePress && P.carry) throwCarry(true);
    else if (ePress && P.pcand && !P.atk && P.roll <= 0 && (!P.cand || P.cand.dead || (P.cand !== G.want && P.pd < P.cd - .15)) && grabPerson(P.pcand)) P.eHold = 0;
    else if (P.cand && !P.cand.dead) {
      const c = P.cand, d = c.def;
      if (d.use) { if (ePress) { useProp(c); P.cand = null; } }
      else if (d.ride && G.toys && d.grab === false) { if (ePress) { P.cand = null; mount(c); } }
      // 바퀴의자: 짧게 = 집어 들기, 꾹 = 올라타기
      else if (d.ride && G.toys) { if (I.e) { P.eHold += dt; if (P.eHold >= .35) { P.eHold = 0; P.cand = null; mount(c); } } else { if (P.pe && P.eHold > 0) { carry(c); P.cand = null; } P.eHold = 0; } }
      else if (d.flip) { if (I.e) { P.eHold += dt; if (P.eHold >= .45) { P.eHold = 0; flipProp(c); P.cand = null; } } else P.eHold = 0; }
      else if (ePress) { if (d.weapon) { equip(c.type, c); kill(c); } else carry(c); P.cand = null; }
    } else P.eHold = 0;
  }
  holdCarry(pp);
  if (P.rush > 0) {
    P.rush--; if (G.tick % 3 === 0) fx.bitsAt({ x: pp.x, y: .1, z: pp.z }, 2, '#f2b705', 1, 1);
    // 믹스커피 폭주: 달리기만 해도 앞을 들이받는다
    if (!P.atk && onG && hs0 > 4.5 && G.tick % 8 === 0) { const f = fwd(); strike(.45, 1.0, .7, 12, f.x * 9, 4, f.z * 9, { snd: 'dashhit', vol: .45, stop: 30, shake: .1, miss: false }); }
  }
  if (P.storm > 0) {
    P.storm--; if (P.storm % 8 === 0) { fx.sheet({ x: pp.x + rand(-2, 2), y: 1.2, z: pp.z + rand(-2, 2) }, 8, '#ffffff', 5); const h = attack({ x: pp.x, y: 1, z: pp.z }, 4.6, 10, { x: 3, y: 2.5, z: 3 }, { max: 14, radial: true, tall: 1, pk: .6 }); addCombo(Math.min(3, h.length)); sfx('paper', .4); }
    // 서류 폭풍 끝: 한꺼번에 터진다
    if (P.storm === 0) { const c = { x: pp.x, y: .8, z: pp.z }; explode(c, 5, 35, 11); fx.sheet({ x: c.x, y: 1.6, z: c.z }, 30, '#ffffff', 6); fx.burst(c, 1.8); fx.text({ x: c.x, y: 2.3, z: c.z }, '결재 완료!', 'word big'); sfx('paper'); sfx('boom', .7); G.shake = Math.max(G.shake, .35); }
  }
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
  pos.copy(look).addScaledVector(dirv, dist); if (G.ceil) pos.y = Math.min(pos.y, G.ceil);
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
    const pp = P.body.position, R = P.R, a = P.atk;
    P.koK = lerp(P.koK || 0, P.ko ? 1 : 0, Math.min(1, dt * 8));
    // 몸 전체 회전: 구르기(엉덩이 높이를 축으로 한 바퀴), 쓰러짐(발을 축으로 뒤로 눕기), 도는 기술(몸 방향)
    let tip = 0, piv = 0, yo = 0;
    if (P.roll > 0) { tip = (P.rollBack ? -1 : 1) * (1 - P.roll / (P.rollMax || 24)) * 6.283; piv = .5; }
    else if (P.koK > .01) tip = -1.5 * P.koK;
    if (a) { const k = a.t; if (a.type === 'spin') yo = Math.min(1, k / .9) * 12.566; else if (a.type === 'spinkick') yo = sm(Math.min(1, k / .7)) * 6.283; else if (a.type === 'round') yo = -1.1 * Math.sin(Math.min(1, k) * Math.PI); }
    const ry = P.yaw + yo, stp = Math.sin(tip);
    if (R.root.rotation.order !== 'YXZ') R.root.rotation.order = 'YXZ';
    R.root.position.set(pp.x - piv * stp * Math.sin(ry), pp.y + piv * (1 - Math.cos(tip)) + .12 * P.koK, pp.z - piv * stp * Math.cos(ry)); R.root.rotation.set(tip, ry, 0);
    // 맞은 직후 무적인 동안 깜빡인다
    R.root.visible = !(P.blink > 0 && (P.blink >> 2) % 2 === 1);
    const golf = !!(a && a.type === 'golf' && !P.weapon); if (golf || R.club) clubMesh(R, golf);
    P.blinkT -= dt; let ex = P.ko ? 'endureB' : P.hurtF > 0 || P.stag > 0 ? 'endure' : P.expr;
    if (P.blinkT < 0) { if (P.blinkT < -.12) P.blinkT = 2.6 + Math.random() * 2.4; else if (ex === 'normal') ex = 'blink'; else if (ex === 'endure') ex = 'endureB'; }
    if (ex !== R.shown) { R.face.material.map = faceTex(R.L, ex); R.shown = ex; }
    if (P.tremble > 0) { P.tremble--; R.face.position.x = (Math.random() - .5) * .004; } else R.face.position.x = 0;
    R.vein.visible = P.expr === 'endure' || P.expr === 'rage'; if (R.vein.visible) { const k = .08 + Math.sin(performance.now() * .012) * .012; R.vein.scale.set(k, k, 1); }
    const rk = P.ride && P.ride.kind, sitting = !!P.seated || rk === 'chair' || rk === 'fork';
    poseRig(R, { walk: P.walk, speed: P.onG && !sitting && !P.ko ? P.speed : 0, air: !P.onG && P.air > 5 && !sitting && !P.roll && !P.ko, slam: P.slam, carry: (!!P.carry && P.carry !== true) || !!P.grab, atk: a, t: P.t, seated: sitting, typing: (!!P.seated && P.seated.tag === 'myChair' && P.expr === 'normal') || rk === 'fork', push: rk === 'cart', clench: P.expr === 'endure', cheer: P.cheer, relief: P.expr === 'relief', look: P.look, armed: !!P.weapon,
      chg: P.bPend && P.bHold > .12 ? Math.min(1, P.bHold / .6) : 0, roll: P.roll > 0, stag: P.stag > 0 && !P.ko && !P.roll && !sitting ? 1 : 0, ko: P.koK > .01 ? P.koK : 0 });
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
