import { G, rand, clamp, lerp, angLerp } from './state.js';
import { CHARS } from './data/chars.js';
import { DEFS } from './data/props.js';
import { S } from './save.js';
import { THREE, X, M, bx, cyl, sph, colorMat, capGeo, textMat, pl } from './gfx.js';
import { CANNON, PH, GR, attack, damage, spawn, shove, explode, later, slow, addCombo, kill, distTo } from './engine.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';

export const I = { mx: 0, mz: 0, jump: false, a: false, b: false, c: false, e: false, lookX: 0, lookY: 0 };
export const P = { active: false };
export const CAM = { yaw: 0, pitch: .28, dist: 4.3, mode: 'follow', t: 0 };
const FIST = { n: '맨손', dmg: 10, r: .75, reach: .7, push: 3, cd: 210, snd: 'punch' };

// ───── 캐릭터 모형
function limb(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function cap(g, r, len, mat, y) { const m = new THREE.Mesh(capGeo(r, len), mat); m.position.y = y; m.castShadow = true; g.add(m); return m; }
export function buildRig(id, acc) {
  const ch = CHARS[id], root = new THREE.Group(), suit = colorMat(ch.suit, .8), pants = M('pants'), skin = M('skin'), hair = M('hair'), R = { root };
  const hips = R.hips = limb(root, 0, .88, 0);
  for (const s of [-1, 1]) {
    const hip = limb(hips, s * .1, 0, 0), knee = limb(hip, 0, -.4, 0);
    cap(hip, .078, .26, pants, -.2); cap(knee, .066, .28, pants, -.2); bx(knee, .1, .07, .25, 'shoe', 0, -.415, .05, .02);
    R[s < 0 ? 'hipL' : 'hipR'] = hip; R[s < 0 ? 'kneeL' : 'kneeR'] = knee;
  }
  const spine = R.spine = limb(hips, 0, 0, 0);
  bx(spine, .34, .17, .21, pants, 0, .06, 0, .05); bx(spine, .41, .46, .25, suit, 0, .38, 0, .09);
  bx(spine, .11, .3, .012, 'shirt', 0, .44, .122); if (ch.tie) bx(spine, .04, .26, .012, colorMat(ch.tie, .6), 0, .42, .13); else bx(spine, .012, .3, .012, colorMat('#d8d5cc'), 0, .44, .13);
  cyl(spine, .048, .052, .08, skin, 0, .65, 0, 10);
  const head = R.head = limb(spine, 0, .78, 0);
  const sk = sph(head, .125, skin); sk.scale.set(1, 1.13, 1.03);
  if (ch.hair !== 'bald' && ch.hair !== 'cap') { const h = sph(head, .132, hair, 0, .04, -.014); h.scale.set(1.02, ch.hair === 'bob' ? 1.0 : .78, 1.06); if (ch.hair === 'bob') bx(head, .27, .16, .1, hair, 0, -.05, -.07, .04); if (ch.hair === 'mop') { const f = sph(head, .07, hair, 0, .09, .1); f.scale.set(1.6, .6, .8); } }
  if (ch.hair === 'bald') { bx(head, .268, .06, .2, hair, 0, .0, -.03, .03); }
  if (ch.hair === 'cap') { const c = sph(head, .136, suit, 0, .05, 0); c.scale.set(1, .7, 1.04); bx(head, .2, .015, .13, suit, 0, .06, .16, .006); }
  for (const s of [-1, 1]) sph(head, .013, 'rubber', s * .046, .012, .118);
  sph(head, .018, skin, 0, -.02, .128);
  if (ch.glasses) for (const s of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.032, .006, 6, 14), M('plasticDark')); t.position.set(s * .048, .012, .122); head.add(t); }
  if (ch.sun || acc === 'sun') bx(head, .21, .045, .02, 'glassDark', 0, .014, .122, .01);
  if (acc === 'band') { const b = cyl(head, .13, .13, .04, 'red', 0, .07, 0, 18); b.scale.set(1, 1, 1.05); pl(head, .12, .035, textMat('투쟁', { w: 128, h: 40, size: 30, bg: '#c9281f', fg: '#ffffff' }), 0, .07, .137); }
  if (acc === 'helmet') { const c = sph(head, .145, colorMat('#f2c21a', .35), 0, .06, 0); c.scale.set(1, .72, 1.05); bx(head, .31, .02, .34, colorMat('#f2c21a', .35), 0, .045, .02, .008); }
  if (acc === 'chain') { const t = new THREE.Mesh(new THREE.TorusGeometry(.085, .012, 6, 18), M('gold')); t.position.set(0, .56, .05); t.rotation.x = 1.2; spine.add(t); }
  for (const s of [-1, 1]) {
    const sh = limb(spine, s * .255, .56, 0), el = limb(sh, 0, -.28, 0), hand = limb(el, 0, -.27, 0);
    cap(sh, .058, .17, suit, -.13); cap(el, .05, .16, suit, -.12); sph(hand, .052, skin);
    R[s < 0 ? 'shL' : 'shR'] = sh; R[s < 0 ? 'elL' : 'elR'] = el; R[s < 0 ? 'handL' : 'handR'] = hand;
  }
  root.scale.set(ch.build, 1, ch.build);
  return R;
}
export function poseRig(R, st) {
  const ph = st.walk || 0, sp = st.speed || 0, s = Math.sin(ph);
  R.hipL.rotation.set(-s * .8 * sp, 0, 0); R.hipR.rotation.set(s * .8 * sp, 0, 0);
  R.kneeL.rotation.x = Math.max(0, Math.sin(ph + 1.2)) * 1.0 * sp; R.kneeR.rotation.x = Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * 1.0 * sp;
  R.shL.rotation.set(s * .7 * sp, 0, .06); R.shR.rotation.set(-s * .7 * sp, 0, -.06); R.elL.rotation.x = -.25 - sp * .5; R.elR.rotation.x = -.25 - sp * .5;
  R.spine.rotation.set(.1 * sp, 0, 0); R.hips.position.y = .88 - Math.abs(Math.cos(ph)) * .03 * sp + Math.sin((st.t || 0) * .05) * .004; R.head.rotation.set(0, 0, 0);
  if (st.air) { R.hipL.rotation.x = -.7; R.hipR.rotation.x = -.3; R.kneeL.rotation.x = 1.1; R.kneeR.rotation.x = .7; R.shL.rotation.z = .5; R.shR.rotation.z = -.5; }
  if (st.slam) { R.spine.rotation.x = .5; R.shL.rotation.x = -2.8; R.shR.rotation.x = -2.8; }
  if (st.carry) { R.shL.rotation.set(-2.95, 0, .25); R.shR.rotation.set(-2.95, 0, -.25); R.elL.rotation.x = -.1; R.elR.rotation.x = -.1; }
  const a = st.atk;
  if (a) {
    const t = a.t, up = t < .35 ? t / .35 : 1, hit = t < .35 ? 0 : Math.min(1, (t - .35) / .22), back = t > .7 ? (t - .7) / .3 : 0;
    if (a.type === 'kick') {
      const k = up * (1 - back); R.hipR.rotation.x = -1.75 * (t < .35 ? up * .5 : hit) * (1 - back); R.kneeR.rotation.x = (t < .35 ? 1.3 * up : 1.3 * (1 - hit)) * (1 - back); R.spine.rotation.x = -.28 * k; R.shL.rotation.x = -.6 * k; R.shR.rotation.x = .5 * k;
    } else {
      const ang = lerp(lerp(0, -2.75, up), a.type === 'smash' ? -.25 : -.75, hit) * (1 - back), side = a.alt ? -1 : 1;
      R.shR.rotation.set(ang, 0, -.1 - (a.alt ? .5 * up * (1 - hit) : 0)); R.elR.rotation.x = -.35 * (1 - hit);
      if (a.type === 'smash') { R.shL.rotation.set(ang, 0, .35); R.elL.rotation.x = -.5 * (1 - hit); }
      R.spine.rotation.y = side * lerp(-.45 * up, .45, hit) * (1 - back); R.spine.rotation.x = lerp(-.12 * up, .3, hit) * (1 - back);
    }
  }
}

