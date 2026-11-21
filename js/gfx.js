import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { G } from './state.js';
export { THREE };
export const X = { renderer: null, scene: null, camera: null, sun: null, hemi: null, level: null, lamps: [] };
const mats = {}, geos = {}, texs = {};
export const FONT = '"Noto Sans KR",sans-serif', TITLE = '"Black Han Sans","Noto Sans KR",sans-serif';

export function canvasTex(w, h, fn, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export function speckle(c, w, h, n, a, dark = true) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(${dark ? '0,0,0' : '255,255,255'},${Math.random() * a})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
const TEX = {
  wallG: () => canvasTex(64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#efefef'); g.addColorStop(.2, '#fbfbfb'); g.addColorStop(.7, '#ffffff'); g.addColorStop(1, '#e6e6e6'); c.fillStyle = g; c.fillRect(0, 0, w, h); speckle(c, w, h, 500, .05); }),
  carpet: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4f6485'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5000, .2); speckle(c, w, h, 2500, .06, false); c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }, [28, 18]),
  wood: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8a070'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(90,55,20,${Math.random() * .16})`; c.lineWidth = 1 + Math.random() * 3; const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + Math.random() * 8 - 4, w * .6, y + Math.random() * 8 - 4, w, y + Math.random() * 6 - 3); c.stroke(); } }),
  woodDark: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#5b3b24'; c.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { c.strokeStyle = `rgba(20,8,0,${Math.random() * .25})`; c.lineWidth = 1 + Math.random() * 3; const y = Math.random() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * .3, y + Math.random() * 8 - 4, w * .6, y + Math.random() * 8 - 4, w, y + Math.random() * 6 - 3); c.stroke(); } }),
  ceiling: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ecebe6'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2500, .1); c.strokeStyle = '#c9c8c2'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); }, [23, 15]),
  fabric: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2500, .2); }, [3, 3]),
  cardboard: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#c39a62'; c.fillRect(0, 0, w, h); speckle(c, w, h, 1500, .12); c.fillStyle = 'rgba(120,85,40,.45)'; c.fillRect(w * .44, 0, w * .12, h); }),
  soft: () => canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }),
  // 임원층 카펫: 짙은 자주색
  carpetExec: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#5b2532'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5000, .22); speckle(c, w, h, 2000, .05, false); }, [28, 18]),
  // 로비 대리석 타일: 한 장(1.2m)에 결 한두 줄
  marble: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#ebe7df'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, .05); for (let i = 0; i < 3; i++) { c.strokeStyle = `rgba(120,115,105,${.12 + Math.random() * .12})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); let x = Math.random() * w, y = 0; c.moveTo(x, y); while (y < h) { y += 12; x += Math.random() * 18 - 9; c.lineTo(x, y); } c.stroke(); } c.strokeStyle = 'rgba(0,0,0,.16)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }, [24, 15]),
  concrete: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#8e908c'; c.fillRect(0, 0, w, h); speckle(c, w, h, 6000, .16); speckle(c, w, h, 2500, .06, false); for (let i = 0; i < 6; i++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 40); g.addColorStop(0, 'rgba(40,38,34,.18)'); g.addColorStop(1, 'rgba(40,38,34,0)'); c.save(); c.translate(Math.random() * w, Math.random() * h); c.fillStyle = g; c.fillRect(-40, -40, 80, 80); c.restore(); } }, [7, 5]),
  hazard: () => canvasTex(128, 32, (c, w, h) => { c.fillStyle = '#f2c21a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b1b'; for (let x = -h; x < w + h; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, h); c.lineTo(x + 16 + h, 0); c.lineTo(x + h, 0); c.fill(); } }),
  globe: () => canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#2f6fb3'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fae55'; [[40, 40, 30, 22], [70, 85, 18, 26], [140, 45, 40, 20], [150, 80, 14, 18], [205, 90, 20, 12], [190, 40, 28, 16]].forEach(([x, y, a, b]) => { c.beginPath(); c.ellipse(x, y, a, b, .3, 0, 7); c.fill(); }); }),
  slats: () => canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#b07d4f'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { c.fillStyle = `rgba(60,30,10,${.15 + Math.random() * .15})`; c.fillRect(x, 0, 3, h); } speckle(c, w, h, 800, .08); }),
  // 옥상·대강당·회식
  grill: () => canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#2a2d31'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8b9097'; c.lineWidth = 3; for (let r = 14; r < 64; r += 12) { c.beginPath(); c.arc(64, 64, r, 0, 7); c.stroke(); } c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 128); c.moveTo(0, 64); c.lineTo(128, 64); c.stroke(); }),
  solar: () => canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#c9ced4'; c.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const g = c.createLinearGradient(0, 0, 30, 36); g.addColorStop(0, '#1d3f7a'); g.addColorStop(1, '#0f2448'); c.fillStyle = g; c.save(); c.translate(4 + x * 31.5, 4 + y * 39); c.fillRect(0, 0, 29, 36); c.restore(); } }),
  grate: () => canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#1b1c1e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6f747a'; c.lineWidth = 3; for (let x = 4; x < w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } }),
  parquet: () => canvasTex(256, 256, (c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 2; x++) { c.fillStyle = `hsl(28,${38 + Math.random() * 12}%,${44 + Math.random() * 10}%)`; c.fillRect(x * 128 + (y % 2) * 64 - 64, y * 32, 128, 32); c.fillRect(x * 128 + (y % 2) * 64 + 192, y * 32, 128, 32); } c.strokeStyle = 'rgba(40,20,5,.35)'; c.lineWidth = 2; for (let y = 0; y <= h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } speckle(c, w, h, 900, .06); }, [9, 6]),
  tileDark: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4a4440'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2500, .14); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 3; for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(w, x); c.stroke(); } }, [7, 4.5]),
  roofGreen: () => canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#3f7d5a'; c.fillRect(0, 0, w, h); speckle(c, w, h, 4000, .12); speckle(c, w, h, 1500, .08, false); for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(255,255,255,${.04 + Math.random() * .05})`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 10 + Math.random() * 25, Math.random() * 3, 0, 7); c.fill(); } c.strokeStyle = 'rgba(20,40,28,.35)'; c.lineWidth = 1.5; for (let i = 0; i < 4; i++) { c.beginPath(); let x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30 - 15; c.lineTo(x, y); } c.stroke(); } }, [7, 4.5]),
};
export function tex(k) { return texs[k] || (texs[k] = TEX[k]()); }

