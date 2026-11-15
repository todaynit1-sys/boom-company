import { G, INK, rand } from './state.js';
import * as fx from './fx.js';
const TITLE = '"Black Han Sans","Noto Sans KR",sans-serif', BODY = '"Noto Sans KR",sans-serif';

export function rr(c, x, y, w, h, r, fill, lw = 3) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } }
export function circ(c, x, y, r, fill, lw = 3) { c.beginPath(); c.arc(x, y, r, 0, 6.29); if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } }
export function line(c, x1, y1, x2, y2, col = INK, lw = 3) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = lw; c.strokeStyle = col; c.lineCap = 'round'; c.stroke(); }
export function txt(c, s, x, y, size, col = INK, title = false, maxW) { c.font = (title ? '400 ' : '700 ') + size + 'px ' + (title ? TITLE : BODY); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y, maxW); c.textBaseline = 'alphabetic'; }
const mctx = document.createElement('canvas').getContext('2d');
export function textW(s, size = 15) { mctx.font = '700 ' + size + 'px ' + BODY; return mctx.measureText(s).width; }

function screenArt(c, o, x, y, w, h) {
  let s = o.screen || 'off'; const r = o.hp / o.maxHp;
  if (r < .5 && s !== 'off') s = (G.tick >> 3) % 3 === 0 ? 'blue' : s;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  if (s === 'update') { c.fillStyle = '#2F6BFF'; c.fillRect(x, y, w, h); txt(c, '업데이트 중', x + w / 2, y + h * .32, 11, '#fff'); txt(c, '37%', x + w / 2, y + h * .65, 17, '#fff'); }
  else if (s === 'sheet') { c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.fillStyle = '#1F9D57'; c.fillRect(x, y, w, h * .2); c.strokeStyle = '#cfd8cf'; c.lineWidth = 1; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x, y + h * .2 + i * h * .16); c.lineTo(x + w, y + h * .2 + i * h * .16); c.moveTo(x + i * w / 5, y + h * .2); c.lineTo(x + i * w / 5, y + h); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(x, y + h * .35, w, h * .34); txt(c, '응답 없음', x + w / 2, y + h * .53, 12, '#777'); }
  else if (s === 'chat') { c.fillStyle = '#FBF7EE'; c.fillRect(x, y, w, h); for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#FFD84D' : '#dfe6ee'; c.fillRect(x + (i % 2 ? w * .3 : 6), y + 5 + i * h * .23, w * .62, h * .16); } }
  else if (s === 'slide') { c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.fillStyle = '#FFD84D'; c.fillRect(x, y, w, h * .22); txt(c, o.text || '3 / 126', x + w / 2, y + h * .6, Math.min(22, h * .28), INK, true); }
  else if (s === 'blue') { c.fillStyle = '#1846c9'; c.fillRect(x, y, w, h); txt(c, ':(', x + w * .3, y + h * .45, h * .4, '#fff'); }
  else { c.fillStyle = '#1b1d22'; c.fillRect(x, y, w, h); }
  c.restore(); c.lineWidth = 2; c.strokeStyle = INK; c.strokeRect(x, y, w, h);
}

