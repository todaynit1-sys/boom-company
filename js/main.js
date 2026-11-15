import { G } from './state.js';
import { S } from './save.js';
import { tick } from './engine.js';
import { render } from './draw.js';
import { I, P, drawPlayer, drawChar } from './player.js';
import { F } from './floor.js';
import { R, title, preview, startRun, startEndless, bill, again } from './run.js';
import * as ui from './ui.js';
import { unlock } from './audio.js';

const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), wrap = document.getElementById('wrap');
let scale = 1;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1), vw = G.W * (G.cam || 1), s = Math.min(wrap.clientWidth / vw, wrap.clientHeight / 560);
  const w = Math.max(1, Math.floor(vw * s)), h = Math.max(1, Math.floor(560 * s));
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); scale = cv.width / vw;
}
let lastW = 0;
function draw() {
  if (G.W * (G.cam || 1) !== lastW) { lastW = G.W * (G.cam || 1); resize(); }
  render(ctx, scale, c => {
    if (R.mode === 'title') drawChar(c, S.char, Math.max(40, G.cx - 215), 482, { acc: S.acc, walk: 0 });
    else drawPlayer(c);
  });
}
window.addEventListener('resize', resize);

// ───── 입력
const CODES = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', KeyC: 'c', KeyL: 'c' };
let paused = false, faked = false;
function setPause(on) { if (R.mode !== 'run' && R.mode !== 'endless' && R.mode !== 'finale') return; paused = on; G.userPause = on; ui.pause(on); }
function setFake(on) { faked = on; ui.fake(on); if (on && !paused && (R.mode === 'run' || R.mode === 'endless')) { paused = true; G.userPause = true; } else if (!on && paused) { G.userPause = false; paused = false; ui.pause(false); } }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  unlock();
  if (faked) { setFake(false); e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') return setPause(!paused);
  if (e.code === 'KeyB') return setFake(true);
  const k = CODES[e.code]; if (k) { I[k] = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const k = CODES[e.code]; if (k) I[k] = false; });
addEventListener('blur', () => { for (const k in I) I[k] = false; });
document.querySelectorAll('#pad button').forEach(b => {
  const k = b.dataset.k, set = v => e => { e.preventDefault(); unlock(); I[k] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { try { b.setPointerCapture(e.pointerId); } catch (x) {} set(true)(e); });
  b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false));
  b.addEventListener('contextmenu', e => e.preventDefault());
});
cv.addEventListener('pointerdown', e => { unlock(); I.tap = true; e.preventDefault(); });
addEventListener('pointerdown', unlock, { once: true });
document.getElementById('s-fake').addEventListener('pointerdown', () => setFake(false));

function bot() {
  if (!P.active) return;
  const p = P.body.position; let t = F.culprit && !F.culprit.dead && G.tick % 600 < 400 ? F.culprit : null;
  if (!t) { let best = 1e9; for (const o of G.objs) { if (o.hp == null || o.dead) continue; const d = Math.abs(o.body.position.x - p.x) + Math.abs(o.body.position.y - p.y) * .5; if (d < best) { best = d; t = o; } } }
  if (!t) return;
  const dx = t.body.position.x - p.x, dy = t.body.position.y - p.y;
  I.left = dx < -45; I.right = dx > 45; I.a = true; I.b = G.tick % 45 < 2; I.jump = dy < -70 && G.tick % 36 < 3; I.c = G.rage >= 100 && G.tick % 4 < 2;
}

// ───── 루프
let acc = 0, lastT = 0;
function step() { if (G.auto) bot(); tick(); }
function frame(t) {
  const dt = Math.min(100, t - lastT); lastT = t;
  if (!G.paused && !G.userPause && !document.hidden) { acc += dt; let n = 0; while (acc >= 16.667 && n < 3) { step(); acc -= 16.667; n++; } if (n === 3) acc = 0; }
  draw(); requestAnimationFrame(frame);
}

Object.assign(ui.act, {
  quick: startRun, endless: startEndless, preview, title, again,
  pause: () => setPause(!paused),
  quit: () => { paused = false; G.userPause = false; ui.pause(false); bill(); },
});

async function boot() {
  G.mobile = matchMedia('(pointer:coarse)').matches; G.calm = S.calm || matchMedia('(prefers-reduced-motion:reduce)').matches;
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  ui.init(); title(); resize();
  requestAnimationFrame(frame);
  if (location.hash.includes('debug')) {
    window.__boom = {
      G, F, R, I, P, S,
      peek: () => ({ mode: R.mode, scene: G.scene, tick: G.tick, paused: G.paused, floor: F.label, phase: F.phase, money: Math.round(G.money), stress: F.stress, objs: G.objs.length, culprit: F.culprit && !F.culprit.dead ? Math.round(F.culprit.hp) : null, x: P.active ? Math.round(P.body.position.x) : null, y: P.active ? Math.round(P.body.position.y) : null, combo: G.combo, rage: G.rage, W: G.W }),
      step: n => { for (let i = 0; i < n; i++) step(); draw(); return window.__boom.peek(); },
      start: id => { startEndless(id); }, run: startRun, bill, title,
      set auto(v) { G.auto = v; }, get auto() { return G.auto; },
    };
  }
}
boot();
