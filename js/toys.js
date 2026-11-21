// 놀거리: 바퀴의자·택배 카트·지게차 타기, 소화기 뿜으며 날기, 비상벨·스프링클러, 자동차 경보와 부서지는 단계
// 자유 난동(G.toys)에서만 탈 수 있다. 소화기 뿜기는 어디서나 된다
import { G, rand, clamp, lerp, angLerp, pick } from './state.js';
import { THREE, M } from './gfx.js';
import { CANNON, PH, GR, damage, shove, spawn, addCombo, comboMult, distTo, setScreen, later } from './engine.js';
import { DEFS } from './data/props.js';
import { P, I, CAM, dropWeapon } from './player.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';

export const TOY = { alarm: 0, wet: false };
const emit = (k, n = 1) => G.emit && G.emit(k, n);
const top = p => ({ x: p.body.position.x, y: p.body.position.y + p.size[1] / 2 + .3, z: p.body.position.z });
const headPos = (dy = 0) => ({ x: P.body.position.x, y: P.body.position.y + 1.85 + dy, z: P.body.position.z });
export const yawOf = q => Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y));
const won = g => '+' + Math.round(g).toLocaleString('ko-KR') + '원';
// 부서지지 않아도 값이 매겨지는 순간(차 유리·문짝, 차 들어 올리기)
function bonus(key, name, amount, pos) {
  const g = amount * comboMult() * G.mult; G.money += g; addCombo(1);
  const c = G.counts[key] || (G.counts[key] = { n: 0, sum: 0, name }); c.n++; c.sum += g;
  fx.text({ x: pos.x, y: pos.y + .35, z: pos.z }, won(g), 'money');
}