// ───── 생성
const rigs = {};
export function spawnPlayer(id, x, z, yaw = 0) {
  const key = id + '|' + (S.acc || ''), ch = CHARS[id];
  const R = rigs[key] || (rigs[key] = buildRig(id, S.acc));
  if (P.R && P.R !== R) X.scene.remove(P.R.root);
  X.scene.add(R.root);
  const body = new CANNON.Body({ mass: 70, material: PH.matP, fixedRotation: true, allowSleep: false, collisionFilterGroup: GR.PLAYER, collisionFilterMask: GR.STATIC | GR.PROP | GR.PWALL });
  body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .3, 0)); body.addShape(new CANNON.Sphere(.3), new CANNON.Vec3(0, .9, 0));
  body.position.set(x, .02, z); body.isPlayer = true; body.updateMassProperties(); PH.world.addBody(body);
  if (P.wmesh && P.R) P.R.handR.remove(P.wmesh);
  Object.assign(P, { id, ch, R, body, yaw, walk: 0, speed: 0, atk: null, cdB: 0, n3: 0, air: 0, jumps: 0, slam: false, rush: 0, storm: 0, carry: null, weapon: null, wdef: null, wdur: 0, wmesh: null, lock: 0, pj: false, pb: false, pc: false, pe: false, eHold: 0, active: true, t: 0, onG: true, cand: null });
  CAM.yaw = yaw + Math.PI; CAM.pitch = .28; CAM.mode = 'follow';
  R.root.visible = true; R.root.position.set(x, 0, z); R.root.rotation.y = yaw;
}
export function hidePlayer() { P.active = false; if (P.R) P.R.root.visible = false; }

