import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { G } from './state.js';
export { THREE };
export const X = { renderer: null, scene: null, camera: null, sun: null, hemi: null, level: null };
const mats = {}, geos = {}, texs = {};
const FONT = '"Noto Sans KR",sans-serif', TITLE = '"Black Han Sans","Noto Sans KR",sans-serif';

export function canvasTex(w, h, fn, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function speckle(c, w, h, n, a, dark = true) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
const TEX = {
  carpet: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#566070'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5000, .2); speckle(c, w, h, 2500, .06, false); c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }, [28, 18]),
  wood: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8a070'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(90,55,20,${Math.random() * .16})`; c.lineWidth = 1 + Math.random() * 3; const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + Math.random() * 8 - 4, w * .6, y + Math.random() * 8 - 4, w, y + Math.random() * 6 - 3); c.stroke(); } }),
  woodDark: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#5b3b24'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(20,8,0,${Math.random() * .25})`; c.lineWidth = 1 + Math.random() * 3; const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + Math.random() * 8 - 4, w * .6, y + Math.random() * 8 - 4, w, y + Math.random() * 6 - 3); c.stroke(); } }),
  ceiling: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ecebe6'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2500, .1); c.strokeStyle = '#c9c8c2'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); }, [23, 15]),
  fabric: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2500, .2); }, [3, 3]),
  cardboard: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#c39a62'; c.fillRect(0, 0, w, h); speckle(c, w, h, 1500, .12); c.fillStyle = 'rgba(120,85,40,.45)'; c.fillRect(w * .44, 0, w * .12, h); }),
  soft: () => canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
};
export function tex(k) { return texs[k] || (texs[k] = TEX[k]()); }

const MATDEF = {
  carpet: { map: 'carpet', roughness: 1 }, wall: { color: '#d6d0c2', roughness: .95 }, wallDark: { color: '#5f7286', roughness: .85 }, ceiling: { map: 'ceiling', roughness: 1 },
  wood: { map: 'wood', roughness: .55 }, woodDark: { map: 'woodDark', roughness: .45 }, lam: { color: '#f1efe9', roughness: .6 }, lamGray: { color: '#8f979f', roughness: .55 },
  plasticDark: { color: '#24262b', roughness: .45 }, plasticGray: { color: '#8b9097', roughness: .5 }, plasticLight: { color: '#e4e1d8', roughness: .5 }, plasticBlue: { color: '#2f5fb3', roughness: .5 },
  metal: { color: '#b4bac0', roughness: .32, metalness: .85 }, metalDark: { color: '#4b5158', roughness: .4, metalness: .8 }, chrome: { color: '#e6e9ec', roughness: .12, metalness: 1 }, gold: { color: '#d9a531', roughness: .25, metalness: 1 },
  fabricBlue: { color: '#33507c', map: 'fabric', roughness: 1 }, fabricDark: { color: '#2c2f36', map: 'fabric', roughness: 1 }, fabricGray: { color: '#7d8894', map: 'fabric', roughness: 1 }, fabricPurple: { color: '#5a3e8a', map: 'fabric', roughness: 1 }, leather: { color: '#3a2a22', roughness: .5 },
  glass: { color: '#bfe2ee', roughness: .04, metalness: .1, transparent: true, opacity: .26 }, glassFrost: { color: '#e4eef2', roughness: .5, transparent: true, opacity: .55 }, glassDark: { color: '#0d1014', roughness: .08, metalness: .4 },
  ceramic: { color: '#f4f2ec', roughness: .25 }, cardboard: { map: 'cardboard', roughness: .9 }, paper: { color: '#fbfaf5', roughness: .9 }, paperSide: { color: '#dcd9d0', roughness: .9 },
  leaf: { color: '#2f7d3c', roughness: .7 }, pot: { color: '#b9603c', roughness: .8 }, soil: { color: '#4a3524', roughness: 1 },
  red: { color: '#c9281f', roughness: .4 }, green: { color: '#2a8a45', roughness: .3, transparent: true, opacity: .85 }, beer: { color: '#e8b53a', roughness: .1, transparent: true, opacity: .8 }, water: { color: '#8fd0ff', roughness: .05, transparent: true, opacity: .55 },
  rubber: { color: '#151515', roughness: .9 }, white: { color: '#ffffff', roughness: .5 }, coffee: { color: '#4a2c17', roughness: .3 }, lightPanel: { color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.6 },
  skin: { color: '#e8b895', roughness: .7 }, shirt: { color: '#f3f1ec', roughness: .8 }, pants: { color: '#2b2f3a', roughness: .85 }, shoe: { color: '#1b1b1d', roughness: .4 }, hair: { color: '#1d1a18', roughness: .7 },
  concrete: { color: '#a9a7a0', roughness: .95 }, brick: { color: '#a8523c', roughness: .95 }, bglass: { color: '#7fb4d6', roughness: .1, metalness: .5 }, winLit: { color: '#fff3c4', emissive: '#ffe9a0', emissiveIntensity: .8 }, asphalt: { color: '#5f6360', roughness: 1 },
};
export function M(k) {
  if (mats[k]) return mats[k];
  const d = Object.assign({}, MATDEF[k] || { color: k });
  if (d.map) d.map = tex(d.map);
  return mats[k] = new THREE.MeshStandardMaterial(d);
}
export function colorMat(hex, rough = .7) { const k = 'c' + hex + rough; return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: rough })); }

