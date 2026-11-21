// 때릴 수 있는 사람들(부장님·사장님…). 서 있을 때는 물건만 부딪히는 몸이고, 맞으면 물리로 날아간다.
// 피는 없고, 잠깐 뻗었다가 다시 일어나 도망 다닌다.
import { X } from './gfx.js';
import { G, rand, pick, clamp, won, angLerp } from './state.js';
import { PH, GR, CANNON, addCombo } from './engine.js';
import { buildRig, poseRig, faceTex, P } from './player.js';
import { NPCS } from './data/chars.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';

const list = [], rigs = {};
const CAST = { office: ['bujang', 'timjang', 'insa'], exec: ['sajang', 'sangmu'], lobby: ['gap', 'insa'], hall: ['sajang', 'bujang', 'timjang'], party: ['bujang', 'sangmu'], roof: ['bujang', 'timjang'], parking: ['gap', 'sangmu'] };
const OW = ['으악!', '아이고!', '내 허리!', '왜 나한테!', '인사팀 불러!', '컥!', '살려 줘!'];
const BEG = ['자, 잠깐만!', '말로 하자고!', '내가 잘못했네!', '연봉 올려 줄게!', '오지 마!'];
const HY = .84, lv = new CANNON.Vec3(), wv = new CANNON.Vec3();

// 그 자리에 물건·벽이 있는지(사람 키 높이만 본다)
function blocked(x, z, rad) {
  if (Math.abs(x) > 12.8 || z < -8.3 || z > 8) return true;
  for (const b of PH.world.bodies) {
    if (b.isPlayer || b.npc || (b.p && b.p.kind === 'frag')) continue;
    if (b.aabbNeedsUpdate) b.updateAABB(); const lo = b.aabb.lowerBound, hi = b.aabb.upperBound;
    if (hi.y < .15 || lo.y > 1.6) continue;
    if (x + rad > lo.x && x - rad < hi.x && z + rad > lo.z && z - rad < hi.z) return true;
  }
  return false;
}
function freeSpot(avoid) {
  for (let n = 0; n < 60; n++) {
    const x = rand(-12, 12), z = rand(-7.4, 6.2);
    if (avoid.some(a => Math.hypot(a[0] - x, a[1] - z) < a[2]) || list.some(q => Math.hypot(q.body.position.x - x, q.body.position.z - z) < 1.5) || blocked(x, z, .5)) continue;
    return { x, z };
  }
  return null;
}
function face(n, ex) { const R = n.R; if (R.shown !== ex) { R.face.material.map = faceTex(R.L, ex); R.shown = ex; } }
function stand(n, x, z) {
  if (n.home && blocked(x, z, .3)) { let ok = false; for (let k = 0; k < 24 && !ok; k++) { const a = k * 2.4, r = .5 + k * .12, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r; if (!blocked(tx, tz, .3)) { x = tx; z = tz; ok = true; } } if (!ok) { x = n.home[0]; z = n.home[1]; } }
  const b = n.body; b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.updateMassProperties(); b.collisionFilterMask = GR.PROP | GR.FRAG | GR.FORK;
  b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.position.set(x, HY, z); b.quaternion.setFromEuler(0, n.yaw, 0);
}

// avoid = [[x, z, 반경], …] 처음에 비워 둘 자리(내 자리·엘리베이터 앞)
export function spawnPeople(floor, avoid = []) {
  reset();
  for (const id of CAST[floor] || []) {
    const pt = freeSpot(avoid); if (!pt) continue;
    const R = rigs[id] || (rigs[id] = buildRig(id, null, NPCS[id].g)); X.scene.add(R.root); R.root.visible = true; R.shown = null;
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: PH.matD, allowSleep: false, linearDamping: .08, angularDamping: .35, collisionFilterGroup: GR.NPC, collisionFilterMask: GR.PROP | GR.FRAG | GR.FORK });
    body.addShape(new CANNON.Box(new CANNON.Vec3(.24, .82, .17)));
    const n = { id, d: NPCS[id], R, body, yaw: rand(6.28), st: 'idle', t: 0, walk: 0, spd: 0, hits: 0, kt: -99, think: rand(60, 200) | 0, nagT: rand(200, 500) | 0, scared: 0, tgt: null, pend: null, out: false };
    body.npc = n; stand(n, pt.x, pt.z); n.home = [pt.x, pt.z]; face(n, 'normal');
    body.addEventListener('collide', e => {
      if (n.st === 'fly' || n.st === 'down' || G.tick < G.settle) return; const ob = e.body; if (ob.isPlayer || ob.npc) return;
      if (ob.p && ob.p.kind === 'frag') return;
      const v = ob.velocity, sp = v.length(); if (sp < 3.2 || sp * Math.sqrt(ob.mass || 1) < 8) return; n.pend = [v.x * .9, 3 + sp * .3, v.z * .9];
    });
    PH.world.addBody(body); list.push(n);
  }
}
function head(n) { const p = n.body.position; return { x: p.x, y: p.y + 1.25, z: p.z }; }