const D = {
  _box(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, o.col || o.def.cols[0]); },
  monitor(c, o, w, h) { rr(c, -7, h / 2 - 18, 14, 12, 0, '#555'); rr(c, -28, h / 2 - 8, 56, 8, 3, '#555'); rr(c, -w / 2, -h / 2, w, h - 16, 6, '#3a3f4b'); screenArt(c, o, -w / 2 + 7, -h / 2 + 7, w - 14, h - 30); },
  pc(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#cfd3d8'); rr(c, -w / 2 + 7, -h / 2 + 8, w - 14, 8, 2, '#9aa3ab', 2); rr(c, -w / 2 + 7, -h / 2 + 22, w - 14, 8, 2, '#9aa3ab', 2); circ(c, 0, h / 2 - 18, 5, o.hp / o.maxHp < .5 ? '#E5342B' : '#1F9D57', 2); },
  keyboard(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#e8e4da'); c.fillStyle = '#9b9486'; for (let i = 0; i < 11; i++) { c.fillRect(-w / 2 + 6 + i * 8, -3, 5, 3); c.fillRect(-w / 2 + 8 + i * 8, 2, 5, 3); } },
  mouse(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 6, '#e8e4da'); },
  laptop(c, o, w, h) { rr(c, -w / 2 + 4, -h / 2, w - 8, h - 8, 4, '#3a3f4b'); screenArt(c, Object.assign({}, o, { screen: o.screen || 'sheet' }), -w / 2 + 9, -h / 2 + 5, w - 18, h - 19); rr(c, -w / 2, h / 2 - 8, w, 8, 3, '#b9bec6'); },
  mug(c, o, w, h) { c.beginPath(); c.arc(w / 2, 1, 7, -1.4, 1.4); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); rr(c, -w / 2, -h / 2, w, h, 4, o.col || '#fff'); line(c, -w / 2 + 4, -h / 2 + 5, w / 2 - 4, -h / 2 + 5, '#7a4b22', 3); },
  phone(c, o, w, h) { const j = o.ringing ? Math.sin(G.tick * 1.3) * 2 : 0; rr(c, -w / 2, -h / 2 + 8, w, h - 8, 4, '#3d4350'); rr(c, -w / 2 + 2 + j, -h / 2, w * .55, 11, 5, '#5a6170'); c.fillStyle = '#cfd3d8'; for (let i = 0; i < 6; i++) c.fillRect(w * .12 + (i % 3) * 7, -h / 2 + 14 + (i / 3 | 0) * 6, 4, 3); },
  papers(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 2, '#fff'); for (let y = -h / 2 + 5; y < h / 2 - 1; y += 5) line(c, -w / 2 + 2, y, w / 2 - 2, y, '#c9c4b8', 1.2); },
  binder(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#3b5b8c'); rr(c, -w / 2 + 6, -h / 2 + 12, w - 12, h - 20, 1, '#fff', 2); rr(c, -9, -h / 2 - 2, 18, 9, 2, '#9aa3ab', 2); },
  box(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#c99a5b'); c.fillStyle = '#a97c42'; c.fillRect(-5, -h / 2 + 1.5, 10, h - 3); txt(c, 'A4', -w / 4, 4, 11, '#7a5a2e'); },
  trash(c, o, w, h) { c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2 - 5, h / 2); c.lineTo(-w / 2 + 5, h / 2); c.closePath(); c.fillStyle = '#9aa3ab'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); for (let i = -1; i < 2; i++) line(c, i * 8, -h / 2 + 5, i * 7, h / 2 - 4, '#6f7880', 2); circ(c, -4, -h / 2 - 2, 6, '#fff', 2); },
  plant(c, o, w, h) { c.fillStyle = '#3c9a4e'; c.strokeStyle = INK; c.lineWidth = 3; [[-9, -8, -.5], [9, -8, .5], [0, -14, 0]].forEach(([x, y, a]) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(0, -6, 8, 15, 0, 0, 6.29); c.fill(); c.stroke(); c.restore(); }); c.beginPath(); c.moveTo(-w / 2, 4); c.lineTo(w / 2, 4); c.lineTo(w / 2 - 5, h / 2); c.lineTo(-w / 2 + 5, h / 2); c.closePath(); c.fillStyle = '#c8683f'; c.fill(); c.stroke(); },
  chair(c, o, w, h) { line(c, 0, 4, 0, h / 2 - 8, '#2d3440', 6); line(c, -w / 2 + 4, h / 2 - 6, w / 2 - 4, h / 2 - 6, '#2d3440', 5); circ(c, -w / 2 + 5, h / 2 - 5, 4, '#222', 2); circ(c, w / 2 - 5, h / 2 - 5, 4, '#222', 2); rr(c, -w / 2 + 4, -h / 2, w - 8, 38, 8, '#4a5568'); rr(c, -w / 2, -2, w, 12, 5, '#4a5568'); },
  cabinet(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#9aa7b3'); for (let i = 0; i < 3; i++) { rr(c, -w / 2 + 6, -h / 2 + 6 + i * (h - 8) / 3, w - 12, (h - 8) / 3 - 6, 2, '#b3bec8', 2); rr(c, -8, -h / 2 + 14 + i * (h - 8) / 3, 16, 5, 2, '#5f6b76', 0); } },
  watercooler(c, o, w, h) { rr(c, -w / 2 + 6, -h / 2, w - 12, h * .38, 9, 'rgba(143,208,255,.85)'); rr(c, -w / 2, -h / 2 + h * .36, w, h * .64, 4, '#fff'); circ(c, -7, -h / 2 + h * .5, 4, '#2F6BFF', 2); circ(c, 7, -h / 2 + h * .5, 4, '#E5342B', 2); rr(c, -w / 2 + 6, h * .1, w - 12, 12, 2, '#cfd3d8', 2); },
  extinguisher(c, o, w, h) { rr(c, -4, -h / 2, 8, 10, 2, '#333', 2); line(c, 4, -h / 2 + 4, 13, -h / 2 + 10, INK, 3); rr(c, -w / 2, -h / 2 + 8, w, h - 8, 7, '#E5342B'); rr(c, -w / 2 + 4, -4, w - 8, 12, 1, '#fff', 0); },
  toner(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#333'); c.fillStyle = o.col || '#1aa7c7'; c.fillRect(-w / 2 + 6, -3, w - 12, 6); },
  clock(c, o, w) { const r = w / 2; circ(c, 0, 0, r, '#fff'); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; line(c, Math.cos(a) * (r - 6), Math.sin(a) * (r - 6), Math.cos(a) * (r - 3), Math.sin(a) * (r - 3), INK, 1.5); } const m = o.clockT ?? 600; const ha = (m / 60 % 12) / 12 * 6.283 - 1.571, ma = (m % 60) / 60 * 6.283 - 1.571; line(c, 0, 0, Math.cos(ha) * r * .5, Math.sin(ha) * r * .5, INK, 3.5); line(c, 0, 0, Math.cos(ma) * r * .75, Math.sin(ma) * r * .75, '#E5342B', 2.5); },
  frame(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#8a5a2b'); rr(c, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 1, '#FBF7EE', 2); txt(c, o.text || '열정', 0, 1, Math.min(18, h * .4), INK, true, w - 20); },
  portrait(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#c9a227'); rr(c, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 1, '#FBF7EE', 2); circ(c, 0, -10, 13, '#555', 0); rr(c, -19, 6, 38, 26, 12, '#555', 0); txt(c, '대표', 0, h / 2 - 13, 9, '#FBF7EE'); },
  banner(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 2, '#fff'); c.strokeStyle = '#E5342B'; c.lineWidth = 2; c.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8); txt(c, o.text || '파이팅', 0, 1, 20, '#E5342B', true, w - 20); },
  whiteboard(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#c9ccd1'); rr(c, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 1, '#fff', 2); c.strokeStyle = '#2F6BFF'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-w / 2 + 18, h / 2 - 20); c.lineTo(-20, 5); c.lineTo(10, 14); c.lineTo(w / 2 - 22, -h / 2 + 22); c.stroke(); txt(c, '매출 ↗ ?', -w / 4, -h / 2 + 22, 13, '#E5342B'); },
  screen(c, o, w, h) { rr(c, -w / 2, -h / 2 - 4, w, 8, 3, '#777', 2); screenArt(c, Object.assign({}, o, { screen: o.dark ? 'off' : 'slide' }), -w / 2 + 4, -h / 2 + 4, w - 8, h - 6); },
  light(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#fffbe0', 2); },
  desk(c, o, w, h) { if (!o.def.noLegs && o.body.isStatic) { const L = 520 - o.body.position.y; rr(c, -w / 2 + 8, 0, 10, L, 2, o.def.cols[1]); rr(c, w / 2 - 18, 0, 10, L, 2, o.def.cols[1]); } rr(c, -w / 2, -h / 2, w, h, 4, o.def.cols[0]); },
  partition(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#8FA3B0'); },
  nameplate(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#2b2b2b'); txt(c, o.text || '부장', 0, 1, 12, '#e3b23c', false, w - 8); },
  trophy(c, o, w, h) { rr(c, -w / 2 + 3, h / 2 - 9, w - 6, 9, 2, '#6b431d', 2); rr(c, -3, 2, 6, h / 2 - 10, 0, '#e3b23c', 2); c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 4, 4); c.lineTo(-w / 4, 4); c.closePath(); c.fillStyle = '#e3b23c'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); },
  golfbag(c, o, w, h) { line(c, -8, -h / 2 + 12, -14, -h / 2 - 16, '#aaa', 3); line(c, 2, -h / 2 + 12, 4, -h / 2 - 22, '#aaa', 3); line(c, 10, -h / 2 + 12, 18, -h / 2 - 12, '#aaa', 3); circ(c, 4, -h / 2 - 24, 5, '#ddd', 2); rr(c, -w / 2, -h / 2 + 8, w, h - 8, 8, '#5a3e8a'); rr(c, -w / 2 + 6, 6, w - 12, 30, 4, '#7b5db3', 2); },
  bottle(c, o, w, h) { rr(c, -3.5, -h / 2, 7, 14, 2, o.col || '#3c9a4e', 2); rr(c, -w / 2, -h / 2 + 12, w, h - 12, 4, o.col || '#3c9a4e', 2.5); c.fillStyle = '#fff'; c.fillRect(-w / 2 + 2, 0, w - 4, 9); },
  glass(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 3, '#f3c64a', 2.5); c.fillStyle = '#fff'; c.fillRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, 7); },
  fishbowl(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 20, '#bfe6ff'); c.fillStyle = '#FF8A1F'; const fxp = Math.sin(G.tick * .04) * 12; c.beginPath(); c.ellipse(fxp, 4, 9, 5, 0, 0, 6.29); c.fill(); c.beginPath(); c.moveTo(fxp - 8, 4); c.lineTo(fxp - 15, -1); c.lineTo(fxp - 15, 9); c.fill(); },
  microwave(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#e8e4da'); rr(c, -w / 2 + 6, -h / 2 + 6, w * .6, h - 12, 2, '#333', 2); circ(c, w / 2 - 11, -6, 4, '#9aa3ab', 2); circ(c, w / 2 - 11, 8, 4, '#9aa3ab', 2); },
  fridge(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 6, '#e3e8ec'); line(c, -w / 2, -h / 2 + h * .35, w / 2, -h / 2 + h * .35, INK, 3); rr(c, w / 2 - 14, -h / 2 + 14, 5, 26, 2, '#9aa3ab', 2); rr(c, w / 2 - 14, -h / 2 + h * .35 + 12, 5, 34, 2, '#9aa3ab', 2); rr(c, -w / 2 + 10, -8, 30, 24, 1, '#FFD84D', 2); },
  noodle(c, o, w, h) { c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2 - 4, h / 2); c.lineTo(-w / 2 + 4, h / 2); c.closePath(); c.fillStyle = '#E5342B'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#fff'; c.fillRect(-w / 2 + 3, -4, w - 6, 8); },
  grill(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#444'); for (let i = -2; i < 3; i++) line(c, i * 10, -h / 2 + 3, i * 10, h / 2 - 3, '#222', 2); circ(c, -14, -h / 2 - 3, 6, '#c8683f', 2); circ(c, 8, -h / 2 - 3, 6, '#c8683f', 2); },
  tamb(c, o, w) { circ(c, 0, 0, w / 2, '#FF5C8A'); circ(c, 0, 0, w / 2 - 6, '#fff', 2); },
  cart(c, o, w, h) { line(c, -w / 2 + 6, -h / 2 + 30, -w / 2 + 6, h / 2 - 10, '#6f7880', 5); line(c, w / 2 - 6, -h / 2 + 30, w / 2 - 6, h / 2 - 10, '#6f7880', 5); rr(c, -w / 2, h / 2 - 24, w, 10, 3, '#9aa3ab'); rr(c, -w / 2, -h / 2 + 30, w, 10, 3, '#9aa3ab'); circ(c, -w / 2 + 10, h / 2 - 6, 6, '#222', 2); circ(c, w / 2 - 10, h / 2 - 6, 6, '#222', 2); const k = 1 - o.stage * .3; D.papers(c, o, w - 20, 1); for (let i = 0; i < 3; i++) { const ph = 30 * k; c.save(); c.translate((i - 1) * 24, -h / 2 + 30 - ph / 2); D.papers(c, o, 22, ph); c.restore(); } c.save(); c.translate(0, h / 2 - 34); D.papers(c, o, w - 26, 18); c.restore(); },
  printer(c, o, w, h) { rr(c, -w / 2 + 8, 10, w - 16, h / 2 - 10, 3, '#bdb7a8'); rr(c, -w / 2, -h / 2 + 34, w, 62, 6, '#e9e6df'); if (o.stage < 2) { c.save(); c.translate(0, -h / 2 + 22); if (o.stage === 1) c.rotate(Math.sin(G.tick * .5) * .05); rr(c, -w / 2 + 4, -14, w - 8, 28, 5, '#d8d4ca'); c.restore(); } else { c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) c.fillRect(-30 + i * 22, -h / 2 + 14 - (G.tick * (i + 2)) % 16, 16, 22); } rr(c, -w / 2 + 10, -h / 2 + 44, 66, 24, 2, '#1b1d22', 2); txt(c, o.stage < 2 ? '용지 걸림' : '!!오류!!', -w / 2 + 43, -h / 2 + 57, 12, '#ff5247'); circ(c, w / 2 - 20, -h / 2 + 56, 7, '#E5342B', 2); rr(c, -w / 2 + 14, -h / 2 + 76, w - 28, 8, 2, '#333', 0); rr(c, -w / 2 + 14, 22, w - 28, 16, 2, '#d8d4ca', 2); rr(c, -w / 2 + 14, 44, w - 28, 16, 2, '#d8d4ca', 2); },
  stamp(c, o, w, h) { rr(c, -11, -h / 2, 22, 54, 9, '#8a5a2b'); rr(c, -w / 2 + 8, -h / 2 + 46, w - 16, 22, 5, '#a97241'); rr(c, -w / 2, h / 2 - 30, w, 30, 4, '#E5342B'); txt(c, '반려', 0, h / 2 - 14, 20, '#fff', true); },
  projector(c, o, w, h) { line(c, 0, -h / 2, 0, -h / 2 - 190, '#777', 5); c.fillStyle = 'rgba(255,240,170,.16)'; if (!o.dead) { c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2 - 110, -44); c.lineTo(-w / 2 - 110, 44); c.fill(); } rr(c, -w / 2, -h / 2, w, h, 6, '#f1f1f1'); circ(c, -w / 2 + 14, 0, 9, '#8fd0ff', 2.5); circ(c, w / 2 - 12, -5, 3, '#E5342B', 0); },
  coffee(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 6, '#4a4f57'); rr(c, -w / 2 + 8, -h / 2 + 8, w - 16, 20, 3, '#2d3138', 2); rr(c, -8, -h / 2 + 30, 16, 12, 2, '#9aa3ab', 2); rr(c, -14, h / 2 - 28, 28, 22, 3, '#fff', 2); c.save(); c.translate(w / 2 - 20, -h / 2 + 22); c.rotate(.15); rr(c, -17, -13, 34, 26, 1, '#FFD84D', 2); txt(c, '고장', 0, 1, 13, INK); c.restore(); },
  karaoke(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 6, '#333'); rr(c, -w / 2 + 10, -h / 2 + 10, w - 20, 40, 3, '#FF5C8A', 2); txt(c, '♪ 98점', 0, -h / 2 + 31, 15, '#fff'); circ(c, -22, 24, 16, '#555'); circ(c, -22, 24, 6, '#222', 0); circ(c, 22, 24, 16, '#555'); circ(c, 22, 24, 6, '#222', 0); },
  safe(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 6, '#5b6570'); rr(c, -w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 4, '#6f7a86', 2.5); circ(c, -8, 0, 15, '#cfd3d8'); line(c, -8, 0, -8, -11, INK, 3); rr(c, 22, -14, 8, 28, 3, '#e3b23c', 2); },
  block(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 1, o.col); rr(c, -w / 2 + 9, -h / 2 + 10, w / 2 - 14, h - 22, 1, o.col2, 2); rr(c, 5, -h / 2 + 10, w / 2 - 14, h - 22, 1, o.col2, 2); },
  letter(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#fff'); txt(c, o.text, 0, 2, 26, '#E5342B', true); },
  bubble(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 13, '#fff', 0); c.lineWidth = 3; c.strokeStyle = o.mine ? '#E5342B' : INK; c.stroke(); txt(c, o.text, 0, 1, 15, o.mine ? '#E5342B' : INK); },
  popup(c, o, w, h) { rr(c, -w / 2, -h / 2, w, h, 4, '#fff'); c.fillStyle = '#2F6BFF'; c.fillRect(-w / 2 + 1.5, -h / 2 + 1.5, w - 3, 14); txt(c, '×', w / 2 - 10, -h / 2 + 9, 11, '#fff'); txt(c, o.text, 0, 4, 11, INK, false, w - 12); rr(c, -16, h / 2 - 15, 32, 11, 2, '#e8e4da', 1.5); },
  frag(c, o, w, h) { c.fillStyle = o.col || '#bbb'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); if (o.tri) { c.moveTo(w / 2, 0); c.lineTo(-w / 4, w * .43); c.lineTo(-w / 4, -w * .43); c.closePath(); } else c.rect(-w / 2, -h / 2, w, h); c.fill(); c.stroke(); },
  a4(c, o, w, h) { c.fillStyle = '#fff'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(-w / 2, -h / 2, w, h); line(c, -w / 2 + 4, -4, w / 2 - 4, -4, '#bbb', 1.5); line(c, -w / 2 + 4, 2, w / 2 - 4, 2, '#bbb', 1.5); },
  bill(c, o, w, h) { c.fillStyle = '#b9e3b0'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = '#2b7a3b'; c.lineWidth = 1.5; c.strokeRect(-w / 2, -h / 2, w, h); circ(c, 0, 0, 3, '#2b7a3b', 0); },
  crumple(c, o, w) { circ(c, 0, 0, w / 2, '#fff', 2); line(c, -3, -2, 2, 1, '#bbb', 1.5); },
  ball(c, o, w) { circ(c, 0, 0, w / 2, '#fff', 2); },
  proj(c, o, w, h) { if (o.ptype === 'envelope') { rr(c, -w / 2, -h / 2, w, h, 1, '#fff', 2); line(c, -w / 2, -h / 2, 0, 1, INK, 1.5); line(c, w / 2, -h / 2, 0, 1, INK, 1.5); } else if (o.ptype === 'ball') circ(c, 0, 0, w / 2, '#fff', 2); else if (o.ptype === 'binderang') rr(c, -w / 2, -h / 2, w, h, 3, '#3b5b8c', 2.5); else rr(c, -w / 2, -h / 2, w, h, 2, '#E5342B', 2); },
};
D.table = D.lowtable = D.shelf = D.desk;

