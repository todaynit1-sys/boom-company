// 때릴 수 있는 사람들(부장님·사장님…). 서 있을 때는 물건만 부딪히는 몸이고, 맞으면 물리로 날아간다.
// 피는 없고, 잠깐 뻗었다가 다시 일어난다. 사람마다 버릇이 다르다: 결재판으로 막기 · 웅크리기 · 옆으로 피하기 · 물건 던지기 · 도망
// 행동 버튼으로 들어 올려 던질 수도 있다(player.js). 가장 높은 층 결전(G.combat)에서는 spawnBoss()로 사장님 일행이 덤빈다
import { X, THREE, colorMat } from './gfx.js';
import { G, rand, pick, clamp, won, angLerp } from './state.js';
import { PH, GR, CANNON, addCombo, slow, spawn, shove } from './engine.js';
import { pow, dizzyStars, spinStars, warnMark } from './hitfx.js';
import { buildRig, poseRig, faceTex, seatOf, P, hurtPlayer, clubMesh, boardMesh } from './player.js';
import { NPCS } from './data/chars.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';

const list = [], rigs = {}, PJ = [], MARKS = [];
const CAST = { office: ['bujang', 'timjang', 'insa'], exec: ['sajang', 'sangmu'], lobby: ['gap', 'insa'], hall: ['sajang', 'bujang', 'timjang'], party: ['bujang', 'sangmu'], roof: ['bujang', 'timjang'], parking: ['gap', 'sangmu'] };
const OW = ['으악!', '아이고!', '내 허리!', '왜 나한테!', '인사팀 불러!', '컥!', '살려 줘!'];
const BEG = ['자, 잠깐만!', '말로 하자고!', '내가 잘못했네!', '연봉 올려 줄게!', '오지 마!'];
const COWER = ['살려 주세요…', '저는 아무것도 몰라요!', '때리지 마세요…', '(덜덜덜)'];
const HELD = ['내려 줘!', '이거 놔!', '으아아!', '인사팀!!', '높은 데 무서워!'];
const CUPW = ['앗 차가!', '커피 세례!', '내 셔츠!'], PAPW = ['퍽!', '종이 뭉치!', '이게 뭐야!'];
const HY = .84, lv = new CANNON.Vec3(), wv = new CANNON.Vec3(), hv = new THREE.Vector3();
const mb = new THREE.Matrix4(), va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), tq = new THREE.Quaternion();
const FROM = { x: 0, z: 0 }, SP = { x: 0, y: 0, z: 0 }, TOSSO = { pk: 1.4, brk: true }, BLASTO = { pk: 1, brk: true, blast: true };
const FOE = { boss: null, called: false };
let busy = 0;

// 그 자리에 물건·벽이 있는지(사람 키 높이만 본다). soft = 가벼운 물건(밀고 지나갈 수 있는 것)은 무시
function blocked(x, z, rad, soft) {
  if (Math.abs(x) > 12.8 || z < -8.3 || z > 8) return true;
  for (const b of PH.world.bodies) {
    if (b.isPlayer || b.npc || (b.p && (b.p.kind === 'frag' || b.p.held))) continue;
    if (soft && b.mass > 0 && b.mass < 20) continue;
    if (b.aabbNeedsUpdate) b.updateAABB(); const lo = b.aabb.lowerBound, hi = b.aabb.upperBound;
    if (hi.y < .15 || lo.y > 1.6) continue;
    if (x + rad > lo.x && x - rad < hi.x && z + rad > lo.z && z - rad < hi.z) return true;
  }
  return false;
}
// 두 점 사이가 막혀 있지 않은지(큰 가구·벽만 본다)
function los(x0, z0, x1, z1) {
  z0 = Math.min(z0, 7.9); z1 = Math.min(z1, 7.9);
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(d / .6);
  for (let i = 1; i < n; i++) { const t = i / n; if (blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, .15, true)) return false; }
  return true;
}
function freeSpot(avoid) {
  for (let n = 0; n < 60; n++) {
    const x = rand(-12, 12), z = rand(-7.4, 6.2);
    if (avoid.some(a => Math.hypot(a[0] - x, a[1] - z) < a[2]) || list.some(q => Math.hypot(q.body.position.x - x, q.body.position.z - z) < 1.5) || blocked(x, z, .5)) continue;
    return { x, z };
  }
  return null;
}
// 나에게서 dmin ~ dmax 떨어진, 나를 바로 볼 수 있는 빈자리
function foeSpot(pp, dmin = 4, dmax = 9) {
  for (let k = 0; k < 80; k++) {
    const a = rand(6.283), d = rand(dmin, dmax), x = pp.x + Math.cos(a) * d, z = pp.z + Math.sin(a) * d;
    if (Math.abs(x) > 12.3 || z < -7.6 || z > 7.2) continue;
    if (list.some(q => !q.gone && Math.hypot(q.body.position.x - x, q.body.position.z - z) < 1.4) || blocked(x, z, .5) || !los(x, z, pp.x, pp.z)) continue;
    return { x, z };
  }
  return null;
}
function face(n, ex) { const R = n.R; if (R.shown !== ex) { R.face.material.map = faceTex(R.L, ex); R.shown = ex; } }
function stand(n, x, z) {
  if (n.home && blocked(x, z, .3)) { let ok = false; for (let k = 0; k < 24 && !ok; k++) { const a = k * 2.4, r = .5 + k * .12, tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r; if (!blocked(tx, tz, .3)) { x = tx; z = tz; ok = true; } } if (!ok) { x = n.home[0]; z = n.home[1]; } }
  const b = n.body; b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.updateMassProperties(); b.collisionFilterMask = GR.PROP | GR.FRAG | GR.FORK;
  b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.position.set(x, n.hy, z); b.quaternion.setFromEuler(0, n.yaw, 0);
}

// 한 사람 만들기(모습은 한 번만 짓고 다시 쓴다)
function makeNpc(id, x, z) {
  const d = NPCS[id], tall = d.tall || 1, wide = tall > 1.1 ? 1.3 : 1;
  let R = rigs[id];
  if (!R) { R = rigs[id] = buildRig(id, null, d.g); if (tall !== 1) R.root.scale.multiplyScalar(tall); }
  if (!R.mats) { R.mats = []; R.base = R.root.scale.clone(); const cl = new Map(); R.root.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { let c = cl.get(o.material); if (!c) { c = o.material.clone(); cl.set(o.material, c); R.mats.push(c); } o.material = c; } }); }
  X.scene.add(R.root); R.root.visible = true; R.shown = null;
  const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: PH.matD, allowSleep: false, linearDamping: .08, angularDamping: .35, collisionFilterGroup: GR.NPC, collisionFilterMask: GR.PROP | GR.FRAG | GR.FORK });
  body.addShape(new CANNON.Box(new CANNON.Vec3(.24 * wide, .82 * tall, .17 * wide)));
  const n = { id, d, R, body, hy: HY * tall, tall, yaw: rand(6.28), st: 'idle', t: 0, walk: 0, spd: 0, hits: 0, kt: -99, think: rand(60, 200) | 0, nagT: rand(200, 500) | 0, scared: 0, tgt: null, pend: null, out: false,
    kind: d.kind || 'flee', hostile: false, defeated: false, gone: false, cow: false, dodge: 0, ddx: 0, ddz: 0, dcd: rand(60, 200) | 0, tcd: rand(120, 300) | 0, wind: 0, fol: 0,
    guardUp: d.kind === 'guard', gCrack: false, gT: 0, gNear: false, blockPose: 0, stun: 0, inv: 0, thrown: 0, tossT: 0, svx: 0, svz: 0,
    ap: { type: 'punch', t: 0 }, ps: { walk: 0, speed: 0, air: false, t: 0, seated: false, typing: false, cower: false, guard: false, stag: 0, held: false, atk: null } };
  body.npc = n; stand(n, x, z); n.home = [x, z]; face(n, 'normal');
  body.addEventListener('collide', e => {
    if (n.st === 'fly' || n.st === 'down' || n.st === 'held' || n.gone || n.defeated || G.tick < G.settle) return; const ob = e.body; if (ob.isPlayer || ob.npc) return;
    if (ob.p && ob.p.kind === 'frag') return;
    const v = ob.velocity, sp = v.length(); if (sp < 3.2 || sp * Math.sqrt(ob.mass || 1) < 8) return; n.pend = [v.x * .9, 3 + sp * .3, v.z * .9];
  });
  // 날아가다 바닥·벽에 부딪히면 쿵(물리 계산 중이라 적어 두었다가 tick에서 처리)
  body.addEventListener('collide', e => { if (n.st !== 'fly' || n.t < 6) return; const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 3.5 && G.tick - (n.lt || -99) > 10) { n.lt = G.tick; n.land = Math.max(n.land || 0, v); } });
  n.stars = dizzyStars();
  PH.world.addBody(body); list.push(n);
  boardMesh(R, n.guardUp); if (R.club) R.club.visible = false;
  return n;
}

