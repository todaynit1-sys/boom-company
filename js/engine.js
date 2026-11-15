import { G, rand, pick, clamp, won } from './state.js';
import { DEFS, MATS } from './data/objects.js';
import * as fx from './fx.js';
import { sfx, buzz } from './audio.js';
import { bake, stain } from './draw.js';
const M = Matter;
const CATOF = { obj: 2, frag: 4, paper: 8, bubble: 16, popup: 16, proj: 2 };
const MASK = { obj: 1 | 2 | 4 | 16, frag: 1 | 2, paper: 1, bubble: 1 | 2 | 16, popup: 1 | 2 | 16, proj: 1 | 2 };

export function initWorld(W, scene) {
  G.W = W; G.cx = W / 2; G.scene = scene;
  G.engine = M.Engine.create(); G.world = G.engine.world;
  const st = { isStatic: true, friction: .8, collisionFilter: { category: 1, mask: 0xFFFF } };
  const top = scene === 'room' ? -100 : -900;
  M.World.add(G.world, [M.Bodies.rectangle(W / 2, 620, W + 800, 200, st), M.Bodies.rectangle(W / 2, top, W + 800, 200, st), M.Bodies.rectangle(-100, 0, 200, 3000, st), M.Bodies.rectangle(W + 100, 0, 200, 3000, st)]);
  M.Events.on(G.engine, 'collisionStart', e => { for (const p of e.pairs) G.hits.push(p.bodyA, p.bodyB); });
  Object.assign(G, { objs: [], removeQ: [], hits: [], timers: [], parts: [], texts: [], bursts: [], bombs: [], hitstop: 0, timeScale: 1, slowAcc: 0, slowUntil: 0, shake: 0, flashW: 0, dark: 0, mult: 1, onTick: null, onBreak: null, onStage: null });
  G.settle = G.tick + 50;
}

export function later(ticks, fn) { G.timers.push({ t: G.tick + ticks, fn }); }
export function slow(scale, realTicks) { G.timeScale = scale; G.slowUntil = G.real + realTicks; }

export function spawn(type, x, y, o = {}) {
  const def = DEFS[type], w = o.w || def.w, h = o.h || def.h, kind = o.kind || def.kind || 'obj';
  const opt = { density: def.d || .001, friction: def.fr ?? .6, frictionAir: def.air ?? .01, restitution: def.re ?? .12, collisionFilter: { category: CATOF[kind], mask: MASK[kind] } };
  if (o.sensor) opt.isSensor = true;
  const body = def.circle ? M.Bodies.circle(x, y, w / 2, opt) : o.tri ? M.Bodies.polygon(x, y, 3, w / 2, opt) : M.Bodies.rectangle(x, y, w, h, opt);
  const ob = Object.assign({}, o, { type, def, kind, body, w, h, mat: o.mat || def.mat, hp: o.hp ?? def.hp, price: o.price ?? def.price ?? 0, cracks: [], flash: 0, squash: 0, stage: 0, fixed: o.fix || def.fix || null, pvx: 0, pvy: 0, dead: false });
  ob.maxHp = ob.hp; body.g = ob;
  if (kind === 'bubble') M.Body.setInertia(body, Infinity);
  if (o.ang) M.Body.setAngle(body, o.ang);
  if (ob.fixed) M.Body.setStatic(body, true);
  else { if (o.v) M.Body.setVelocity(body, o.v); if (o.av) M.Body.setAngularVelocity(body, o.av); }
  M.World.add(G.world, body); G.objs.push(ob);
  return ob;
}
export function kill(o) { if (o.dead) return; o.dead = true; G.removeQ.push(o); }
const pushK = o => clamp(2.2 / Math.sqrt(o.body.mass), .15, 1.6);
export function shove(o, dx, dy) { if (o.body.isStatic) return; const v = o.body.velocity, k = pushK(o); M.Body.setVelocity(o.body, { x: v.x + dx * k, y: v.y + dy * k }); }

