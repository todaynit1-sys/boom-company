import { G, rand, INK } from './state.js';
const TITLE = '"Black Han Sans","Noto Sans KR",sans-serif', BODY = '"Noto Sans KR",sans-serif';

export function part(p) { if (G.parts.length < (G.mobile ? 200 : 300)) G.parts.push(Object.assign({ vx: 0, vy: 0, g: .25, life: 30, size: 4, col: '#fff', type: 'sq', rot: rand(6.28) }, p, { max: p.life || 30 })); }
export function puff(x, y, n, col, spd = 4, o = {}) {
  for (let i = 0; i < n; i++) { const a = rand(6.28), s = rand(.3, 1) * spd; part(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, col, life: rand(14, 30) | 0, size: rand(2, 5) }, o)); }
}
export function sparks(x, y, n) { for (let i = 0; i < n; i++) { const a = rand(6.28), s = rand(2, 9); part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, col: rand() < .5 ? '#FFD84D' : '#FF8A1F', life: rand(10, 26) | 0, size: rand(2, 4), type: 'spark', g: .3 }); } }
export function drops(x, y, n, col, spd = 7) { for (let i = 0; i < n; i++) { const a = -rand(.2, 2.94), s = rand(2, spd); part({ x: x + rand(-10, 10), y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col, life: rand(30, 60) | 0, size: rand(3, 6), type: 'circ', g: .35 }); } }
export function cloud(x, y, n, col, r = 60) { for (let i = 0; i < n; i++) part({ x: x + rand(-r, r) * .5, y: y + rand(-r, r) * .5, vx: rand(-1.5, 1.5), vy: rand(-1.5, .3), col, life: rand(50, 100) | 0, size: rand(14, 34), type: 'cloud', g: -.01 }); }
export function chars(x, y, w, s, col = INK) {
  const n = s.length; for (let i = 0; i < n; i++) { if (s[i] === ' ') continue; part({ x: x - w / 2 + (i + .5) * w / n, y, vx: rand(-4, 4), vy: rand(-7, -2), col, life: rand(30, 50) | 0, size: 15, type: 'char', ch: s[i], g: .35 }); }
}
export function sheets(n) { for (let i = 0; i < n; i++) part({ x: rand(-60, 0), y: rand(40, 500), vx: rand(9, 18), vy: rand(-2, 2), col: '#fff', life: rand(60, 110) | 0, size: 16, type: 'sheet', g: 0 }); }
export function word(x, y, s, size = 30, col = '#FFD84D') { if (G.texts.length > 24) G.texts.shift(); G.texts.push({ x, y, s, size, col, rot: rand(-.21, .21), life: 42, max: 42, title: true }); }
export function note(x, y, s, col = '#E5342B', size = 15) { if (G.texts.length > 24) G.texts.shift(); G.texts.push({ x, y, s, size, col, rot: 0, life: 46, max: 46 }); }
export function burst(x, y, r = 22) { if (G.bursts.length < 12) G.bursts.push({ x, y, r, life: 5, rot: rand(6.28) }); }

export function update() {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.rot += p.vx * .05;
    if (p.type === 'cloud') { p.vx *= .96; p.vy *= .96; }
    if (p.y > 518 && p.g > 0) { p.y = 518; p.vy *= -.3; p.vx *= .7; }
    if (--p.life <= 0) P.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.y -= .7; if (--t.life <= 0) G.texts.splice(i, 1); }
  for (let i = G.bursts.length - 1; i >= 0; i--) if (--G.bursts[i].life <= 0) G.bursts.splice(i, 1);
}

export function draw(c) {
  for (const p of G.parts) {
    const a = Math.min(1, p.life / (p.max * .4));
    c.globalAlpha = p.type === 'cloud' ? a * .5 : a; c.fillStyle = p.col;
    if (p.type === 'circ' || p.type === 'cloud') { c.beginPath(); c.arc(p.x, p.y, p.size / (p.type === 'cloud' ? 1 : 2), 0, 6.29); c.fill(); }
    else if (p.type === 'char') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.font = '700 ' + p.size + 'px ' + BODY; c.textAlign = 'center'; c.fillText(p.ch, 0, 5); c.restore(); }
    else if (p.type === 'sheet') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-8, -10, 16, 20); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(-8, -10, 16, 20); c.restore(); }
    else if (p.type === 'spark') { c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    else { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); c.restore(); }
  }
  c.globalAlpha = 1;
  for (const b of G.bursts) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.rot); c.beginPath();
    for (let i = 0; i < 16; i++) { const r = i % 2 ? b.r * .45 : b.r * (1.3 - b.life * .08), a = i / 16 * 6.283; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#FFD84D'; c.stroke(); c.restore();
  }
  for (const t of G.texts) {
    const k = 1 - t.life / t.max, sc = k < .15 ? k / .15 * 1.2 : k < .25 ? 1.2 - (k - .15) * 2 : 1;
    c.save(); c.translate(t.x, t.y); c.rotate(t.rot); c.scale(sc, sc); c.globalAlpha = Math.min(1, t.life / 12);
    c.font = (t.title ? '400 ' : '900 ') + t.size + 'px ' + (t.title ? TITLE : BODY); c.textAlign = 'center'; c.lineJoin = 'round';
    c.lineWidth = t.title ? 6 : 4; c.strokeStyle = t.title ? INK : '#fff'; c.strokeText(t.s, 0, 0); c.fillStyle = t.col; c.fillText(t.s, 0, 0); c.restore();
  }
  c.globalAlpha = 1;
}