export function equip(type) {
  dropWeapon();
  const def = DEFS[type]; P.weapon = type; P.wdef = def.weapon; P.wdur = def.weapon.dur || 0;
  const g = new THREE.Group(); def.build(g, {}, def.size); g.rotation.x = 0; g.position.set(0, 0, def.size[2] * .36); const holder = new THREE.Group(); holder.add(g); P.R.handR.add(holder); P.wmesh = holder;
  sfx('up', .6); fx.text(headPos(.5), def.weapon.n + ' 장착!', 'note');
}
export function dropWeapon(broke) {
  if (!P.weapon) return; P.R.handR.remove(P.wmesh);
  const p = P.body.position;
  if (!broke) spawn(P.weapon, p.x + Math.sin(P.yaw) * .5, .6, p.z + Math.cos(P.yaw) * .5, { ry: rand(6.28) });
  P.weapon = null; P.wdef = null; P.wmesh = null;
}
const headPos = (dy = 0) => ({ x: P.body.position.x, y: P.body.position.y + 1.8 + dy, z: P.body.position.z });
const fwd = () => ({ x: Math.sin(P.yaw), z: Math.cos(P.yaw) });
const aim = () => ({ x: -Math.sin(CAM.yaw), z: -Math.cos(CAM.yaw) });