export function comboMult() { return G.combo >= 50 ? 3 : G.combo >= 25 ? 2 : G.combo >= 10 ? 1.5 : 1; }
export function addCombo(n) {
  const before = comboMult(), b10 = G.combo / 10 | 0;
  G.combo += n; G.comboT = 90; G.maxCombo = Math.max(G.maxCombo, G.combo);
  if ((G.combo / 10 | 0) > b10) { G.comboNote = G.combo; sfx('combo', 1, Math.min(8, G.combo / 10 | 0)); }
  if (comboMult() > before) G.flashW = 3;
}

// 반경 안 물건에 피해·밀기. 맞힌 개수를 돌려준다.
export function attack(cx, cy, r, dmg, push, dx, dy, opt = {}) {
  const list = [];
  for (const o of G.objs) {
    if (o.dead) continue; const b = o.body.bounds;
    const nx = clamp(cx, b.min.x, b.max.x), ny = clamp(cy, b.min.y, b.max.y), d = Math.hypot(cx - nx, cy - ny);
    if (d > r) continue;
    if (o.hp == null) { if (opt.radial) shove(o, (o.body.position.x - cx) / r * push, -push * .6); else shove(o, dx * push * .6, dy * push * .6); continue; }
    list.push([d, o, nx, ny]);
  }
  list.sort((a, b) => a[0] - b[0]);
  let hits = 0;
  for (const [d, o, nx, ny] of list.slice(0, opt.max || 6)) {
    const k = 1 - d / r * .5;
    if (opt.radial) { const p = o.body.position; shove(o, clamp((p.x - cx) / 60, -1, 1) * push * .5, -push); } else shove(o, dx * push, dy * push);
    damage(o, dmg * k, nx, ny); hits++;
    if (hits === 1) { fx.burst(nx, ny, opt.heavy ? 34 : 22); fx.puff(nx, ny, opt.heavy ? 10 : 6, o.def.cols ? o.def.cols[0] : '#ccc'); }
  }
  return hits;
}

export function damage(o, dmg, x, y) {
  if (o.dead || o.hp == null) return;
  if (G.timeScale < 1) dmg *= 2;
  o.hp -= dmg; o.flash = 3; o.squash = 7;
  if (o.cracks.length < 6 && dmg > 3) { const p = o.body.position, a = -o.body.angle, lx = x - p.x, ly = y - p.y; o.cracks.push({ x: clamp(lx * Math.cos(a) - ly * Math.sin(a), -o.w / 2 + 4, o.w / 2 - 4), y: clamp(lx * Math.sin(a) + ly * Math.cos(a), -o.h / 2 + 3, o.h / 2 - 3), s: rand(6) }); }
  if (o.hp <= 0) return breakObj(o);
  const r = o.hp / o.maxHp;
  if ((o.fixed === 'wall' || o.fixed === 'ceil') && r <= .5) { M.Body.setStatic(o.body, false); o.fixed = null; }
  if (o.culprit) { const st = r <= .33 ? 2 : r <= .66 ? 1 : 0; if (st > o.stage) { o.stage = st; G.onStage && G.onStage(o, st); } }
  sfx(o.kind === 'bubble' ? 'pop' : 'punch', .7);
}

export function breakObj(o) {
  if (o.dead) return; o.dead = true; G.removeQ.push(o);
  const p = o.body.position, m = MATS[o.mat], big = o.price >= 300000;
  const gain = o.price * comboMult() * G.mult;
  G.money += gain; G.rage = Math.min(100, G.rage + (o.kind === 'bubble' ? 3 : 5)); addCombo(1);
  if (o.kind === 'bubble' || o.kind === 'popup') { G.bubbles++; G.bubbleSum += gain; }
  else { const c = G.counts[o.type] || (G.counts[o.type] = { n: 0, sum: 0, name: o.def.n }); c.n++; c.sum += gain; }
  if (o.kind === 'bubble') { fx.chars(p.x, p.y, o.w - 20, o.text, o.mine ? '#E5342B' : undefined); sfx('pop'); fx.note(p.x, p.y - 22, '정신적 피해 +' + won(gain)); buzz(8); }
  else {
    fx.word(p.x, p.y - o.h / 2 - 6, pick(m.words), o.culprit ? 46 : big ? 38 : 28, o.culprit ? '#FF5C8A' : '#FFD84D');
    if (gain) fx.note(p.x, p.y - o.h / 2 - 34, '+' + won(gain));
    sfx(m.snd, big ? 1 : .7); if (o.culprit) sfx('boom');
    G.shake = Math.max(G.shake, o.culprit ? 18 : big ? 10 : 4); if (big) G.hitstop = Math.max(G.hitstop, 60); buzz(30);
    frags(o); spill(o);
  }
  G.onBreak && G.onBreak(o);
}