// avoid = [[x, z, 반경], …] 처음에 비워 둘 자리(내 자리·엘리베이터 앞)
// 사무실 층: 남의 자리 의자 몇 개에 동료가 앉아 일한다
const WORKERS = ['w1', 'w2', 'w3', 'w4'];
const upright = p => { const q = p.body.quaternion; return 1 - 2 * (q.x * q.x + q.z * q.z) > .9 && Math.abs(p.body.position.y - p.size[1] / 2) < .1; };
function seats() { return G.props.filter(p => !p.dead && p.type === 'chair' && upright(p) && /^d[0-9]+_Chair$/.test(p.tag || '')).sort(() => Math.random() - .5).slice(0, WORKERS.length); }
export function spawnPeople(floor, avoid = []) {
  reset();
  const sit = floor === 'office' ? seats() : [], cast = (CAST[floor] || []).concat(WORKERS.slice(0, sit.length));
  for (const id of cast) {
    const wi = WORKERS.indexOf(id), chair = wi >= 0 ? sit[wi] : null, so = chair && seatOf(chair);
    const pt = so ? { x: so.x, z: so.z } : freeSpot(avoid); if (!pt) continue;
    const n = makeNpc(id, pt.x, pt.z);
    if (chair) { n.st = 'sit'; n.chair = chair; n.yaw = so.yaw; n.body.quaternion.setFromEuler(0, n.yaw, 0); n.body.collisionFilterMask = 0; n.sx = so.x; n.sz = so.z; }
  }
}
function head(n) { const p = n.body.position; return { x: p.x, y: p.y + 1.25 * n.tall, z: p.z }; }
// 머리 위 말풍선(아래 자막은 결전 흐름 쪽에서 쓴다)
function bub(n, txt) { const p = n.body.position; fx.text({ x: p.x, y: p.y + 1.45 * n.tall, z: p.z }, n.d.n + ': ' + txt, 'say'); }

function flash(n, k) { for (const m of n.R.mats) m.emissive.setRGB(k, k, k); }
function squash(n) { const s = n.sq / 10, e = .3 * s * Math.cos((1 - s) * Math.PI * 3), B = n.R.base; n.R.root.scale.set(B.x * (1 + e), B.y * (1 - e * .9), B.z * (1 + e)); }

// ───── 맞기
// 날려 보낸다(물리 몸으로 바꾼다)
function fly(n, vx, vy, vz) {
  const air = n.st === 'fly' || n.st === 'down', wasFly = n.st === 'fly', b = n.body;
  n.chair = null; n.cow = false; n.dodge = 0; n.wind = 0; n.fol = 0; n.ap.t = 0; n.spd = 0; n.stun = 0;
  if (!air) { b.type = CANNON.Body.DYNAMIC; b.mass = 55 * n.tall; b.updateMassProperties(); b.collisionFilterMask = GR.STATIC | GR.PROP | GR.FRAG | GR.FORK; }
  b.wakeUp(); b.velocity.set(clamp(vx, -16, 16), clamp(vy, 2.5, 13), clamp(vz, -16, 16)); b.angularVelocity.set(rand(-9, 9), rand(-4, 4), rand(-9, 9));
  n.st = 'fly'; n.t = 0; face(n, 'endure');
  n.jug = wasFly ? (n.jug || 1) + 1 : 1;
}
// 맞은 자리: 별·섬광·하얗게 번쩍·찌그러짐·소리·멈춤
function hitFx(n, vx, vz, from, air, pw) {
  const bp = n.body.position;
  let cx = bp.x, cz = bp.z, cy = bp.y + .35;
  if (from) { const dx = from.x - bp.x, dz = from.z - bp.z, l = Math.hypot(dx, dz) || 1; cx += dx / l * .28; cz += dz / l * .28; cy = clamp(from.y ?? cy, bp.y - .1, bp.y + .7); }
  const cp = { x: cx, y: cy, z: cz };
  pow(cp, { x: vx, z: vz }, pw + (n.jug >= 3 ? .4 : 0));
  fx.burst(cp, .45 * pw, !air); fx.bitsAt(cp, 12, '#ffffff', 6 * pw, 2); fx.bitsAt(cp, 10, '#ffd84d', 4, 3); fx.bitsAt(head(n), 6, '#bfe6ff', 2.4, 3);
  n.fl = 5; flash(n, 1); n.sq = 10; squash(n);
  sfx('smack', 1); sfx('boom', .22 * pw); buzz(air ? 25 : 45);
  G.shake = Math.max(G.shake, .1 + .06 * pw); if (!air) G.hitstop = Math.max(G.hitstop, 60 + 45 * pw); else G.hitstop = Math.max(G.hitstop, 45);
}
function frontal(n, from) { const bp = n.body.position, dx = from.x - bp.x, dz = from.z - bp.z, l = Math.hypot(dx, dz) || 1; return (dx * Math.sin(n.yaw) + dz * Math.cos(n.yaw)) / l > .35; }
// 막았다: 파란 별·불꽃, 막은 사람은 살짝 밀리고 때린 나는 튕긴다
function blockFx(n, from, txt) {
  const bp = n.body.position, dx = from.x - bp.x, dz = from.z - bp.z, l = Math.hypot(dx, dz) || 1, c = { x: bp.x + dx / l * .35, y: bp.y + .55 * n.tall, z: bp.z + dz / l * .35 };
  pow(c, { x: -dx, z: -dz }, .75, '#9fd8ff'); fx.sparks(c, 12); fx.burst(c, .3, false); fx.text(head(n), txt, 'word'); sfx('block'); buzz(12);
  G.hitstop = Math.max(G.hitstop, 45); G.shake = Math.max(G.shake, .08);
  const nx = bp.x - dx / l * .25, nz = bp.z - dz / l * .25; if (!blocked(nx, nz, .3)) { bp.x = nx; bp.z = nz; }
  if (P.active && P.body) { const v = P.body.velocity; v.x += dx / l * 2.5; v.z += dz / l * 2.5; }
  n.blockPose = 14;
}
// 결재판이 손에서 날아간다(진짜 물건으로 떨어진다)
function boardFly(n) {
  boardMesh(n.R, false);
  const bp = n.body.position, p = spawn('binder', bp.x, bp.y + .7 * n.tall, bp.z, { ry: rand(6.28), life: 600, v: { x: rand(-3, 3), y: 5, z: rand(-3, 3) }, av: { x: rand(-8, 8), y: rand(-8, 8), z: rand(-8, 8) } });
  p.thrownT = G.tick; fx.sheet({ x: bp.x, y: bp.y + .8, z: bp.z }, 4, '#ffffff', 3); sfx('plastic', .7);
}
// 막았으면 true. 결재판(평소 부장님·사장님): 앞에서 온 첫 대는 막고 금이 가며, 다음 대에 박살 난다(폭발은 바로 박살)
// 결전: 사장님 1단계 방패는 강타·마무리로 깨지고, 경호원은 가끔 앞에서 오는 가벼운 공격을 막는다
function tryBlock(n, from, sp, o) {
  if (n.st !== 'idle' && n.st !== 'dizzy' && n.st !== 'stag') return false;
  if (!frontal(n, from)) return false;
  const brk = !!(o && o.brk);
  if (n.hostile) {
    if (n.role === 'boss' && n.shield && n.ai !== 'strike') {
      if (brk || sp >= 9) { n.shield = false; n.shieldT = 360; boardFly(n); n.stun = 40; stopMove(n); fx.text(head(n), '방패가 깨졌다!', 'word big'); sfx('block'); sfx('wood', .7); return false; }
      blockFx(n, from, pick(['결재 반려!', '막았다!'])); return true;
    }
    if (n.role === 'guard' && n.ai === 'move' && !brk && sp < 9 && n.blockT <= 0 && Math.random() < .35) { n.blockT = 70; blockFx(n, from, '막았다!'); return true; }
    return false;
  }
  if (n.kind === 'guard' && n.guardUp) {
    if ((o && o.blast) || n.gCrack) { n.guardUp = false; n.gCrack = false; n.gT = 720; boardFly(n); fx.text(head(n), '결재판 박살!', 'word'); return false; }
    n.gCrack = true; n.gT = 0; blockFx(n, from, '막았다!'); return true;
  }
  return false;
}
function knock(n, vx, vy, vz, from, o) {
  if (n.gone || n.defeated || n.st === 'held') return false;
  const air = n.st === 'fly' || n.st === 'down';
  if (air && G.tick - n.kt < 10) return false;
  // 옆으로 피하는 중이면 빗나간다
  if (n.dodge > 4) { if (G.tick - (n.missT || -99) > 20) { n.missT = G.tick; fx.text(head(n), '휙!', 'note'); } return false; }
  const sp = Math.hypot(vx, vz), pw = clamp(sp / 9, .6, 1.7);
  if (from && !air && tryBlock(n, from, sp, o)) return false;
  if (n.hostile) return foeHit(n, vx, vy, vz, from, o, sp, pw, air);
  // 웅크린 사람은 덜 날아간다
  if (n.cow) { vx *= .45; vy *= .6; vz *= .45; }
  const bp = n.body.position;
  fly(n, vx, vy, vz); n.kt = G.tick; n.hits++; n.tgt = null;
  const gain = (air ? 150000 : 300000) * (1 + (Math.min(n.jug, 5) - 1) * .5) * G.mult;
  G.money += gain; G.rage = Math.min(100, G.rage + 4); addCombo(1);
  const c = G.counts.npc || (G.counts.npc = { n: 0, sum: 0, name: '때린 사람(합의금)' }); c.n++; c.sum += gain;
  fx.text(head(n), n.jug > 1 ? n.jug + '연타!' + (n.jug >= 3 ? '!' : '') : pick(OW), 'word' + (n.jug === 2 || (air && n.jug < 2) ? '' : ' big')); fx.text({ x: bp.x, y: bp.y + .9, z: bp.z }, '합의금 +' + won(gain), 'money');
  hitFx(n, vx, vz, from, air, pw);
  // 공중 3연타부터는 잠깐 느리게
  if (n.jug >= 3 && !G.calm) { if (!(G.timeScale < 1 && G.slowUntil - G.real > 26)) slow(.35, 26); G.flash = Math.max(G.flash || 0, 3); }
  // 옆 사람들도 겁먹는다(물건 던지는 사람은 던지기 시작)
  for (const m of list) if (m !== n && !m.hostile && m.st === 'idle' && Math.hypot(m.body.position.x - bp.x, m.body.position.z - bp.z) < 5.5) m.scared = Math.max(m.scared, 420);
  G.emit && G.emit('npc');
  return true;
}
// 주먹·발차기·무기·내려찍기
function hit(c, r, imp, opt = {}) {
  let k = 0;
  const me = P.active && P.body ? P.body.position : null, src = me && Math.hypot(me.x - c.x, me.z - c.z) < 1.6 ? { x: me.x, y: c.y, z: me.z } : c;
  for (const n of list) {
    if (n.gone || n.st === 'held') continue;
    const bp = n.body.position, dx = bp.x - c.x, dz = bp.z - c.z, d = Math.hypot(dx, dz); if (d > r + .35 * (n.tall > 1.1 ? 1.3 : 1) || Math.abs(bp.y - c.y) > 1.5 * n.tall) continue;
    const l = d || 1, h = Math.hypot(imp.x, imp.z);
    if (opt.radial) { if (knock(n, dx / l * imp.x * 1.3, imp.y + 2.5, dz / l * imp.x * 1.3, src, opt)) k++; }
    else if (knock(n, imp.x * 1.3 + dx / l * h * .2, imp.y * 1.1 + 2.5, imp.z * 1.3 + dz / l * h * .2, src, opt)) k++;
  }
  PEO.lastN = k;
  return k;
}
function blast(c, r, push) {
  for (const n of list) { if (n.gone || n.st === 'held') continue; const bp = n.body.position, dx = bp.x - c.x, dz = bp.z - c.z, d = Math.hypot(dx, bp.y - c.y, dz); if (d > r) continue; const k = (1 - d / r * .6) * push * 1.2, l = Math.hypot(dx, dz) || 1; knock(n, dx / l * k, 3 + k * .7, dz / l * k, c, BLASTO); }
}