export function carry(p) { P.carry = p; p.held = true; p.body.collisionResponse = false; p.body.wakeUp(); sfx('jump', .5); }
export function throwCarry(soft) {
  const p = P.carry; if (!p) return; P.carry = null; p.held = false;
  const a = soft ? fwd() : aim(), b = p.body, pp = P.body.position, k = (P.ch.thr || 1) * clamp(4 / Math.sqrt(b.mass), .55, 1.25);
  if (!soft) P.yaw = Math.atan2(a.x, a.z);
  b.collisionResponse = true; b.position.set(pp.x + a.x * .75, pp.y + (soft ? 1.0 : 1.75), pp.z + a.z * .75); b.wakeUp();
  if (soft) b.velocity.set(a.x * 1.5, 0, a.z * 1.5);
  else { const up = Math.max(.12, .5 - CAM.pitch) * 9; b.velocity.set(a.x * 15 * k, up * k + 1.5, a.z * 15 * k); b.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); p.thrownT = G.tick; sfx('whoosh'); P.atk = { type: 'swing', t: .35, dur: .25, hit: true }; }
}
export function flipProp(p) {
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
    if (p.dead || p.kind !== 'obj' || p.fixed || p.held) continue; const def = p.def;
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
  const sp = P.ch.sp, pp = P.body.position, pos = { x: pp.x, y: .3, z: pp.z };
  G.rage = 0; G.hitstop = 110; G.flash = 6; sfx('special'); fx.text(headPos(.4), sp.name + '!', 'word big'); buzz([40, 30, 80]);
  if (sp.type === 'quake') { for (let i = 0; i < sp.n; i++) later(3 + i * 26, () => { const q = P.body.position; explode({ x: q.x, y: .2, z: q.z }, 7.5, sp.dmg, 9); fx.cloud({ x: q.x, y: .3, z: q.z }, 10, '#b9b2a2', 1.2, 1.5); sfx('boom'); }); if (sp.slow) later(5, () => slow(.3, 100)); }
  else if (sp.type === 'rush') P.rush = 480;
  else if (sp.type === 'storm') P.storm = 210;
  else if (sp.type === 'line') for (let i = 0; i < 9; i++) later(3 + i * 5, () => { const q = P.body.position, a = aim(); P.yaw = Math.atan2(a.x, a.z); const b = spawn('ball', q.x + a.x * .7 + rand(-.3, .3), 1.1 + rand(-.3, .4), q.z + a.z * .7 + rand(-.3, .3), { mass: 4, life: 240, v: { x: a.x * 30, y: 1, z: a.z * 30 } }); b.thrownT = G.tick; explode({ x: q.x + a.x * 2.2, y: 1, z: q.z + a.z * 2.2 }, 1.6, 30, 10); sfx('plastic', .7); });
  else if (sp.type === 'rain') for (let i = 0; i < 11; i++) later(6 + i * 7, () => { const q = P.body.position, c = { x: clamp(q.x + rand(-6, 6), -13, 13), y: .4, z: clamp(q.z + rand(-6, 6), -8, 8) }; fx.sheet({ x: c.x, y: 2.4, z: c.z }, 6, '#ffffff', 2); explode(c, 3, 55, 9); fx.cloud(c, 6, '#ffffff', 1, .6); sfx('boom', .7); });
  void pos;
}

