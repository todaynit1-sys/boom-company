import * as CANNON from 'cannon-es';
import { THREE, X, bx, newLevel, screenMat } from './gfx.js';
import { G, rand, pick, clamp, won } from './state.js';
import { DEFS, MATS } from './data/props.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
export { CANNON };

export const PH = { world: null };
export const GR = { STATIC: 1, PROP: 2, FRAG: 4, PLAYER: 8, PWALL: 16, FORK: 32 };
const DT = 1 / 60;
let impacts = [], fragN = 0;

export function resetWorld() {
  const w = PH.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
  w.broadphase = new CANNON.SAPBroadphase(w); w.allowSleep = true; w.solver.iterations = 8;
  PH.matD = new CANNON.Material('d'); PH.matP = new CANNON.Material('p');
  w.addContactMaterial(new CANNON.ContactMaterial(PH.matD, PH.matD, { friction: .5, restitution: .12 }));
  w.addContactMaterial(new CANNON.ContactMaterial(PH.matP, PH.matD, { friction: 0, restitution: 0 }));
  Object.assign(G, { props: [], removeQ: [], timers: [], camBlock: [], hitstop: 0, timeScale: 1, slowUntil: 0, shake: 0, mult: 1, onTick: null, onBreak: null, onHit: null, onOut: null });
  impacts = []; fragN = 0; G.settle = G.tick + 80;
  fx.clearFx();
  return newLevel();
}
// 부서지지 않는 고정 상자(벽·바닥). mat을 주면 그림도 만든다.
export function solid(x, y, z, w, h, d, mat, o = {}) {
  const b = new CANNON.Body({ mass: 0, material: PH.matD, collisionFilterGroup: o.group || GR.STATIC, collisionFilterMask: o.mask ?? (GR.PROP | GR.FRAG | GR.PLAYER) });
  b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2))); b.position.set(x, y, z); PH.world.addBody(b);
  if (mat) { const m = bx(X.level, w, h, d, mat, x, y, z); if (o.noShadow) m.castShadow = false; if (o.block !== false) G.camBlock.push(m); return m; }
  return b;
}
export function later(ticks, fn) { G.timers.push({ t: G.tick + ticks, fn }); }
export function slow(scale, realTicks) { G.timeScale = scale; G.slowUntil = G.real + realTicks; }

export function spawn(type, x, y, z, o = {}) {
  const def = DEFS[type], size = o.size || def.size, kind = def.kind || 'obj', fixed = !!(o.fixed || def.fixedOnly);
  const g = new THREE.Group(); def.build(g, o, size); X.level.add(g);
  const body = new CANNON.Body({
    mass: fixed ? 0 : (o.mass || def.mass), material: PH.matD, allowSleep: true, sleepSpeedLimit: .3, sleepTimeLimit: .5, linearDamping: .06, angularDamping: .2,
    collisionFilterGroup: kind === 'frag' ? GR.FRAG : GR.PROP, collisionFilterMask: kind === 'frag' ? (GR.STATIC | GR.PROP | GR.FORK) : (GR.STATIC | GR.PROP | GR.FRAG | GR.PLAYER | GR.FORK),
  });
  // 자동차·지게차처럼 모양이 여러 개인 물건은 def.shapes가 직접 붙인다
  if (def.shapes) def.shapes(body, size, CANNON); else body.addShape(def.sphere ? new CANNON.Sphere(size[0] / 2) : new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)));
  body.position.set(x, y, z); if (o.ry) body.quaternion.setFromEuler(0, o.ry, 0);
  const p = Object.assign({}, o, { type, def, kind, g, body, size, opt: o, mat: o.mat || def.mat, hp: kind === 'frag' ? null : (o.hp ?? def.hp), price: o.price ?? def.price ?? 0, fixed, punch: 0, dead: false, born: G.tick });
  p.maxHp = p.hp; body.p = p;
  if (kind !== 'frag') body.addEventListener('collide', onCollide);
  if (o.v) body.velocity.set(o.v.x, o.v.y, o.v.z);
  if (o.av) body.angularVelocity.set(o.av.x, o.av.y, o.av.z);
  PH.world.addBody(body); G.props.push(p); sync(p);
  return p;
}
function sync(p) { p.g.position.copy(p.body.position); p.g.quaternion.copy(p.body.quaternion); }
export function kill(p) { if (p.dead) return; p.dead = true; G.removeQ.push(p); }
export function release(p) { if (!p.fixed || p.def.fixedOnly) return; p.fixed = false; const b = p.body; b.type = CANNON.Body.DYNAMIC; b.mass = p.def.mass; b.updateMassProperties(); b.wakeUp(); }
export function setScreen(p, kind) { const s = p && p.g.userData.screen; if (s) s.material = screenMat(kind); if (p) p.screen = kind; }