// ───── 들어 올리기(player.js가 부른다)
// 앞(fx, fz) 쪽 r 안의 가장 가까운 사람. any = 앉은 사람·누운 사람도. 거리는 PEO.nd
function near(x, z, fx_, fz, r = 1.35, any = false, cmin = .25) {
  let best = null, bd = r;
  for (const n of list) {
    if (n.gone || n.defeated || n.st === 'held') continue;
    if (!any && (n.st === 'sit' || n.st === 'fly' || n.st === 'down')) continue;
    const bp = n.body.position, dx = bp.x - x, dz = bp.z - z, d = Math.hypot(dx, dz);
    if (d > bd || (d > .3 && (dx * fx_ + dz * fz) / d < cmin)) continue;
    bd = d; best = n;
  }
  PEO.nd = bd; return best;
}
function grab(n) {
  if (!n || n.gone || n.defeated || n.st === 'sit' || n.st === 'fly' || n.st === 'down' || n.st === 'held' || !list.includes(n)) return false;
  if (n.role === 'boss') { fx.text(head(n), '꿈쩍도 안 한다!', 'note'); sfx('block', .5); return false; }
  if (n.hostile) stopMove(n);
  n.st = 'held'; n.t = 0; n.tgt = null; n.cow = false; n.dodge = 0; n.wind = 0; n.fol = 0; n.ap.t = 0; n.stun = 0;
  const b = n.body; b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.updateMassProperties(); b.collisionFilterMask = 0; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
  face(n, 'endure'); fx.text(head(n), pick(HELD), 'say'); n.scared = 900;
  return true;
}
// 내려놓기(어지러운 채로 선다)
function drop(n, x, z) {
  if (P.grab === n) P.grab = null;
  if (n.gone || n.st !== 'held') return;
  n.st = 'dizzy'; n.t = 0; n.scared = 900; stand(n, clamp(x, -12.6, 12.6), clamp(z, -8.1, 7.8)); face(n, 'endure');
}
// 던지기: 날아가며 부딪히는 사람을 쓰러뜨리고 물건을 깬다
function toss(n, vx, vy, vz) {
  if (P.grab === n) P.grab = null;
  if (n.gone || n.st !== 'held' || !P.body) return;
  const pp = P.body.position, l = Math.hypot(vx, vz) || 1;
  n.st = 'idle'; n.body.position.set(pp.x + vx / l * .7, pp.y + 1.75, pp.z + vz / l * .7);
  n.kt = -99; n.thrown = G.tick; n.tossT = G.tick;
  knock(n, vx, vy, vz, null, TOSSO);
  sfx('toss'); fx.text(head(n), pick(['으아아아!', '날아간다!', '살려 줘!']), 'word');
}
function heldTick(n) {
  const b = n.body, bp = b.position;
  if (P.grab !== n || !P.active || !P.body) { drop(n, bp.x, bp.z); return; }
  const pp = P.body.position, s = Math.sin(P.yaw), c = Math.cos(P.yaw);
  // 머리 위에 가로로 눕힌다: 머리는 오른쪽, 얼굴은 위
  bp.set(pp.x, pp.y + 2.0 + .1 * n.tall, pp.z);
  va.set(s, 0, c); vb.set(c, 0, -s); vc.set(0, 1, 0); mb.makeBasis(va, vb, vc); tq.setFromRotationMatrix(mb); b.quaternion.set(tq.x, tq.y, tq.z, tq.w);
  n.spd = 0;
  if (n.t % 70 === 35) fx.text(head(n), pick(HELD), 'say');
  // 오래 들고 있으면 버둥거리다 빠져나온다(결전의 적은 금방)
  if (n.t > (n.hostile ? 150 : 420)) { drop(n, pp.x + s * .9, pp.z + c * .9); fx.text(head(n), '빠져나왔다!', 'word'); if (n.hostile) P.stag = Math.max(P.stag || 0, 14); sfx('grab', .6); }
}