const MATDEF = {
  carpet: { map: 'carpet', roughness: 1 }, wall: { color: '#e4d9c2', roughness: .95, map: 'wallG' }, wallDark: { color: '#4f7396', roughness: .85, map: 'wallG' }, ceiling: { map: 'ceiling', roughness: 1 },
  wood: { map: 'wood', roughness: .55 }, woodDark: { map: 'woodDark', roughness: .45 }, lam: { color: '#f1efe9', roughness: .6 }, lamGray: { color: '#8f979f', roughness: .55 },
  plasticDark: { color: '#24262b', roughness: .45 }, plasticGray: { color: '#8b9097', roughness: .5 }, plasticLight: { color: '#e4e1d8', roughness: .5 }, plasticBlue: { color: '#2f5fb3', roughness: .5 },
  metal: { color: '#b4bac0', roughness: .32, metalness: .85 }, metalDark: { color: '#4b5158', roughness: .4, metalness: .8 }, chrome: { color: '#e6e9ec', roughness: .12, metalness: 1 }, gold: { color: '#d9a531', roughness: .25, metalness: 1 },
  fabricBlue: { color: '#33507c', map: 'fabric', roughness: 1 }, fabricDark: { color: '#2c2f36', map: 'fabric', roughness: 1 }, fabricGray: { color: '#7d8894', map: 'fabric', roughness: 1 }, fabricPurple: { color: '#5a3e8a', map: 'fabric', roughness: 1 }, leather: { color: '#3a2a22', roughness: .5 },
  glass: { color: '#bfe2ee', roughness: .04, metalness: .1, transparent: true, opacity: .26 }, glassFrost: { color: '#e4eef2', roughness: .5, transparent: true, opacity: .55 }, glassDark: { color: '#0d1014', roughness: .08, metalness: .4 },
  ceramic: { color: '#f4f2ec', roughness: .25 }, cardboard: { map: 'cardboard', roughness: .9 }, paper: { color: '#fbfaf5', roughness: .9 }, paperSide: { color: '#dcd9d0', roughness: .9 },
  leaf: { color: '#2f7d3c', roughness: .7 }, pot: { color: '#b9603c', roughness: .8 }, soil: { color: '#4a3524', roughness: 1 },
  red: { color: '#c9281f', roughness: .4 }, green: { color: '#2a8a45', roughness: .3, transparent: true, opacity: .85 }, beer: { color: '#e8b53a', roughness: .1, transparent: true, opacity: .8 }, water: { color: '#8fd0ff', roughness: .05, transparent: true, opacity: .55 },
  rubber: { color: '#151515', roughness: .9 }, white: { color: '#ffffff', roughness: .5 }, coffee: { color: '#4a2c17', roughness: .3 },
  lightPanel: { color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.6 }, lightPanelOn: { color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 1.6 },
  skin: { color: '#e8b895', roughness: .7 }, shirt: { color: '#f3f1ec', roughness: .8 }, pants: { color: '#2b2f3a', roughness: .85 }, shoe: { color: '#1b1b1d', roughness: .4 }, hair: { color: '#1d1a18', roughness: .7 },
  concrete: { color: '#a9a7a0', roughness: .95 }, brick: { color: '#a8523c', roughness: .95 }, bglass: { color: '#7fb4d6', roughness: .1, metalness: .5 }, winLit: { color: '#fff3c4', emissive: '#ffe9a0', emissiveIntensity: .8 }, asphalt: { color: '#5f6360', roughness: 1 },
  // 새 층: 임원층·로비·주차장
  carpetExec: { map: 'carpetExec', roughness: 1 }, marble: { map: 'marble', roughness: .18, metalness: .05 }, marbleDark: { color: '#33373d', roughness: .22, metalness: .1 }, wallWood: { color: '#6e4a30', roughness: .6 }, wallWarm: { color: '#e6dccb', roughness: .9, map: 'wallG' },
  concreteTex: { map: 'concrete', roughness: .95 }, concreteWall: { color: '#9b9d99', roughness: .95, map: 'wallG' }, hazard: { map: 'hazard', roughness: .6 }, yellowPaint: { color: '#f2c21a', roughness: .45 }, orange: { color: '#ff6a1a', roughness: .5 },
  carGlass: { color: '#16202a', roughness: .05, metalness: .5, transparent: true, opacity: .82 }, carInside: { color: '#0b0c0e', roughness: .9 }, headlight: { color: '#fffaf0', emissive: '#fff4d6', emissiveIntensity: 1.2 }, taillight: { color: '#c21d12', emissive: '#ff2a1a', emissiveIntensity: .9 },
  celadon: { color: '#9cc6b2', roughness: .12 }, globe: { map: 'globe', roughness: .4 }, cream: { color: '#fff3df', roughness: .7 }, slats: { map: 'slats', roughness: .6 }, plaza: { color: '#b9b4aa', roughness: .95 },
  alarmLamp: { color: '#ff3a2a', emissive: '#ff2a1a', emissiveIntensity: .6 }, beacon: { color: '#ff9a1a', emissive: '#ff8a00', emissiveIntensity: 1 },
  fanGrill: { map: 'grill', roughness: .6 }, solarCell: { map: 'solar', roughness: .18, metalness: .3 }, grillTop: { map: 'grate', roughness: .5, metalness: .6 }, coals: { color: '#ff6a1a', emissive: '#ff4a00', emissiveIntensity: 1.2 },
  mirror: { color: '#e6e9ec', roughness: .05, metalness: 1, flatShading: true }, tankBlue: { color: '#3f86c4', roughness: .45 }, roofGreen: { map: 'roofGreen', roughness: .85 }, parquet: { map: 'parquet', roughness: .5 }, tileDark: { map: 'tileDark', roughness: .6 },
  wallParty: { color: '#2c2240', roughness: .8, map: 'wallG' }, wallHall: { color: '#d9d2c3', roughness: .9, map: 'wallG' }, stage: { color: '#3b2a20', roughness: .5 }, curtain: { color: '#8a1c2b', roughness: .95 },
};
const BUMP = { carpet: 1.6, carpetExec: 1.6, ceiling: 1.2, concreteTex: 1.8, parquet: 1, tileDark: 1.5, roofGreen: 1.2, wood: .7, woodDark: .7, fabricBlue: 1.2, fabricDark: 1.2, fabricGray: 1.2, fabricPurple: 1.2, cardboard: .8, slats: 1.2, marble: .25 };
// 자동차 도장: 반짝이는 색 (색마다 하나)
export function paintMat(hex) { const k = 'paint' + hex; return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: .22, metalness: .55 })); }
export function M(k) {
  if (mats[k]) return mats[k];
  const d = Object.assign({}, MATDEF[k] || { color: k });
  if (d.map) d.map = tex(d.map);
  if (!G.mobile && d.map && BUMP[k]) { d.bumpMap = d.map; d.bumpScale = BUMP[k]; }
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

// ───── 모니터·단말기 화면
function wrap(c, s, maxW) { const out = []; let line = ''; for (const ch of s) { if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }
function dialog(c, w, h, title, body, color) {
  const dw = 300, dh = 120, x = (w - dw) / 2, y = (h - dh) / 2;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 6, y + 6, dw, dh);
  c.fillStyle = '#fff'; c.fillRect(x, y, dw, dh); c.fillStyle = color; c.fillRect(x, y, dw, 30);
  c.fillStyle = '#fff'; c.font = '700 17px ' + FONT; c.textAlign = 'left'; c.fillText(title, x + 12, y + 21);
  c.fillStyle = '#222'; c.font = '700 21px ' + FONT; c.textAlign = 'center'; c.fillText(body, w / 2, y + 78);
  return { x, y, dw, dh };
}
function workBase(c, w, h, file = '업무_정리_최종.xlsx') {
  c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f7a46'; c.fillRect(0, 0, w, 40);
  c.fillStyle = '#fff'; c.font = '700 18px ' + FONT; c.textAlign = 'left'; c.fillText(file, 12, 27);
  c.strokeStyle = '#d3dad3'; c.lineWidth = 1; for (let y = 64; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } for (let x = 0; x < w; x += 80) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, h); c.stroke(); }
  c.fillStyle = '#e9f2ec'; c.fillRect(0, 40, w, 24); c.fillStyle = '#556'; c.font = '500 13px ' + FONT;
  for (let r = 0; r < 10; r++) for (let k = 1; k < 6; k++) if ((r * 7 + k * 3) % 4) c.fillText(((r * 7919 + k * 104729) % 90000 + 1000).toLocaleString(), k * 80 + 8, 82 + r * 24);
}
function docBase(c, w, h) {
  c.fillStyle = '#d9dde2'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f4f7f'; c.fillRect(0, 0, w, 34);
  c.fillStyle = '#fff'; c.font = '700 16px ' + FONT; c.textAlign = 'left'; c.fillText('문서 편집기', 10, 23);
  c.fillStyle = '#fff'; c.fillRect(w * .16, 46, w * .68, h - 46);
  c.fillStyle = '#222'; c.font = '700 22px ' + FONT; c.textAlign = 'center'; c.fillText('보고서_v7_진짜최종', w / 2, 82);
  c.fillStyle = '#9aa0a8'; for (let i = 0; i < 9; i++) c.fillRect(w * .21, 104 + i * 22, w * (.5 + ((i * 37) % 9) / 50), 7);
  c.strokeStyle = '#e5342b'; c.lineWidth = 2; for (const i of [2, 5]) { c.beginPath(); for (let x = w * .3; x < w * .55; x += 6) c.lineTo(x, 115 + i * 22 + (x / 6 % 2 ? 2 : -1)); c.stroke(); }
}
const SCREENS = {
  update: (c, w, h) => { c.fillStyle = '#1857d6'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 30px ' + FONT; c.fillText('업데이트 중입니다', w / 2, h * .42); c.font = '700 64px ' + FONT; c.fillText('37%', w / 2, h * .68); c.font = '500 18px ' + FONT; c.fillText('PC를 끄지 마세요', w / 2, h * .84); },
  sheet: (c, w, h) => { workBase(c, w, h, '보고서_최종_진짜최종_v7.xlsx'); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, 40, w, h); dialog(c, w, h, '응답 없음', '프로그램이 응답하지 않습니다', '#6b7280'); },
  work: (c, w, h) => workBase(c, w, h),
  doc: (c, w, h) => docBase(c, w, h),
  save: (c, w, h) => { docBase(c, w, h); const d = dialog(c, w, h, '알림', '저장 완료', '#1f7a46'); c.strokeStyle = '#1f7a46'; c.lineWidth = 5; c.beginPath(); c.moveTo(d.x + 66, d.y + 72); c.lineTo(d.x + 78, d.y + 84); c.lineTo(d.x + 98, d.y + 60); c.stroke(); },
  print: (c, w, h) => { docBase(c, w, h); const d = dialog(c, w, h, '인쇄', '인쇄 중… (1 / 5)', '#2f4f7f'); c.fillStyle = '#e3e6ea'; c.fillRect(d.x + 30, d.y + 92, d.dw - 60, 12); c.fillStyle = '#2f6bff'; c.fillRect(d.x + 30, d.y + 92, (d.dw - 60) * .3, 12); },
  msg: (c, w, h, s = '') => {
    workBase(c, w, h); const bw = 330, bh = 140, x = w - bw - 14, y = h - bh - 14;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x + 6, y + 6, bw, bh); c.fillStyle = '#fff'; c.fillRect(x, y, bw, bh); c.fillStyle = '#3b5bdb'; c.fillRect(x, y, bw, 32);
    c.fillStyle = '#fff'; c.font = '700 16px ' + FONT; c.textAlign = 'left'; c.fillText('메신저 · 새 메시지 1', x + 12, y + 22);
    c.fillStyle = '#e5342b'; c.beginPath(); c.arc(x + bw - 18, y + 16, 9, 0, 7); c.fill();
    c.fillStyle = '#222'; c.font = '700 21px ' + FONT; wrap(c, s, bw - 28).slice(0, 3).forEach((l, i) => c.fillText(l, x + 14, y + 64 + i * 30));
  },
  chat: (c, w, h) => { c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, w, h); const L = ['넵!', '확인 부탁드립니다', '@전체 필독', '주말에 잠깐 시간 되죠?', '넵넵', 'ㅇㅋ 내일 아침까지']; L.forEach((s, i) => { const me = i % 3 === 0; c.fillStyle = me ? '#ffd84d' : '#fff'; const bw = 60 + s.length * 20, x = me ? w - bw - 16 : 16, y = 16 + i * 46; c.fillRect(x, y, bw, 36); c.fillStyle = '#222'; c.font = '700 18px ' + FONT; c.textAlign = 'left'; c.fillText(s, x + 10, y + 25); }); c.fillStyle = '#e5342b'; c.beginPath(); c.arc(w - 40, h - 36, 26, 0, 7); c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 20px ' + FONT; c.fillText('300+', w - 40, h - 29); },
  slide: (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b3a6b'; c.fillRect(0, 0, w, 70); c.fillStyle = '#fff'; c.font = '700 30px ' + FONT; c.textAlign = 'left'; c.fillText('3분기 실적 분석 및 4분기 전략 (3 / 126)', 20, 46); c.fillStyle = '#444'; c.font = '500 22px ' + FONT;['· 시너지 창출을 위한 선제적 대응', '· 패러다임 전환과 혁신 드라이브', '· 전사적 역량 결집 (상세 내용 다음 장)'].forEach((s, i) => c.fillText(s, 30, 130 + i * 44)); c.fillStyle = '#2f6bff'; for (let i = 0; i < 5; i++) c.fillRect(w * .58 + i * 34, h - 40 - i * 22, 24, i * 22 + 12); },
  blue: (c, w, h) => { c.fillStyle = '#0d3fb8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '700 80px ' + FONT; c.textAlign = 'left'; c.fillText(':(', 40, h * .45); c.font = '500 20px ' + FONT; c.fillText('PC에 문제가 발생하여 다시 시작해야 합니다.', 40, h * .68); },
  jam: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5247'; c.textAlign = 'center'; c.font = '700 44px ' + FONT; c.fillText('용지 걸림', w / 2, h * .46); c.font = '700 24px ' + FONT; c.fillText('(트레이 2)', w / 2, h * .8); },
  ready: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe08a'; c.textAlign = 'center'; c.font = '700 40px ' + FONT; c.fillText('인쇄 대기', w / 2, h * .6); },
  toner: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd84d'; c.textAlign = 'center'; c.font = '700 38px ' + FONT; c.fillText('토너 부족', w / 2, h * .46); c.font = '700 20px ' + FONT; c.fillText('(방금 갈았는데요)', w / 2, h * .8); },
  karaoke: (c, w, h) => { c.fillStyle = '#b3246b'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 60px ' + FONT; c.fillText('♪ 98점', w / 2, h * .6); },
  clockin: (c, w, h) => { c.fillStyle = '#0e1a14'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe08a'; c.textAlign = 'center'; c.font = '700 120px ' + FONT; c.fillText('08:59', w / 2, h * .56); c.font = '700 34px ' + FONT; c.fillStyle = '#cfe9d8'; c.fillText('사원증을 대 주세요', w / 2, h * .86); },
  clockok: (c, w, h) => { c.fillStyle = '#1f7a46'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 96px ' + FONT; c.fillText('정상 출근', w / 2, h * .55); c.font = '700 40px ' + FONT; c.fillText('08:59', w / 2, h * .85); },
  clocklate: (c, w, h) => { c.fillStyle = '#b3261e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '700 120px ' + FONT; c.fillText('지각', w / 2, h * .55); c.font = '700 40px ' + FONT; c.fillText('09:01', w / 2, h * .85); },
  off: (c, w, h) => { c.fillStyle = '#07080a'; c.fillRect(0, 0, w, h); },
  // 로비 대형 전광판: 회사 자랑
  led: (c, w, h, s = '회사') => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0b2a6b'); g.addColorStop(1, '#1d63c9'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd84d'; c.textAlign = 'center'; c.font = '700 26px ' + FONT; c.fillText('★ 고객 만족 1위 ★', w / 2, 60); c.fillStyle = '#fff'; c.font = '700 54px ' + TITLE; c.fillText(s + ' 창립 30주년', w / 2, 150); c.font = '700 24px ' + FONT; c.fillText('가족 같은 회사 · 일하기 좋은 기업', w / 2, 210); c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < w; x += 6) c.fillRect(x, 0, 1, h); },
  gate: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fe08a'; c.textAlign = 'center'; c.font = '700 120px ' + FONT; c.fillText('↑', w / 2, h * .62); c.font = '700 36px ' + FONT; c.fillText('사원증을 대 주세요', w / 2, h * .9); },
  kiosk: (c, w, h) => { c.fillStyle = '#f4f6f9'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b3a6b'; c.fillRect(0, 0, w, 56); c.fillStyle = '#fff'; c.font = '700 28px ' + FONT; c.textAlign = 'left'; c.fillText('층별 안내', 20, 38); c.fillStyle = '#222'; c.font = '700 26px ' + FONT;[['12F', '임원실 · 대회의실'], ['7F', '영업팀 · 부장실'], ['1F', '로비 · 카페'], ['B2', '주차장']].forEach(([a, b], i) => { c.fillStyle = '#2f6bff'; c.fillText(a, 24, 104 + i * 54); c.fillStyle = '#222'; c.fillText(b, 100, 104 + i * 54); }); },
  pos: (c, w, h) => { c.fillStyle = '#10151c'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd84d'; c.textAlign = 'center'; c.font = '700 40px ' + FONT; c.fillText('아메리카노', w / 2, h * .4); c.fillStyle = '#fff'; c.font = '700 64px ' + FONT; c.fillText('1,500원', w / 2, h * .78); },
  // 대강당 대형 화면: 시무식
  hall: (c, w, h, s = '회사') => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e2350'); g.addColorStop(1, '#244f9e'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd84d'; c.textAlign = 'center'; c.font = '700 30px ' + FONT; c.fillText('2027 시무식 · 월례 조회', w / 2, 70); c.fillStyle = '#fff'; c.font = '400 60px ' + TITLE; c.fillText(s, w / 2, 160); c.font = '700 30px ' + FONT; c.fillText('열정 · 도전 · 혁신 — 다 함께 한 발 더!', w / 2, 230); c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '700 18px ' + FONT; c.fillText('사장님 말씀 (예정 10분 · 실제 40분)', w / 2, 290); },
  // 노래방 화면: 지어낸 노래(실제 노래 아님)
  karaoke2: (c, w, h) => { c.fillStyle = '#1b0b3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 30; i++) { c.fillStyle = `hsla(${Math.random() * 360},90%,60%,.35)`; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 0, 7); c.fill(); } c.textAlign = 'center'; c.fillStyle = '#ffd84d'; c.font = '700 26px ' + FONT; c.fillText('♪ 사랑의 결재판 — 부장님 18번 (4절)', w / 2, 60); c.fillStyle = '#fff'; c.font = '700 34px ' + FONT; c.fillText('결재판 들고 왔네~', w / 2, 150); c.fillStyle = '#5fd0ff'; c.fillText('반려라고 하시네~', w / 2, 205); c.fillStyle = '#ff7ab0'; c.font = '700 22px ' + FONT; c.fillText('다음 곡 예약: 부장님 · 부장님 · 부장님', w / 2, 285); },
};
export function screenMat(kind, arg) { const fn = SCREENS[kind] || SCREENS.off; return labelMat('S' + kind + (arg || ''), 512, 320, (c, w, h) => fn(c, w, h, arg)); }

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

// ───── 하늘과 시간대
const SKY = {};
const SKYP = {
  morning: ['#6faee8', '#f7dcc0', '#8fa3b8', 0], day: ['#4f9fe8', '#c4e2fa', '#8aa6bd', 0], afternoon: ['#5598de', '#eadfc8', '#8a9fb4', 0],
  evening: ['#f08a4b', '#ffd9a0', '#5c5470', .5], night: ['#0c1330', '#27325a', '#161b30', 1],
};
function skyTex(t) {
  if (SKY[t]) return SKY[t];
  const P = SKYP[t] || SKYP.day;
  return SKY[t] = canvasTex(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, P[0]); g.addColorStop(1, P[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (t === 'morning') { c.fillStyle = 'rgba(255,236,205,.95)'; c.beginPath(); c.arc(w * .14, h * .66, 40, 0, 7); c.fill(); }
    if (t === 'evening') { c.fillStyle = '#fff1c0'; c.beginPath(); c.arc(w * .7, h * .62, 44, 0, 7); c.fill(); }
    if (t === 'night') { c.fillStyle = '#f5edc8'; c.beginPath(); c.arc(w * .2, h * .2, 26, 0, 7); c.fill(); }
    const dayish = t !== 'night', sx = t === 'morning' ? w * .14 : t === 'evening' ? w * .7 : w * .32, sy = t === 'morning' || t === 'evening' ? h * .64 : h * .2;
    const gl = c.createRadialGradient(sx, sy, 0, sx, sy, h * .7); gl.addColorStop(0, dayish ? 'rgba(255,244,214,.75)' : 'rgba(180,200,255,.25)'); gl.addColorStop(1, 'rgba(255,244,214,0)'); c.fillStyle = gl; c.fillRect(0, 0, w, h);
    if (t === 'night') for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(255,255,255,' + (.2 + Math.random() * .7) + ')'; c.fillRect(Math.random() * w, Math.random() * h * .6, 1.5, 1.5); }
    for (let i = 0; i < (t === 'night' ? 5 : 11); i++) { const cx = Math.random() * w, cy = h * (.08 + Math.random() * .42), cw = 70 + Math.random() * 130; for (let k = 0; k < 9; k++) { const px = cx + (Math.random() - .5) * cw * 1.6, py = cy + (Math.random() - .5) * 22, pr = 22 + Math.random() * 40, g2 = c.createRadialGradient(px, py, 0, px, py, pr), a = t === 'night' ? .1 : t === 'evening' ? .5 : .62; g2.addColorStop(0, (t === 'evening' ? 'rgba(255,214,180,' : 'rgba(255,255,255,') + a + ')'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fillRect(px - pr, py - pr, pr * 2, pr * 2); } }
    c.globalAlpha = .45; for (let i = 0; i < 34; i++) { const bw = 30 + Math.random() * 50, bh = 60 + Math.random() * 150; c.fillStyle = P[2]; c.fillRect(i * 31 + Math.random() * 14, h - bh, bw, bh); } c.globalAlpha = 1;
    for (let i = 0; i < 26; i++) { const bw = 40 + Math.random() * 70, bh = 120 + Math.random() * 260, x = i * 40 + Math.random() * 20; c.fillStyle = P[2]; c.fillRect(x, h - bh, bw, bh); for (let y = h - bh + 10; y < h - 8; y += 16) for (let xx = x + 6; xx < x + bw - 8; xx += 12) { if (Math.random() < .25 + P[3] * .3) { c.fillStyle = P[3] > .3 ? 'rgba(255,225,140,.9)' : 'rgba(255,255,255,.35)'; c.fillRect(xx, y, 6, 8); } } }
  });
}
const TIMES = {
  morning: { sun: 4.4, sunCol: '#ffd9ae', hemi: .4, exp: .92, bg: '#dce8f4', env: .55, panel: 1.6, lamp: 0, fill: .8, pos: [11, 6, -14], fog: .010 },
  day: { sun: 4.6, sunCol: '#fff1d8', hemi: .4, exp: .92, bg: '#cfe6f7', env: .6, panel: 1.6, lamp: 0, fill: .78, pos: [-5, 6.5, -13], fog: .008 },
  afternoon: { sun: 4.6, sunCol: '#ffe2b0', hemi: .4, exp: .92, bg: '#d4e2ec', env: .55, panel: 1.6, lamp: 0, fill: .8, pos: [-11, 6, -14], fog: .010 },
  evening: { sun: 4.6, sunCol: '#ff9d55', hemi: .36, exp: .98, bg: '#f3b98a', env: .45, panel: 1.6, lamp: .35, fill: .6, pos: [-14, 4, -13], fog: .014 },
  night: { sun: .9, sunCol: '#9db0ff', hemi: .26, exp: 1.02, bg: '#141a33', env: .16, panel: .05, lamp: 1.15, fill: .1, pos: [7, 10, -13], fog: .014 },
  // 지하주차장: 햇빛 없이 형광등
  garage: { sun: 0, sunCol: '#e4ecff', hemi: .5, exp: 1.04, bg: '#101316', env: .36, panel: 1.5, lamp: 1, fill: 1.25, fillCol: '#dfe9ff', pos: [6, 16, 7], fog: .018 },
  // B1 회식: 고깃집은 따뜻하게, 노래방은 색 조명
  party: { sun: 0, sunCol: '#ffd9b0', hemi: .42, exp: 1.04, bg: '#0c0a14', env: .3, panel: 1.1, lamp: 1.7, fill: .8, fillCol: '#ffd9b0', pos: [6, 16, 7], fog: .016 },
};
export function setTime(t) {
  const T = TIMES[t] || TIMES.day; X.time = t;
  X.sun.intensity = T.sun; X.sun.color.set(T.sunCol); X.sun.position.set(T.pos[0], T.pos[1], T.pos[2]).multiplyScalar(1.6); X.sun.shadow.autoUpdate = T.sun > 0; X.hemi.intensity = T.hemi;
  X.fill.intensity = T.fill; X.fill.color.set(T.fillCol || '#fff4e2'); X.scene.fog.color.set(T.bg); X.scene.fog.density = T.fog; drawShafts(); X.renderer.toneMappingExposure = T.exp; X.scene.background = new THREE.Color(SKYP[t] ? SKYP[t][0] : T.bg); X.scene.environmentIntensity = T.env;
  const lp = M('lightPanel'); lp.emissiveIntensity = T.panel; lp.color.set(T.panel < .5 ? '#77756f' : '#ffffff');
  X.lamps.forEach(l => { l.intensity = T.lamp * l.userData.base; });
  if (X.sky) X.sky.material.map = skyTex(t);
}

export function initGfx(canvas) {
  const r = X.renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.mobile, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.mobile ? 1.5 : 2));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const s = X.scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); s.environment = pm.fromScene(new RoomEnvironment(), .04).texture; s.environmentIntensity = .5;
  X.camera = new THREE.PerspectiveCamera(58, 1, .05, 160);
  X.hemi = new THREE.HemisphereLight('#ffffff', '#8a8578', 1.1); s.add(X.hemi);
  const sun = X.sun = new THREE.DirectionalLight('#fff6e8', 2.4); sun.position.set(6, 16, 7); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -20; sc.right = 20; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 70;
  sun.shadow.mapSize.set(G.mobile ? 1024 : 4096, G.mobile ? 1024 : 4096); sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; sun.shadow.radius = G.mobile ? 1.5 : 3;
  // 천장 조명 몫: 위에서 내려오는 그림자 없는 빛
  X.fill = new THREE.DirectionalLight('#fff4e2', 1.1); X.fill.position.set(0, 20, 0); s.add(X.fill); s.add(X.fill.target);
  if (!G.mobile) { const f = X.fill; f.castShadow = true; const fc = f.shadow.camera; fc.left = -16; fc.right = 16; fc.top = 12; fc.bottom = -12; fc.near = 1; fc.far = 40; f.shadow.mapSize.set(2048, 2048); f.shadow.bias = -.0006; f.shadow.normalBias = .04; f.shadow.radius = 6; }
  s.fog = new THREE.FogExp2('#cfe6f7', .008);
  s.add(sun); s.add(sun.target);
  // 밤에만 켜는 등 (늘 장면에 두어 셰이더를 한 번만 만든다)
  const l1 = new THREE.PointLight('#ffd6a0', 0, 9, 1.3); l1.userData.base = 9; l1.position.set(0, 2.55, -1.9);
  const l2 = new THREE.PointLight('#ffd6a0', 0, 7.5, 1.3); l2.userData.base = 6; l2.position.set(-11.2, 2.4, -6.3);
  s.add(l1, l2); X.lamps = [l1, l2];
  X.sky = new THREE.Mesh(new THREE.PlaneGeometry(150, 60), new THREE.MeshBasicMaterial({ map: skyTex('day'), fog: false })); X.sky.position.set(0, 14, -46); s.add(X.sky);
  setTime('day');
  // 조명 패널·모니터·불빛이 은은하게 번지게(PC만). 실패하면 그냥 기본 그리기로
  if (!G.mobile) try {
    const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
    const c = X.composer = new EffectComposer(r, rt); c.addPass(new RenderPass(s, X.camera));
    // 구석·물건 밑의 어두운 음영
    try { const ao = X.ao = new GTAOPass(s, X.camera, 256, 256); ao.blendIntensity = .95; ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.2, thickness: 1.2, scale: 1.25, samples: 12 }); ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      const ov = ao.overrideVisibility.bind(ao); ao.overrideVisibility = function () { ov(); this.scene.traverse(o => { if (!o.visible) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (o.isSprite || (o.isMesh && m && (m.transparent || m.colorWrite === false))) o.visible = false; }); };
      c.addPass(ao); } catch (e) { X.ao = null; }
    X.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .26, .55, 1.4); c.addPass(X.bloom); c.addPass(new OutputPass());
  } catch (e) { X.composer = null; }
}
let ft = 0, fAvg = 16, fN = 0;
export function render() {
  if (X.composer) X.composer.render(); else X.renderer.render(X.scene, X.camera);
  if (X.ao && X.ao.enabled && document.visibilityState === 'visible') { const now = performance.now(); if (ft && now - ft < 200) { if (++fN > 0) fAvg += (Math.min(50, now - ft) - fAvg) * .02; if (fN > 360 && fAvg > 33) X.ao.enabled = false; } ft = now; }
}
// 천장 위의 그늘막: 햇빛이 천장을 뚫고 들어오지 않게 그림자만 드리운다
const shadeM = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export function shade(L, H) { const m = new THREE.Mesh(new THREE.BoxGeometry(30, .3, 19.4), shadeM); m.position.set(0, H + .15, .3); m.castShadow = true; L.add(m); fillNear(20 - H + .04); return m; }
// 천장 조명의 그림자는 천장 아래 것만 드리운다
function fillNear(n) { if (X.fill && X.fill.castShadow) { X.fill.shadow.camera.near = n; X.fill.shadow.camera.updateProjectionMatrix(); } }
// 창에서 바닥으로 비스듬히 떨어지는 빛줄기(해 방향에 맞춰 다시 그린다)
const shaftT = () => texs.shaft || (texs.shaft = canvasTex(8, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }));
const SHOP = { morning: .13, day: .1, afternoon: .13, evening: .2 };
export function shafts(L, x, z, w, y0, y1) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: shaftT(), color: '#fff0d0', transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3)); m.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0]), 2)); m.geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  m.userData.s = [x, z, w, y0, y1]; m.frustumCulled = false; m.castShadow = false; m.renderOrder = 5; L.add(m); (X.shafts || (X.shafts = [])).push(m); drawShafts(); return m;
}
function drawShafts() {
  if (!X.shafts || !X.sun) return; const sp = X.sun.position, op = SHOP[X.time] || 0;
  X.shafts = X.shafts.filter(m => m.parent);
  for (const m of X.shafts) {
    const [x, z, w, y0, y1] = m.userData.s, p = m.geometry.attributes.position.array, dx = -sp.x / sp.y, dz = -sp.z / sp.y; m.visible = op > 0 && dz > 0; m.material.opacity = op; m.material.color.set(X.sun.color);
    [y1, y0].forEach((y, q) => { const k = y * .8; p.set([x - w / 2, y, z, x + w / 2, y, z, x + w / 2 + dx * k, y - k, z + dz * k, x - w / 2 + dx * k, y - k, z + dz * k], q * 12); });
    m.geometry.attributes.position.needsUpdate = true;
  }
}
// 휴대폰 세로: 장면을 위로 22% 올려 그려서 캐릭터가 아래쪽 조작 버튼에 가리지 않게 한다(찌그러지지 않게 aspect도 맞춘다)
export function resizeGfx(w, h) {
  X.renderer.setSize(w, h, false); const cam = X.camera, phone = G.mobile || Math.min(w, h) < 520, portrait = h > w;
  if (phone && portrait) { const k = 1.22; cam.fov = 90; cam.aspect = w / (h * k); cam.setViewOffset(w, h * k, 0, h * (k - 1), w, h); }
  else { cam.fov = phone ? 62 : 58; cam.aspect = w / h; cam.clearViewOffset(); }
  cam.updateProjectionMatrix();
  if (X.composer) { X.composer.setPixelRatio(X.renderer.getPixelRatio()); X.composer.setSize(w, h); }
}
export function newLevel() { X.shafts = []; fillNear(1); fN = -90; fAvg = 16; if (X.level) X.scene.remove(X.level); X.level = new THREE.Group(); X.scene.add(X.level); return X.level; }
