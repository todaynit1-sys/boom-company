import { G } from './state.js';
import { S } from './save.js';
import { X, initGfx, resizeGfx, render } from './gfx.js';
import { tick } from './engine.js';
import * as fx from './fx.js';
import { I, P, CAM, renderPlayer } from './player.js';
import { MISSIONS, MISSION_IDS, MS, skipStep, canSkip } from './missions.js';
import { R, title, preview, startCourse, startSingle, startFree, startRush, goFloor, bill, again, fmtClock } from './run.js';
import { tickWorld } from './world.js';
import { FLOOR_IDS } from './floors.js';
import { TOY } from './toys.js';
import './vox.js';
import './people.js';
import * as ui from './ui.js';
import { unlock } from './audio.js';
import { duckMusic, musicState } from './music.js';
import { stageOg } from './og.js';

const cv = document.getElementById('cv'), flashEl = document.getElementById('flash');
let W = 1, H = 1;
// 휴대폰이면 카메라를 캐릭터 가까이, 화면 배치는 세로(phone-p)·가로(phone-l)에 맞춘다
function resize() {
  W = innerWidth; H = innerHeight; resizeGfx(W, H);
  const phone = G.mobile || Math.min(W, H) < 520, portrait = H > W;
  CAM.dist = phone ? (portrait ? 3.2 : 3.5) : 4.3;
  document.body.classList.toggle('phone-p', phone && portrait); document.body.classList.toggle('phone-l', phone && !portrait);
}
addEventListener('resize', resize);
const playing = () => R.mode === 'run' || R.mode === 'free' || R.mode === 'finale';

// ───── 입력
const keys = new Set(); let joy = null, paused = false, faked = false;
const BTN = { Space: 'jump', KeyJ: 'a', KeyZ: 'a', KeyK: 'b', KeyX: 'b', KeyE: 'e', KeyF: 'e', KeyQ: 'c', KeyC: 'c', KeyL: 'c' };
function setPause(on) { if (!playing()) return; paused = on; G.userPause = on; ui.pause(on); if (on && document.pointerLockElement) document.exitPointerLock(); duckMusic(on ? .35 : 1); }
// 위장 화면(부장님 떴다!)에서는 음악도 끈다
function setFake(on) { faked = on; ui.fake(on); if (on) { if (document.pointerLockElement) document.exitPointerLock(); G.userPause = true; duckMusic(0); } else { if (!paused) G.userPause = false; duckMusic(paused ? .35 : 1); } }
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  unlock();
  if (faked) { setFake(false); e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') return setPause(!paused);
  if (e.code === 'KeyB') return setFake(true);
  if (e.code === 'Tab') { ui.toggleObj(); e.preventDefault(); return; }
  // 엘리베이터 층 버튼: 숫자 키 1~4
  if (ui.elevOpen() && /^Digit[1-9]$/.test(e.code)) { const id = FLOOR_IDS[+e.code.slice(5) - 1]; if (id) goFloor(id); e.preventDefault(); return; }
  keys.add(e.code); const k = BTN[e.code]; if (k) I[k] = true;
  if (k || e.code.startsWith('Arrow') || e.code === 'KeyW' || e.code === 'KeyS') e.preventDefault();
});
addEventListener('keyup', e => { keys.delete(e.code); const k = BTN[e.code]; if (k) I[k] = false; });
addEventListener('blur', () => { keys.clear(); for (const k of ['jump', 'a', 'b', 'c', 'e']) I[k] = false; });
function pollKeys() {
  if (!joy && !G.auto) { I.mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0); I.mz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); }
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
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && playing() && !paused && !faked && G.locked && !G.uiFree) setPause(true); G.locked = !!document.pointerLockElement; });
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
  const s = MS.step, pp = P.body.position; let pos = null, e = false, a = false, b = false, jump = false, near = 1.15;
  if (s && MS.phase === 'play') {
    const t = s.type;
    if (t === 'cut' || t === 'wait') { I.a = I.b = I.e = I.jump = I.c = false; I.mx = I.mz = 0; return; }
    if (t === 'break') { const q = s.list().find(o => o && !o.dead); if (q) pos = q.body.position; a = true; b = G.tick % 50 < 2; jump = q && q.body.position.y > 1.6 && G.tick % 40 < 3; }
    else if (t === 'hit') { const q = s.at(); if (q) pos = q.body.position; if (s.heavy) b = G.tick % 30 < 2; else a = true; }
    else if (t === 'out') { const it = s.item(); if (it && !it.dead) { if (P.carry === it) { pos = { x: pp.x, z: -20 }; a = G.tick % 20 === 0; } else { pos = it.body.position; e = G.tick % 12 === 0; } } }
    else if (t === 'carryTo') { const it = s.item(); if (it) { if (P.carry === it) { const d = s.at(); pos = d.body ? d.body.position : d; } else pos = it.body.position; e = G.tick % 12 === 0; near = 1.4; } }
    else if (t === 'sit') { const c = s.at(); if (c) pos = c.body.position; e = G.tick % 12 === 0; }
    else if (t === 'use') { const d = s.at(); if (d) pos = d.body ? d.body.position : d; e = s.hold ? true : G.tick % 8 < 4; near = 1.6; }
    else if (t === 'pick' || t === 'equip') { const d = s.at(); if (d) pos = d.body.position; e = G.tick % 12 === 0; }
    else if (t === 'reach') { pos = s.at(); near = .4; }
    else if (t === 'ride') { pos = { x: G.elev ? G.elev.x : -3.5, z: 10.1 }; near = .2; }
    else if (t === 'until') { const q = s.at && s.at(); if (q) pos = q.body ? q.body.position : q; a = G.tick % 20 < 10; }
    // 지게차를 탄 채로는 부술 수 없으니 내린다
    if (P.ride && t !== 'until') e = G.tick % 30 === 0;
  } else if (MS.phase === 'rampage' || R.mode === 'free') { a = true; b = G.tick % 50 < 2; let best = 1e9; for (const o of G.props) { if (o.hp == null || o.dead || o.fixed) continue; const d = Math.hypot(o.body.position.x - pp.x, o.body.position.z - pp.z); if (d < best) { best = d; pos = o.body.position; } } }
  I.a = a; I.b = b; I.e = e; I.jump = jump; I.c = G.rage >= 100 && MS.phase === 'rampage' && G.tick % 6 < 3;
  if (!pos) { I.mx = I.mz = 0; return; }
  const dx = pos.x - pp.x, dz = pos.z - pp.z, d = Math.hypot(dx, dz);
  CAM.yaw = Math.atan2(-dx, -dz); I.mz = d > near ? 1 : 0; I.mx = 0;
  if (I.mz && !P.seated && Math.hypot(P.body.velocity.x, P.body.velocity.z) < 1) { if (++stuck > 90) { P.body.position.set(pos.x - dx / d * 1.1, .3, pos.z - dz / d * 1.1); stuck = 0; } else if (stuck % 30 > 20) I.jump = true; } else stuck = 0;
}