function onCollide(e) {
  const p = e.target.p; if (!p || p.dead || p.hp == null || G.tick < G.settle || G.tick - p.born < 20) return;
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v < 3.5) return;
  const ob = e.body, q = ob.p;
  let k = 1;
  if (ob.isPlayer) k = .35; else if (q) { if (q.kind === 'frag') k = .25; else k = MATS[q.mat].hard * clamp(Math.sqrt(ob.mass / Math.max(.5, p.body.mass)), .35, 2.2); }
  if ((p.thrownT && G.tick - p.thrownT < 150) || (q && q.thrownT && G.tick - q.thrownT < 150)) k *= 1.7;
  impacts.push({ p, dmg: (v - 3.5) * 7 * MATS[p.mat].weak * k, v, q });
}

export function comboMult() { return G.combo >= 80 ? 2 : G.combo >= 40 ? 1.5 : G.combo >= 15 ? 1.2 : 1; }
export function addCombo(n) {
  const b = comboMult(), b10 = G.combo / 10 | 0; G.combo += n; G.comboT = 110; G.maxCombo = Math.max(G.maxCombo, G.combo);
  if ((G.combo / 10 | 0) > b10) sfx('combo', 1, Math.min(8, G.combo / 10 | 0));
  if (comboMult() > b) G.flash = 4;
}
export function shove(p, ix, iy, iz, spin = 1) {
  const b = p.body; if (b.mass <= 0) return; b.wakeUp();
  const k = clamp(2.6 / Math.sqrt(b.mass), .18, 2.2);
  b.velocity.x += ix * k; b.velocity.y += iy * k; b.velocity.z += iz * k;
  b.angularVelocity.x += rand(-3, 3) * k * spin; b.angularVelocity.y += rand(-3, 3) * k * spin; b.angularVelocity.z += rand(-3, 3) * k * spin;
}
const cp = new CANNON.Vec3();
export function distTo(p, c, tall = 0) { const b = p.body; if (b.aabbNeedsUpdate) b.updateAABB(); const a = b.aabb; cp.set(clamp(c.x, a.lowerBound.x, a.upperBound.x), clamp(c.y, a.lowerBound.y, a.upperBound.y), clamp(c.z, a.lowerBound.z, a.upperBound.z)); return Math.hypot(c.x - cp.x, Math.max(0, Math.abs(c.y - cp.y) - tall), c.z - cp.z); }

// 반경 안 물건에 피해·밀기. 맞힌 물건 목록을 돌려준다.
export function attack(c, r, dmg, imp, opt = {}) {
  const list = [];
  for (const p of G.props) {
    if (p.dead || p === opt.skip || p.held) continue; const d = distTo(p, c, opt.tall || 0); if (d > r) continue;
    if (p.hp == null) { shove(p, imp.x * .6, imp.y * .6 + 1, imp.z * .6); continue; }
    list.push([d, p, cp.x, cp.y, cp.z]);
  }
  list.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [d, p, x, y, z] of list.slice(0, opt.max || 5)) {
    const k = 1 - d / r * .5;
    if (opt.radial) { const bp = p.body.position, dx = bp.x - c.x, dz = bp.z - c.z, l = Math.hypot(dx, dz) || 1; shove(p, dx / l * imp.x, imp.y, dz / l * imp.x); } else shove(p, imp.x, imp.y, imp.z);
    const pt = { x, y, z }; out.push(p);
    if (out.length === 1) fx.bitsAt(pt, opt.heavy ? 14 : 7, MATS[p.mat].bit, opt.heavy ? 4 : 2.5);
    damage(p, dmg * k, pt, opt.heavy, true);
  }
  return out;
}