// ───── 타기
export function mount(p) {
  if (!G.toys || P.ride || !p || p.dead || !p.def.ride) return false;
  const b = p.body; b.wakeUp();
  P.ride = { p, kind: p.def.ride, vx: 0, vz: 0, spd: 0, yaw: yawOf(b.quaternion), cd: 0, hit: new Map(), mat: b.material };
  b.material = PH.matP; P.seated = null; P.atk = null; P.slam = false;
  P.body.collisionFilterMask = GR.STATIC | GR.PWALL;
  sfx('jump', .6); fx.text(headPos(.4), p.def.ride === 'fork' ? '시동!' : '출발!', 'note');
  emit('ride:' + p.def.ride);
  return true;
}
export function unmount(hop) {
  const R = P.ride; if (!R) return; P.ride = null;
  const p = R.p, b = p.body, pp = P.body.position, s = Math.sin(R.yaw), c = Math.cos(R.yaw);
  if (!p.dead) { b.material = R.mat; b.velocity.x *= .5; b.velocity.z *= .5; }
  if (R.kind === 'fork') { pp.x = b.position.x - c * 1.1; pp.z = b.position.z + s * 1.1; pp.y = .05; }
  else if (R.kind === 'chair') { pp.x += s * .35; pp.z += c * .35; }
  P.body.velocity.set(0, hop ? 4.5 : 0, 0);
  P.ghost = 30; P.body.collisionFilterMask = GR.STATIC | GR.PWALL; P.atk = null;
  sfx('step', .6);
}
export function updateRide(dt, locked) {
  const R = P.ride, p = R.p, b = p.body, pp = P.body.position, v = P.body.velocity;
  if (p.dead || !G.toys) { unmount(); return; }
  const ePress = I.e && !P.pe, jPress = I.jump && !P.pj, aPress = I.a && !P.pa;
  if (!locked && (ePress || jPress)) { unmount(jPress); return; }
  b.wakeUp();
  // 벽에 막혀 실제로 줄어든 속도를 반영한다
  R.vx = lerp(R.vx, b.velocity.x, .5); R.vz = lerp(R.vz, b.velocity.z, .5);
  if (R.kind === 'fork') drive(dt, R, b, locked); else roll(R, b, locked, aPress);
  b.quaternion.setFromEuler(0, R.yaw, 0); b.angularVelocity.set(0, 0, 0);
  ram(R, b);
  const s = Math.sin(R.yaw), c = Math.cos(R.yaw);
  if (R.kind === 'chair') { pp.x = b.position.x + s * .04; pp.z = b.position.z + c * .04; }
  else if (R.kind === 'cart') { const back = p.size[2] / 2 + .42; pp.x = b.position.x - s * back; pp.z = b.position.z - c * back; }
  else { pp.x = b.position.x - s * .32; pp.z = b.position.z - c * .32; pp.y = b.position.y - p.size[1] / 2 + .3; }
  v.set(0, R.kind === 'fork' ? 0 : Math.min(0, v.y), 0);
  P.yaw = R.yaw; P.onG = true; P.air = 0;
  if (P.atk) { P.atk.t += dt / P.atk.dur; if (P.atk.t >= 1) P.atk = null; }
  const sp = Math.hypot(b.velocity.x, b.velocity.z);
  if (R.kind === 'cart') { P.speed = lerp(P.speed, clamp(sp / 5.5, 0, 1.2), .25); if (sp > .4) P.walk += sp * dt * 2.6; } else P.speed = 0;
  if (sp > 2 && G.tick % 9 === 0) sfx(R.kind === 'fork' ? 'hum' : 'roll', R.kind === 'fork' ? .5 : Math.min(1, sp / 8));
}
// 바퀴의자·카트: 화면 기준으로 밀고, 때리기 = 힘껏 차고 나가기
function roll(R, b, locked, aPress) {
  let mx = locked ? 0 : I.mx, mz = locked ? 0 : I.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  const ax = -Math.sin(CAM.yaw), az = -Math.cos(CAM.yaw), wx = ax * mz + Math.cos(CAM.yaw) * mx, wz = az * mz - Math.sin(CAM.yaw) * mx;
  const cart = R.kind === 'cart', topS = cart ? 6.5 : 7.5;
  if (l > .1) { R.vx = lerp(R.vx, wx * topS, cart ? .06 : .035); R.vz = lerp(R.vz, wz * topS, cart ? .06 : .035); }
  else { R.vx *= cart ? .95 : .988; R.vz *= cart ? .95 : .988; }
  if (--R.cd < 0 && aPress && !locked) {
    const k = cart ? 5 : 6.5; R.vx += Math.sin(R.yaw) * k; R.vz += Math.cos(R.yaw) * k; R.cd = 26;
    sfx('whoosh'); fx.bitsAt({ x: b.position.x, y: .1, z: b.position.z }, 8, '#cfcfcf', 2, 1);
    if (!cart) P.atk = { type: 'kick', t: .35, dur: .3, hit: true };
  }
  const sp = Math.hypot(R.vx, R.vz); if (sp > 12) { R.vx *= 12 / sp; R.vz *= 12 / sp; }
  if (sp > .6) R.yaw = angLerp(R.yaw, Math.atan2(R.vx, R.vz), cart ? .1 : .07);
  b.velocity.x = R.vx; b.velocity.z = R.vz;
}
// 지게차: W·S 앞뒤, A·D 방향, 때리기 = 포크 올리기, 강타 = 내리기
function drive(dt, R, b, locked) {
  const mz = locked ? 0 : I.mz, mx = locked ? 0 : I.mx, fx_ = Math.sin(R.yaw), fz = Math.cos(R.yaw);
  R.spd = lerp(R.spd, b.velocity.x * fx_ + b.velocity.z * fz, .5);
  R.spd = lerp(R.spd, mz > 0 ? mz * 5.5 : mz * 3, mz ? .03 : .07);
  const steer = Math.abs(R.spd) > .15 ? clamp(Math.abs(R.spd) / 1.2, 0, 1) * Math.sign(R.spd) : .5;
  R.yaw -= mx * 1.4 * dt * steer;
  b.velocity.x = Math.sin(R.yaw) * R.spd; b.velocity.z = Math.cos(R.yaw) * R.spd;
  const p = R.p, up = !locked && I.a, down = !locked && I.b;
  if (up || down) { p.lift = clamp((p.lift || 0) + (up ? 1 : -1) * .85 * dt, 0, 1.75); if (G.tick % 10 === 0) sfx('hum', .35); }
  if (Math.abs(R.spd) > .4) CAM.yaw = angLerp(CAM.yaw, R.yaw + Math.PI, .025);
  if (R.spd < -.3 && G.tick % 28 === 0) sfx('beep', .45);
}
// 달려서 부딪힌 물건: 밀고 깨뜨린다(같은 물건은 잠깐 쉬었다가)
function ram(R, b) {
  const vx = b.velocity.x, vz = b.velocity.z, sp = Math.hypot(vx, vz), fork = R.kind === 'fork';
  if (sp < (fork ? 1.2 : 2.8)) return;
  const f = { x: vx / sp, z: vz / sp }, p = R.p, reach = p.size[2] / 2 + (fork ? .25 : .15);
  const c = { x: b.position.x + f.x * reach, y: fork ? .7 : .45, z: b.position.z + f.z * reach }, r = fork ? .9 : .55, dk = fork ? 16 : R.kind === 'cart' ? 8 : 6;
  let hits = 0;
  for (const q of G.props) {
    if (q.dead || q === p || q.held || q.kind !== 'obj' || (R.hit.get(q) || 0) > G.tick) continue;
    if (distTo(q, c, .45) > r) continue;
    R.hit.set(q, G.tick + 24); hits++;
    shove(q, f.x * sp * (fork ? 1.4 : 1.1), 1.5 + sp * .35, f.z * sp * (fork ? 1.4 : 1.1));
    if (q.hp != null) damage(q, sp * dk, q.body.position, true, true);
  }
  if (!hits) return;
  addCombo(hits); G.rage = Math.min(100, G.rage + hits * 2); G.shake = Math.max(G.shake, fork ? .2 : .1); buzz(15);
  fx.text({ x: c.x, y: 1.4, z: c.z }, fork ? '쾅!' : pick(['쿵!', '돌진!', '비켜!']), 'word'); sfx(fork ? 'metal' : 'wood', .7);
  emit('ram', hits); emit('ram:' + R.kind, hits);
  if (!fork) { R.vx *= .7; R.vz *= .7; }
}

