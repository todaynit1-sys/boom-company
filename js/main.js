import { G, clamp } from './state.js';
import { S } from './save.js';
import { X, initGfx, resizeGfx } from './gfx.js';
import { tick } from './engine.js';
import * as fx from './fx.js';
import { I, P, CAM, renderPlayer } from './player.js';
import { MISSIONS, MISSION_IDS, MS } from './missions.js';
import { R, title, preview, startCourse, startSingle, startFree, bill, again } from './run.js';
import * as ui from './ui.js';
import { unlock } from './audio.js';
import { hush } from './voice.js';

const cv = document.getElementById('cv'), flashEl = document.getElementById('flash');
let W = 1, H = 1;
function resize() { W = innerWidth; H = innerHeight; resizeGfx(W, H); }
addEventListener('resize', resize);
const playing = () => R.mode === 'run' || R.mode === 'free' || R.mode === 'finale';

// ───── 입력
const keys = new Set(); let joy = null, paused = false, faked = false;
const BTN = { Space: 'jump', KeyJ: 'a', KeyZ: 'a', KeyK: 'b', KeyX: 'b', KeyE: 'e', KeyF: 'e', KeyQ: 'c', KeyC: 'c', KeyL: 'c' };
function setPause(on) { if (!playing()) return; paused = on; G.userPause = on; ui.pause(on); if (on && document.pointerLockElement) document.exitPointerLock(); if (on) hush(); }
function setFake(on) { faked = on; ui.fake(on); if (on) { if (document.pointerLockElement) document.exitPointerLock(); G.userPause = true; hush(); } else if (!paused) G.userPause = false; }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  unlock();
  if (faked) { setFake(false); e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') return setPause(!paused);
  if (e.code === 'KeyB') return setFake(true);
  keys.add(e.code); const k = BTN[e.code]; if (k) I[k] = true;
  if (k || e.code.startsWith('Arrow') || e.code === 'KeyW' || e.code === 'KeyS') e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); const k = BTN[e.code]; if (k) I[k] = false; });
