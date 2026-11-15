import { G, rand, INK } from './state.js';
import { CHARS } from './data/chars.js';
import { S } from './save.js';
import { attack, damage, spawn, shove, explode, later, slow, addCombo } from './engine.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import { rr, circ, line, txt, crackDecal } from './draw.js';
const M = Matter;

export const I = { left: false, right: false, jump: false, a: false, b: false, c: false };
export const P = { active: false };

export function spawnPlayer(id, x) {
  const body = M.Bodies.rectangle(x, 520 - 39, 44, 76, { inertia: Infinity, friction: 0, frictionAir: .01, restitution: 0, collisionFilter: { category: 32, mask: 1 } });
  M.World.add(G.world, body);
  Object.assign(P, { id, ch: CHARS[id], body, face: 1, walk: 0, swing: 0, cdA: 0, cdB: 0, n3: 0, air: 0, jumps: 0, slam: false, rush: 0, storm: 0, pj: false, pb: false, pc: false, active: true });
}

function hitFx(hits, heavy) {
  if (hits) { addCombo(hits); G.rage = Math.min(100, G.rage + hits); G.shake = Math.max(G.shake, heavy ? 8 : 2.5); if (heavy) G.hitstop = Math.max(G.hitstop, 60); buzz(8); }
  else sfx('whoosh', .6);
}
function shoot(a, big) {
  const p = P.body.position, pierce = !!a.pierce;
  spawn('proj', p.x + P.face * 30, p.y - 8, { ptype: a.proj, w: big ? 34 : 20, h: big ? 26 : 12, dmg: a.dmg, pierce, sensor: pierce, life: 70, v: { x: P.face * (big ? 13 : 18), y: pierce ? 0 : -1.5 }, av: P.face * .4 });
  sfx('whoosh', .5);
}

export function updatePlayer() {
  if (!P.active) return;
  const b = P.body, ch = P.ch, v = b.velocity, pos = b.position;
  const onG = pos.y >= 520 - 38 - 2.5 && v.y > -.5, k = P.rush > 0 ? 2 : 1;
  let vx = 0, vy = v.y;
  if (I.left) { vx = -ch.spd * k; P.face = -1; } if (I.right) { vx = ch.spd * k; P.face = 1; }
  if (P.slam) vx *= .3;
  if (onG) {
    if (P.slam) {
      P.slam = false; const B = ch.B;
      const h = attack(pos.x, 512, 150, B.dmg * .7, 10, 0, -1, { max: 12, radial: true, heavy: true });
      hitFx(h, true); G.shake = Math.max(G.shake, 10); G.hitstop = 70; sfx('wood'); crackDecal(pos.x, 532, 30); fx.puff(pos.x, 516, 14, '#cbbfa9', 6);
    }
    P.jumps = 0; P.air = 0;
  } else P.air++;
  if (I.jump && !P.pj) {
    if (onG) { vy = -ch.jump; P.jumps = 1; sfx('jump'); }
    else if (ch.dj && P.jumps < 2) { vy = -ch.jump * .9; P.jumps = 2; sfx('jump'); fx.puff(pos.x, pos.y + 36, 6, '#fff', 3); }
  }
  M.Body.setVelocity(b, { x: vx, y: vy });
  P.walk = vx && onG ? P.walk + .32 * k : 0;
  if (P.swing > 0) P.swing -= .14;
  P.cdA--; P.cdB--;
  if (I.a && P.cdA <= 0 && !P.slam) {
    const A = ch.A; P.cdA = A.cd / 16.67 / k; P.swing = 1; P.n3 = (P.n3 + 1) % 3; const third = P.n3 === 0;
    if (A.proj) shoot(A);
    else hitFx(attack(pos.x + P.face * (A.r * .7 + 8), pos.y - 4, A.r, A.dmg * (third ? 1.5 : 1), A.push * (third ? 2 : 1), P.face, A.up ? -1.1 : -.25), false);
  }
  if (I.b && !P.pb && P.cdB <= 0) {
    const B = ch.B;
    if (!onG) { P.slam = true; P.cdB = 20; M.Body.setVelocity(b, { x: 0, y: 22 }); sfx('whoosh'); }
    else {
      P.cdB = B.cd / 16.67 / k; P.swing = 1.4;
      if (B.proj) shoot(B, true);
      else {
        const h = attack(pos.x + P.face * (B.r * .6 + 8), pos.y - 10, B.r, B.dmg, B.push, P.face * .8, -.65, { heavy: true });
        hitFx(h, true);
        if (h && B.word) fx.word(pos.x + P.face * 60, pos.y - 70, B.word, 26, '#fff');
        if (!h) { crackDecal(pos.x + P.face * 60, pos.y - 20 + rand(-30, 30)); fx.note(pos.x + P.face * 60, pos.y - 50, '도배 50,000원'); G.money += 50000 * G.mult; }
      }
    }
  }
  if (I.c && !P.pc && G.rage >= 100) special();
  if (P.rush > 0) { P.rush--; if (G.tick % 3 === 0) fx.puff(pos.x, pos.y + 30, 2, '#F2B705', 2); }
  if (P.storm > 0) {
    P.storm--;
    if (P.storm % 6 === 0) { fx.sheets(8); for (const o of G.objs.slice()) if (o.hp != null && !o.dead) { damage(o, 4, o.body.position.x, o.body.position.y); shove(o, rand(1, 4), rand(-2, 0)); } sfx('paper', .4); }
  }
  for (let i = G.bombs.length - 1; i >= 0; i--) { const bm = G.bombs[i]; bm.y += bm.vy; bm.vy += .5; if (bm.y >= 488) { G.bombs.splice(i, 1); explode(bm.x, 480, 120, 60, 14); fx.cloud(bm.x, 480, 8, '#fff', 50); fx.burst(bm.x, 480, 40); sfx('boom', .7); } }
  if (vx && G.tick % 2 === 0) for (const o of G.objs) { if (o.fixed || o.body.mass > 4 || o.kind === 'proj') continue; const bb = o.body.bounds; if (bb.max.x > pos.x - 22 && bb.min.x < pos.x + 22 && bb.max.y > pos.y - 38 && bb.min.y < pos.y + 38) { const ov = o.body.velocity; M.Body.setVelocity(o.body, { x: ov.x * .7 + vx * .35, y: ov.y - .25 }); } }
  P.pj = I.jump; P.pb = I.b; P.pc = I.c;
}