function frags(o) {
  const m = MATS[o.mat]; let n = o.def.frag ?? m.frag; if (G.mobile) n = Math.ceil(n * .7); if (!n) return;
  const p = o.body.position, v = o.body.velocity, s = clamp(Math.sqrt(o.w * o.h / n) * .7, 6, 26), cols = o.def.cols || ['#bbb'];
  for (let i = 0; i < n; i++) {
    const a = rand(6.28), sp = rand(3, 9);
    spawn('frag', p.x + rand(-.4, .4) * o.w, p.y + rand(-.4, .4) * o.h, { w: s * rand(.6, 1.3), h: s * rand(.5, 1.1), tri: m.tri, col: o.col || pick(cols), mat: o.mat, life: rand(210, 300) | 0, v: { x: v.x + Math.cos(a) * sp, y: v.y + Math.sin(a) * sp - 2 }, av: rand(-.3, .3) });
  }
}
const CMYK = ['#1aa7c7', '#d6338a', '#e8c41c', '#333'];
function spill(o) {
  const p = o.body.position, x = p.x, y = p.y;
  for (const [k, n, a, b] of o.def.spill || []) {
    if (k === 'a4' || k === 'bills') { const m = G.mobile ? Math.ceil(n * .6) : n; for (let i = 0; i < m; i++) spawn(k === 'a4' ? 'a4' : 'bill', x + rand(-.4, .4) * o.w, y + rand(-.4, .4) * o.h, { life: rand(300, 400) | 0, v: { x: rand(-7, 7), y: rand(-11, -2) }, av: rand(-.3, .3) }); }
    else if (k === 'crumple' || k === 'balls') for (let i = 0; i < n; i++) spawn(k === 'balls' ? 'ball' : 'crumple', x + rand(-10, 10), y + rand(-10, 10), { life: rand(260, 360) | 0, v: { x: rand(-6, 6), y: rand(-9, -3) } });
    else if (k === 'keys') fx.puff(x, y, n, '#e8e4da', 7, { size: 5, g: .4, life: 40 });
    else if (k === 'sparks') { fx.sparks(x, y, n); sfx('zap'); }
    else if (k === 'smoke') fx.cloud(x, y - 10, n, '#888', 40);
    else if (k === 'coffee') { fx.drops(x, y, n, '#7a4b22'); stain(x, 536, 18 + n * .6, '#7a4b22'); }
    else if (k === 'soil') fx.puff(x, y, n, '#6b4a2e', 5, { g: .4 });
    else if (k === 'water') { fx.drops(x, y, n, '#8fd0ff', 9); stain(x, 538, 60, '#8fd0ff', .5); sfx('water'); }
    else if (k === 'fish') fx.part({ x, y, vx: 2, vy: -8, col: '#FF8A1F', life: 90, size: 12, type: 'circ', g: .3 });
    else if (k === 'boom') later(4, () => { explode(x, y, n, a, 12); fx.cloud(x, y, 18, b === 'cmyk' ? pick(CMYK) : b, n * .6); if (b === 'cmyk') CMYK.forEach(c => fx.cloud(x, y, 5, c, n * .7)); stain(x, 536, n * .5, b === 'cmyk' ? '#333' : '#fff', .5); sfx('boom', .8); });
  }
}

export function explode(x, y, r, dmg, push) {
  for (const o of G.objs.slice()) {
    if (o.dead) continue; const p = o.body.position, d = Math.hypot(p.x - x, p.y - y); if (d > r) continue;
    const k = 1 - d / r * .6, a = Math.atan2(p.y - y - 12, p.x - x);
    shove(o, Math.cos(a) * push * k, Math.sin(a) * push * k - push * .3);
    if (dmg && o.hp != null) damage(o, dmg * k, p.x, p.y);
  }
  G.shake = Math.max(G.shake, 10);
}