addEventListener('blur', () => { keys.clear(); for (const k of ['jump', 'a', 'b', 'c', 'e']) I[k] = false; });
function pollKeys() {
  if (!joy) { I.mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0); I.mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); }
  if (keys.has('ArrowLeft')) I.lookX -= .045; if (keys.has('ArrowRight')) I.lookX += .045;
}
// 마우스: 화면을 누르면 시점 고정, 좌클릭 때리기, 우클릭 강타
let dragging = false;
cv.addEventListener('mousedown', e => {
  unlock(); if (G.mobile) return; I.tap = true;
  if (playing() && R.mode !== 'finale' && !document.pointerLockElement) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (x) { } }
  dragging = true; if (e.button === 0) I.a = true; if (e.button === 2) I.b = true; e.preventDefault();
});
addEventListener('mouseup', e => { dragging = false; if (e.button === 0) I.a = false; if (e.button === 2) I.b = false; });
addEventListener('mousemove', e => { if (document.pointerLockElement === cv || (dragging && !G.mobile)) { I.lookX += e.movementX * .0026; I.lookY += e.movementY * .002; } });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing() && !paused && !faked && G.locked) setPause(true); G.locked = !!document.pointerLockElement; });
// 터치: 왼쪽 조이스틱, 오른쪽 끌어서 시점, 버튼
const joyEl = document.getElementById('joy'), knob = joyEl.firstElementChild, lookEl = document.getElementById('look');
function joyMove(e) { const r = joyEl.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy) || 1, m = Math.min(l, 50); I.mx = dx / l * m / 50; I.mz = -dy / l * m / 50; knob.style.transform = `translate(${dx / l * m}px,${dy / l * m}px)`; }
joyEl.addEventListener('pointerdown', e => { unlock(); joy = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (x) { } joyMove(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', e => { if (joy === e.pointerId) joyMove(e); });
const joyEnd = e => { if (joy !== e.pointerId) return; joy = null; I.mx = I.mz = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
let lookId = null, lx = 0, ly = 0;
lookEl.addEventListener('pointerdown', e => { unlock(); lookId = e.pointerId; lx = e.clientX; ly = e.clientY; I.tap = true; try { lookEl.setPointerCapture(e.pointerId); } catch (x) { } });
lookEl.addEventListener('pointermove', e => { if (lookId !== e.pointerId) return; I.lookX += (e.clientX - lx) * .006; I.lookY += (e.clientY - ly) * .004; lx = e.clientX; ly = e.clientY; });
const lookEnd = e => { if (lookId === e.pointerId) lookId = null; }; lookEl.addEventListener('pointerup', lookEnd); lookEl.addEventListener('pointercancel', lookEnd);
document.querySelectorAll('#pad button').forEach(b => {
  const k = b.dataset.k, set = v => e => { e.preventDefault(); unlock(); I[k] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { try { b.setPointerCapture(e.pointerId); } catch (x) { } set(true)(e); });
  b.addEventListener('pointerup', set(false)); b.addEventListener('pointercancel', set(false)); b.addEventListener('contextmenu', e => e.preventDefault());
});
addEventListener('pointerdown', unlock, { once: true });
document.getElementById('s-fake').addEventListener('pointerdown', () => setFake(false));

// ───── 시험용 자동 조작
let stuck = 0;
function bot() {
  if (!P.active || R.mode === 'finale') return;
  const s = MS.step, pp = P.body.position; let pos = null, e = false, a = true, b = G.tick % 50 < 2, jump = false;
  if (s && MS.phase === 'play') {
    const t = s.type;
    if (t === 'break') { const q = s.list().find(o => o && !o.dead); if (q) pos = q.body.position; jump = q && q.body.position.y > 1.6 && G.tick % 40 < 3; }
    else if (t === 'out') { const it = s.item(); if (it && !it.dead) { if (P.carry === it) { pos = { x: pp.x, z: -20 }; a = G.tick % 20 === 0; } else { pos = it.body.position; e = G.tick % 12 === 0; a = false; } } }
    else if (t === 'carryTo') { const it = s.item(); if (it) { if (P.carry === it) { const d = s.at(); pos = d.body ? d.body.position : d; } else pos = it.body.position; e = G.tick % 12 === 0; a = false; b = false; } }
    else if (s.at) { const d = s.at(); if (d) pos = d.body ? d.body.position : d; if (t === 'use') { e = s.hold ? true : G.tick % 8 < 4; a = false; b = false; } if (t === 'pick' || t === 'equip') { e = G.tick % 12 === 0; a = false; b = false; } if (t === 'hit' && s.heavy) { a = false; b = G.tick % 30 < 2; } }
  } else { let best = 1e9; for (const o of G.props) { if (o.hp == null || o.dead || o.fixed) continue; const d = Math.hypot(o.body.position.x - pp.x, o.body.position.z - pp.z); if (d < best) { best = d; pos = o.body.position; } } }
  I.a = a; I.b = b; I.e = e; I.jump = jump; I.c = G.rage >= 100 && G.tick % 6 < 3;
  if (!pos) { I.mz = 0; return; }
  const dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  CAM.yaw = Math.atan2(-dx, -dz); I.mz = d > 1.15 ? 1 : 0; I.mx = 0;
  if (I.mz && Math.hypot(P.body.velocity.x, P.body.velocity.z) < 1) { if (++stuck > 90) { P.body.position.set(pos.x - dx / d * 1.1, .3, pos.z - dz / d * 1.1); stuck = 0; } else if (stuck % 30 > 20) I.jump = true; } else stuck = 0;
}

// ───── 루프
let acc = 0, lastT = 0;
function step() { pollKeys(); if (G.auto) bot(); tick(); }
function draw() { renderPlayer(); X.renderer.render(X.scene, X.camera); fx.drawTexts(W, H); flashEl.style.opacity = G.flash > 0 && !G.calm ? Math.min(.7, G.flash / 8) : 0; }
function frame(t) {
  const dt = Math.min(100, t - lastT); lastT = t;
  if (!G.paused && !G.userPause && !document.hidden) { acc += dt; let n = 0; while (acc >= 16.667 && n < 3) { step(); acc -= 16.667; n++; } if (n === 3) acc = 0; }
  draw(); requestAnimationFrame(frame);
}

Object.assign(ui.act, {
  course: startCourse, single: startSingle, free: startFree, preview, title, again,
  pause: () => setPause(!paused),
  quit: () => { paused = false; G.userPause = false; ui.pause(false); bill(); },
  home: () => { paused = false; G.userPause = false; ui.pause(false); title(); },
});

async function boot() {
  G.mobile = matchMedia('(pointer:coarse)').matches; G.calm = S.calm || matchMedia('(prefers-reduced-motion:reduce)').matches;
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  initGfx(cv); fx.initFx(); resize();
  ui.init(MISSIONS, MISSION_IDS); title();
  document.getElementById('boot').remove();
  requestAnimationFrame(frame);
  if (location.hash.includes('debug')) {
    window.__boom = {
      G, R, I, P, S, MS, CAM, X,
      peek: () => ({ mode: R.mode, tick: G.tick, paused: G.paused, mission: MS.m && MS.m.n, step: MS.step ? MS.i + ':' + MS.step.t : MS.phase, money: Math.round(G.money), props: G.props.length, x: P.active ? +P.body.position.x.toFixed(1) : null, y: P.active ? +P.body.position.y.toFixed(2) : null, z: P.active ? +P.body.position.z.toFixed(1) : null, combo: G.combo, rage: Math.round(G.rage), weapon: P.weapon, calls: X.renderer.info.render.calls }),
      step: n => { for (let i = 0; i < n; i++) step(); draw(); return window.__boom.peek(); },
      single: startSingle, course: startCourse, free: startFree, bill, title,
      set auto(v) { G.auto = v; }, get auto() { return G.auto; },
    };
  }
}
boot().catch(e => { document.getElementById('boot').textContent = '불러오지 못했어요: ' + e.message; console.error(e); });
void clamp;