// ───── 평소 사람의 버릇
// 내가 휘두르려는 쪽(앞)에 있나
function threatened(n, dp) {
  const A = P.atk; if (!A || A.hit || dp > 2.4 || !P.body) return false;
  const pp = P.body.position, bp = n.body.position;
  return ((bp.x - pp.x) * Math.sin(P.yaw) + (bp.z - pp.z) * Math.cos(P.yaw)) / (dp || 1) > .4;
}
function startDodge(n, pp) {
  if (Math.random() < .25) { n.dcd = 40; return; }
  const bp = n.body.position, dx = bp.x - pp.x, dz = bp.z - pp.z, l = Math.hypot(dx, dz) || 1;
  let sx = -dz / l, sz = dx / l; if (Math.random() < .5) { sx = -sx; sz = -sz; }
  if (blocked(bp.x + sx * 1.2, bp.z + sz * 1.2, .3)) { sx = -sx; sz = -sz; if (blocked(bp.x + sx * 1.2, bp.z + sz * 1.2, .3)) { n.dcd = 30; return; } }
  n.ddx = sx; n.ddz = sz; n.dodge = 13; n.dcd = n.hostile ? 130 : rand(200, 320) | 0;
  fx.text(head(n), pick(['어딜!', '휙!', '안 맞지롱']), 'say'); sfx('dodge', .5);
}
function dodgeStep(n) {
  const bp = n.body.position; n.dodge--;
  const nx = bp.x + n.ddx * .11, nz = bp.z + n.ddz * .11;
  if (!blocked(nx, nz, .26)) { bp.x = nx; bp.z = nz; return 6.6; }
  n.dodge = 0; return 0;
}
// 걷거나 도망가기(예전 그대로). 결재판 든 사람은 도망가지 않고 나를 노려본다
function wander(n, dt, pp, dp) {
  const bp = n.body.position, guard = n.kind === 'guard';
  if (!guard && n.scared > 0 && pp && dp < 4.5 && (!n.tgt || !n.tgt.run)) {
    const l = dp || 1, ax = bp.x + (bp.x - pp.x) / l * 3 + rand(-1.5, 1.5), az = bp.z + (bp.z - pp.z) / l * 3 + rand(-1.5, 1.5);
    n.tgt = { x: clamp(ax, -12.3, 12.3), z: clamp(az, -7.8, 7.4), run: true, life: 90 };
    if (n.nagT <= 0) { fx.text(head(n), pick(BEG), 'say'); n.nagT = 200; }
  } else if (--n.think <= 0 && !n.tgt) {
    n.think = rand(140, 360) | 0; const x = bp.x + rand(-3, 3), z = bp.z + rand(-3, 3);
    if (!blocked(x, z, .45)) n.tgt = { x, z, run: false, life: 240 };
  }
  if (guard && dp < 3.5) n.tgt = null;
  if (n.nagT > 0) n.nagT--;
  else if (dp < 3.2 && (!n.scared || guard)) { fx.text(head(n), n.d.n + ': ' + pick(n.d.lines), 'say'); n.nagT = rand(420, 700) | 0; }
  let sp = 0;
  if (n.tgt) {
    const dx = n.tgt.x - bp.x, dz = n.tgt.z - bp.z, d = Math.hypot(dx, dz);
    if (d < .2 || --n.tgt.life <= 0) n.tgt = null;
    else {
      sp = n.tgt.run ? 3.4 : 1.1; const ux = dx / d, uz = dz / d;
      if (blocked(bp.x + ux * .45, bp.z + uz * .45, .26)) { n.tgt = null; sp = 0; }
      else { bp.x += ux * sp * dt; bp.z += uz * sp * dt; n.yaw = angLerp(n.yaw, Math.atan2(ux, uz), .2); }
    }
  } else if (pp && dp < (guard ? 4 : 3.2)) n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), guard ? .12 : .08);
  return sp;
}
function idleTick(n, dt, pp, dp) {
  const b = n.body, bp = b.position, kind = n.kind;
  if (n.scared > 0) n.scared--; if (n.dcd > 0) n.dcd--; if (n.tcd > 0) n.tcd--;
  let sp = 0; n.cow = false;
  if (n.dodge > 0) sp = dodgeStep(n);
  // 던지기: 팔을 뒤로 젖혔다가(예고) → 던지고 → 따라 휘두름
  else if (n.wind > 0) {
    if (pp) n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), .2);
    n.ap.type = 'throw'; n.ap.t = .35 * (1 - n.wind / 24);
    if (--n.wind === 0) { throwAt(n, Math.random() < .4 ? 'cup' : 'paper', 0); n.fol = 14; }
  }
  else if (n.fol > 0) { n.fol--; n.ap.t = n.fol > 0 ? .35 + .65 * (1 - n.fol / 14) : 0; }
  else if (kind === 'dodge' && n.dcd <= 0 && pp && threatened(n, dp)) startDodge(n, pp);
  // 웅크리기: 겁먹었거나 내가 날뛰면 그 자리에 쪼그려 앉는다(덜 날아간다)
  else if (kind === 'cower' && pp && dp < 3 && (n.scared > 0 || G.combo > 0 || threatened(n, dp))) {
    n.cow = true; n.tgt = null; n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), .05);
    if (n.nagT > 0) n.nagT--; else { fx.text(head(n), pick(COWER), 'say'); n.nagT = rand(260, 420) | 0; }
  }
  // 물건 던지기: 맞아 봤거나 옆 사람이 맞았으면 거리를 두고 종이 뭉치·컵을 던진다(아프지는 않다)
  else if (kind === 'throw' && pp && n.scared > 0 && n.tcd <= 0 && dp > 2.4 && dp < 7.5) { n.wind = 24; n.tcd = rand(330, 560) | 0; n.tgt = null; fx.text(head(n), pick(['에잇!', '받아라!', '저리 가!']), 'say'); sfx('windup', .3, 4); }
  else sp = wander(n, dt, pp, dp);
  // 사람끼리 겹치지 않게 살짝 비킨다
  if (pp && dp < .6 && dp > .01 && !P.ride) { const x = bp.x + (bp.x - pp.x) / dp * .03, z = bp.z + (bp.z - pp.z) / dp * .03; if (!blocked(x, z, .2)) { bp.x = x; bp.z = z; } }
  bp.y = n.hy; b.quaternion.setFromEuler(0, n.yaw, 0);
  n.spd = sp; face(n, n.scared > 0 || n.cow ? 'endure' : 'normal');
}

// ───── 던지는 물건(종이 뭉치·컵·서류·서류 폭탄): 물리 없이 포물선으로 난다
const PJN = 14, PJG = {}, PJM = {};
let pji = 0;
function pjInit() {
  if (PJ.length) return;
  PJG.paper = new THREE.IcosahedronGeometry(.075, 0); PJM.paper = colorMat('#f4f2ec', .9);
  PJG.cup = new THREE.CylinderGeometry(.045, .036, .11, 10); PJM.cup = colorMat('#ffffff', .4);
  PJG.doc = new THREE.BoxGeometry(.22, .05, .3); PJM.doc = colorMat('#fbfaf5', .9);
  PJG.bomb = new THREE.BoxGeometry(.24, .14, .3); PJM.bomb = colorMat('#fbfaf5', .9);
  const band = new THREE.BoxGeometry(.06, 1, 1), bandM = colorMat('#c9281f', .6);
  for (let i = 0; i < PJN; i++) {
    const g = new THREE.Group(), m = new THREE.Mesh(PJG.paper, PJM.paper), b = new THREE.Mesh(band, bandM);
    m.castShadow = true; g.add(m); g.add(b); g.visible = false; X.scene.add(g);
    PJ.push({ g, m, b, on: false, kind: 'paper', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, dmg: 0, foe: false });
  }
}
function launch(kind, x, y, z, vx, vy, vz, dmg, foe) {
  pjInit(); let e = null;
  for (let i = 0; i < PJN; i++) { const q = PJ[(pji + i) % PJN]; if (!q.on) { e = q; pji = (pji + i + 1) % PJN; break; } }
  if (!e) { e = PJ[pji]; pji = (pji + 1) % PJN; }
  e.on = true; e.kind = kind; e.x = x; e.y = y; e.z = z; e.vx = vx; e.vy = vy; e.vz = vz; e.t = 0; e.dmg = dmg; e.foe = !!foe;
  e.m.geometry = PJG[kind]; e.m.material = PJM[kind];
  e.b.visible = kind === 'doc' || kind === 'bomb'; if (e.b.visible) e.b.scale.set(1, kind === 'bomb' ? .15 : .055, .31);
  e.g.position.set(x, y, z); e.g.visible = true;
}
function pjOff(e) { e.on = false; e.g.visible = false; }
function pjSplat(e) {
  SP.x = e.x; SP.y = Math.max(.1, e.y); SP.z = e.z;
  if (e.kind === 'cup') { fx.bitsAt(SP, 12, '#5a3418', 3, 2.5); fx.bitsAt(SP, 6, '#ffffff', 3, 2); fx.stain(e.x, e.z, .3, '#4a2c17', .5); sfx('splat', .6); sfx('plastic', .4); }
  else if (e.kind === 'doc') { fx.sheet(SP, 6, '#ffffff', 2.5); sfx('paper', .5); }
  else { fx.bitsAt(SP, 8, '#f4f2ec', 2.5, 2); fx.sheet(SP, 2, '#ffffff', 2); sfx('splat', .5); }
  pjOff(e);
}
// 서류 폭탄: 떨어진 자리에서 펑(나만 다치고, 둘레 물건은 밀린다)
function pjBoom(e) {
  SP.x = e.x; SP.y = .3; SP.z = e.z;
  fx.cloud(SP, 4, '#ffffff', .8, .4); fx.sheet(SP, 5, '#ffffff', 3); fx.burst(SP, .7); sfx('boom', .45); sfx('paper', .5);
  for (const p of G.props) { if (p.dead || p.fixed || p.held) continue; const q = p.body.position, dx = q.x - e.x, dz = q.z - e.z, d = Math.hypot(dx, dz); if (d > 1.6 || q.y > 1.6) continue; const l = d || 1; shove(p, dx / l * 4, 3, dz / l * 4); }
  if (P.active && P.body && G.combat) { const pp = P.body.position; if (Math.hypot(pp.x - e.x, pp.z - e.z) < 1.5 && pp.y < 1.1) { FROM.x = e.x; FROM.z = e.z; hurtPlayer(e.dmg, FROM, 'blast'); } }
  G.shake = Math.max(G.shake, .12);
  pjOff(e);
}
function pjHitPlayer(e) {
  FROM.x = e.x - e.vx * .1; FROM.z = e.z - e.vz * .1;
  const hurt = e.foe && G.combat && e.dmg > 0 ? hurtPlayer(e.dmg, FROM, 'proj') : false;
  // 싸움이 아닐 때는 맞아도 안 아프다: 살짝 비틀하고 한마디
  if (!hurt && (!e.foe || !G.combat) && !P.ko && !(P.inv > 0)) { if (!P.seated && !P.ride) P.stag = Math.max(P.stag || 0, 6); fx.text({ x: P.body.position.x, y: P.body.position.y + 2.05, z: P.body.position.z }, pick(e.kind === 'cup' ? CUPW : PAPW), 'note'); }
  pjSplat(e);
}
function pjTick(dt) {
  if (!PJ.length) return;
  const pp = P.active && P.body ? P.body.position : null;
  for (const e of PJ) {
    if (!e.on) continue;
    e.t++; e.vy -= 12 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
    e.g.position.set(e.x, e.y, e.z); e.g.rotation.x += .25; e.g.rotation.z += .17;
    if (e.kind === 'bomb' && e.t % 4 === 0) { SP.x = e.x; SP.y = e.y + .1; SP.z = e.z; fx.bitsAt(SP, 1, '#ffd84d', .5, 1); }
    if (pp && e.kind !== 'bomb') { const dx = e.x - pp.x, dz = e.z - pp.z, dy = e.y - (pp.y + .95); if (dx * dx + dz * dz < .2 && dy > -.85 && dy < .85) { pjHitPlayer(e); continue; } }
    if (e.y < .07) { if (e.kind === 'bomb') pjBoom(e); else pjSplat(e); continue; }
    if (e.kind !== 'bomb' && (e.t & 1) === 0 && e.y < 1.55 && blocked(e.x, e.z, .04)) { pjSplat(e); continue; }
    if (e.t > 240) pjOff(e);
  }
}
// n이 나를 향해 던진다(내가 움직이는 쪽을 조금 앞질러 노린다)
function throwAt(n, kind, dmg) {
  if (!P.active || !P.body) return;
  const bp = n.body.position, pp = P.body.position, pv = P.body.velocity, s = Math.sin(n.yaw), c = Math.cos(n.yaw);
  const sx = bp.x + s * .4, sy = 1.55 * n.tall, sz = bp.z + c * .4, D = Math.hypot(pp.x - sx, pp.z - sz), T = clamp(D / 10, .3, 1.1);
  const tx = pp.x + pv.x * T * .5, tz = pp.z + pv.z * T * .5, ty = pp.y + 1.0;
  launch(kind, sx, sy, sz, (tx - sx) / T, (ty - sy + 6 * T * T) / T, (tz - sz) / T, dmg, n.hostile);
  sfx('proj');
}
// 사장님 서류 폭탄: 둘레에 고리 모양으로 8개(떨어질 자리에 고리 표시) + 나를 노리는 2개
function ringBombs(n) {
  const bp = n.body.position, sy = 2.1 * n.tall, T = .95, a0 = rand(6.283), g6 = 6 * T * T;
  for (let i = 0; i < 8; i++) {
    const a = a0 + i * .785, r = 3 + (i & 1) * 1.3, tx = clamp(bp.x + Math.cos(a) * r, -12.6, 12.6), tz = clamp(bp.z + Math.sin(a) * r, -8, 7.8);
    launch('bomb', bp.x, sy, bp.z, (tx - bp.x) / T, (.05 - sy + g6) / T, (tz - bp.z) / T, 10, true);
    SP.x = tx; SP.y = .06; SP.z = tz; fx.burst(SP, .5, true);
  }
  if (P.active && P.body) for (let i = 0; i < 2; i++) { const pp = P.body.position, tx = pp.x + rand(-.8, .8), tz = pp.z + rand(-.8, .8); launch('bomb', bp.x, sy, bp.z, (tx - bp.x) / T, (.05 - sy + g6) / T, (tz - bp.z) / T, 10, true); }
  sfx('toss'); sfx('proj');
}

