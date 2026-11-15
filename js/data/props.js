import { THREE, M, bx, cyl, sph, pl, screenMat, textMat, labelMat, colorMat, paintMat, canvasTex, FONT } from '../gfx.js';

export const MATS = {
  glass: { weak: 2, hard: .9, words: ['쨍그랑!', '와장창!'], snd: 'glass', bit: '#cfeaf5' },
  ceramic: { weak: 1.8, hard: 1, words: ['쨍!', '와장창!'], snd: 'glass', bit: '#f4f2ec' },
  elec: { weak: 1.2, hard: 1, words: ['파지직!', '퍼엉!'], snd: 'zap', bit: '#555' },
  plastic: { weak: 1, hard: .9, words: ['빠직!', '우지끈!'], snd: 'plastic', bit: '#ccc' },
  liquid: { weak: 1, hard: .8, words: ['촤아악!'], snd: 'water', bit: '#8fd0ff' },
  wood: { weak: .6, hard: 1.1, words: ['쿵!', '우지직!'], snd: 'wood', bit: '#c8a070' },
  metal: { weak: .4, hard: 1.3, words: ['깡!', '텅!'], snd: 'metal', bit: '#b4bac0' },
  paper: { weak: .3, hard: .3, words: ['쫘악—', '북북!'], snd: 'paper', bit: '#fff' },
  cloth: { weak: .3, hard: .4, words: ['부욱—'], snd: 'paper', bit: '#7d8894' },
};
const rot = (m, x = 0, y = 0, z = 0) => { m.rotation.set(x, y, z); return m; };
// 새 층 물건에 쓰는 그림(한 번만 만든다)
const bookMat = () => labelMat('books', 512, 128, (c, w, h) => { c.fillStyle = '#2a1c14'; c.fillRect(0, 0, w, h); const cols = ['#7a2030', '#1f3f6b', '#2f5f3a', '#c9a24a', '#e9e1cf', '#3a2a22', '#5a3e8a']; let x = 0, k = 0; while (x < w) { const bw = 10 + (k * 7) % 14, bh = h * (.7 + ((k * 13) % 7) * .045); c.fillStyle = cols[k % cols.length]; c.fillRect(x, h - bh, bw - 1, bh); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x + 2, h - bh + 8, bw - 5, 3); x += bw; k++; } }, true);
const vendMat = () => labelMat('vend', 256, 320, (c, w, h) => { c.fillStyle = '#e9eef3'; c.fillRect(0, 0, w, h); const cols = ['#c9281f', '#2f6bff', '#ffd84d', '#2a8a45', '#ff8a1f', '#7a2030']; for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { const x = 14 + i * 39, y = 20 + r * 76; c.fillStyle = cols[(r * 2 + i) % 6]; c.fillRect(x, y, 26, 46); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x + 4, y + 6, 5, 34); c.fillStyle = '#222'; c.fillRect(x, y + 52, 26, 11); c.fillStyle = '#ff5247'; c.font = '700 10px ' + FONT; c.fillText('800', x + 4, y + 61); } }, true);
const menuMat = () => labelMat('menu', 512, 300, (c, w, h) => { c.fillStyle = '#26302b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8a070'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); c.fillStyle = '#f4efe2'; c.font = '700 34px ' + FONT; c.textAlign = 'center'; c.fillText('오늘의 메뉴', w / 2, 56); c.textAlign = 'left'; c.font = '700 26px ' + FONT;[['아메리카노', '1,500'], ['카페라떼', '2,000'], ['부장님 추천 쌍화차', '3,000'], ['야근 세트 (커피+커피)', '2,900']].forEach(([a, b], i) => { c.fillStyle = '#f4efe2'; c.fillText(a, 34, 112 + i * 44); c.fillStyle = '#ffd84d'; c.textAlign = 'right'; c.fillText(b, w - 34, 112 + i * 44); c.textAlign = 'left'; }); }, true);
let standeeM, vaseG, tireG;
function standeeMat() {
  if (standeeM) return standeeM;
  const t = canvasTex(256, 740, (c, w) => {
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(14, 4, w - 28, 62, 16); c.fill(); c.fillStyle = '#c9281f'; c.font = '700 26px ' + FONT; c.textAlign = 'center'; c.fillText('열정! 도전! 혁신!', w / 2, 46);
    c.fillStyle = '#1d2a44'; c.beginPath(); c.moveTo(48, 250); c.lineTo(208, 250); c.lineTo(222, 520); c.lineTo(34, 520); c.fill();
    c.fillRect(70, 515, 50, 200); c.fillRect(136, 515, 50, 200); c.fillStyle = '#111'; c.fillRect(62, 705, 64, 30); c.fillRect(130, 705, 64, 30);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(104, 250); c.lineTo(152, 250); c.lineTo(128, 330); c.fill(); c.fillStyle = '#c9281f'; c.fillRect(122, 262, 12, 70);
    c.fillStyle = '#e8b895'; c.beginPath(); c.arc(128, 170, 64, 0, 7); c.fill(); c.fillStyle = '#2a211c'; c.beginPath(); c.arc(128, 150, 66, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    c.fillStyle = '#2a211c'; c.beginPath(); c.arc(104, 172, 6, 0, 7); c.arc(152, 172, 6, 0, 7); c.fill(); c.strokeStyle = '#7a3a2a'; c.lineWidth = 5; c.beginPath(); c.arc(128, 192, 22, .2, Math.PI - .2); c.stroke();
    c.fillStyle = '#e8b895'; c.beginPath(); c.arc(214, 300, 22, 0, 7); c.fill(); c.fillStyle = '#1d2a44'; c.fillRect(196, 250, 30, 50); c.fillStyle = '#e8b895'; c.fillRect(204, 180, 22, 110);
    c.fillStyle = '#ffffff'; c.fillRect(70, 380, 116, 40); c.fillStyle = '#1d2a44'; c.font = '700 26px ' + FONT; c.fillText('대표이사', 128, 409);
  });
  return standeeM = new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });
}
// 자동차: 앞(보닛)·뒤(트렁크)·가운데 실내, 유리·문짝·보닛은 따로 떼어 낼 수 있게 이름표를 붙인다
function carBuild(g, o, [w, h, d]) {
  const paint = paintMat(o.col || '#15171b'), y0 = -h / 2, u = g.userData, inside = M('carInside'), dk = 'plasticDark';
  const fl = d * .27, rl = d * .22, zf = d / 2 - fl, zr = -d / 2 + rl, zs = zr + (zf - zr) * .48, yb = y0 + .655;
  bx(g, w, .55, fl, paint, 0, yb, zf + fl / 2, .1); bx(g, w, .58, rl, paint, 0, yb + .015, zr - rl / 2, .1);
  bx(g, w - .3, .55, zf - zr, inside, 0, yb, (zf + zr) / 2);
  u.doors = [];
  for (const s of [-1, 1]) for (const [a, b] of [[zs, zf], [zr, zs]]) { const m = bx(g, .15, .55, b - a - .02, paint, s * (w / 2 - .075), yb, (a + b) / 2, .04); bx(m, .02, .03, .14, 'chrome', s * .08, .12, (b - a) * .25); u.doors.push({ m, s }); }
  const cz0 = zr - .15, cz1 = zf - .25, cc = (cz0 + cz1) / 2, cl = cz1 - cz0;
  bx(g, w - .22, .45, cl, inside, 0, y0 + 1.155, cc, .05); bx(g, w - .26, .05, cl - .4, paint, 0, y0 + 1.39, cc, .02);
  for (const s of [-1, 1]) { rot(bx(g, .06, .5, .06, paint, s * (w / 2 - .13), y0 + 1.15, cz1 - .02), -.5); rot(bx(g, .06, .5, .07, paint, s * (w / 2 - .12), y0 + 1.15, cz0 + .05), .45); bx(g, .06, .45, .07, paint, s * (w / 2 - .12), y0 + 1.15, zs); bx(g, .1, .08, .14, paint, s * (w / 2 + .05), y0 + 1.0, cz1 - .05); }
  const gm = M('carGlass'); u.glass = [];
  for (const s of [-1, 1]) for (const [a, b] of [[zs + .05, cz1 - .1], [cz0 + .12, zs - .05]]) u.glass.push(bx(g, .02, .34, b - a, gm, s * (w / 2 - .1), y0 + 1.17, (a + b) / 2));
  u.glass.push(rot(bx(g, w - .3, .5, .02, gm, 0, y0 + 1.16, cz1 + .06), -.55), rot(bx(g, w - .32, .46, .02, gm, 0, y0 + 1.16, cz0 - .05), .5));
  u.glass.forEach(m => { m.castShadow = false; });
  u.hood = bx(g, w - .1, .04, fl - .05, paint, 0, y0 + .95, zf + fl / 2);
  const hl = u.hl = M('headlight').clone(), tl = u.tl = M('taillight').clone();
  for (const s of [-1, 1]) { bx(g, .34, .1, .05, hl, s * (w / 2 - .32), y0 + .76, d / 2 + .005); bx(g, .36, .1, .05, tl, s * (w / 2 - .3), y0 + .8, -d / 2 - .005); }
  bx(g, .8, .18, .04, dk, 0, y0 + .6, d / 2 + .01); bx(g, w + .02, .14, .14, dk, 0, y0 + .43, d / 2 - .03); bx(g, w + .02, .14, .14, dk, 0, y0 + .43, -d / 2 + .03);
  const plate = textMat(o.plate || '12가 3456', { w: 256, h: 64, size: 40, bg: '#ffffff', fg: '#111111' });
  pl(g, .44, .11, plate, 0, y0 + .52, d / 2 + .042); pl(g, .44, .11, plate, 0, y0 + .56, -d / 2 - .042, Math.PI);
  const wz = d / 2 - d * .185;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { rot(cyl(g, .33, .33, .24, 'rubber', sx * (w / 2 - .14), y0 + .33, sz * wz, 20), 0, 0, Math.PI / 2); rot(cyl(g, .19, .19, .25, 'chrome', sx * (w / 2 - .14), y0 + .33, sz * wz, 14), 0, 0, Math.PI / 2); }
}
const wbMat = () => labelMat('wb', 512, 300, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2f6bff'; c.lineWidth = 5; c.beginPath(); c.moveTo(40, 250); c.lineTo(160, 170); c.lineTo(260, 200); c.lineTo(450, 60); c.stroke(); c.fillStyle = '#e5342b'; c.font = '700 34px "Noto Sans KR"'; c.fillText('매출 ↗ ?', 40, 60); c.fillStyle = '#222'; c.font = '700 24px "Noto Sans KR"'; c.fillText('시너지 · 혁신 · 원팀', 250, 270); }, true);

// size = [가로 x, 높이 y, 깊이 z], 앞면 = +z
export const DEFS = {
  desk: { n: '책상', size: [1.6, .74, .8], mass: 45, hp: 320, price: 450000, mat: 'wood', fm: ['wood', 'lam'], frag: 9, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, .04, d, 'wood', 0, h / 2 - .02, 0, .012); bx(g, .03, h - .04, d - .06, 'lam', -w / 2 + .03, -.02, 0); bx(g, .03, h - .04, d - .06, 'lam', w / 2 - .03, -.02, 0); bx(g, w - .08, .4, .02, 'lam', 0, .1, -d / 2 + .08); } },
  bossdesk: { n: '부장 책상', size: [2.0, .78, .95], mass: 70, hp: 480, price: 1800000, mat: 'wood', fm: ['woodDark'], frag: 10, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, .06, d, 'woodDark', 0, h / 2 - .03, 0, .015); bx(g, .5, h - .06, d - .08, 'woodDark', -w / 2 + .27, -.03, 0); bx(g, .5, h - .06, d - .08, 'woodDark', w / 2 - .27, -.03, 0); bx(g, w - .1, .5, .03, 'woodDark', 0, .08, d / 2 - .1); for (let i = 0; i < 3; i++) bx(g, .1, .015, .02, 'gold', -w / 2 + .27, .22 - i * .2, -d / 2 + .03); } },
  table: { n: '회의 탁자', size: [3.2, .74, 1.2], mass: 80, hp: 480, price: 900000, mat: 'wood', fm: ['wood'], frag: 10, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, .05, d, 'wood', 0, h / 2 - .025, 0, .02); bx(g, .08, h - .05, d - .3, 'metalDark', -w / 2 + .4, -.025, 0); bx(g, .08, h - .05, d - .3, 'metalDark', w / 2 - .4, -.025, 0); bx(g, w - .9, .1, .04, 'metalDark', 0, .2, 0); } },
  counter: { n: '싱크대', size: [.6, .9, 2.6], mass: 110, hp: 500, price: 700000, mat: 'wood', fm: ['lam', 'wood'], frag: 10, grab: false,
    build(g, o, [w, h, d]) { bx(g, w, h - .04, d, 'lam', 0, -.02, 0); bx(g, w + .03, .04, d + .02, 'metalDark', 0, h / 2 - .02, 0); for (let i = 0; i < 4; i++) bx(g, .015, .12, .02, 'chrome', w / 2 + .005, .15, -d / 2 + .35 + i * .63); } },
  reception: { n: '안내 데스크', size: [2.4, 1.05, .7], mass: 90, hp: 450, price: 1200000, mat: 'wood', fm: ['lam', 'wood'], frag: 10, grab: false,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'lam', 0, 0, 0, .02); bx(g, w + .04, .04, d + .06, 'wood', 0, h / 2, 0); pl(g, 1.6, .34, textMat(o.text || '회사', { title: true, bg: '#f1efe9', fg: '#c9281f' }), 0, 0, d / 2 + .003); } },
  monitor: { n: '모니터', size: [.56, .44, .2], mass: 4, hp: 60, price: 320000, mat: 'glass', fm: ['plasticDark', 'glassDark'], frag: 7,
    build(g, o) { bx(g, .56, .34, .035, 'plasticDark', 0, .05, 0, .008); g.userData.screen = pl(g, .52, .3, screenMat(o.screen || 'sheet'), 0, .05, .019); bx(g, .05, .13, .04, 'plasticDark', 0, -.14, -.03); bx(g, .24, .015, .18, 'plasticDark', 0, -.212, 0, .004); } },
  pc: { n: '본체', size: [.2, .44, .44], mass: 8, hp: 110, price: 1100000, mat: 'elec', fm: ['plasticDark', 'metal'], frag: 7, spill: [['sparks', 18], ['smoke', 5]], elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .01); bx(g, w - .04, .02, .005, 'plasticGray', 0, .15, d / 2); bx(g, w - .04, .02, .005, 'plasticGray', 0, .1, d / 2); sph(g, .012, colorMat('#35d07f', .3), 0, -.12, d / 2); } },
  keyboard: { n: '키보드', size: [.44, .03, .14], mass: .7, hp: 30, price: 45000, mat: 'plastic', fm: ['plasticLight'], frag: 3, spill: [['keys', 18]],
    weapon: { n: '키보드', dmg: 15, r: .85, reach: .8, push: 3.5, cd: 170, dur: 22, snd: 'plastic' },
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticLight', 0, 0, 0, .008); bx(g, w - .03, .008, d - .03, 'plasticGray', 0, h / 2, 0); } },
  mouse: { n: '마우스', size: [.06, .035, .1], mass: .15, hp: 8, price: 25000, mat: 'plastic', fm: ['plasticLight'], frag: 2, build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticLight', 0, 0, 0, .015); } },
  laptop: { n: '노트북', size: [.34, .24, .26], mass: 1.8, hp: 50, price: 1600000, mat: 'elec', fm: ['metal', 'glassDark'], frag: 5, spill: [['sparks', 8]],
    build(g) { bx(g, .34, .018, .24, 'metal', 0, -.11, .01, .005); const s = bx(g, .34, .22, .012, 'metal', 0, .0, -.12, .005); rot(s, -.25); const p = pl(g, .31, .19, screenMat('sheet'), 0, .0, -.112); p.rotation.x = -.25; } },
  mug: { n: '머그컵', size: [.09, .1, .09], mass: .3, hp: 8, price: 12000, mat: 'ceramic', fm: ['ceramic'], frag: 4, spill: [['coffee', 8]],
    build(g) { cyl(g, .042, .036, .1, 'ceramic'); cyl(g, .036, .036, .005, 'coffee', 0, .046, 0); const h = new THREE.Mesh(new THREE.TorusGeometry(.028, .008, 6, 12), M('ceramic')); h.position.set(.048, 0, 0); g.add(h); } },
  phone: { n: '전화기', size: [.2, .08, .2], mass: .8, hp: 30, price: 80000, mat: 'plastic', fm: ['plasticDark'], frag: 5, ring: true,
    build(g) { bx(g, .2, .05, .2, 'plasticDark', 0, -.015, 0, .01); bx(g, .06, .035, .19, 'plasticDark', -.06, .025, 0, .012); bx(g, .09, .005, .1, 'plasticGray', .04, .012, .02); } },
  papers: { n: '서류 더미', size: [.22, .16, .3], mass: 1.5, hp: 16, price: 30000, mat: 'paper', fm: [], frag: 0, spill: [['sheets', 14]],
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'paperSide'); bx(g, w, .004, d, 'paper', 0, h / 2, 0); } },
  report: { n: '보고서', size: [.22, .03, .3], mass: .4, hp: 9999, price: 0, mat: 'paper', fm: [], frag: 0,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'paperSide'); pl(g, w, d, textMat('보고서 v7', { w: 256, h: 340, size: 40 }), 0, h / 2 + .001, 0, 0, -Math.PI / 2); } },
  envelope: { n: '사직서', size: [.24, .012, .12], mass: .2, hp: 9999, price: 0, mat: 'paper', fm: [], frag: 0,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'paper'); pl(g, w, d, textMat('사 직 서', { w: 256, h: 128, size: 58, title: true, bg: '#ffffff' }), 0, h / 2 + .001, 0, 0, -Math.PI / 2); } },
  cellphone: { n: '업무폰', size: [.08, .015, .16], mass: .2, hp: 20, price: 1350000, mat: 'glass', fm: ['plasticDark', 'glassDark'], frag: 4, spill: [['sparks', 6]],
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .006); pl(g, w - .01, d - .015, screenMat('chat'), 0, h / 2 + .001, 0, 0, -Math.PI / 2); } },
  binder: { n: '결재판', size: [.26, .33, .05], mass: .6, hp: 20, price: 8000, mat: 'paper', fm: ['plasticBlue'], frag: 3, spill: [['sheets', 5]],
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticBlue', 0, 0, 0, .006); pl(g, w * .6, h * .3, textMat('결재', { w: 128, h: 64, size: 40 }), 0, .04, d / 2 + .001); } },
  box: { n: 'A4 박스', size: [.42, .3, .32], mass: 5, hp: 22, price: 25000, mat: 'paper', fm: ['cardboard'], frag: 4, spill: [['sheets', 16]], build(g, o, [w, h, d]) { bx(g, w, h, d, 'cardboard'); } },
  trash: { n: '휴지통', size: [.26, .32, .26], mass: 1, hp: 15, price: 7000, mat: 'metal', fm: ['metalDark'], frag: 4, spill: [['sheets', 5]], build(g) { cyl(g, .13, .1, .32, 'metalDark', 0, 0, 0, 14); cyl(g, .12, .12, .01, 'paper', 0, .13, 0, 14); } },
  plant: { n: '화분', size: [.4, 1.05, .4], mass: 7, hp: 25, price: 35000, mat: 'ceramic', fm: ['pot', 'leaf'], frag: 7, spill: [['soil', 16]],
    build(g) { cyl(g, .17, .13, .34, 'pot', 0, -.35, 0); cyl(g, .16, .16, .02, 'soil', 0, -.185, 0); cyl(g, .018, .02, .4, 'leaf', 0, .0, 0, 6); [[0, .3, 0, .24], [.12, .12, .05, .17], [-.1, .16, -.08, .18], [.02, .05, -.13, .15], [-.05, .08, .13, .15]].forEach(([x, y, z, r]) => { const m = sph(g, r, 'leaf', x, y, z); m.scale.set(1, 1.25, 1); }); } },
  chair: { n: '의자', size: [.56, .95, .56], mass: 8, hp: 70, price: 150000, mat: 'plastic', fm: ['fabricDark', 'plasticDark', 'metalDark'], frag: 7, ride: 'chair',
    build(g, o) { const f = o.boss ? 'leather' : 'fabricDark'; bx(g, .5, .08, .5, f, 0, -.03, 0, .03); bx(g, .46, o.boss ? .7 : .5, .07, f, 0, o.boss ? .36 : .26, -.22, .03); cyl(g, .028, .028, .32, 'chrome', 0, -.23, 0, 10); bx(g, .56, .03, .06, 'plasticDark', 0, -.42, 0); bx(g, .06, .03, .56, 'plasticDark', 0, -.42, 0);[[.26, 0], [-.26, 0], [0, .26], [0, -.26]].forEach(([x, z]) => sph(g, .03, 'rubber', x, -.445, z)); bx(g, .05, .03, .3, 'plasticDark', .27, .15, 0); bx(g, .05, .03, .3, 'plasticDark', -.27, .15, 0); } },
  sofa: { n: '소파', size: [1.7, .78, .8], mass: 40, hp: 200, price: 600000, mat: 'cloth', fm: ['fabricGray'], frag: 7, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, .32, d, 'fabricGray', 0, -.2, 0, .06); bx(g, w, .5, .2, 'fabricGray', 0, .12, -d / 2 + .1, .06); bx(g, .18, .45, d, 'fabricGray', -w / 2 + .09, .02, 0, .06); bx(g, .18, .45, d, 'fabricGray', w / 2 - .09, .02, 0, .06); } },
  cabinet: { n: '캐비닛', size: [.9, 1.8, .45], mass: 55, hp: 220, price: 250000, mat: 'metal', fm: ['lamGray', 'metal'], frag: 9, spill: [['sheets', 22]], grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'lamGray', 0, 0, 0, .01); bx(g, .005, h - .06, .005, 'metalDark', 0, 0, d / 2); bx(g, .02, .12, .02, 'chrome', -.06, .1, d / 2 + .01); bx(g, .02, .12, .02, 'chrome', .06, .1, d / 2 + .01); } },
  lowcab: { n: '낮은 수납장', size: [.9, .75, .42], mass: 28, hp: 140, price: 180000, mat: 'wood', fm: ['lam', 'wood'], frag: 7, spill: [['sheets', 10]], grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'lam', 0, 0, 0, .01); bx(g, w + .02, .03, d + .02, 'wood', 0, h / 2, 0); bx(g, .005, h - .06, .005, 'metalDark', 0, 0, d / 2); } },
  watercooler: { n: '정수기', size: [.34, 1.3, .34], mass: 16, hp: 80, price: 180000, mat: 'liquid', fm: ['plasticLight', 'water'], frag: 6, spill: [['water', 60]],
    build(g) { bx(g, .34, .9, .34, 'plasticLight', 0, -.2, 0, .02); cyl(g, .13, .13, .38, 'water', 0, .45, 0); cyl(g, .05, .13, .06, 'water', 0, .27, 0); bx(g, .2, .12, .02, 'plasticGray', 0, .05, .171); sph(g, .016, colorMat('#2f6bff'), -.05, .08, .185); sph(g, .016, colorMat('#e5342b'), .05, .08, .185); } },
  extinguisher: { n: '소화기', size: [.14, .5, .14], mass: 4, hp: 25, price: 30000, mat: 'metal', fm: ['red'], frag: 4, spill: [['boom', 3.2, 35, '#ffffff']],
    weapon: { n: '소화기', spray: true, dmg: 18, r: .9, reach: .9, push: 5, cd: 380, snd: 'metal' },
    build(g) { cyl(g, .065, .065, .38, 'red', 0, -.05, 0); sph(g, .065, 'red', 0, .14, 0); cyl(g, .02, .02, .08, 'metalDark', 0, .22, 0, 8); bx(g, .1, .015, .03, 'metalDark', .03, .25, 0); } },
  toner: { n: '토너', size: [.3, .1, .1], mass: .8, hp: 10, price: 90000, mat: 'plastic', fm: ['plasticDark'], frag: 3, spill: [['boom', 2.2, 20, 'cmyk']],
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .02); bx(g, w * .5, h + .004, d + .004, colorMat(o.col || '#1aa7c7', .5), 0, 0, 0, .02); } },
  clock: { n: '벽시계', size: [.38, .38, .06], mass: 1.2, hp: 28, price: 30000, mat: 'glass', fm: ['white', 'plasticDark'], frag: 6, wall: true,
    build(g) { const c = cyl(g, .19, .19, .05, 'plasticDark'); c.rotation.x = Math.PI / 2; const f = pl(g, .34, .34, labelMat('clockface', 256, 256, (c, w) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(128, 128, 128, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); c.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); c.stroke(); } }, true), 0, 0, .027); f.material.transparent = true; const hh = bx(g, .012, .09, .004, 'plasticDark', 0, 0, .03), mh = bx(g, .008, .14, .004, 'red', 0, 0, .032); hh.geometry = hh.geometry.clone().translate(0, .045, 0); mh.geometry = mh.geometry.clone().translate(0, .07, 0); g.userData.hh = hh; g.userData.mh = mh; } },
  timeclock: { n: '근태 단말기', size: [.26, .36, .08], mass: 2, hp: 40, price: 350000, mat: 'elec', fm: ['plasticDark', 'glassDark'], frag: 5, spill: [['sparks', 10]], wall: true, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .012); g.userData.screen = pl(g, w - .05, h * .42, screenMat('clockin'), 0, .07, d / 2 + .002); bx(g, .15, .08, .012, 'plasticGray', 0, -.1, d / 2 + .004, .004); sph(g, .008, colorMat('#35d07f', .3), .09, -.1, d / 2 + .008); } },
  frame: { n: '사훈 액자', size: [1.0, .5, .05], mass: 2.5, hp: 35, price: 60000, mat: 'glass', fm: ['woodDark', 'glass'], frag: 7, wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'woodDark', 0, 0, 0, .008); pl(g, w - .1, h - .1, textMat(o.text || '열정', { title: true, w: 512, h: 240, size: 110 }), 0, 0, d / 2 + .002); } },
  portrait: { n: '대표 초상화', size: [.6, .8, .05], mass: 3, hp: 40, price: 800000, mat: 'glass', fm: ['gold', 'glass'], frag: 7, wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'gold', 0, 0, 0, .01); pl(g, w - .1, h - .1, labelMat('portrait', 256, 340, (c, W, H) => { c.fillStyle = '#d9cfbb'; c.fillRect(0, 0, W, H); c.fillStyle = '#4a4540'; c.beginPath(); c.arc(W / 2, H * .36, 52, 0, 7); c.fill(); c.beginPath(); c.ellipse(W / 2, H * .92, 100, 110, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 24px "Noto Sans KR"'; c.textAlign = 'center'; c.fillText('대 표', W / 2, H - 14); }, true), 0, 0, d / 2 + .002); } },
  banner: { n: '현수막', size: [2.6, .45, .03], mass: 1.5, hp: 40, price: 30000, mat: 'cloth', fm: ['white'], frag: 4, wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'white'); pl(g, w - .04, h - .04, textMat(o.text || '파이팅', { title: true, w: 1024, h: 176, size: 120, fg: '#c9281f', border: '#c9281f', bg: '#ffffff' }), 0, 0, d / 2 + .002); } },
  logo: { n: '회사 간판', size: [3.2, .7, .08], mass: 9, hp: 80, price: 2000000, mat: 'plastic', fm: ['white', 'red'], frag: 10, wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'white', 0, 0, 0, .02); pl(g, w - .1, h - .1, textMat(o.text || '회사', { title: true, w: 1024, h: 220, size: 170, fg: '#c9281f', bg: '#ffffff' }), 0, 0, d / 2 + .002); } },
  screen: { n: '빔 스크린', size: [2.3, 1.4, .04], mass: 5, hp: 90, price: 400000, mat: 'cloth', fm: ['white'], frag: 6, wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'white'); g.userData.screen = pl(g, w - .1, h - .1, screenMat('slide'), 0, 0, d / 2 + .002); } },
  whiteboard: { n: '화이트보드', size: [1.8, 1.75, .5], mass: 12, hp: 70, price: 120000, mat: 'plastic', fm: ['white', 'metal'], frag: 8,
    build(g) { bx(g, 1.8, 1.1, .04, 'white', 0, .3, 0, .01); pl(g, 1.7, 1.0, wbMat(), 0, .3, .022); bx(g, .04, 1.72, .04, 'metal', -.86, 0, 0); bx(g, .04, 1.72, .04, 'metal', .86, 0, 0); bx(g, .04, .04, .5, 'metal', -.86, -.85, 0); bx(g, .04, .04, .5, 'metal', .86, -.85, 0); } },
  partition: { n: '파티션', size: [1.6, 1.15, .06], mass: 12, hp: 80, price: 130000, mat: 'cloth', fm: ['fabricGray', 'metal'], frag: 6,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'fabricGray', 0, 0, 0, .01); bx(g, w, .03, d + .01, 'metal', 0, h / 2, 0); bx(g, .3, .02, .3, 'metal', -w / 2 + .2, -h / 2 + .01, 0); bx(g, .3, .02, .3, 'metal', w / 2 - .2, -h / 2 + .01, 0); } },
  nameplate: { n: '명패', size: [.3, .08, .07], mass: .5, hp: 20, price: 50000, mat: 'glass', fm: ['plasticDark', 'gold'], frag: 4,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .008); pl(g, w - .02, h - .015, textMat(o.text || '부장', { w: 256, h: 64, size: 44, bg: '#17181b', fg: '#e3b23c' }), 0, 0, d / 2 + .001); } },
  trophy: { n: '트로피', size: [.14, .32, .14], mass: 1.2, hp: 28, price: 70000, mat: 'metal', fm: ['gold'], frag: 4,
    build(g) { bx(g, .14, .05, .14, 'woodDark', 0, -.135, 0); cyl(g, .015, .02, .1, 'gold', 0, -.06, 0, 8); cyl(g, .065, .03, .14, 'gold', 0, .06, 0, 12); } },
  golfbag: { n: '골프백', size: [.3, 1.1, .3], mass: 9, hp: 90, price: 3500000, mat: 'cloth', fm: ['fabricPurple', 'chrome'], frag: 6, spill: [['balls', 8]],
    build(g) { cyl(g, .14, .13, .95, 'fabricPurple', 0, -.07, 0, 12); bx(g, .12, .3, .06, 'fabricDark', 0, -.1, .14, .02);[[-.05, .03], [.05, -.02], [0, .06]].forEach(([x, z], i) => { cyl(g, .008, .008, .3, 'chrome', x, .5, z, 6); bx(g, .06, .035, .03, 'chrome', x + .02, .66, z); }); } },
  bottle: { n: '병', size: [.07, .26, .07], mass: .5, hp: 6, price: 5000, mat: 'glass', fm: ['green'], frag: 4, build(g, o) { const m = o.col ? colorMat(o.col, .1) : 'green'; cyl(g, .034, .034, .17, m, 0, -.045, 0, 10); cyl(g, .013, .03, .06, m, 0, .07, 0, 10); cyl(g, .013, .013, .03, m, 0, .115, 0, 8); } },
  noodle: { n: '컵라면', size: [.11, .11, .11], mass: .2, hp: 6, price: 1500, mat: 'paper', fm: ['red'], frag: 3, build(g) { cyl(g, .055, .042, .11, 'red', 0, 0, 0, 12); cyl(g, .056, .056, .006, 'white', 0, .055, 0, 12); } },
  fishbowl: { n: '어항', size: [.4, .3, .3], mass: 6, hp: 35, price: 200000, mat: 'glass', fm: ['glass'], frag: 8, spill: [['water', 40]], build(g, o, [w, h, d]) { bx(g, w, h, d, 'glass', 0, 0, 0, .02); bx(g, w - .03, h * .7, d - .03, 'water', 0, -.03, 0); const f = sph(g, .03, colorMat('#ff8a1f', .4), .05, -.02, 0); f.scale.set(1.6, 1, .7); } },
  microwave: { n: '전자레인지', size: [.5, .3, .38], mass: 11, hp: 80, price: 150000, mat: 'elec', fm: ['plasticLight', 'glassDark'], frag: 7, spill: [['sparks', 16], ['smoke', 5]], elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticLight', 0, 0, 0, .012); bx(g, w * .62, h - .06, .01, 'glassDark', -w * .14, 0, d / 2); bx(g, .1, h - .08, .01, 'plasticGray', w / 2 - .08, 0, d / 2); } },
  fridge: { n: '냉장고', size: [.65, 1.75, .65], mass: 60, hp: 220, price: 900000, mat: 'metal', fm: ['metal', 'lam'], frag: 9, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'metal', 0, 0, 0, .02); bx(g, w, .008, .005, 'metalDark', 0, .3, d / 2); bx(g, .025, .3, .03, 'chrome', w / 2 - .07, .55, d / 2 + .015); bx(g, .025, .5, .03, 'chrome', w / 2 - .07, -.1, d / 2 + .015); pl(g, .2, .2, textMat('냉장고 정리 금요일', { w: 256, h: 256, size: 34, bg: '#ffd84d' }), -.12, .6, d / 2 + .002); } },
  coffee: { n: '커피머신', size: [.3, .45, .36], mass: 9, hp: 260, price: 1900000, mat: 'metal', fm: ['metalDark', 'chrome'], frag: 8, spill: [['coffee', 40], ['sparks', 14]], elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'metalDark', 0, 0, 0, .02); bx(g, w - .06, .12, .01, 'plasticDark', 0, .12, d / 2); bx(g, .06, .05, .06, 'chrome', 0, .0, d / 2 - .02); bx(g, w - .06, .02, .14, 'chrome', 0, -.2, d / 2 - .08); const n = pl(g, .2, .15, textMat('고장', { w: 256, h: 192, size: 110, bg: '#ffd84d' }), .02, .14, d / 2 + .008); n.rotation.z = .12; } },
  printer: { n: '복합기', size: [.75, 1.1, .65], mass: 75, hp: 1500, price: 2400000, mat: 'plastic', fm: ['plasticLight', 'plasticGray', 'plasticDark'], frag: 16, spill: [['sheets', 40], ['sparks', 26], ['boom', 3.4, 25, 'cmyk']], grab: false, elec: true,
    build(g) { bx(g, .7, .55, .6, 'plasticLight', 0, -.27, 0, .015); bx(g, .6, .1, .02, 'plasticGray', 0, -.18, .3); bx(g, .6, .1, .02, 'plasticGray', 0, -.36, .3); bx(g, .75, .3, .65, 'plasticLight', 0, .15, 0, .025); const lid = new THREE.Group(); bx(lid, .7, .07, .6, 'plasticGray', 0, .34, 0, .02); bx(lid, .5, .1, .34, 'plasticLight', 0, .43, -.1, .02); g.add(lid); g.userData.lid = lid; bx(g, .24, .13, .03, 'plasticDark', .2, .2, .325); g.userData.screen = pl(g, .21, .105, screenMat('ready'), .2, .2, .342); bx(g, .38, .02, .22, 'plasticGray', -.16, .02, .42); } },
  lid: { n: '복합기 덮개', size: [.7, .12, .6], mass: 4, hp: 60, price: 300000, mat: 'plastic', fm: ['plasticGray'], frag: 5, build(g) { bx(g, .7, .07, .6, 'plasticGray', 0, -.02, 0, .02); bx(g, .5, .08, .34, 'plasticLight', 0, .04, -.1, .02); } },
  projector: { n: '빔 프로젝터', size: [.4, .16, .34], mass: 5, hp: 220, price: 2800000, mat: 'elec', fm: ['lam', 'plasticDark'], frag: 7, spill: [['sparks', 24], ['smoke', 6]], wall: true, elec: true,
    build(g) { bx(g, .4, .14, .34, 'lam', 0, 0, 0, .02); const l = cyl(g, .05, .05, .06, 'glassDark', -.1, 0, .18, 12); l.rotation.x = Math.PI / 2; cyl(g, .02, .02, .42, 'metalDark', 0, .28, 0, 8); } },
  safe: { n: '금고', size: [.7, .8, .6], mass: 140, hp: 1500, price: 5000000, mat: 'metal', fm: ['metalDark', 'metal'], frag: 12, spill: [['bills', 80]], grab: false,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'metalDark', 0, 0, 0, .02); bx(g, w - .1, h - .1, .02, 'metal', 0, 0, d / 2); const dl = cyl(g, .07, .07, .03, 'chrome', -.08, .02, d / 2 + .02, 20); dl.rotation.x = Math.PI / 2; bx(g, .03, .16, .03, 'gold', .18, .02, d / 2 + .02); } },
  karaoke: { n: '노래방 기계', size: [.6, 1.0, .5], mass: 30, hp: 600, price: 2500000, mat: 'plastic', fm: ['plasticDark'], frag: 10, spill: [['sparks', 24], ['smoke', 6]], grab: false, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .02); pl(g, .46, .26, screenMat('karaoke'), 0, .3, d / 2 + .002);[-.15, .15].forEach(x => { const s = cyl(g, .11, .11, .02, 'plasticGray', x, -.15, d / 2, 16); s.rotation.x = Math.PI / 2; }); } },
  glasspane: { n: '유리벽', size: [2, 2.6, .05], mass: 30, hp: 55, price: 700000, mat: 'glass', fm: ['glass'], frag: 14, fixedOnly: true,
    build(g, o, [w, h, d]) { const m = bx(g, w, h, d, o.frost ? 'glassFrost' : 'glass'); m.castShadow = false; bx(g, w, .04, d + .02, 'metal', 0, h / 2 - .02, 0); bx(g, w, .04, d + .02, 'metal', 0, -h / 2 + .02, 0); } },
  window: { n: '유리창', size: [3.7, 1.6, .05], mass: 30, hp: 40, price: 900000, mat: 'glass', fm: ['glass'], frag: 16, fixedOnly: true, build(g, o, [w, h, d]) { const m = bx(g, w, h, d, 'glass'); m.castShadow = false; } },
  // ───── 임원층
  aquarium: { n: '대형 수족관', size: [2.2, 1.6, .62], mass: 260, hp: 150, price: 18000000, mat: 'glass', fm: ['glass', 'woodDark'], frag: 14, spill: [['water', 140], ['fish', 18]], grab: false,
    build(g, o, [w, h, d]) { bx(g, w, .7, d, 'woodDark', 0, -.45, 0, .02); const t = bx(g, w - .02, .9, d - .02, 'glass', 0, .35, 0); t.castShadow = false; bx(g, w - .08, .74, d - .08, 'water', 0, .29, 0).castShadow = false; bx(g, w - .08, .05, d - .08, colorMat('#d9c9a0', .9), 0, -.065, 0); bx(g, w, .04, d, 'metalDark', 0, .82, 0); for (let i = 0; i < 7; i++) { const f = sph(g, .045, colorMat(['#ff8a1f', '#ffd84d', '#3fa7ff'][i % 3], .4), -w / 2 + .3 + i * (w - .6) / 6, .12 + (i * 37 % 5) * .09, i % 2 ? .1 : -.08); f.scale.set(1.9, 1, .55); } for (const x of [-.7, .1, .75]) cyl(g, .015, .025, .32, 'leaf', x, .1, -.16, 6); } },
  ceodesk: { n: '대표이사 책상', size: [2.6, .8, 1.15], mass: 120, hp: 700, price: 9000000, mat: 'wood', fm: ['woodDark', 'leather'], frag: 12, grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, .07, d, 'woodDark', 0, h / 2 - .035, 0, .02); bx(g, w - .3, .012, d - .35, 'leather', 0, h / 2 + .006, 0); bx(g, .62, h - .07, d - .08, 'woodDark', -w / 2 + .33, -.035, 0); bx(g, .62, h - .07, d - .08, 'woodDark', w / 2 - .33, -.035, 0); bx(g, w - .12, .55, .03, 'woodDark', 0, .06, d / 2 - .12); for (let i = 0; i < 3; i++) for (const s of [-1, 1]) bx(g, .12, .016, .02, 'gold', s * (w / 2 - .33), .2 - i * .2, -d / 2 + .03); } },
  bookshelf: { n: '책장', size: [1.6, 2.1, .4], mass: 70, hp: 260, price: 1200000, mat: 'wood', fm: ['woodDark', 'paper'], frag: 10, spill: [['books', 24]], grab: false, flip: true,
    build(g, o, [w, h, d]) { bx(g, w, h, .03, 'woodDark', 0, 0, -d / 2 + .015); for (const s of [-1, 1]) bx(g, .04, h, d, 'woodDark', s * (w / 2 - .02), 0, 0); const rh = (h - .06) / 4; for (let i = 0; i < 5; i++) { const y = -h / 2 + .03 + i * rh; bx(g, w - .04, .03, d, 'woodDark', 0, y, 0); if (i < 4) bx(g, w - .1, rh - .1, d - .1, bookMat(), 0, y + rh / 2 - .02, .02); } } },
  pedestal: { n: '진열대', size: [.5, .9, .5], mass: 40, hp: 120, price: 300000, mat: 'wood', fm: ['marbleDark'], frag: 6, grab: false, build(g, o, [w, h, d]) { bx(g, w, h, d, 'marbleDark', 0, 0, 0, .01); bx(g, w + .04, .04, d + .04, 'gold', 0, h / 2 - .02, 0); } },
  vase: { n: '회장님 도자기', size: [.36, .62, .36], mass: 6, hp: 12, price: 30000000, mat: 'ceramic', fm: ['celadon'], frag: 9,
    build(g) { vaseG = vaseG || new THREE.LatheGeometry([[0, -.31], [.1, -.3], [.16, -.2], [.18, -.05], [.14, .12], [.07, .22], [.06, .28], [.09, .31]].map(([x, y]) => new THREE.Vector2(x, y)), 22); const m = new THREE.Mesh(vaseG, M('celadon')); m.castShadow = true; g.add(m); } },
  orchid: { n: '축하 난', size: [.36, .78, .3], mass: 3, hp: 10, price: 200000, mat: 'ceramic', fm: ['ceramic', 'leaf'], frag: 5, spill: [['soil', 10]],
    build(g, o) { cyl(g, .13, .1, .22, 'ceramic', 0, -.28, 0); for (let i = 0; i < 6; i++) rot(bx(g, .02, .42, .006, 'leaf', (i - 2.5) * .03, -.02, 0), 0, 0, (i - 2.5) * .22); for (let i = 0; i < 4; i++) sph(g, .028, 'white', -.05 + i * .035, .22 + (i % 2) * .05, .03); rot(pl(g, .07, .3, textMat(o.text || '축 연임', { w: 64, h: 280, size: 30, bg: '#c9281f', fg: '#ffe08a' }), .1, -.12, .16), 0, 0, -.25); } },
  globe: { n: '지구본', size: [.4, .56, .4], mass: 3, hp: 20, price: 450000, mat: 'wood', fm: ['woodDark', 'plasticBlue'], frag: 4, build(g) { cyl(g, .12, .14, .04, 'woodDark', 0, -.26, 0); cyl(g, .015, .015, .2, 'gold', 0, -.15, 0, 6); rot(sph(g, .17, 'globe', 0, .1, 0), 0, 0, .4); } },
  tv: { n: '대형 디스플레이', size: [2.4, 1.4, .08], mass: 30, hp: 120, price: 8000000, mat: 'glass', fm: ['plasticDark', 'glassDark'], frag: 10, spill: [['sparks', 30], ['smoke', 6]], wall: true, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'plasticDark', 0, 0, 0, .01); g.userData.screen = pl(g, w - .06, h - .06, screenMat(o.screen || 'slide', o.sarg), 0, 0, d / 2 + .002); } },
  // ───── 로비·카페
  gate: { n: '보안 게이트', size: [.32, 1.0, 1.5], mass: 90, hp: 220, price: 4500000, mat: 'elec', fm: ['chrome', 'glass'], frag: 8, spill: [['sparks', 20]], grab: false, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'chrome', 0, 0, 0, .03); bx(g, w + .01, .05, d - .1, 'plasticDark', 0, h / 2 - .02, 0); pl(g, .22, .14, screenMat('gate'), 0, h / 2 + .005, d / 2 - .22, 0, -Math.PI / 2); for (const s of [-1, 1]) bx(g, .46, .5, .02, 'glass', s * (w / 2 + .23), .12, 0).castShadow = false; } },
  cafecounter: { n: '카페 카운터', size: [3.0, 1.05, .7], mass: 160, hp: 500, price: 3000000, mat: 'wood', fm: ['slats', 'marbleDark'], frag: 12, grab: false,
    build(g, o, [w, h, d]) { bx(g, w, h - .04, d, 'slats', 0, -.02, 0, .02); bx(g, w + .04, .04, d + .06, 'marbleDark', 0, h / 2 - .02, 0); } },
  showcase: { n: '케이크 진열장', size: [1.3, 1.25, .62], mass: 70, hp: 70, price: 2800000, mat: 'glass', fm: ['glass', 'lam'], frag: 10, spill: [['cream', 30]], grab: false, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, .66, d, 'lam', 0, -h / 2 + .33, 0, .02); const gl = bx(g, w - .02, h - .68, d - .02, 'glass', 0, .33, 0); gl.castShadow = false; bx(g, w - .06, .015, d - .08, 'glass', 0, .3, 0); for (const y of [.02, .32]) for (let i = 0; i < 4; i++) { const x = -w / 2 + .2 + i * (w - .4) / 3; cyl(g, .08, .08, .09, i % 2 ? 'cream' : colorMat('#7a4a2a', .7), x, y + .05, 0, 14); sph(g, .022, colorMat('#e0303f', .4), x, y + .105, 0); } } },
  cafetable: { n: '카페 테이블', size: [.7, .74, .7], mass: 12, hp: 60, price: 180000, mat: 'wood', fm: ['wood', 'metalDark'], frag: 5,
    build(g, o, [w, h]) { cyl(g, w / 2, w / 2, .04, 'wood', 0, h / 2 - .02, 0, 20); cyl(g, .03, .03, h - .08, 'metalDark', 0, -.02, 0, 8); cyl(g, .24, .24, .03, 'metalDark', 0, -h / 2 + .015, 0, 16); } },
  cafechair: { n: '카페 의자', size: [.44, .86, .44], mass: 4, hp: 40, price: 90000, mat: 'wood', fm: ['wood'], frag: 4,
    build(g, o, [w, h, d]) { bx(g, w, .04, d, 'wood', 0, -.03, 0, .01); bx(g, w, .38, .03, 'wood', 0, .2, -d / 2 + .02, .01); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, .03, .4, .03, 'metalDark', sx * (w / 2 - .04), -.25, sz * (d / 2 - .04)); } },
  standee: { n: '대표님 등신대', size: [.6, 1.75, .05], mass: 2, hp: 15, price: 80000, mat: 'paper', fm: ['cardboard'], frag: 4, spill: [['sheets', 6]],
    build(g, o, [w, h]) { pl(g, w, h, standeeMat(), 0, 0, .026); bx(g, .3, .04, .3, 'cardboard', 0, -h / 2 + .02, -.1); } },
  kiosk: { n: '안내 키오스크', size: [.55, 1.5, .4], mass: 50, hp: 140, price: 3200000, mat: 'elec', fm: ['plasticDark', 'glassDark'], frag: 7, spill: [['sparks', 16]], grab: false, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h - .6, d * .7, 'plasticLight', 0, -.3, 0, .03); const s = bx(g, w, .62, .05, 'plasticDark', 0, .42, .06, .02); s.rotation.x = -.18; const p = pl(g, w - .06, .56, screenMat('kiosk'), 0, .42, .09); p.rotation.x = -.18; } },
  vending: { n: '자판기', size: [.95, 1.85, .78], mass: 220, hp: 420, price: 3500000, mat: 'elec', fm: ['red', 'glassDark', 'metal'], frag: 12, spill: [['cans', 40], ['coins', 24], ['sparks', 18]], grab: false, flip: true, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, colorMat(o.col || '#c9281f', .45), 0, 0, 0, .03); pl(g, w * .62, h * .62, vendMat(), -w * .12, .2, d / 2 + .004); bx(g, w * .64, h * .64, .02, 'glass', -w * .12, .2, d / 2 + .012).castShadow = false; bx(g, w * .2, h * .5, .02, 'plasticDark', w * .36, .25, d / 2 + .01); bx(g, w * .62, .16, .05, 'plasticDark', -w * .12, -h / 2 + .3, d / 2); pl(g, w * .8, .16, textMat('시원한 음료', { w: 256, h: 52, size: 34, bg: o.col || '#c9281f', fg: '#ffffff' }), 0, h / 2 - .14, d / 2 + .004); } },
  bigplant: { n: '대형 화분', size: [.7, 2.0, .7], mass: 30, hp: 50, price: 300000, mat: 'ceramic', fm: ['pot', 'leaf'], frag: 8, spill: [['soil', 30]],
    build(g) { cyl(g, .3, .23, .55, 'pot', 0, -.72, 0); cyl(g, .28, .28, .02, 'soil', 0, -.45, 0); cyl(g, .035, .045, 1.1, colorMat('#6b4a2a', .8), 0, .05, 0, 6); [[0, .78, 0, .42], [.24, .45, .1, .3], [-.22, .5, -.12, .32], [.05, .28, -.24, .26], [-.1, .32, .24, .27]].forEach(([x, y, z, r]) => { sph(g, r, 'leaf', x, y, z).scale.set(1, 1.2, 1); }); } },
  menuboard: { n: '메뉴판', size: [1.6, .94, .05], mass: 4, hp: 30, price: 250000, mat: 'wood', fm: ['woodDark'], frag: 5, wall: true, build(g, o, [w, h, d]) { bx(g, w, h, d, 'woodDark', 0, 0, 0, .01); pl(g, w - .06, h - .06, menuMat(), 0, 0, d / 2 + .002); } },
  umbstand: { n: '우산꽂이', size: [.36, .55, .36], mass: 4, hp: 30, price: 60000, mat: 'metal', fm: ['metalDark'], frag: 4, build(g) { cyl(g, .17, .15, .5, 'metalDark', 0, -.025, 0, 16); for (let i = 0; i < 4; i++) { const a = i * 1.6; cyl(g, .02, .02, .5, colorMat(['#1d2a44', '#7a2030', '#2f5f3a', '#222'][i], .7), Math.cos(a) * .07, .2, Math.sin(a) * .07, 6); } } },
  // 상황용: 커피 캐리어(아아 12잔), 엘리베이터 점검 표지판, 세차 양동이
  cuptray: { n: '커피 캐리어', size: [.44, .2, .32], mass: 1.5, hp: 8, price: 54000, mat: 'paper', fm: ['cardboard', 'white'], frag: 4, spill: [['coffee', 34], ['cups', 12]],
    build(g, o, [w, h, d]) { bx(g, w, .06, d, 'cardboard', 0, -h / 2 + .03, 0, .01); for (let i = 0; i < 4; i++) { const x = (i % 2 ? .1 : -.1), z = (i < 2 ? -.07 : .07); cyl(g, .045, .036, .14, 'white', x, .02, z, 10); cyl(g, .047, .047, .02, colorMat('#5a3418', .5), x, .095, z, 10); } pl(g, w - .04, .05, textMat('아아 ×12', { w: 256, h: 56, size: 36, bg: '#c39a62', fg: '#3a2a1a' }), 0, -h / 2 + .03, d / 2 + .002); } },
  notice: { n: '점검 표지판', size: [.55, .9, .42], mass: 3, hp: 20, price: 40000, mat: 'plastic', fm: ['yellowPaint'], frag: 4,
    build(g, o, [w, h, d]) { for (const s of [-1, 1]) { const b = bx(g, w, h, .03, 'yellowPaint', 0, 0, s * .1, .01); b.rotation.x = -s * .22; pl(b, w - .08, .3, textMat(o.text || '점검 중', { w: 256, h: 128, size: 60, bg: '#f2c21a', fg: '#1b1b1b' }), 0, .12, s * .017, s < 0 ? Math.PI : 0); } } },
  bucket: { n: '세차 양동이', size: [.32, .32, .32], mass: 3, hp: 18, price: 15000, mat: 'plastic', fm: ['plasticBlue'], frag: 3, spill: [['water', 40]],
    build(g) { cyl(g, .16, .12, .3, 'plasticBlue', 0, 0, 0, 14); cyl(g, .15, .15, .01, 'water', 0, .13, 0, 14); const h = new THREE.Mesh(new THREE.TorusGeometry(.15, .008, 6, 16, Math.PI), M('metalDark')); h.position.y = .12; g.add(h); sph(g, .06, colorMat('#ffd84d', .9), .05, .17, .03).scale.set(1.4, .7, 1); } },
  // ───── 지하주차장
  car: { n: '자동차', size: [1.9, 1.45, 4.6], mass: 1500, hp: 1600, price: 60000000, mat: 'metal', fm: ['metalDark', 'carInside', 'rubber'], frag: 16, spill: [['carboom', 1]], grab: false,
    shapes(body, [w, h, d], C) { body.addShape(new C.Box(new C.Vec3(w / 2, .52, d / 2)), new C.Vec3(0, -h / 2 + .9, 0)); const wz = d / 2 - d * .185; for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.addShape(new C.Sphere(.33), new C.Vec3(sx * (w / 2 - .2), -h / 2 + .33, sz * wz)); },
    build: carBuild },
  cardoor: { n: '자동차 문짝', size: [.1, .55, 1.15], mass: 22, hp: 60, price: 1500000, mat: 'metal', fm: ['metalDark'], frag: 5, build(g, o, [w, h, d]) { bx(g, w, h, d, paintMat(o.col || '#15171b'), 0, 0, 0, .03); } },
  hood: { n: '보닛', size: [1.7, .05, 1.15], mass: 18, hp: 50, price: 1200000, mat: 'metal', fm: ['metalDark'], frag: 5, build(g, o, [w, h, d]) { bx(g, w, h, d, paintMat(o.col || '#15171b'), 0, 0, 0, .02); } },
  cone: { n: '라바콘', size: [.36, .7, .36], mass: 1.2, hp: 30, price: 15000, mat: 'plastic', fm: ['orange'], frag: 3, build(g) { cyl(g, .03, .14, .62, 'orange', 0, .03, 0, 12); cyl(g, .085, .1, .08, 'white', 0, 0, 0, 12); bx(g, .36, .04, .36, 'orange', 0, -.33, 0, .01); } },
  drum: { n: '드럼통', size: [.58, .88, .58], mass: 40, hp: 90, price: 120000, mat: 'metal', fm: ['metalDark'], frag: 6, spill: [['boom', 3.6, 45, 'fire']],
    build(g, o) { cyl(g, .29, .29, .88, colorMat(o.col || '#2f5fb3', .5), 0, 0, 0, 18); for (const y of [-.2, .2]) cyl(g, .296, .296, .03, 'metalDark', 0, y, 0, 18); cyl(g, .27, .27, .01, 'metalDark', 0, .44, 0, 18); if (o.oil) pl(g, .3, .2, textMat('인화성', { w: 128, h: 84, size: 30, bg: '#ffd84d', fg: '#c9281f' }), 0, .05, .292); } },
  tirestack: { n: '타이어 더미', size: [.75, .9, .75], mass: 60, hp: 200, price: 600000, mat: 'cloth', fm: ['rubber'], frag: 6,
    build(g) { tireG = tireG || new THREE.TorusGeometry(.26, .1, 8, 18); for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(tireG, M('rubber')); t.rotation.x = Math.PI / 2; t.position.y = -.34 + i * .225; t.castShadow = true; g.add(t); } } },
  pallet: { n: '팔레트', size: [1.1, .14, 1.1], mass: 18, hp: 60, price: 30000, mat: 'wood', fm: ['wood'], frag: 5,
    build(g, o, [w, h, d]) { for (let i = 0; i < 5; i++) bx(g, w, .025, .16, 'wood', 0, h / 2 - .0125, -d / 2 + .08 + i * (d - .16) / 4); for (const x of [-1, 0, 1]) bx(g, .1, h - .03, d, 'wood', x * (w / 2 - .05), -.015, 0); } },
  gatebox: { n: '차단기', size: [.38, 1.05, .38], mass: 80, hp: 260, price: 2500000, mat: 'elec', fm: ['yellowPaint', 'metalDark'], frag: 6, spill: [['sparks', 14]], grab: false, elec: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'yellowPaint', 0, 0, 0, .02); bx(g, w + .01, .12, d + .01, 'hazard', 0, -h / 2 + .1, 0); sph(g, .05, 'alarmLamp', 0, h / 2 + .02, 0); } },
  gatearm: { n: '차단봉', size: [3.4, .08, .08], mass: 6, hp: 40, price: 400000, mat: 'plastic', fm: ['hazard'], frag: 5, wall: true, build(g, o, [w, h, d]) { bx(g, w, h, d, 'hazard'); } },
  hydrant: { n: '소화전', size: [.75, .95, .22], mass: 30, hp: 70, price: 450000, mat: 'metal', fm: ['red', 'glass'], frag: 6, spill: [['water', 90]], wall: true,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'red', 0, 0, 0, .02); bx(g, w - .1, h - .1, .02, 'glass', 0, 0, d / 2).castShadow = false; pl(g, w - .2, .14, textMat('소화전', { w: 256, h: 64, size: 44, bg: '#c9281f', fg: '#ffffff' }), 0, h / 2 - .14, d / 2 + .012); rot(cyl(g, .16, .16, .12, 'white', 0, -.08, 0, 16), Math.PI / 2); } },
  // ───── 놀거리: 비상벨·카트·지게차 (부서지지 않는다)
  alarm: { n: '비상벨', size: [.34, .46, .1], mass: 1, hp: 9999, price: 0, mat: 'metal', fm: [], frag: 0, wall: true, use: 'alarm', useN: '비상벨 누르기',
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'red', 0, 0, 0, .02); rot(cyl(g, .065, .065, .03, 'white', 0, .04, d / 2 + .01, 16), Math.PI / 2); pl(g, w - .06, .07, textMat('누르면 경보', { w: 256, h: 56, size: 34, bg: '#c9281f', fg: '#ffffff' }), 0, -.13, d / 2 + .002); rot(cyl(g, .085, .085, .05, 'gold', 0, h / 2 + .1, .02, 16), Math.PI / 2); sph(g, .03, 'alarmLamp', 0, .19, d / 2 + .01); } },
  cart: { n: '택배 카트', size: [.72, .3, 1.15], mass: 30, mat: 'metal', fm: [], frag: 0, grab: false, ride: 'cart',
    build(g, o, [w, h, d]) { const dk = M('metalDark'); bx(g, w, .05, d, o.top || 'plasticBlue', 0, h / 2 - .025, 0, .01); bx(g, w - .06, .04, d - .06, dk, 0, h / 2 - .08, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl(g, .025, .025, .14, dk, sx * (w / 2 - .08), -h / 2 + .19, sz * (d / 2 - .1), 6); rot(cyl(g, .06, .06, .04, 'rubber', sx * (w / 2 - .08), -h / 2 + .06, sz * (d / 2 - .1), 12), 0, 0, Math.PI / 2); } for (const sx of [-1, 1]) bx(g, .03, .8, .03, 'chrome', sx * (w / 2 - .04), h / 2 + .4, -d / 2 + .02); bx(g, w - .04, .035, .035, 'chrome', 0, h / 2 + .8, -d / 2 + .02); } },
  forklift: { n: '지게차', size: [1.15, 1.25, 2.1], mass: 2600, mat: 'metal', fm: [], frag: 0, grab: false, ride: 'fork',
    build(g, o, [w, h, d]) {
      const y0 = -h / 2, yp = M('yellowPaint'), dk = M('metalDark'), u = g.userData;
      bx(g, w, .55, d - .3, yp, 0, y0 + .5, -.1, .05); bx(g, w - .04, .5, .45, 'plasticDark', 0, y0 + .62, -d / 2 + .25, .06);
      bx(g, .5, .08, .45, 'fabricDark', 0, y0 + .84, -.35, .03); bx(g, .5, .4, .08, 'fabricDark', 0, y0 + 1.05, -.6, .03);
      const sw = new THREE.Mesh(new THREE.TorusGeometry(.13, .018, 6, 16), dk); sw.position.set(0, y0 + 1.12, .18); sw.rotation.x = -1.0; g.add(sw); cyl(g, .02, .02, .35, dk, 0, y0 + .98, .26, 6).rotation.x = .5;
      for (const sx of [-1, 1]) for (const z of [-.62, .38]) bx(g, .05, 1.25, .05, dk, sx * (w / 2 - .06), y0 + 1.4, z);
      bx(g, w - .04, .05, 1.08, dk, 0, y0 + 2.02, -.12);
      for (const sx of [-1, 1]) for (const [z, r] of [[.6, .3], [-.65, .25]]) rot(cyl(g, r, r, .22, 'rubber', sx * (w / 2 - .08), y0 + r, z, 16), 0, 0, Math.PI / 2);
      for (const sx of [-1, 1]) bx(g, .07, 2.1, .1, dk, sx * .32, y0 + 1.05, d / 2 - .02); bx(g, .72, .06, .1, dk, 0, y0 + 2.08, d / 2 - .02);
      const car = u.carriage = new THREE.Group(); g.add(car);
      bx(car, .78, .45, .05, dk, 0, y0 + .3, d / 2 + .06); for (const sx of [-1, 1]) bx(car, .12, .05, 1.1, 'metal', sx * .3, y0 + .06, d / 2 + .6);
      u.beacon = sph(g, .06, 'beacon', 0, y0 + 2.1, -.3);
      pl(g, .55, .15, textMat('안전 제일', { w: 256, h: 72, size: 40, bg: '#1b1b1b', fg: '#f2c21a' }), 0, y0 + .62, -d / 2 - .03, Math.PI);
    } },
  // 무기
  umbrella: { n: '장우산', size: [.07, .07, .95], mass: .6, hp: 9999, price: 0, mat: 'cloth', fm: [], frag: 0,
    weapon: { n: '장우산', dmg: 16, r: .9, reach: 1.2, push: 5.5, cd: 200, snd: 'plastic', dur: 45 }, build(g) { rot(cyl(g, .03, .012, .8, colorMat('#1d2a44', .7), 0, 0, .05, 8), Math.PI / 2); rot(cyl(g, .008, .008, .95, 'chrome', 0, 0, 0, 6), Math.PI / 2); const h = new THREE.Mesh(new THREE.TorusGeometry(.04, .012, 6, 10, Math.PI), M('woodDark')); h.position.set(0, -.04, -.47); h.rotation.y = Math.PI / 2; g.add(h); } },
  crowbar: { n: '빠루', size: [.06, .06, .9], mass: 2.5, hp: 9999, price: 0, mat: 'metal', fm: [], frag: 0,
    weapon: { n: '빠루', dmg: 34, r: .95, reach: 1.0, push: 6.5, cd: 330, snd: 'metal' }, build(g) { rot(cyl(g, .016, .016, .84, colorMat('#b3261e', .4), 0, 0, 0, 8), Math.PI / 2); rot(bx(g, .03, .03, .14, 'metalDark', 0, .05, .45), .6); bx(g, .05, .015, .1, 'metalDark', 0, 0, -.46); } },
  bat: { n: '야구방망이', size: [.07, .07, .86], mass: 1, hp: 9999, price: 0, mat: 'wood', fm: [], frag: 0,
    weapon: { n: '야구방망이', dmg: 28, r: .95, reach: 1.0, push: 6, cd: 300, snd: 'wood' }, build(g) { const c = cyl(g, .034, .02, .86, 'wood', 0, 0, 0, 10); c.rotation.x = Math.PI / 2; } },
  golfclub: { n: '골프채', size: [.1, .06, 1.0], mass: .8, hp: 9999, price: 0, mat: 'metal', fm: [], frag: 0,
    weapon: { n: '부장님 골프채', dmg: 22, r: .95, reach: 1.1, push: 7.5, cd: 260, up: 1.2, snd: 'metal', word: '나이스 샷!' }, build(g) { const c = cyl(g, .01, .01, .95, 'chrome', 0, 0, 0, 6); c.rotation.x = Math.PI / 2; bx(g, .09, .04, .05, 'chrome', .03, -.01, .48, .01); bx(g, .028, .028, .2, 'rubber', 0, 0, -.4); } },
  hammer: { n: '오함마', size: [.24, .12, .95], mass: 5, hp: 9999, price: 0, mat: 'metal', fm: [], frag: 0,
    weapon: { n: '오함마', dmg: 60, r: 1.15, reach: 1.1, push: 9, cd: 620, snd: 'metal', heavy: true }, build(g) { const c = cyl(g, .022, .022, .9, 'wood', 0, 0, -.02, 8); c.rotation.x = Math.PI / 2; bx(g, .24, .11, .12, 'metalDark', 0, 0, .4, .015); } },
  // 파편·투사체
  frag: { n: '파편', size: [.1, .1, .1], mass: .4, kind: 'frag', mat: 'plastic', build() { } },
  ball: { n: '골프공', size: [.07, .07, .07], mass: .3, kind: 'frag', mat: 'plastic', sphere: true, build(g) { sph(g, .035, 'white'); } },
  // 건물 밖
  block: { n: '사옥 외벽', size: [3, 2.4, 3], mass: 60, hp: 80, price: 800000, mat: 'wood', fm: ['concrete'], frag: 8, grab: false,
    build(g, o, [w, h, d]) { bx(g, w, h, d, o.wallMat || 'bglass');[-1, 1].forEach(s => { pl(g, w * .32, h * .5, M(o.lit ? 'winLit' : 'glassDark'), s * w * .22, 0, d / 2 + .01); const b = pl(g, w * .32, h * .5, M(o.lit ? 'winLit' : 'glassDark'), s * w * .22, 0, -d / 2 - .01); b.rotation.y = Math.PI; }); } },
  letter: { n: '간판 글자', size: [1.1, 1.2, .3], mass: 6, hp: 20, price: 500000, mat: 'plastic', fm: ['white', 'red'], frag: 5,
    build(g, o, [w, h, d]) { bx(g, w, h, d, 'white', 0, 0, 0, .04); pl(g, w - .1, h - .1, textMat(o.text || '?', { title: true, w: 128, h: 140, size: 110, fg: '#c9281f', bg: '#ffffff' }), 0, 0, d / 2 + .003); } },
};