export function drawObj(c, o, flat) {
  const b = o.body, p = b.position;
  c.save(); c.translate(p.x, p.y); c.rotate(b.angle);
  if (!flat) {
    if (o.squash > 0) { const k = 1 + o.squash * .012; c.scale(k, k); }
    if (o.life != null && o.life < 30) c.globalAlpha = o.life / 30;
  }
  (D[o.type] || D._box)(c, o, o.w, o.h);
  if (o.cracks && o.cracks.length) {
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath();
    for (const k of o.cracks) for (let i = 0; i < 6; i++) { const a = i * 1.05 + k.s, len = 5 + ((k.s * 97 + i * 31) % 10); c.moveTo(k.x, k.y); c.lineTo(k.x + Math.cos(a) * len * .5, k.y + Math.sin(a) * len * .5 + 1); c.lineTo(k.x + Math.cos(a + .3) * len, k.y + Math.sin(a + .3) * len); }
    c.stroke();
  }
  if (!flat && o.flash > 0 && !G.calm) { c.globalAlpha = .7; c.fillStyle = '#fff'; if (o.def.circle) { c.beginPath(); c.arc(0, 0, o.w / 2, 0, 6.29); c.fill(); } else c.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); }
  c.restore();
}

const DS = 2;
function mk(W) { const cv = document.createElement('canvas'); cv.width = W * DS; cv.height = 560 * DS; const c = cv.getContext('2d'); c.setTransform(DS, 0, 0, DS, 0, 0); return [cv, c]; }
export function makeLayers(W) { const [d, dc] = mk(W); G.decal = d; G.dctx = dc; const [b, bc] = mk(W); G.bg = b; return bc; }
export function bake(o) { if (G.dctx) drawObj(G.dctx, o, true); }
export function stain(x, y, r, col, a = .55) { const c = G.dctx; if (!c) return; c.globalAlpha = a; c.fillStyle = col; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + rand(-r, r) * .6, y + rand(-4, 4), rand(.3, .7) * r, rand(.15, .3) * r, 0, 0, 6.29); c.fill(); } c.globalAlpha = 1; }
export function crackDecal(x, y, r = 26) { const c = G.dctx; if (!c) return; c.strokeStyle = INK; c.lineWidth = 2; c.globalAlpha = .7; c.beginPath(); for (let i = 0; i < 7; i++) { const a = i * .9 + rand(.5), l = rand(.4, 1) * r; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l * .5 + rand(-3, 3), y + Math.sin(a) * l * .5 + rand(-3, 3)); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); } c.stroke(); c.globalAlpha = 1; }
export function stampDecal(x, y, s, col = '#E5342B', size = 34) { const c = G.dctx; if (!c) return; c.save(); c.translate(x, y); c.rotate(rand(-.3, .3)); c.globalAlpha = .8; c.strokeStyle = col; c.lineWidth = 4; const w = size * s.length * .95 + 16; c.strokeRect(-w / 2, -size * .7, w, size * 1.4); txt(c, s, 0, 2, size, col, true); c.restore(); c.globalAlpha = 1; }