// ───── 지게차 포크: 보이지 않는 판이 따라다니며 물건을 들어 올린다
function forkTick(p, dt) {
  const b = p.body, [, h, d] = p.size;
  if (!p.fork) {
    const fb = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, allowSleep: false, collisionFilterGroup: GR.FORK, collisionFilterMask: GR.PROP | GR.FRAG | GR.NPC });
    fb.material = PH.matD;
    for (const sx of [-1, 1]) fb.addShape(new CANNON.Box(new CANNON.Vec3(.06, .03, .55)), new CANNON.Vec3(sx * .3, 0, 0));
    fb.addShape(new CANNON.Box(new CANNON.Vec3(.39, .22, .03)), new CANNON.Vec3(0, .24, -.54));
    PH.world.addBody(fb); p.fork = fb; p.forkNew = true; b.collisionFilterMask &= ~GR.FORK;
  }
  const yaw = yawOf(b.quaternion), s = Math.sin(yaw), c = Math.cos(yaw), lift = p.lift || 0, lz = d / 2 + .6;
  const tx = b.position.x + b.velocity.x * dt + s * lz, ty = b.position.y + b.velocity.y * dt - h / 2 + .06 + lift, tz = b.position.z + b.velocity.z * dt + c * lz, fb = p.fork;
  if (p.forkNew) { fb.position.set(tx, ty, tz); p.forkNew = false; }
  fb.velocity.set((tx - fb.position.x) / dt, (ty - fb.position.y) / dt, (tz - fb.position.z) / dt);
  fb.quaternion.setFromEuler(0, yaw, 0);
  const car = p.g.userData.carriage; if (car) car.position.y = lift;
  const bc = p.g.userData.beacon; if (bc) bc.material.emissiveIntensity = P.ride && P.ride.p === p ? (G.tick % 30 < 15 ? 1.6 : .2) : .4;
  if (lift > .3 && G.tick % 10 === 0) for (const q of G.props) if (q.type === 'car' && !q.dead && !q.lifted && q.body.position.y > q.size[1] / 2 + .3) { q.lifted = true; emit('liftcar'); fx.text(top(q), '번쩍!', 'word big'); sfx('up'); bonus('lift', '지게차로 든 차', 5000000, top(q)); }
}