// ───── 루프
let acc = 0, lastT = 0;
function step() { pollKeys(); if (G.auto) bot(); tick(); tickWorld(); }
function draw(dt) { renderPlayer(dt); render(); fx.drawTexts(W, H); flashEl.style.opacity = G.flash > 0 && !G.calm ? Math.min(.7, G.flash / 8) : 0; }
function frame(t) {
  const dt = Math.min(100, t - lastT); lastT = t;
  // 한 번 틀려도 게임이 멈추지 않게: 오류는 기록만 하고 다음 틱으로 넘어간다
  try { if (!G.paused && !G.userPause && !document.hidden) { acc += dt; let n = 0; while (acc >= 16.667 && n < 3) { step(); acc -= 16.667; n++; } if (n === 3) acc = 0; } }
  catch (e) { acc = 0; if (!frame.errs || frame.errs++ < 5) { frame.errs = frame.errs || 1; console.error(e); } }
  try { draw(dt / 1000); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

Object.assign(ui.act, {
  course: startCourse, single: startSingle, free: startFree, rush: startRush, goFloor, preview, title, again, clock: fmtClock,
  pause: () => setPause(!paused),
  canSkip: () => R.mode === 'run' && canSkip(), skip: () => R.mode === 'run' && skipStep(),
  quit: () => { paused = false; G.userPause = false; ui.pause(false); duckMusic(1); bill(); },
  home: () => { paused = false; G.userPause = false; ui.pause(false); duckMusic(1); title(); },
});

async function boot() {
  G.mobile = matchMedia('(pointer:coarse)').matches; G.calm = S.calm || matchMedia('(prefers-reduced-motion:reduce)').matches;
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) { }
  initGfx(cv); fx.initFx(); resize();
  ui.init(MISSIONS, MISSION_IDS);
  if (location.hash.includes('og')) stageOg(); else title();
  document.getElementById('boot').remove();
  requestAnimationFrame(frame);
  if (location.hash.includes('debug')) {
    window.__boom = {
      G, R, I, P, S, MS, CAM, X, music: musicState,
      peek: () => ({ mode: R.mode, day: R.i, tick: G.tick, paused: G.paused, mission: MS.m && MS.m.n, step: MS.step ? MS.i + ':' + MS.step.t : MS.phase, clock: fmtClock(G.clock || 0), money: Math.round(G.money), stress: Math.round(G.stress || 0), props: G.props.length, debris: fx.debrisCount(), restocked: Object.values(G.restocked || {}).reduce((a, b) => a + b, 0), seated: !!P.seated, expr: P.expr, cam: CAM.mode, x: P.active ? +P.body.position.x.toFixed(1) : null, z: P.active ? +P.body.position.z.toFixed(1) : null, weapon: P.weapon, calls: X.renderer.info.render.calls, floor: R.mode === 'free' ? R.floor : null, ride: P.ride ? P.ride.kind : null, fuel: P.fuel ? Math.round(P.fuel) : 0, alarm: TOY.alarm, wet: TOY.wet, goals: R.got ? [...R.got] : null }),
      step: n => { for (let i = 0; i < n; i++) step(); draw(n / 60); return window.__boom.peek(); },
      single: startSingle, course: startCourse, free: startFree, rush: startRush, go: goFloor, toy: TOY, bill, title,
      set auto(v) { G.auto = v; if (!v) { I.mx = I.mz = 0; I.a = I.b = I.e = I.jump = I.c = false; } }, get auto() { return G.auto; },
    };
  }
}
boot().catch(e => { document.getElementById('boot').textContent = '불러오지 못했어요: ' + e.message; console.error(e); });