// ───── 결전: 사장님 · 비서 2 · 경호원 2
const HPS = { boss: 450, guard: 110, sec: 70 };
const FOE_CAST = [['boss', 'boss', 6, 10], ['guard1', 'guard', 4, 7], ['guard2', 'guard', 4, 7], ['sec1', 'sec', 6, 10], ['sec2', 'sec', 6, 10]];
function markFor() { for (const m of MARKS) if (!m.userData.used) { m.userData.used = true; return m; } const m = warnMark(); m.userData.used = true; MARKS.push(m); return m; }
function addFoe(id, role, pt) {
  if (!pt || !NPCS[id]) return null;
  const n = makeNpc(id, pt.x, pt.z);
  Object.assign(n, { hostile: true, role, hp: HPS[role], maxHp: HPS[role], ai: 'move', at: 0, windT: 30, cd: rand(70, 170) | 0, mv: null, mvd: null, spd0: role === 'sec' ? 3.6 : role === 'guard' ? 3.1 : 2.5,
    phase: 1, shield: role === 'boss', shieldT: 0, stuck: 0, flinchN: 0, blockT: 0, side: Math.random() < .5 ? 1 : -1, plan: 0, wdx: 0, wdz: 1, roarQ: false, hitDone: false, dx: 0, dz: 1, nagT: rand(240, 520) | 0, mark: markFor() });
  boardMesh(n.R, n.shield);
  if (P.active && P.body) { n.yaw = Math.atan2(P.body.position.x - pt.x, P.body.position.z - pt.z); n.body.quaternion.setFromEuler(0, n.yaw, 0); }
  return n;
}
// 지금 층의 사람들을 모두 치우고 사장님 일행을 세운다. 세운 수를 돌려준다
export function spawnBoss() {
  reset();
  const pp = { x: -3.5, z: 6.7 };
  for (const [id, role, d0, d1] of FOE_CAST) addFoe(id, role, foeSpot(pp, d0, d1) || foeSpot(pp, 3, 12) || freeSpot([[pp.x, pp.z, 3.5]]));
  // 3단계에 부를 경호원은 미리 지어 둔다(그때 멈칫하지 않게)
  if (!rigs.guard3) { const d = NPCS.guard3, R = rigs.guard3 = buildRig('guard3', null, d.g); if (d.tall && d.tall !== 1) R.root.scale.multiplyScalar(d.tall); }
  FOE.boss = list.find(n => n.role === 'boss') || null; FOE.called = false;
  G.boss = FOE.boss ? { name: '사장님', hp: FOE.boss.hp, maxHp: FOE.boss.maxHp, phase: 1, alive: true } : null;
  if (FOE.boss) bub(FOE.boss, pick(['자네, 오늘부로 해고야!', '감히 여기까지 올라와?', '경호원! 저 직원 막아!']));
  return list.length;
}
// 아직 항복하지 않은 적의 수
export function foesLeft() { let k = 0; for (const n of list) if (n.hostile && !n.defeated && !n.gone) k++; return k; }