// ───── 소화기: 꾹 누르면 화면이 보는 쪽으로 뿜고, 반동으로 몸이 밀린다(아래를 보면 뜬다)
export function sprayTick(dt, locked) {
  const b = P.body, v = b.velocity, pp = b.position;
  if (locked || !I.a || !(P.fuel > 0)) { P.spraying = false; return false; }
  P.spraying = true;
  const pitch = clamp(CAM.pitch - .28, -.5, 1.45), cy = Math.cos(pitch);
  const d = { x: -Math.sin(CAM.yaw) * cy, y: -Math.sin(pitch), z: -Math.cos(CAM.yaw) * cy };
  if (cy > .2) P.yaw = angLerp(P.yaw, Math.atan2(d.x, d.z), .3);
  P.fuel -= dt * 19;
  const F = 30 * dt; v.x -= d.x * F; v.y -= d.y * F; v.z -= d.z * F;
  if (v.y > 6.5) v.y = 6.5; const hs = Math.hypot(v.x, v.z); if (hs > 8.5) { v.x *= 8.5 / hs; v.z *= 8.5 / hs; }
  const n = { x: pp.x + Math.sin(P.yaw) * .4, y: pp.y + 1.1, z: pp.z + Math.cos(P.yaw) * .4 };
  fx.jet(n, d, 3, '#f4f4f2', 8, .16);
  if (G.tick % 3 === 0) fx.cloud({ x: n.x + d.x * 1.2, y: n.y + d.y * 1.2, z: n.z + d.z * 1.2 }, 1, '#ffffff', .6, .2);
  if (G.tick % 7 === 0) fx.cloud({ x: n.x + d.x * 2.6, y: n.y + d.y * 2.6, z: n.z + d.z * 2.6 }, 1, '#f0f0f0', 1.1, .4);
  if (G.tick % 6 === 0) sfx('spray', .7);
  if (G.tick % 4 === 0) for (const q of G.props) {
    if (q.dead || q.held || q.fixed || q.kind !== 'obj') continue;
    const qp = q.body.position, dx = qp.x - n.x, dy = qp.y - n.y, dz = qp.z - n.z, dist = Math.hypot(dx, dy, dz);
    if (dist > 3.6 || dist < .1 || (dx * d.x + dy * d.y + dz * d.z) / dist < .86) continue;
    shove(q, d.x * 2.4, d.y * 2.4 + .8, d.z * 2.4, .4);
    if (q.hp != null && (q.mat === 'paper' || q.def.elec)) damage(q, 3, qp, false, true);
  }
  if (d.y < -.25 && G.tick % 9 === 0) { const t = -n.y / d.y; if (t < 4.5) fx.stain(n.x + d.x * t, n.z + d.z * t, .32, '#ffffff', .5); }
  if (!P.onG) { P.flyT = (P.flyT || 0) + dt; if (P.flyT > .9 && pp.y > 1 && !P.flew) { P.flew = true; emit('fly'); fx.text(headPos(.3), '날았다!', 'word big'); sfx('up'); } }
  if (P.fuel <= 0) {
    fx.text(headPos(.3), '소화기 다 썼다', 'note'); dropWeapon(true); P.spraying = false;
    const e = spawn('extinguisher', pp.x + Math.sin(P.yaw) * .5, pp.y + 1, pp.z + Math.cos(P.yaw) * .5, { fuel: 0, hp: 6 }); e.body.velocity.set(Math.sin(P.yaw) * 2, 2, Math.cos(P.yaw) * 2);
  }
  return true;
}