const rayFrom = new CANNON.Vec3(), rayTo = new CANNON.Vec3(), rayRes = new CANNON.RaycastResult();
export function updatePlayer(dt) {
  if (!P.active) return;
  const b = P.body, ch = P.ch, v = b.velocity, pp = b.position; P.t++;
  CAM.yaw -= I.lookX; CAM.pitch = clamp(CAM.pitch + I.lookY, -.2, 1.15); I.lookX = I.lookY = 0;
  rayFrom.set(pp.x, pp.y + .35, pp.z); rayTo.set(pp.x, pp.y - .14, pp.z); rayRes.reset();
  PH.world.raycastClosest(rayFrom, rayTo, { collisionFilterMask: GR.STATIC | GR.PROP, skipBackfaces: true }, rayRes);
  const onG = P.onG = rayRes.hasHit && v.y < 2.5;
  const locked = P.lock > 0; if (locked) P.lock--;
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
  // E: 임무 → 던지기 → 집기/장착/엎기
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
  if (P.carry) { const c = P.carry; if (c.dead) P.carry = null; else { const cb = c.body; cb.position.set(pp.x, pp.y + 1.78 + c.size[1] / 2, pp.z); cb.velocity.set(0, 0, 0); cb.angularVelocity.set(0, 0, 0); cb.quaternion.setFromEuler(0, P.yaw, 0); } }
  if (P.rush > 0) { P.rush--; if (G.tick % 3 === 0) fx.bitsAt({ x: pp.x, y: .1, z: pp.z }, 2, '#f2b705', 1, 1); }
  if (P.storm > 0) { P.storm--; if (P.storm % 8 === 0) { fx.sheet({ x: pp.x + rand(-2, 2), y: 1.2, z: pp.z + rand(-2, 2) }, 8, '#ffffff', 5); const h = attack({ x: pp.x, y: 1, z: pp.z }, 4.6, 10, { x: 3, y: 2.5, z: 3 }, { max: 14, radial: true, tall: 1 }); addCombo(Math.min(3, h.length)); sfx('paper', .4); } }
  const hs = Math.hypot(v.x, v.z); P.speed = lerp(P.speed, clamp(hs / 5.5, 0, 1.2), .25); if (onG && hs > .4) { P.walk += hs * dt * 2.6; if (Math.sin(P.walk) * Math.sin(P.walk - hs * dt * 2.6) < 0) sfx('step', .25); }
  if (pp.y < -2) { b.position.set(0, .5, 5); v.set(0, 0, 0); }
  P.pj = I.jump; P.pa = I.a; P.pb = I.b; P.pc = I.c; P.pe = I.e;
}

// 그릴 때마다: 모형 자세와 카메라
const tgt = new THREE.Vector3(), des = new THREE.Vector3(), dirv = new THREE.Vector3(), ray = new THREE.Raycaster();
export function renderPlayer() {
  if (P.active) {
    const pp = P.body.position, R = P.R;
    R.root.position.set(pp.x, pp.y, pp.z); R.root.rotation.y = P.yaw;
    poseRig(R, { walk: P.walk, speed: P.onG ? P.speed : 0, air: !P.onG && P.air > 5, slam: P.slam, carry: !!P.carry, atk: P.atk, t: P.t });
    if (P.wmesh) P.wmesh.rotation.x = 0;
  }
  const cam = X.camera;
  if (CAM.mode === 'follow' && P.active) {
    const pp = P.body.position, cy = Math.cos(CAM.pitch), sx = Math.cos(CAM.yaw) * .42, sz = -Math.sin(CAM.yaw) * .42;
    tgt.set(pp.x + sx, pp.y + 1.5, pp.z + sz);
    dirv.set(Math.sin(CAM.yaw) * cy, Math.sin(CAM.pitch), Math.cos(CAM.yaw) * cy);
    let dist = CAM.dist;
    ray.set(tgt, dirv); ray.far = dist + .3; const hit = ray.intersectObjects(G.camBlock, false)[0]; if (hit) dist = Math.max(.9, hit.distance - .3);
    des.copy(tgt).addScaledVector(dirv, dist);
    if (G.scene === 'office') des.y = Math.min(des.y, 2.86);
    cam.position.lerp(des, .5); cam.lookAt(tgt);
  } else if (CAM.mode === 'orbit') {
    CAM.t += .004; const c = CAM.center || { x: 0, y: 1.2, z: 0 }, r = CAM.r || 9, ang = (CAM.base || 0) + Math.sin(CAM.t) * (CAM.sway || 0);
    cam.position.set(c.x + Math.sin(ang) * r, CAM.h || 2.5, c.z + Math.cos(ang) * r); cam.lookAt(c.x, c.y, c.z);
  } else if (CAM.mode === 'fixed') { cam.position.lerp(CAM.pos, .08); cam.lookAt(CAM.look.x, CAM.look.y, CAM.look.z); }
  if (G.shake > 0 && !G.calm) { cam.position.x += (Math.random() - .5) * G.shake; cam.position.y += (Math.random() - .5) * G.shake; cam.position.z += (Math.random() - .5) * G.shake * .6; }
}