function stopMove(n) { if (n.mvd && n.mvd.club) clubMesh(n.R, false); n.ai = 'move'; n.at = 0; n.ap.t = 0; n.mvd = null; n.mv = null; if (n.mark) n.mark.visible = false; n.cd = Math.max(n.cd || 0, 30); }
function endMove(n) { const W = n.mvd; stopMove(n); n.cd = ((W ? W.cool : 60) * (n.phase === 3 ? .65 : 1) + rand(0, 40)) | 0; }
function flinch(n, vx, vz) { n.st = 'stag'; n.t = 0; n.svx = clamp(vx, -9, 9) * .5; n.svz = clamp(vz, -9, 9) * .5; face(n, 'endure'); }
function foeHit(n, vx, vy, vz, from, o, sp, pw, air) {
  if (n.inv > 0) { if (G.tick - (n.missT || -99) > 20) { n.missT = G.tick; fx.text(head(n), '안 통한다!', 'note'); sfx('block', .5); } return false; }
  const boss = n.role === 'boss', pk = (o && o.pk) || 1;
  const dmg = Math.round(clamp((4 + sp * 1.5 + Math.max(0, vy - 3) * .3) * Math.sqrt(pk), 3, 30) * (air ? .6 : 1));
  n.hp = Math.max(0, n.hp - dmg); n.kt = G.tick; n.hits++;
  const gain = 120000 * G.mult, c = G.counts.foe || (G.counts.foe = { n: 0, sum: 0, name: '사장님 일행 합의금' }); G.money += gain; c.n++; c.sum += gain;
  G.rage = Math.min(100, G.rage + 3); addCombo(1);
  fx.text(head(n), '-' + dmg, dmg >= 18 ? 'word big' : 'word');
  if (n.hp <= 0) { stopMove(n); fly(n, vx * 1.2, Math.max(vy, 8), vz * 1.2); hitFx(n, vx, vz, from, air, Math.max(pw, 1.3)); defeat(n); return true; }
  if (boss) bossPhase(n);
  // 사장님은 휘두르는 동안 꿈쩍 안 한다. 나머지는 움찔하거나(가벼운 공격) 날아간다(센 공격·세 번째 움찔)
  const armor = boss && (n.ai === 'wind' || n.ai === 'strike');
  const launch = !armor && (air || sp >= (boss ? 12 : 8.5) || vy > 9.5 || ++n.flinchN >= (boss ? 4 : 3));
  if (launch) { n.flinchN = 0; stopMove(n); fly(n, vx * (boss ? .6 : 1), vy * (boss ? .75 : 1), vz * (boss ? .6 : 1)); }
  else if (!armor) { stopMove(n); flinch(n, vx, vz); }
  else if (G.tick - (n.missT || -99) > 40) { n.missT = G.tick; fx.text(head(n), '끄떡없다!', 'note'); }
  hitFx(n, vx, vz, from, air || armor, pw);
  G.emit && G.emit('npc');
  return true;
}
// 항복: 그 자리에 쓰러져 다시 일어나지 않는다
function defeat(n) {
  n.defeated = true; n.hp = 0; n.inv = 0; stopMove(n); n.ai = 'out';
  const bp = n.body.position; fx.text({ x: bp.x, y: bp.y + 1.6 * n.tall, z: bp.z }, '항복!', 'word big'); sfx('foedown');
  const boss = n.role === 'boss', gain = (boss ? 3000000 : 500000) * G.mult, c = G.counts.foedown || (G.counts.foedown = { n: 0, sum: 0, name: '항복 받아 낸 사장님 일행' });
  G.money += gain; c.n++; c.sum += gain; fx.text({ x: bp.x, y: bp.y + 1.1, z: bp.z }, '+' + won(gain), 'money');
  G.emit && G.emit('foedown', n.id);
  if (!boss) return;
  if (G.boss) { G.boss.hp = 0; G.boss.alive = false; }
  slow(.3, 90); G.flash = Math.max(G.flash || 0, 6); G.shake = Math.max(G.shake, .5); sfx('up');
  bub(n, '하, 항복! 연봉 올려 줄게!');
  // 사장님이 항복하면 남은 사람들도 손을 든다
  for (const m of list) if (m !== n && m.hostile && !m.defeated && !m.gone) surrender(m);
  G.emit && G.emit('bossdown');
}
function surrender(m) {
  if (m.st === 'held') drop(m, m.body.position.x, m.body.position.z);
  m.defeated = true; m.hp = 0; stopMove(m); m.ai = 'out'; m.cow = true;
  fx.text(head(m), '항복!', 'word'); G.emit && G.emit('foedown', m.id);
}
// 체력에 따라 단계가 바뀐다: 2단계(방패 버림·돌진·서류 폭탄) → 3단계(분노: 포효 + 경호원 부르기, 빨라짐)
function bossPhase(n) {
  const k = n.hp / n.maxHp, ph = k > .66 ? 1 : k > .33 ? 2 : 3;
  if (ph <= n.phase) return;
  n.phase = ph; sfx('phase');
  if (ph === 2) { if (n.shield) { n.shield = false; boardMesh(n.R, false); } n.shieldT = 0; bub(n, '이것들이 보자 보자 하니까!'); fx.text(head(n), '사장님 2단계!', 'word big'); }
  else n.roarQ = true;
}
function callGuard() {
  if (FOE.called || !P.active || !P.body) return; FOE.called = true;
  const ex = G.elev ? G.elev.x : -3.5, pp = P.body.position;
  const pt = !blocked(ex, 7.2, .5) ? { x: ex, z: 7.2 } : foeSpot(pp, 3, 9) || freeSpot([[pp.x, pp.z, 3]]);
  const g = addFoe('guard3', 'guard', pt); if (!g) return;
  g.cd = 60; fx.cloud({ x: pt.x, y: .8, z: pt.z }, 6, '#d8d0bf', 1, .5); fx.text(head(g), '지원 왔습니다!', 'say'); sfx('ding');
}
function roar(n) {
  n.inv = 100; const bp = n.body.position;
  sfx('roar'); bub(n, '다들 해고야!! 경호원 어딨나!'); fx.text(head(n), '분노!!', 'word big');
  G.shake = Math.max(G.shake, .5); G.flash = Math.max(G.flash || 0, 3); fx.burst({ x: bp.x, y: .1, z: bp.z }, 2.4); fx.cloud({ x: bp.x, y: 1, z: bp.z }, 8, '#ff7a6a', 1, .8);
  if (P.active && P.body) { const pp = P.body.position; if (Math.hypot(pp.x - bp.x, pp.z - bp.z) < 4.5) { FROM.x = bp.x; FROM.z = bp.z; hurtPlayer(0, FROM, 'roar'); } }
  callGuard();
}
// 적 공격이 나에게 맞았나: range 안, 앞쪽(cosMin), low = 점프하면 피한다
function meleeHit(n, range, cosMin, dmg, kind, low) {
  if (!P.active || !P.body || P.ko) return false;
  const bp = n.body.position, pp = P.body.position, dx = pp.x - bp.x, dz = pp.z - bp.z, d = Math.hypot(dx, dz) || .01;
  if (d > range || (dx * Math.sin(n.yaw) + dz * Math.cos(n.yaw)) / d < cosMin) return false;
  if (pp.y > (low ? .7 : 1.5)) { if (low && G.tick - (n.missT || -99) > 30) { n.missT = G.tick; fx.text({ x: pp.x, y: pp.y + 2.1, z: pp.z }, '점프로 피했다!', 'note'); } return false; }
  FROM.x = bp.x; FROM.z = bp.z; return hurtPlayer(dmg, FROM, kind);
}
// 몸통 박치기·돌진: 벽이나 큰 가구에 박으면 잠깐 정신을 잃는다(때릴 기회)
function rush(n, sp, dmg, dt) {
  const bp = n.body.position, k = n.at < 6 ? n.at / 6 : 1, st = sp * k * dt, nx = bp.x + n.dx * st, nz = bp.z + n.dz * st;
  if (blocked(nx + n.dx * .35, nz + n.dz * .35, .28, true)) {
    endMove(n); n.stun = 50; face(n, 'endure'); fx.text(head(n), '쿵!', 'word'); sfx('thud', .8); G.shake = Math.max(G.shake, .12); fx.cloud({ x: nx + n.dx * .4, y: .9, z: nz + n.dz * .4 }, 3, '#d8d0bf', .6, .3);
    return 0;
  }
  bp.x = nx; bp.z = nz;
  if (G.tick % 3 === 0) { SP.x = bp.x; SP.y = .1; SP.z = bp.z; fx.bitsAt(SP, 3, '#d8d0bf', 1.5, 1); }
  if (!n.hitDone && meleeHit(n, 1.05, .2, dmg, 'heavy', true)) n.hitDone = true;
  return sp * k;
}
// 적의 공격 표: wind = 예고(틱, 머리 위 '!' + 경고음, 0.37초 넘게), dur = 휘두르기, cool = 쉬는 틈, pose = 자세, k = 경고음 높이
const FMV = {
  punch: { wind: 26, dur: 22, cool: 70, pose: 'punch', k: 0, tick(n) { if (n.at === 5) meleeHit(n, 1.6, .7, 12, 'punch', false); } },
  tackle: { wind: 30, dur: 42, cool: 110, pose: 'dash', k: 1, go(n) { fx.text(head(n), '돌격!', 'say'); }, tick(n, dt) { return rush(n, 8.5, 15, dt); } },
  skick: { wind: 22, dur: 18, cool: 60, pose: 'kick', k: 3, tick(n) { if (n.at === 5) meleeHit(n, 1.4, .6, 8, 'kick', true); } },
  toss: { wind: 24, dur: 16, cool: 85, pose: 'throw', k: 4, tick(n) { if (n.at === 3) throwAt(n, Math.random() < .5 ? 'cup' : 'doc', 7); } },
  golf: { wind: 32, dur: 26, cool: 75, pose: 'golf', k: 2, club: true, go() { sfx('golf', .5); }, tick(n) { if (n.at === 6) meleeHit(n, 2.6, .15, 18, 'heavy', false); } },
  charge: { wind: 34, dur: 56, cool: 120, pose: 'dash', k: 1, go(n) { fx.text(head(n), '비켜라!', 'say'); }, tick(n, dt) { return rush(n, 10.5, 20, dt); } },
  bombs: { wind: 38, dur: 22, cool: 140, pose: 'bomb', k: 5, go(n) { fx.text(head(n), '서류 폭탄이다!', 'say'); }, tick(n) { if (n.at === 3) ringBombs(n); } },
  roar: { wind: 12, dur: 84, cool: 20, pose: 'roar', k: 6, go(n) { roar(n); }, tick(n) { if (n.at % 14 === 0) { const bp = n.body.position; SP.x = bp.x; SP.y = 1.6 * n.tall; SP.z = bp.z; fx.cloud(SP, 1, '#ff9a8a', .7, .3); } } },
};
function pickMove(n, dp) {
  const r = Math.random(), bp = n.body.position, pp = P.body.position, seen = () => los(bp.x, bp.z, pp.x, pp.z);
  if (n.role === 'guard') { if (dp < 1.7) return 'punch'; if (dp > 3.2 && dp < 7.5 && r < .45 && seen()) return 'tackle'; return null; }
  if (n.role === 'sec') { if (dp < 1.5) return 'skick'; if (dp > 2.6 && dp < 10 && seen()) return 'toss'; return null; }
  if (n.phase === 1) return dp < 2.5 ? 'golf' : null;
  if (dp < 2.5 && r < .6) return 'golf';
  if (dp > 3.2 && dp < 9 && r < (n.phase === 3 ? .55 : .45) && seen()) return 'charge';
  if (dp < 8 && r < .85) return 'bombs';
  return null;
}
function startWind(n, mv) {
  const W = FMV[mv]; n.ai = 'wind'; n.at = 0; n.mv = mv; n.mvd = W; n.ap.type = W.pose; n.ap.t = 0; n.hitDone = false;
  n.windT = Math.max(22, Math.round(W.wind * (n.phase === 3 ? .82 : 1)));
  n.mark.visible = mv !== 'roar'; sfx('windup', .8, W.k);
  if (W.club) clubMesh(n.R, true);
}
// 막힌 곳은 비스듬히 돌아간다. 방향은 몇 틱마다 다시 고른다. 3초 넘게 못 가면 다른 길로 돌아 나온다
const TRY = [0, .5, -.5, 1.1, -1.1, 1.7, -1.7];
function relocate(n) {
  n.stuck = 0; if (!P.active || !P.body) return;
  const pt = foeSpot(P.body.position, 3.5, 7.5); if (!pt) return;
  const bp = n.body.position; fx.cloud({ x: bp.x, y: .9, z: bp.z }, 4, '#d8d0bf', .8, .4);
  stand(n, pt.x, pt.z); fx.cloud({ x: pt.x, y: .9, z: pt.z }, 4, '#d8d0bf', .8, .4); fx.text(head(n), '헉헉… 돌아서 왔다!', 'say');
}
function walkTo(n, gx, gz, s, dt) {
  const bp = n.body.position, dx = gx - bp.x, dz = gz - bp.z, d = Math.hypot(dx, dz);
  if (d < .15 || s <= 0) { if (n.stuck > 0) n.stuck -= .5; return 0; }
  const ux = dx / d, uz = dz / d, st = Math.min(d, s * dt);
  if (n.plan > 0 && !blocked(bp.x + n.wdx * .42, bp.z + n.wdz * .42, .28, true)) n.plan--;
  else {
    n.plan = 0;
    for (let i = 0; i < TRY.length; i++) {
      const a = TRY[i] * n.side, c = Math.cos(a), sn = Math.sin(a), vx = ux * c - uz * sn, vz = ux * sn + uz * c;
      if (blocked(bp.x + vx * .42, bp.z + vz * .42, .28, true)) continue;
      n.wdx = vx; n.wdz = vz; n.plan = 4; n.stuck = i >= 3 ? n.stuck + 3 : Math.max(0, n.stuck - 2); break;
    }
    if (!n.plan) { n.stuck += 1; if (n.stuck > 180) relocate(n); return 0; }
  }
  if (n.stuck > 180) { relocate(n); return 0; }
  bp.x += n.wdx * st; bp.z += n.wdz * st; return st / dt;
}
function foeTick(n, dt, pp, dp) {
  const b = n.body, bp = b.position;
  if (n.cd > 0) n.cd--; if (n.blockT > 0) n.blockT--; if (n.dcd > 0) n.dcd--;
  let sp = 0; n.cow = false;
  if (n.defeated) { n.cow = true; if (pp) n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), .05); n.spd = 0; bp.y = n.hy; b.quaternion.setFromEuler(0, n.yaw, 0); face(n, 'endure'); return; }
  if (n.role === 'boss' && n.shieldT > 0 && --n.shieldT === 0 && n.phase === 1) { n.shield = true; boardMesh(n.R, true); fx.text(head(n), '결재판 다시 든다!', 'note'); }
  if (n.stun > 0) { n.stun--; n.spd = 0; bp.y = n.hy; b.quaternion.setFromEuler(0, n.yaw, 0); face(n, 'endure'); return; }
  const fight = G.combat && pp && P.active && !P.ko;
  if (!fight) {
    // 싸움이 아닐 때: 서서 노려본다. 내가 쓰러져 있으면 한마디씩
    if (n.ai !== 'move') stopMove(n);
    if (pp && dp < 14) n.yaw = angLerp(n.yaw, Math.atan2(pp.x - bp.x, pp.z - bp.z), .08);
    if (pp && P.ko && --n.nagT <= 0) { fx.text(head(n), n.d.n + ': ' + pick(n.d.lines), 'say'); n.nagT = rand(240, 420) | 0; }
  } else {
    const fy = Math.atan2(pp.x - bp.x, pp.z - bp.z);
    if (n.roarQ && n.ai === 'move') { n.roarQ = false; startWind(n, 'roar'); }
    if (n.ai === 'move') {
      if (n.role === 'sec' && n.dodge <= 0 && n.dcd <= 0 && threatened(n, dp)) startDodge(n, pp);
      if (n.dodge > 0) sp = dodgeStep(n);
      else {
        let gx = bp.x, gz = bp.z, s = n.spd0 * (n.phase === 3 ? 1.35 : 1);
        if (n.role === 'sec') {
          // 비서: 3 ~ 6.5m 거리를 두고 옆으로 돈다
          if (dp < 3.2) { gx = bp.x - (pp.x - bp.x) / dp * 2; gz = bp.z - (pp.z - bp.z) / dp * 2; }
          else if (dp > 6.5) { gx = pp.x; gz = pp.z; }
          else { gx = bp.x - (pp.z - bp.z) / dp * n.side * 1.5; gz = bp.z + (pp.x - bp.x) / dp * n.side * 1.5; s *= .45; if (Math.random() < .004) n.side = -n.side; }
        } else if (dp > (n.role === 'boss' ? 1.7 : 1.2)) { gx = pp.x; gz = pp.z; }
        sp = walkTo(n, gx, gz, s, dt);
        n.yaw = angLerp(n.yaw, fy, .15);
        if (n.cd <= 0 && busy < 2) { const mv = pickMove(n, dp); if (mv) { startWind(n, mv); busy++; } else n.cd = 20; }
        if (--n.nagT <= 0) { fx.text(head(n), n.d.n + ': ' + pick(n.d.lines), 'say'); n.nagT = rand(420, 760) | 0; }
      }
    } else if (n.ai === 'wind') {
      n.at++; if (n.at < n.windT * .7) n.yaw = angLerp(n.yaw, fy, .25);
      n.ap.t = .35 * Math.min(1, n.at / n.windT);
      const mk = n.mark, k = 1 + Math.sin(n.at * .6) * .12; mk.position.set(bp.x, bp.y - n.hy + 2.15 * n.tall + Math.sin(n.at * .4) * .04, bp.z); mk.scale.set(.34 * k, .34 * k, 1);
      if (n.at >= n.windT) { n.ai = 'strike'; n.at = 0; mk.visible = false; n.dx = Math.sin(n.yaw); n.dz = Math.cos(n.yaw); n.hitDone = false; if (n.mvd.go) n.mvd.go(n); if (n.mv !== 'roar') sfx('whoosh', .7); }
    } else if (n.ai === 'strike') {
      n.at++; const W = n.mvd; n.ap.t = .35 + .65 * Math.min(1, n.at / W.dur);
      sp = W.tick(n, dt) || 0;
      if (n.ai === 'strike' && n.at >= W.dur) endMove(n);
    }
    // 나와 겹치지 않게
    if (dp < .75 && dp > .01 && !P.ride) { const x = bp.x - (pp.x - bp.x) / dp * .05, z = bp.z - (pp.z - bp.z) / dp * .05; if (!blocked(x, z, .2, true)) { bp.x = x; bp.z = z; } }
  }
  bp.y = n.hy; b.quaternion.setFromEuler(0, n.yaw, 0);
  n.spd = sp; face(n, n.ai === 'wind' || n.ai === 'strike' ? 'rage' : 'normal');
}
// 적끼리 겹치지 않게 조금씩 떼어 놓는다
function separate() {
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (!a.hostile || a.st !== 'idle' || a.gone) continue;
    for (let j = i + 1; j < list.length; j++) {
      const c = list[j]; if (!c.hostile || c.st !== 'idle' || c.gone) continue;
      const ap = a.body.position, cp = c.body.position, dx = cp.x - ap.x, dz = cp.z - ap.z, d = Math.hypot(dx, dz);
      if (d > .9 || d < .001) continue;
      const k = (.9 - d) * .3 / d;
      if (!blocked(cp.x + dx * k, cp.z + dz * k, .25, true)) { cp.x += dx * k; cp.z += dz * k; }
      if (!blocked(ap.x - dx * k, ap.z - dz * k, .25, true)) { ap.x -= dx * k; ap.z -= dz * k; }
    }
  }
}