export function damage(p, dmg, pt, heavy, byPlayer) {
  if (p.dead || p.hp == null) return;
  if (G.timeScale < 1) dmg *= 2;
  if (p.armor != null && !(p.armorOff)) dmg *= p.armor;
  p.hp -= dmg; p.punch = 7; p.body.wakeUp();
  G.onHit && G.onHit(p, dmg, heavy, byPlayer);
  if (p.dead) return;
  // 맞을 때마다 단계가 바뀌는 물건(자동차 유리·문짝, 비상벨)
  if (p.def.onDamage) { p.def.onDamage(p, dmg, heavy); if (p.dead) return; }
  if (p.hp <= 0) return breakProp(p);
  if (p.fixed && p.def.wall && p.hp / p.maxHp <= .5) release(p);
  if (dmg > 2) sfx(heavy ? MATS[p.mat].snd : 'punch', heavy ? .5 : .7);
}

export function breakProp(p) {
  if (p.dead) return; p.dead = true; G.removeQ.push(p);
  const bp = p.body.position, m = MATS[p.mat], big = p.price >= 300000, pos = { x: bp.x, y: bp.y + p.size[1] / 2 + .15, z: bp.z };
  const gain = p.price * comboMult() * G.mult;
  G.money += gain; G.rage = Math.min(100, G.rage + 5); addCombo(1);
  if (gain > 0) { const c = G.counts[p.type] || (G.counts[p.type] = { n: 0, sum: 0, name: p.def.n }); c.n++; c.sum += gain; }
  fx.text(pos, pick(m.words), 'word' + (big ? ' big' : ''));
  if (gain > 0) fx.text({ x: pos.x, y: pos.y + .35, z: pos.z }, '+' + won(gain), 'money');
  sfx(m.snd, big ? 1 : .7); if (p.size[0] * p.size[1] * p.size[2] > .3) sfx('boom', .6);
  G.shake = Math.max(G.shake, big ? .22 : .08); if (big) G.hitstop = Math.max(G.hitstop, 60); buzz(30);
  fx.bitsAt(bp, big ? 26 : 12, m.bit, 4.5, 3);
  frags(p); spill(p);
  G.onBreak && G.onBreak(p);
}