function projHit(pr, t) {
  if (pr.dead) return;
  if (!t) { if (!pr.pierce) kill(pr); return; }
  if (t.hp == null || t.dead || t.kind === 'proj') return;
  if (!pr.seen) pr.seen = new Set(); if (pr.seen.has(t)) return; pr.seen.add(t);
  const p = pr.body.position; damage(t, pr.dmg, p.x, p.y); shove(t, Math.sign(pr.pvx || 1) * 4, -1.5); fx.burst(p.x, p.y, 18);
  addCombo(1); G.rage = Math.min(100, G.rage + 1);
  if (!pr.pierce) kill(pr);
}
function impact(X, Y, rel) {
  if (!X || X.dead || X.hp == null || X.kind !== 'obj') return;
  if (Y && Y.kind !== 'obj' && Y.kind !== 'frag') return;
  const hard = Y ? (Y.kind === 'frag' ? .3 : MATS[Y.mat].hard) : 1, dmg = (rel - 7) * 1.6 * MATS[X.mat].weak * hard;
  if (dmg >= 1) { const p = X.body.position; damage(X, dmg, p.x, p.y); }
}

export function tick() {
  G.real++;
  if (G.timeScale < 1 && G.real >= G.slowUntil) G.timeScale = 1;
  if (G.flashW > 0) G.flashW--;
  if (G.hitstop > 0) { G.hitstop -= 16.7; return; }
  G.slowAcc += G.timeScale; if (G.slowAcc < 1) return; G.slowAcc -= 1;
  G.tick++;
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.timers[i].t <= G.tick) { const t = G.timers.splice(i, 1)[0]; t.fn(); }
  G.onTick && G.onTick();
  if (!G.engine) return;
  for (const o of G.objs) {
    const b = o.body, v = b.velocity; o.pvx = v.x; o.pvy = v.y;
    if (o.flash > 0) o.flash--; if (o.squash > 0) o.squash--;
    if (o.kind === 'bubble') M.Body.applyForce(b, b.position, { x: 0, y: -b.mass * .0008 });
    else if (o.pierce) M.Body.applyForce(b, b.position, { x: 0, y: -b.mass * .001 });
    const sp = Math.hypot(v.x, v.y); if (sp > 40) M.Body.setVelocity(b, { x: v.x / sp * 40, y: v.y / sp * 40 });
    if (o.life != null && --o.life <= 0 && !o.dead) { if (o.kind !== 'proj' && sp < 1.5 && b.position.y > 470) bake(o); kill(o); }
  }
  M.Engine.update(G.engine, 1000 / 60);
  const hs = G.hits; G.hits = [];
  for (let i = 0; i < hs.length; i += 2) {
    const A = hs[i].g, B = hs[i + 1].g;
    if (A && A.kind === 'proj') projHit(A, B); if (B && B.kind === 'proj') projHit(B, A);
    if (G.tick < G.settle) continue;
    const rel = Math.hypot((A ? A.pvx : 0) - (B ? B.pvx : 0), (A ? A.pvy : 0) - (B ? B.pvy : 0));
    if (rel < 7) continue;
    impact(A, B, rel); impact(B, A, rel);
  }
  const cap = G.mobile ? 100 : 140;
  if (G.objs.length > cap) { let n = G.objs.length - cap; for (const o of G.objs) { if (n <= 0) break; if (!o.dead && (o.kind === 'frag' || o.kind === 'paper')) { if (o.body.position.y > 470) bake(o); kill(o); n--; } } }
  if (G.removeQ.length) { for (const o of G.removeQ) M.World.remove(G.world, o.body); G.removeQ = []; G.objs = G.objs.filter(o => !o.dead); }
  fx.update();
  if (G.comboT > 0 && --G.comboT === 0) G.combo = 0;
  G.shake *= .86; if (G.shake < .3) G.shake = 0;
}