function knock(n, vx, vy, vz) {
  const air = n.st === 'fly' || n.st === 'down';
  if (air && G.tick - n.kt < 10) return false;
  const b = n.body; n.kt = G.tick; n.hits++; n.tgt = null;
  if (!air) { b.type = CANNON.Body.DYNAMIC; b.mass = 55; b.updateMassProperties(); b.collisionFilterMask = GR.STATIC | GR.PROP | GR.FRAG | GR.FORK; }
  b.wakeUp(); b.velocity.set(clamp(vx, -16, 16), clamp(vy, 2.5, 13), clamp(vz, -16, 16)); b.angularVelocity.set(rand(-9, 9), rand(-4, 4), rand(-9, 9));
  n.st = 'fly'; n.t = 0; face(n, 'endure');
  const bp = b.position, gain = (air ? 150000 : 300000) * G.mult;
  G.money += gain; G.rage = Math.min(100, G.rage + 4); addCombo(1);
  const c = G.counts.npc || (G.counts.npc = { n: 0, sum: 0, name: '때린 사람(합의금)' }); c.n++; c.sum += gain;
  fx.text(head(n), air ? '한 번 더!' : pick(OW), 'word' + (air ? '' : ' big')); fx.text({ x: bp.x, y: bp.y + .9, z: bp.z }, '합의금 +' + won(gain), 'money');
  fx.burst(bp, .5, true); fx.bitsAt(bp, 10, '#ffd84d', 4, 3);
  sfx('punch', 1); sfx('boom', .35); buzz(40); G.shake = Math.max(G.shake, .14); if (!air) G.hitstop = Math.max(G.hitstop, 45);
  G.emit && G.emit('npc');
  return true;
}
// 주먹·발차기·무기·내려찍기
function hit(c, r, imp, opt = {}) {
  let k = 0;
  for (const n of list) {
    const bp = n.body.position, dx = bp.x - c.x, dz = bp.z - c.z, d = Math.hypot(dx, dz); if (d > r + .35 || Math.abs(bp.y - c.y) > 1.5) continue;
    const l = d || 1, h = Math.hypot(imp.x, imp.z);
    if (opt.radial) { if (knock(n, dx / l * imp.x * 1.3, imp.y + 2.5, dz / l * imp.x * 1.3)) k++; }
    else if (knock(n, imp.x * 1.3 + dx / l * h * .2, imp.y * 1.1 + 2.5, imp.z * 1.3 + dz / l * h * .2)) k++;
  }
  return k;
}
function blast(c, r, push) {
  for (const n of list) { const bp = n.body.position, dx = bp.x - c.x, dz = bp.z - c.z, d = Math.hypot(dx, bp.y - c.y, dz); if (d > r) continue; const k = (1 - d / r * .6) * push * 1.2, l = Math.hypot(dx, dz) || 1; knock(n, dx / l * k, 3 + k * .7, dz / l * k); }
}