// 다 떨어진 조각은 사라지지 않고 바닥의 잔해(물리 없음)로 굳는다
const white = new THREE.Color('#ffffff');
function toDebris(p) {
  const mesh = p.g.children[0], m = mesh && mesh.material, c = new THREE.Color();
  if (m && !m.map) c.copy(m.color); else c.set(MATS[p.mat].bit);
  if (m && m.transparent) c.lerp(white, .35);
  fx.debris(p, c);
}
export function settleFrags() { for (const p of G.props) if (p.type === 'frag' && !p.dead) { toDebris(p); kill(p); } flush(); }
export function flush() {
  if (!G.removeQ.length) return;
  for (const p of G.removeQ) { PH.world.removeBody(p.body); X.level.remove(p.g); if (p.type === 'frag' && !p.counted) fragN--; }
  G.removeQ = []; G.props = G.props.filter(p => !p.dead);
}
const lv = new CANNON.Vec3(), wv = new CANNON.Vec3();
function frags(p) {
  const fm = p.fm || p.def.fm;
  let n = p.def.frag ?? 6; if (!n || !fm || !fm.length) return; if (G.mobile) n = Math.ceil(n * .6);
  const [w, h, d] = p.size, cell = Math.cbrt(w * h * d / n), nx = clamp(Math.round(w / cell), 1, 5), ny = clamp(Math.round(h / cell), 1, 5), nz = clamp(Math.round(d / cell), 1, 5);
  const b = p.body, cap = G.mobile ? 60 : 120;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    if (fragN >= cap) { const old = G.props.find(q => q.type === 'frag' && !q.dead); if (old) { toDebris(old); kill(old); fragN--; old.counted = true; } }
    const sw = w / nx, sh = h / ny, sd = d / nz, size = [Math.max(.03, sw * rand(.55, .95)), Math.max(.03, sh * rand(.55, .95)), Math.max(.03, sd * rand(.55, .95))];
    lv.set(-w / 2 + (i + .5) * sw, -h / 2 + (j + .5) * sh, -d / 2 + (k + .5) * sd); b.quaternion.vmult(lv, wv);
    const l = Math.hypot(wv.x, wv.y, wv.z) || 1, sp = rand(1.5, 5);
    const f = spawn('frag', b.position.x + wv.x, b.position.y + wv.y, b.position.z + wv.z, { size, mass: clamp(size[0] * size[1] * size[2] * 600, .1, 8), mat: p.mat, life: rand(360, 520) | 0, v: { x: b.velocity.x * .6 + wv.x / l * sp + rand(-1, 1), y: b.velocity.y * .6 + wv.y / l * sp + rand(1, 4), z: b.velocity.z * .6 + wv.z / l * sp + rand(-1, 1) }, av: { x: rand(-8, 8), y: rand(-8, 8), z: rand(-8, 8) } });
    const mesh = bx(f.g, size[0], size[1], size[2], pick(fm)); mesh.castShadow = false; f.body.quaternion.copy(b.quaternion); fragN++;
  }
}
const CMYK = ['#1aa7c7', '#d6338a', '#e8c41c', '#222222'];
function spill(p) {
  const b = p.body.position, pos = { x: b.x, y: b.y, z: b.z };
  for (const [k, n, a, c] of p.def.spill || []) {
    if (k === 'sheets') fx.sheet(pos, n, '#ffffff', 3.2);
    else if (k === 'bills') fx.sheet(pos, n, '#9fd69a', 4.5);
    else if (k === 'keys') fx.bitsAt(pos, n, '#e4e1d8', 4, 3.5);
    else if (k === 'sparks') { fx.sparks(pos, n); sfx('zap'); }
    else if (k === 'smoke') fx.cloud(pos, n, '#555555', .6);
    else if (k === 'coffee') { fx.bitsAt(pos, n, '#5a3418', 3, 3); fx.stain(b.x, b.z, .25 + n * .012, '#4a2c17', .6); }
    else if (k === 'soil') { fx.bitsAt(pos, n, '#4a3524', 3, 2.5); fx.stain(b.x, b.z, .35, '#4a3524', .5); }
    else if (k === 'water') { fx.bitsAt(pos, n, '#8fd0ff', 4.5, 4); fx.stain(b.x, b.z, 1.1, '#6fb6e8', .35); sfx('water'); }
    else if (k === 'balls') for (let i = 0; i < n; i++) spawn('ball', b.x + rand(-.1, .1), b.y + rand(0, .3), b.z + rand(-.1, .1), { life: 600, v: { x: rand(-4, 4), y: rand(2, 6), z: rand(-4, 4) } });
    else if (k === 'boom') later(3, () => {
      explode(pos, n, a, 9); sfx('boom', .9);
      if (c === 'cmyk') CMYK.forEach(cc => fx.cloud(pos, 5, cc, 1.1, .6));
      else if (c === 'fire') { fx.cloud(pos, 10, '#ff7a1a', 1.3, .7); fx.cloud(pos, 8, '#2a2522', 1.8, .9); fx.sparks(pos, 30); G.flash = Math.max(G.flash, 4); }
      else fx.cloud(pos, 16, c, 1.2, .7);
      fx.stain(b.x, b.z, n * .35, c === 'cmyk' || c === 'fire' ? '#222222' : '#ffffff', .45);
    });
    // 자동차가 끝내 터질 때
    else if (k === 'carboom') later(4, () => { explode(pos, 6, 70, 13); fx.cloud(pos, 14, '#ff7a1a', 1.8, 1.2); fx.cloud(pos, 12, '#26221f', 2.4, 1.4); fx.sparks(pos, 40); fx.stain(b.x, b.z, 2.4, '#1a1a1a', .55); sfx('boom'); later(8, () => sfx('boom', .8)); G.shake = Math.max(G.shake, .6); G.flash = 6; buzz([60, 40, 120]); });
    else if (k === 'fish') { fx.bitsAt(pos, n, '#ff8a1f', 3.5, 4); fx.text({ x: pos.x, y: pos.y + .6, z: pos.z }, '파닥파닥', 'note'); }
    else if (k === 'books') { fx.bitsAt(pos, n, '#7a2030', 3, 3); fx.bitsAt(pos, n, '#1f3f6b', 3, 3); fx.sheet(pos, n >> 1, '#fbfaf5', 2.5); }
    else if (k === 'cream') { fx.bitsAt(pos, n, '#fff3df', 3.5, 3); fx.bitsAt(pos, n >> 1, '#e0303f', 3, 3); fx.stain(b.x, b.z, .6, '#f3e2c6', .6); }
    else if (k === 'cans') { for (const cc of ['#c9281f', '#2f6bff', '#ffd84d', '#2a8a45']) fx.bitsAt(pos, n >> 2, cc, 4, 4); }
    else if (k === 'coins') fx.bitsAt(pos, n, '#e3b23c', 3.5, 4);
    else if (k === 'cups') { fx.bitsAt(pos, n, '#ffffff', 4, 4); fx.bitsAt(pos, n, '#cfe9ff', 3, 3); }
  }
}
export function explode(c, r, dmg, push) {
  for (const p of G.props.slice()) {
    if (p.dead || p.held) continue; const bp = p.body.position, dx = bp.x - c.x, dy = bp.y - c.y, dz = bp.z - c.z, d = Math.hypot(dx, dy, dz); if (d > r) continue;
    const k = 1 - d / r * .6, l = d || 1; shove(p, dx / l * push * k, (dy / l + .7) * push * k, dz / l * push * k);
    if (dmg && p.hp != null) damage(p, dmg * k, bp, true);
  }
  G.shake = Math.max(G.shake, .3);
}