function quakeWave(dmg) {
  for (const o of G.objs.slice()) { if (o.dead) continue; const p = o.body.position; shove(o, rand(-4, 4), -rand(9, 15)); if (o.hp != null) damage(o, dmg, p.x, p.y); }
  G.shake = 18; sfx('boom'); fx.puff(P.body.position.x, 516, 20, '#cbbfa9', 9); buzz([40, 30, 80]);
}
function special() {
  const sp = P.ch.sp, pos = P.body.position;
  G.rage = 0; G.hitstop = 100; G.flashW = 6; sfx('special'); fx.word(pos.x, pos.y - 70, sp.name + '!', 40, '#FF5C8A');
  if (sp.type === 'quake') { for (let i = 0; i < sp.n; i++) later(2 + i * 24, () => quakeWave(sp.dmg)); if (sp.slow) later(3, () => slow(.34, 90)); }
  else if (sp.type === 'rush') P.rush = 480;
  else if (sp.type === 'storm') P.storm = 180;
  else if (sp.type === 'line') for (let i = 0; i < 10; i++) later(2 + i * 4, () => { const p = P.body.position; spawn('proj', p.x + P.face * 30, p.y - 30 + rand(-30, 40), { ptype: 'ball', w: 12, h: 12, dmg: 50, pierce: true, sensor: true, life: 80, v: { x: P.face * 22, y: 0 } }); sfx('plastic', .5); });
  else if (sp.type === 'rain') for (let i = 0; i < 12; i++) later(2 + i * 6, () => G.bombs.push({ x: rand(50, G.W - 50), y: -20, vy: 6 }));
}