function tick(dt) {
  if (!list.length) return;
  const pp = P.active && P.body ? P.body.position : null, oz = G.outZone;
  for (const n of list) {
    const b = n.body, bp = b.position, R = n.R; n.t++;
    if (n.pend) { const v = n.pend; n.pend = null; knock(n, v[0], v[1], v[2]); }
    if (n.st === 'fly') {
      if (!n.out && oz && (Math.abs(bp.x) > oz.x || bp.z < oz.z0 || bp.y < -3)) {
        n.out = true; const gain = 5000000 * G.mult; G.money += gain; addCombo(3);
        const c = G.counts.npcout || (G.counts.npcout = { n: 0, sum: 0, name: '창밖으로 날린 사람' }); c.n++; c.sum += gain;
        fx.text({ x: clamp(bp.x, -13, 13), y: 2.3, z: clamp(bp.z, -8.6, 8.6) }, '창밖으로 ' + n.d.n + '! +' + won(gain), 'money'); sfx('up', .8); G.emit && G.emit('npcout');
      }
      if (bp.y < -8 || n.t > 480) { n.out = false; n.yaw = Math.PI; stand(n, clamp(bp.y < -3 ? -3.5 + rand(-1.5, 1.5) : bp.x, -12.5, 12.5), bp.y < -3 ? 6.6 : clamp(bp.z, -8, 7.8)); n.st = 'dizzy'; n.t = 0; n.scared = 900; }
      else if (n.t > 40 && b.velocity.lengthSquared() < .3 && b.angularVelocity.lengthSquared() < 1) { n.st = 'down'; n.t = 0; }
    } else if (n.st === 'down') {
      if (n.t === 30) fx.text(head(n), '@_@', 'word');
      if (n.t > 120) { n.out = false; stand(n, clamp(bp.x, -12.6, 12.6), clamp(bp.z, -8.1, 7.8)); n.st = 'dizzy'; n.t = 0; n.scared = 900; }
    } else if (n.st === 'dizzy') {
      n.spd = 0; if (n.t > 70) { n.st = 'idle'; face(n, 'normal'); }
    } else {
      const dp = pp ? Math.hypot(pp.x - bp.x, pp.z - bp.z) : 99;
      if (n.scared > 0) n.scared--;
      // 맞아 본 사람은 내가 다가오면 달아난다
      if (n.scared > 0 && dp < 4.5 && (!n.tgt || !n.tgt.run)) {
        const l = dp || 1, ax = bp.x + (bp.x - pp.x) / l * 3 + rand(-1.5, 1.5), az = bp.z + (bp.z - pp.z) / l * 3 + rand(-1.5, 1.5);
        n.tgt = { x: clamp(ax, -12.3, 12.3), z: clamp(az, -7.8, 7.4), run: true, life: 90 };
        if (n.nagT <= 0) { fx.text(head(n), pick(BEG), 'say'); n.nagT = 200; }
      } else if (--n.think <= 0 && !n.tgt) {
        n.think = rand(140, 360) | 0; const x = bp.x + rand(-3, 3), z = bp.z + rand(-3, 3);
        if (!blocked(x, z, .45)) n.tgt = { x, z, run: false, life: 240 };
      }
      if (n.nagT > 0) n.nagT--;
      else if (dp < 3.2 && !n.scared) { fx.text(head(n), n.d.n + ': ' + pick(n.d.lines), 'say'); n.nagT = rand(420, 700) | 0; }
      let sp = 0;
      if (n.tgt) {
        const dx = n.tgt.x - bp.x, dz = n.tgt.z - bp.z, d = Math.hypot(dx, dz);
        if (d < .2 || --n.tgt.life <= 0) n.tgt = null;
        else {
          sp = n.tgt.run ? 3.4 : 1.1; const ux = dx / d, uz = dz / d;
          if (blocked(bp.x + ux * .45, bp.z + uz * .45, .26)) { n.tgt = null; sp = 0; }
          else { bp.x += ux * sp * dt; bp.z += uz * sp * dt; n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), .2); }
        }
      } else if (dp < 3.2) n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), .08);
      // 사람끼리 겹치지 않게 살짝 비킨다
      if (dp < .6 && dp > .01 && !P.ride) { const x = bp.x + (bp.x - pp.x) / dp * .03, z = bp.z + (bp.z - pp.z) / dp * .03; if (!blocked(x, z, .2)) { bp.x = x; bp.z = z; } }
      bp.y = HY; b.quaternion.setFromEuler(0, n.yaw, 0);
      n.spd = sp; n.walk += sp * dt * 2.6; face(n, n.scared > 0 ? 'endure' : 'normal');
    }
    // 그림을 몸에 맞춘다(발이 기준점)
    lv.set(0, -HY, 0); b.quaternion.vmult(lv, wv);
    R.root.position.set(bp.x + wv.x, bp.y + wv.y, bp.z + wv.z); R.root.quaternion.copy(b.quaternion);
    if (n.st === 'dizzy') R.root.rotation.z = Math.sin(n.t * .3) * .08;
    poseRig(R, { walk: n.walk, speed: clamp(n.spd / 5.5, 0, 1.2), air: n.st === 'fly', t: G.tick / 60 });
  }
}
function reset() { for (const n of list) { if (n.R.root.parent) n.R.root.parent.remove(n.R.root); if (PH.world && n.body.world) PH.world.removeBody(n.body); } list.length = 0; }
G.people = { hit, blast, tick, reset, list };