export function tick() {
  G.real++;
  if (G.timeScale < 1 && G.real >= G.slowUntil) G.timeScale = 1;
  if (G.flash > 0) G.flash--;
  if (G.hitstop > 0) { G.hitstop -= 16.7; return; }
  G.tick++;
  const dt = DT * G.timeScale;
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].t <= G.tick) { const t = G.timers.splice(i, 1)[0]; t.fn(); }
  G.onTick && G.onTick(dt);
  if (!PH.world) return;
  for (const p of G.props) if (p.thrownT && G.tick - p.thrownT < 150) { const v = p.body.velocity; (p.pv || (p.pv = {})).x = v.x; p.pv.y = v.y; p.pv.z = v.z; }
  PH.world.step(dt);
  const im = impacts; impacts = [];
  for (const m of im) {
    const p = m.p; if (p.dead) continue; damage(p, m.dmg, p.body.position, true); if (m.v > 6) sfx(MATS[p.mat].snd, Math.min(.6, m.v / 20));
    // 유리는 던진 물건을 막지 않는다: 깨졌으면 부딪히기 전 속도를 돌려준다
    if (p.dead && p.fixed && p.mat === 'glass' && m.q && !m.q.dead && m.q.pv) m.q.body.velocity.set(m.q.pv.x * .85, m.q.pv.y * .85, m.q.pv.z * .85);
  }
  for (const p of G.props) {
    if (p.dead) continue; const b = p.body;
    if (b.sleepState !== 2 || p.punch > 0 || p.held) {
      sync(p);
      const v = b.velocity, sp = v.length(); if (sp > 32) v.scale(32 / sp, v);
    }
    if (p.punch > 0) { p.punch--; const s = 1 + p.punch * .012; p.g.scale.set(s, s, s); }
    if (p.life != null && --p.life <= 0) {
      if (p.type === 'frag') { if (b.velocity.lengthSquared() > .2 && (p.ext = (p.ext || 0) + 1) < 4) p.life = 60; else { toDebris(p); kill(p); } }
      else kill(p);
    } else if (p.life != null && p.life < 30 && p.type !== 'frag') { const s = p.life / 30; p.g.scale.set(s, s, s); }
    if (p.hp != null && p.def.elec && p.hp / p.maxHp < .5 && G.tick % 14 === 0) { fx.cloud({ x: b.position.x, y: b.position.y + p.size[1] / 2, z: b.position.z }, 1, '#444444', .35, .1); if (p.hp / p.maxHp < .25 && G.tick % 28 === 0) fx.sparks(b.position, 4); }
    const bp = b.position, inCab = G.elev && Math.abs(bp.x - G.elev.x) < .9 && bp.z < 10.9 && bp.y > -1, oz = G.outZone;
    if (!p.fixed && !p.held && oz && !inCab && (bp.z < oz.z0 || bp.x < -oz.x || bp.x > oz.x || bp.z > oz.z1 || bp.y < -3)) {
      if (!p.out && p.kind === 'obj') {
        p.out = true; const gain = Math.max(p.price, 20000) * (oz.k || 2) * G.mult; G.money += gain; addCombo(2);
        const c = G.counts.out || (G.counts.out = { n: 0, sum: 0, name: '창밖으로 던진 물건' }); c.n++; c.sum += gain;
        fx.text({ x: clamp(bp.x, -13, 13), y: 2.2, z: clamp(bp.z, -8.6, 8.6) }, oz.label + ' +' + won(gain), 'money'); sfx('up', .6); G.onOut && G.onOut(p);
      }
      if (bp.y < -6) kill(p);
    } else if (bp.y < -30) kill(p);
  }
  flush();
  fx.update(dt);
  if (G.comboT > 0 && --G.comboT === 0) G.combo = 0;
  G.shake *= .86; if (G.shake < .004) G.shake = 0;
}