// 캐릭터 그림. (x,y)는 몸통 중심, 키 76.
export function drawChar(c, id, x, y, o = {}) {
  const ch = CHARS[id], walk = o.walk || 0, bob = Math.sin(walk * 2) * 1.5, lg = Math.sin(walk) * 8;
  c.save(); c.translate(x, y); c.scale(o.face || 1, 1); if (o.slam) c.rotate(.5);
  line(c, -8, 26, -8 - lg, 37, INK, 7); line(c, 8, 26, 8 + lg, 37, INK, 7);
  if (id === 'park') circ(c, -2, -16 + bob, 25, ch.col);
  rr(c, -17, 3 + bob * .4, 34, 26, 9, id === 'choi' ? '#fff' : ch.col);
  if (id === 'kim') { rr(c, -3, 5, 6, 14, 2, '#fff', 0); }
  if (id === 'choi') { line(c, 0, 6, 0, 22, ch.col, 5); }
  if (id === 'free') { c.fillStyle = '#fff'; [[-9, 10], [3, 18], [9, 9], [-4, 22]].forEach(([a, b]) => { c.beginPath(); c.arc(a, b + bob * .4, 2.5, 0, 6.29); c.fill(); }); }
  if (id === 'park') { rr(c, -6, 8, 10, 13, 2, '#fff', 2); }
  if (o.acc === 'chain') { c.beginPath(); c.arc(0, 4 + bob, 11, .3, 2.84); c.lineWidth = 4; c.strokeStyle = '#e3b23c'; c.stroke(); }
  const hy = -16 + bob;
  circ(c, 0, hy, 22, '#FFD9B0');
  c.fillStyle = INK;
  if (id === 'kim') { c.beginPath(); c.arc(0, hy, 22, 3.3, 6.2); c.lineTo(8, hy - 12); c.closePath(); c.fill(); line(c, -21, hy - 6, 21, hy - 8, '#E5342B', 5); line(c, -19, hy - 6, -30, hy + 8, '#E5342B', 5); }
  else if (id === 'park') { c.beginPath(); c.arc(0, hy, 22, 3.5, 5.9); c.closePath(); c.fill(); }
  else if (id === 'choi') { c.fillRect(-22, hy - 6, 6, 12); line(c, 4, hy + 6, 18, hy + 6, INK, 4); }
  else if (id === 'lee') { c.beginPath(); c.arc(0, hy, 23, 2.6, 6.6); c.lineTo(0, hy - 8); c.closePath(); c.fill(); circ(c, 4, hy - 2, 6, null, 2); circ(c, 16, hy - 2, 6, null, 2); }
  else if (id === 'jung') { c.beginPath(); c.arc(0, hy, 23, 3.14, 6.28); c.closePath(); c.fillStyle = ch.col; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); rr(c, 8, hy - 4, 22, 6, 3, ch.col, 2.5); }
  else if (id === 'free') { c.beginPath(); c.arc(0, hy, 22, 3.4, 6.0); c.closePath(); c.fill(); rr(c, 0, hy - 7, 22, 9, 3, INK, 0); }
  if (id !== 'lee' && id !== 'free') { c.fillStyle = INK; c.beginPath(); c.arc(5, hy - 1, 2.6, 0, 6.29); c.arc(15, hy - 1, 2.6, 0, 6.29); c.fill(); line(c, 1, hy - 8, 8, hy - 6, INK, 2.5); line(c, 19, hy - 8, 12, hy - 6, INK, 2.5); }
  if (id === 'lee') { c.fillStyle = INK; c.beginPath(); c.arc(4, hy - 2, 2, 0, 6.29); c.arc(16, hy - 2, 2, 0, 6.29); c.fill(); }
  if (o.swing > 0) circ(c, 10, hy + 10, 4.5, INK, 0); else line(c, 6, hy + 10, 15, hy + 10, INK, 2.5);
  if (o.acc === 'band') { rr(c, -22, hy - 14, 44, 9, 2, '#E5342B', 2); txt(c, '투쟁', 2, hy - 9, 8, '#fff'); }
  if (o.acc === 'sun') rr(c, -1, hy - 7, 23, 9, 3, INK, 0);
  if (o.acc === 'helmet') { c.beginPath(); c.arc(0, hy - 6, 23, 3.14, 6.28); c.closePath(); c.fillStyle = '#FFD84D'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); rr(c, -26, hy - 8, 52, 6, 3, '#FFD84D', 2.5); }
  const sw = Math.max(0, o.swing || 0), a = sw > 0 ? -2.0 + (1 - Math.min(1, sw)) * 3.0 : 1.1 + Math.sin(walk) * .3;
  c.save(); c.translate(5, 9 + bob * .4); c.rotate(a);
  line(c, 0, 0, 17, 0, INK, 7); line(c, 0, 0, 17, 0, '#FFD9B0', 3.5);
  const w = ch.wpn;
  if (w === 'bag') { rr(c, 15, -3, 26, 20, 3, '#7a4b22'); rr(c, 22, -8, 12, 7, 3, null, 2.5); }
  else if (w === 'fist') circ(c, 20, 0, 7.5, '#FFD9B0');
  else if (w === 'hammer') { line(c, 12, 0, 44, 0, '#8a5a2b', 6); rr(c, 38, -14, 18, 28, 3, '#777'); }
  else if (w === 'stapler') rr(c, 15, -6, 18, 11, 2, '#E5342B', 2.5);
  else if (w === 'golf') { line(c, 12, 0, 50, 0, '#aaa', 3.5); rr(c, 47, -2, 12, 9, 3, '#888', 2.5); }
  else if (w === 'envelope') { rr(c, 15, -8, 22, 15, 1, '#fff', 2.5); line(c, 15, -8, 26, 0, INK, 1.5); line(c, 37, -8, 26, 0, INK, 1.5); }
  c.restore();
  c.restore();
}
export function drawPlayer(c) {
  if (!P.active) return; const p = P.body.position;
  for (const b of G.bombs) { c.save(); c.translate(b.x, b.y); c.rotate(b.y * .05); rr(c, -13, -9, 26, 18, 1, '#fff', 2.5); txt(c, '사직서', 0, 1, 7, INK); c.restore(); }
  drawChar(c, P.id, p.x, p.y, { face: P.face, walk: P.walk, swing: P.swing, slam: P.slam, acc: S.acc });
}