function tick(dt) {
  pjTick(dt);
  if (!list.length) return;
  const pp = P.active && P.body ? P.body.position : null, oz = G.outZone;
  busy = 0; for (const n of list) if (n.hostile && (n.ai === 'wind' || n.ai === 'strike') && n.st === 'idle') busy++;
  for (const n of list) {
    if (n.gone) continue;
    const b = n.body, bp = b.position, R = n.R; n.t++;
    if (n.pend) { const v = n.pend; n.pend = null; knock(n, v[0], v[1], v[2]); }
    if (n.fl > 0) { n.fl--; flash(n, n.fl / 5); }
    if (n.sq > 0) { n.sq--; squash(n); }
    if (n.inv > 0) n.inv--;
    if (n.blockPose > 0) n.blockPose--;
    if (n.land) {
      const v = n.land; n.land = 0;
      fx.cloud({ x: bp.x, y: .15, z: bp.z }, v > 7 ? 4 : 2, '#d8d0bf', .6, .4); fx.bitsAt({ x: bp.x, y: .1, z: bp.z }, 8, '#9a9286', 2.5, 1.5);
      sfx('thud', Math.min(1, v / 9)); G.shake = Math.max(G.shake, Math.min(.16, v * .018));
      if (v > 7) { fx.text({ x: bp.x, y: bp.y + .6, z: bp.z }, pick(['쿵!', '콰당!', '철퍼덕!']), 'word'); buzz(20); }
      // 던져진 적은 떨어질 때 더 아프다
      if (n.hostile && !n.defeated && (n.thrown || v > 8)) { const d = Math.round(Math.min(14, v * 1.1)); n.hp = Math.max(0, n.hp - d); fx.text(head(n), '-' + d, 'note'); if (n.role === 'boss') bossPhase(n); if (n.hp <= 0) defeat(n); }
    }
    const downT = n.defeated && n.t > 180;
    if ((n.st === 'down' && !downT) || n.st === 'dizzy' || n.stun > 0) { R.head.getWorldPosition(hv); spinStars(n.stars, hv.x, hv.y + .32, hv.z, G.tick); } else if (n.stars.visible) n.stars.visible = false;
    const dp = pp ? Math.hypot(pp.x - bp.x, pp.z - bp.z) : 99;
    n.gNear = dp < 3.5;
    if (n.st === 'fly') {
      if (!n.out && oz && (Math.abs(bp.x) > oz.x || bp.z < oz.z0 || bp.y < -3)) {
        n.out = true; const gain = 5000000 * G.mult; G.money += gain; addCombo(3);
        const c = G.counts.npcout || (G.counts.npcout = { n: 0, sum: 0, name: '창밖으로 날린 사람' }); c.n++; c.sum += gain;
        fx.text({ x: clamp(bp.x, -13, 13), y: 2.3, z: clamp(bp.z, -8.6, 8.6) }, '창밖으로 ' + n.d.n + '! +' + won(gain), 'money'); sfx('up', .8); G.emit && G.emit('npcout');
      }
      // 던져진 사람이 날아가며 다른 사람을 쓰러뜨린다
      if (n.thrown && G.tick - n.thrown < 75) {
        const v = b.velocity, s2 = v.x * v.x + v.z * v.z;
        if (s2 > 16) for (const m of list) {
          if (m === n || m.gone || m.defeated || m.st === 'held' || m.st === 'fly' || m.tossT === n.thrown) continue;
          const mp = m.body.position, dx = mp.x - bp.x, dz = mp.z - bp.z;
          if (dx * dx + dz * dz < .8 && Math.abs(mp.y - bp.y) < 1.4) { m.tossT = n.thrown; if (knock(m, v.x * .8, 4 + Math.sqrt(s2) * .2, v.z * .8, bp, TOSSO)) fx.text(head(m), '볼링!', 'word big'); }
        }
      }
      if (bp.y < -8 || n.t > 480) {
        if (n.defeated) { if (bp.y < -3) gone(n); else { n.st = 'down'; n.t = 0; } }
        else { n.out = false; n.thrown = 0; n.yaw = Math.PI; stand(n, clamp(bp.y < -3 ? -3.5 + rand(-1.5, 1.5) : bp.x, -12.5, 12.5), bp.y < -3 ? 6.6 : clamp(bp.z, -8, 7.8)); n.st = 'dizzy'; n.t = 0; n.scared = 900; }
      }
      else if (n.t > 40 && b.velocity.lengthSquared() < .3 && b.angularVelocity.lengthSquared() < 1) { n.st = 'down'; n.t = 0; n.jug = 0; n.thrown = 0; }
    } else if (n.st === 'down') {
      if (!n.defeated) {
        if (n.t === 30) fx.text(head(n), '@_@', 'word');
        if (n.t > (n.hostile ? 60 : 120)) { n.out = false; stand(n, clamp(bp.x, -12.6, 12.6), clamp(bp.z, -8.1, 7.8)); n.st = 'dizzy'; n.t = 0; n.scared = 900; }
      }
    } else if (n.st === 'held') heldTick(n);
    else if (n.st === 'stag') {
      // 움찔: 맞은 쪽으로 조금 밀린다
      n.spd = 0; const nx = bp.x + n.svx * dt, nz = bp.z + n.svz * dt; n.svx *= .82; n.svz *= .82;
      if (!blocked(nx, nz, .28, true)) { bp.x = nx; bp.z = nz; }
      bp.y = n.hy; b.quaternion.setFromEuler(0, n.yaw, 0);
      if (n.t > 16) { n.st = 'idle'; face(n, 'normal'); }
    } else if (n.st === 'sit') {
      // 의자가 없어지거나 밀려났거나, 내가 바로 옆에서 난동을 부리면 벌떡 일어나 달아난다
      const c = n.chair, cp = c && !c.dead ? c.body.position : null;
      if (!cp || !upright(c) || Math.hypot(cp.x - n.sx, cp.z - n.sz) > .7 || (dp < 2.6 && G.combo > 2)) { n.chair = null; stand(n, bp.x, bp.z); n.st = 'idle'; n.scared = 900; n.nagT = 0; fx.text(head(n), pick(['으악!', '뭐야 뭐야!', '도망쳐!']), 'say'); }
      else if (n.nagT > 0) n.nagT--; else if (dp < 2.4) { fx.text(head(n), n.d.n + ': ' + pick(n.d.lines), 'say'); n.nagT = rand(500, 800) | 0; }
    } else if (n.st === 'dizzy') {
      n.spd = 0; if (n.t > (n.hostile ? 25 : 70)) { n.st = 'idle'; face(n, 'normal'); }
    } else if (n.hostile) foeTick(n, dt, pp, dp);
    else idleTick(n, dt, pp, dp);
    // 결재판: 박살 나고 12초 뒤 새로 든다
    if (!n.hostile && n.kind === 'guard' && !n.guardUp && n.gT > 0 && --n.gT === 0) { n.guardUp = true; n.gCrack = false; boardMesh(R, true); }
    n.walk += n.spd * dt * 2.6;
    // 그림을 몸에 맞춘다(발이 기준점)
    lv.set(0, -n.hy, 0); b.quaternion.vmult(lv, wv);
    R.root.position.set(bp.x + wv.x, bp.y + wv.y, bp.z + wv.z); R.root.quaternion.copy(b.quaternion);
    if (n.st === 'dizzy' || n.stun > 0) R.root.rotation.z = Math.sin(n.t * .3) * .08;
    const ps = n.ps, standing = n.st === 'idle';
    ps.walk = n.walk; ps.speed = clamp(n.spd / 5.5, 0, 1.2); ps.air = n.st === 'fly'; ps.t = G.tick / 60; ps.seated = ps.typing = n.st === 'sit';
    ps.cower = n.cow && standing; ps.stag = n.st === 'stag' || n.stun > 0 ? 1 : 0; ps.held = n.st === 'held';
    ps.guard = standing && !ps.cower && (n.blockPose > 0 || (n.guardUp && n.gNear) || (n.hostile && n.shield && n.ai === 'move'));
    ps.atk = standing && n.ap.t > 0 ? n.ap : null;
    poseRig(R, ps);
  }
  if (G.tick % 3 === 0) separate();
  // 결전 HUD용: 사장님 체력·단계
  const fb = FOE.boss;
  if (fb) { const gb = G.boss || (G.boss = { name: '사장님', hp: 0, maxHp: 0, phase: 1, alive: true }); gb.hp = fb.hp; gb.maxHp = fb.maxHp; gb.phase = fb.phase; gb.alive = !fb.defeated && !fb.gone; }
}
// 창밖으로 떨어진 채 항복한 사람은 판에서 뺀다
function gone(n) {
  n.gone = true; n.R.root.visible = false; if (n.stars) n.stars.visible = false; if (n.mark) n.mark.visible = false;
  const b = n.body; b.type = CANNON.Body.KINEMATIC; b.mass = 0; b.updateMassProperties(); b.collisionFilterMask = 0; b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.position.set(0, -50, 0);
}
function reset() {
  if (P.grab) P.grab = null;
  for (const n of list) {
    if (n.R.root.parent) n.R.root.parent.remove(n.R.root); if (n.stars) X.scene.remove(n.stars);
    if (n.R.mats) { for (const m of n.R.mats) m.emissive.setRGB(0, 0, 0); n.R.root.scale.copy(n.R.base); }
    if (n.R.club) n.R.club.visible = false;
    if (PH.world && n.body.world) PH.world.removeBody(n.body);
  }
  list.length = 0;
  for (const m of MARKS) { m.visible = false; m.userData.used = false; }
  for (const e of PJ) pjOff(e);
  FOE.boss = null; FOE.called = false; G.boss = null; busy = 0;
}
const PEO = { hit, blast, tick, reset, list, near, grab, toss, drop, spawnBoss, foesLeft, lastN: 0, nd: 9 };
G.people = PEO;