const SKY = { day: '#BFE3FF', evening: '#FFB877', night: '#27325a' };
export function roomBg(room) {
  const c = makeLayers(G.W), W = G.W, cx = G.cx;
  c.fillStyle = room.wall; c.fillRect(0, 0, W, 520);
  c.fillStyle = 'rgba(0,0,0,.045)'; for (let x = 0; x < W; x += 60) c.fillRect(x, 0, 2, 520);
  for (const wx of room.win || []) {
    rr(c, cx + wx - 60, 70, 120, 150, 4, SKY[room.sky]); line(c, cx + wx, 70, cx + wx, 220, INK, 3); line(c, cx + wx - 60, 145, cx + wx + 60, 145, INK, 3);
    if (room.sky === 'night') { circ(c, cx + wx + 28, 100, 11, '#FFE9A8', 0); c.fillStyle = '#3d4a80'; c.fillRect(cx + wx - 56, 180, 30, 38); c.fillRect(cx + wx + 8, 165, 40, 53); }
    else if (room.sky === 'evening') circ(c, cx + wx - 25, 185, 16, '#FF7A3D', 0);
    else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(cx + wx - 20, 105, 22, 9, 0, 0, 6.29); c.fill(); }
  }
  if (room.door) { const dx = cx + room.door; rr(c, dx - 45, 300, 90, 220, 3, '#8a5a2b'); rr(c, dx - 32, 315, 64, 90, 2, '#d9e2e6', 2); c.fillStyle = 'rgba(42,37,34,.35)'; c.beginPath(); c.arc(dx, 350, 16, 0, 6.29); c.fill(); c.fillRect(dx - 22, 366, 44, 38); circ(c, dx - 32, 430, 5, '#e3b23c', 2); }
  c.fillStyle = 'rgba(42,37,34,.18)'; c.fillRect(0, 508, W, 12);
  c.fillStyle = room.floor; c.fillRect(0, 520, W, 40); line(c, 0, 520, W, 520, INK, 3);
  c.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 20; x < W; x += 90) c.fillRect(x, 522, 2, 38);
}
export function extBg() {
  const c = makeLayers(G.W), W = G.W;
  c.fillStyle = '#BFE3FF'; c.fillRect(0, 0, W, 520); c.fillStyle = '#d7efff'; c.fillRect(0, 300, W, 220);
  c.fillStyle = '#fff'; [[.15, 90, 50], [.7, 60, 64], [.9, 150, 40]].forEach(([k, y, r]) => { c.beginPath(); c.ellipse(W * k, y, r, r * .32, 0, 0, 6.29); c.fill(); });
  c.fillStyle = '#a9c6da'; for (let i = 0; i < 9; i++) { const h = 90 + ((i * 53) % 110); c.fillRect(i * W / 8 - 30, 520 - h, W / 8 - 12, h); }
  c.fillStyle = '#8f9a8a'; c.fillRect(0, 520, W, 40); line(c, 0, 520, W, 520, INK, 3);
}