// ───── 비상벨 → 스프링클러: 20초 동안 물이 쏟아지고, 전자제품은 합선된다. 바닥은 계속 미끄럽다
export function useProp(p) { if (p.def.use === 'alarm') triggerAlarm(p); }
export function triggerAlarm(p) {
  const fresh = TOY.alarm <= 0; TOY.alarm = 1200; TOY.wet = true;
  if (!fresh) return;
  emit('alarm'); sfx('bell'); G.shake = Math.max(G.shake, .1);
  if (p) fx.text(top(p), '삐용삐용!', 'word big');
  G.onAlarm && G.onAlarm(true);
}
export function stopAlarm() { if (TOY.alarm > 0) { TOY.alarm = 0; G.onAlarm && G.onAlarm(false); } M('alarmLamp').emissiveIntensity = .6; }
function alarmTick() {
  if (TOY.alarm <= 0) return;
  if (--TOY.alarm === 0) return stopAlarm();
  const t = TOY.alarm;
  if (t % 26 === 0) sfx('bell', .8);
  M('alarmLamp').emissiveIntensity = t % 20 < 10 ? 2.2 : .2;
  const H = G.ceilH || 3, heads = G.heads || [];
  if (heads.length) for (let i = 0; i < 7; i++) { const h = heads[Math.random() * heads.length | 0]; fx.drops({ x: h.x, y: H - .06, z: h.z }, 3, '#a8dcff', 1.9); }
  if (t % 30 === 0) sfx('water', .3);
  if (t % 20 === 0 && heads.length) { const h = pick(heads); fx.stain(h.x + rand(-1.3, 1.3), h.z + rand(-1.3, 1.3), rand(.9, 1.6), '#7fb6e0', .22); }
  if (t % 45 === 0) {
    const el = G.props.filter(q => !q.dead && q.hp != null && q.hp < 9000 && (q.def.elec || q.type === 'monitor'));
    for (let i = 0; i < 2 && el.length; i++) {
      const q = el.splice(Math.random() * el.length | 0, 1)[0];
      if (q.g.userData.screen) setScreen(q, 'blue');
      fx.sparks(top(q), 10); sfx('zap', .6); if (Math.random() < .35) fx.text(top(q), '합선!', 'note');
      damage(q, q.maxHp * .22, q.body.position, false, true);
    }
  }
}
DEFS.alarm.onDamage = p => { p.hp = p.maxHp; triggerAlarm(p); };

// ───── 자동차: 맞으면 경보가 울리고, 유리 → 문짝 → 보닛 순서로 떨어져 나간다
const CARK = { glass: .78, door: .52, hood: .28 };
function flyPart(p, m, type, side) {
  const wp = new THREE.Vector3(); m.updateWorldMatrix(true, false); m.getWorldPosition(wp);
  const yaw = yawOf(p.body.quaternion), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  // 차체 상자 바깥에서 생겨나야 튕겨 나가며 바로 부서지지 않는다
  spawn(type, wp.x + rx * side * .28, wp.y + (side ? .05 : .55), wp.z + rz * side * .28, { col: p.col, ry: yaw, v: { x: rx * side * 4 + rand(-1, 1), y: side ? 3 : 7.5, z: rz * side * 4 + rand(-1, 1) }, av: { x: rand(-4, 4), y: rand(-4, 4), z: rand(-4, 4) } });
}
function carStage(p, silent) {
  const u = p.g.userData, k = p.hp / p.maxHp, pos = top(p);
  if (k < CARK.glass && !u.glassGone) {
    u.glassGone = true; u.glass.forEach(m => { m.visible = false; });
    if (!silent) { fx.bitsAt(pos, 46, '#cfeaf5', 4.5, 3.5); sfx('glass'); fx.text(pos, '와장창!', 'word big'); bonus('carglass', '자동차 유리', 3000000, pos); emit('carglass'); if (p.tag) emit('carglass:' + p.tag); }
  }
  if (k < CARK.door && !u.doorsGone) {
    u.doorsGone = true; u.doors.forEach(dr => { dr.m.visible = false; if (!silent) flyPart(p, dr.m, 'cardoor', dr.s); });
    if (!silent) { sfx('metal'); fx.text(pos, '문짝 떨어졌다!', 'word'); emit('cardoor'); }
  }
  if (k < CARK.hood && !u.hoodGone) { u.hoodGone = true; u.hood.visible = false; p.smoke = true; if (!silent) { flyPart(p, u.hood, 'hood', 0); sfx('boom', .5); } }
}
DEFS.car.onDamage = p => { if (!p.alarmT) sfx('caralarm'); p.alarmT = 420; carStage(p, false); };
DEFS.car.onRestore = p => carStage(p, true);
function carTick(p) {
  const u = p.g.userData;
  if (p.alarmT > 0) {
    p.alarmT--; if (p.alarmT % 26 === 0) sfx('caralarm', .45);
    const on = p.alarmT > 0 && G.tick % 20 < 10; u.hl.emissiveIntensity = on ? 2.6 : .25; u.tl.emissiveIntensity = on ? 2 : .3;
    if (p.alarmT === 0) { u.hl.emissiveIntensity = 1.2; u.tl.emissiveIntensity = .9; }
  }
  if (p.smoke && G.tick % 12 === 0) { const b = p.body.position, yaw = yawOf(p.body.quaternion), f = p.size[2] * .36; fx.cloud({ x: b.x + Math.sin(yaw) * f, y: b.y + .4, z: b.z + Math.cos(yaw) * f }, 1, '#5a5a5a', .7, .15); }
}