// 글자·화면 텍스처 (key로 캐시)
export function labelMat(key, w, h, draw, lit = false) {
  if (mats[key]) return mats[key];
  const t = canvasTex(w, h, draw);
  return mats[key] = lit ? new THREE.MeshStandardMaterial({ map: t, roughness: .8 }) : new THREE.MeshBasicMaterial({ map: t });
}
export function textMat(text, o = {}) {
  const w = o.w || 512, h = o.h || 128, key = 'T' + text + JSON.stringify(o);
  return labelMat(key, w, h, (c) => {
    c.fillStyle = o.bg || '#fbf7ee'; c.fillRect(0, 0, w, h);
    if (o.border) { c.strokeStyle = o.border; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); }
    let size = o.size || h * .55; c.font = `${o.title ? '400' : '700'} ${size}px ${o.title ? TITLE : FONT}`;
    while (c.measureText(text).width > w * .9 && size > 12) { size -= 4; c.font = `${o.title ? '400' : '700'} ${size}px ${o.title ? TITLE : FONT}`; }
    c.fillStyle = o.fg || '#2a2522'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + size * .04);
  }, o.lit !== false);
}
const SCREENS = {
  update: (c, w, h) => { c.fillStyle = '#1857d6'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 30px ' + FONT; c.fillText('업데이트 중입니다', w / 2, h * .42); c.font = '700 64px ' + FONT; c.fillText('37%', w / 2, h * .68); c.font = '500 18px ' + FONT; c.fillText('PC를 끄지 마세요', w / 2, h * .84); },
  sheet: (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f7a46'; c.fillRect(0, 0, w, 44); c.fillStyle = '#fff'; c.font = '700 20px ' + FONT; c.textAlign = 'left'; c.fillText('보고서_최종_진짜최종_v7.xlsx', 12, 30); c.strokeStyle = '#cfd6cf'; c.lineWidth = 1; for (let y = 70; y < h; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 84) { c.beginPath(); c.moveTo(x, 44); c.lineTo(x, h); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.82)'; c.fillRect(0, 44, w, h); c.fillStyle = '#fff'; c.strokeStyle = '#888'; c.lineWidth = 2; c.fillRect(w * .2, h * .36, w * .6, h * .34); c.strokeRect(w * .2, h * .36, w * .6, h * .34); c.fillStyle = '#333'; c.textAlign = 'center'; c.font = '700 26px ' + FONT; c.fillText('응답 없음', w / 2, h * .52); c.font = '500 16px ' + FONT; c.fillText('프로그램이 응답하지 않습니다', w / 2, h * .62); },
  chat: (c, w, h) => { c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); const L = ['넵!', '확인 부탁드립니다', '@전체 필독', '주말에 잠깐 시간 되죠?', '넵넵', 'ㅇㅋ 내일 아침까지']; L.forEach((s, i) => { const me = i % 3 === 0; c.fillStyle = me ? '#ffd84d' : '#fff'; const bw = 60 + s.length * 20, x = me ? w - bw - 16 : 16, y = 16 + i * 46; c.fillRect(x, y, bw, 36); c.fillStyle = '#222'; c.font = '700 18px ' + FONT; c.textAlign = 'left'; c.fillText(s, x + 10, y + 25); }); c.fillStyle = '#e5342b'; c.beginPath(); c.arc(w - 40, h - 36, 26, 0, 7); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 20px ' + FONT; c.fillText('300+', w - 40, h - 29); },
  slide: (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b3a6b'; c.fillRect(0, 0, w, 70); c.fillStyle = '#fff'; c.font = '700 30px ' + FONT; c.textAlign = 'left'; c.fillText('3분기 실적 분석 및 4분기 전략 (3 / 126)', 20, 46); c.fillStyle = '#444'; c.font = '500 22px ' + FONT;['· 시너지 창출을 위한 선제적 대응', '· 패러다임 전환과 혁신 드라이브', '· 전사적 역량 결집 (상세 내용 다음 장)'].forEach((s, i) => c.fillText(s, 30, 130 + i * 44)); c.fillStyle = '#2f6bff'; for (let i = 0; i < 5; i++) c.fillRect(w * .58 + i * 34, h - 40 - i * 22, 24, i * 22 + 12); },
  blue: (c, w, h) => { c.fillStyle = '#0d3fb8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '700 80px ' + FONT; c.textAlign = 'left'; c.fillText(':(', 40, h * .45); c.font = '500 20px ' + FONT; c.fillText('PC에 문제가 발생하여 다시 시작해야 합니다.', 40, h * .68); },
  jam: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5247'; c.textAlign = 'center'; c.font = '700 44px ' + FONT; c.fillText('용지 걸림', w / 2, h * .46); c.font = '700 24px ' + FONT; c.fillText('(트레이 2)', w / 2, h * .8); },
  ready: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe08a'; c.textAlign = 'center'; c.font = '700 40px ' + FONT; c.fillText('인쇄 대기', w / 2, h * .6); },
  toner: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd84d'; c.textAlign = 'center'; c.font = '700 38px ' + FONT; c.fillText('토너 부족', w / 2, h * .46); c.font = '700 20px ' + FONT; c.fillText('(방금 갈았는데요)', w / 2, h * .8); },
  karaoke: (c, w, h) => { c.fillStyle = '#b3246b'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 60px ' + FONT; c.fillText('♪ 98점', w / 2, h * .6); },
  off: (c, w, h) => { c.fillStyle = '#07080a'; c.fillRect(0, 0, w, h); },
};
export function screenMat(kind) { return labelMat('S' + kind, 512, 320, SCREENS[kind] || SCREENS.off); }

export function boxGeo(w, h, d, r = 0) {
  const k = [w, h, d, r].join('|'); if (geos[k]) return geos[k];
  const rr = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001);
  return geos[k] = rr > .004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
}
export function cylGeo(r1, r2, h, seg = 16) { const k = 'c' + [r1, r2, h, seg].join('|'); return geos[k] || (geos[k] = new THREE.CylinderGeometry(r1, r2, h, seg)); }
export function sphGeo(r, seg = 16) { const k = 's' + r + '|' + seg; return geos[k] || (geos[k] = new THREE.SphereGeometry(r, seg, Math.max(8, seg * .75 | 0))); }
export function capGeo(r, len) { const k = 'cap' + r + '|' + len; return geos[k] || (geos[k] = new THREE.CapsuleGeometry(r, len, 4, 10)); }
const asMat = m => typeof m === 'string' ? M(m) : m;
function put(g, m, x, y, z, shadow = true) { m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; }
export const bx = (g, w, h, d, mat, x = 0, y = 0, z = 0, r = 0) => put(g, new THREE.Mesh(boxGeo(w, h, d, r), asMat(mat)), x, y, z);
export const cyl = (g, r1, r2, h, mat, x = 0, y = 0, z = 0, seg = 16) => put(g, new THREE.Mesh(cylGeo(r1, r2, h, seg), asMat(mat)), x, y, z);
export const sph = (g, r, mat, x = 0, y = 0, z = 0) => put(g, new THREE.Mesh(sphGeo(r), asMat(mat)), x, y, z);
const planeG = {};
export function pl(g, w, h, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0) { const k = w + '|' + h, m = new THREE.Mesh(planeG[k] || (planeG[k] = new THREE.PlaneGeometry(w, h)), asMat(mat)); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = false; g.add(m); return m; }

const SKY = {};
function skyTex(t) {
  if (SKY[t]) return SKY[t];
  const P = { day: ['#8ec5f2', '#d9eefc', '#9fb4c4', 0], evening: ['#f08a4b', '#ffd9a0', '#5c5470', .5], night: ['#0c1330', '#27325a', '#161b30', 1] }[t];
  return SKY[t] = canvasTex(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P[0]); g.addColorStop(1, P[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (t === 'evening') { c.fillStyle = '#fff1c0'; c.beginPath(); c.arc(w * .7, h * .62, 44, 0, 7); c.fill(); }
    if (t === 'night') { c.fillStyle = '#f5edc8'; c.beginPath(); c.arc(w * .2, h * .2, 26, 0, 7); c.fill(); }
    for (let i = 0; i < 26; i++) { const bw = 40 + Math.random() * 70, bh = 120 + Math.random() * 260, x = i * 40 + Math.random() * 20; c.fillStyle = P[2]; c.fillRect(x, h - bh, bw, bh); for (let y = h - bh + 10; y < h - 8; y += 16) for (let xx = x + 6; xx < x + bw - 8; xx += 12) { if (Math.random() < .25 + P[3] * .3) { c.fillStyle = P[3] > .3 ? 'rgba(255,225,140,.9)' : 'rgba(255,255,255,.35)'; c.fillRect(xx, y, 6, 8); } } }
  });
}
const TIMES = {
  day: { sun: 2.3, sunCol: '#fff3df', hemi: .8, exp: .92, bg: '#cfe6f7' },
  evening: { sun: 2.0, sunCol: '#ffc48a', hemi: .65, exp: .92, bg: '#f3b98a' },
  night: { sun: 1.5, sunCol: '#e9eeff', hemi: .55, exp: .9, bg: '#141a33' },
};
export function setTime(t) {
  const T = TIMES[t] || TIMES.day; X.time = t;
  X.sun.intensity = T.sun; X.sun.color.set(T.sunCol); X.hemi.intensity = T.hemi; X.renderer.toneMappingExposure = T.exp; X.scene.background = new THREE.Color(T.bg);
  if (X.sky) X.sky.material.map = skyTex(t);
}

export function initGfx(canvas) {
  const r = X.renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.mobile, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.mobile ? 1.5 : 2));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const s = X.scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); s.environment = pm.fromScene(new RoomEnvironment(), .04).texture; s.environmentIntensity = .5;
  X.camera = new THREE.PerspectiveCamera(58, 1, .08, 160);
  X.hemi = new THREE.HemisphereLight('#ffffff', '#8a8578', 1.1); s.add(X.hemi);
  const sun = X.sun = new THREE.DirectionalLight('#fff6e8', 2.4); sun.position.set(6, 16, 7); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 13; sc.bottom = -13; sc.near = 1; sc.far = 40;
  sun.shadow.mapSize.set(G.mobile ? 1024 : 2048, G.mobile ? 1024 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  s.add(sun); s.add(sun.target);
  X.sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 60), new THREE.MeshBasicMaterial({ map: skyTex('day'), fog: false })); X.sky.position.set(0, 14, -46); s.add(X.sky);
  setTime('day');
}
export function resizeGfx(w, h) { X.renderer.setSize(w, h, false); X.camera.aspect = w / h; X.camera.updateProjectionMatrix(); }
export function newLevel() { if (X.level) X.scene.remove(X.level); X.level = new THREE.Group(); X.scene.add(X.level); return X.level; }