export function render(ctx, s, drawPlayer) {
  const sh = G.shake * (G.calm ? .3 : 1), ox = (Math.random() - .5) * 2 * sh, oy = (Math.random() - .5) * 2 * sh;
  const k = G.cam || 1;
  if (k < 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#8f9a8a'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
  ctx.setTransform(s * k, 0, 0, s * k, ox * s, oy * s);
  if (G.bg) { ctx.drawImage(G.bg, 0, 0, G.W, 560); ctx.drawImage(G.decal, 0, 0, G.W, 560); } else { ctx.fillStyle = '#E9E4D8'; ctx.fillRect(0, 0, G.W, 560); }
  const objs = G.objs;
  for (const o of objs) if (o.fixed && o.kind === 'obj') drawObj(ctx, o);
  for (const o of objs) if (!o.fixed && o.kind === 'obj') drawObj(ctx, o);
  if (drawPlayer) drawPlayer(ctx);
  for (const o of objs) if (o.kind !== 'obj') drawObj(ctx, o);
  fx.draw(ctx);
  if (G.dark > 0) { ctx.fillStyle = 'rgba(20,20,40,' + G.dark + ')'; ctx.fillRect(-20, -20, G.W + 40, 600); }
  if (G.rage >= 100 && G.scene === 'room') { ctx.strokeStyle = 'rgba(255,92,138,' + (.35 + Math.sin(G.real * .2) * .2) + ')'; ctx.lineWidth = 10; ctx.strokeRect(0, 0, G.W, 560); }
  if (G.flashW > 0 && !G.calm) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(.8, G.flashW / 8) + ')'; ctx.fillRect(-20, -20, G.W + 40, 600); }
}