// ───── 확성기: 누를 때마다 직장인 한 맺힌 외침. 앞쪽 물건이 밀려나고 유리·종이는 깨진다
const SHOUTS = ['부장님 미워!!', '월요일 싫어!!', '퇴근하고 싶다!!', '연봉 올려 줘!!', '주말 출근 안 해!!', '회식 싫어!!', '내 휴가 돌려줘!!', '보고서 그만!!', '칼퇴 만세!!', '단톡방 나갈래!!'];
export function shout() {
  const pp = P.body.position, f = { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }, head = { x: pp.x + f.x * .5, y: pp.y + 1.6, z: pp.z + f.z * .5 };
  fx.text({ x: head.x + f.x * 1.3, y: head.y + .35, z: head.z + f.z * 1.3 }, pick(SHOUTS), 'word big');
  sfx('shout'); later(14, () => sfx('shout', .45)); later(28, () => sfx('shout', .2));
  G.shake = Math.max(G.shake, .25); buzz(40); P.shouts = (P.shouts || 0) + 1; emit('shout');
  P.atk = { type: 'swing', t: .3, dur: .35, hit: true };
  for (let i = 1; i <= 3; i++) fx.cloud({ x: head.x + f.x * i * 1.3, y: head.y, z: head.z + f.z * i * 1.3 }, 1, '#fff6c0', .5 + i * .25, .05);
  let n = 0;
  for (const q of G.props) {
    if (q.dead || q.held || q.kind !== 'obj') continue;
    const qp = q.body.position, dx = qp.x - pp.x, dz = qp.z - pp.z, d = Math.hypot(dx, dz);
    if (d > 6 || d < .2 || (dx * f.x + dz * f.z) / d < .7) continue;
    const k = 1 - d / 6; if (!q.fixed) shove(q, f.x * 7 * k, 3 * k, f.z * 7 * k);
    if (q.hp != null && (q.mat === 'glass' || q.mat === 'paper' || q.type === 'balloon')) { damage(q, 45 * k, qp, true, true); n++; }
  }
  if (n) addCombo(n);
}

// 매 틱(물리 계산 전): 비상벨·포크·자동차·미러볼
export function tickToys(dt) {
  alarmTick();
  for (const p of G.props) {
    if (p.dead) continue;
    if (p.type === 'forklift') forkTick(p, dt);
    else if (p.type === 'car') carTick(p);
    else if (p.type === 'mirrorball' && p.fixed && p.g.userData.spin) p.g.userData.spin.rotation.y += .025;
  }
}
// 층을 바꾸거나 판이 끝날 때
export function resetToys(wet = false) { stopAlarm(); TOY.wet = wet; if (P.ride) P.ride = null; }
