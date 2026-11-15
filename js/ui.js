import { S, save, RANKS, rankOf, DEF_COMPANY, copy } from './save.js';
import { CHARS, ACCS } from './data/chars.js';
import { ROOMS, ROOM_IDS } from './data/rooms.js';
import { SETS, WHOS, MOTTOS } from './data/lines.js';
import { G, won, pick } from './state.js';
import { drawChar } from './player.js';
import { sfx } from './audio.js';

export const act = {};
const $ = id => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('off', !on);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const STYLES = [{ v: 'glass', n: '유리 빌딩', rank: 0 }, { v: 'brick', n: '벽돌 상가', rank: 1 }, { v: 'gov', n: '관공서풍', rank: 3 }];
const SCREENS = ['s-title', 's-build', 's-chars', 's-endless', 's-pause', 's-bill', 's-fake'];
function only(id) { SCREENS.forEach(s => show(s, s === id)); }
export function charName(id) { return S.charName[id] || CHARS[id].n; }

function chips(box, items, isOn, onClick) {
  box.textContent = '';
  for (const it of items) {
    const b = el('button', 'chip' + (isOn(it.v) ? ' on' : '') + (it.lock ? ' lock' : ''), it.n + (it.lock ? ' (' + it.lock + ')' : ''));
    b.type = 'button'; b.onclick = () => { if (it.lock) return toast(it.lock + '부터 쓸 수 있어요'); sfx('type'); onClick(it.v); };
    box.appendChild(b);
  }
}
const lockOf = r => rankOf(S.total) >= r ? null : RANKS[r].n;

let toastT;
export function toast(s) { const t = $('toast'); t.textContent = s; t.classList.remove('off'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('off'), 1900); }

// ───── 첫 화면
export function showTitle() {
  only('s-title'); hudShow(false); over('');
  const r = rankOf(S.total), nx = RANKS[r + 1];
  $('t-rank').textContent = RANKS[r].n;
  $('t-rankbar').style.width = (nx ? Math.min(100, (S.total - RANKS[r].at) / (nx.at - RANKS[r].at) * 100) : 100) + '%';
  $('t-total').textContent = '누적 ' + won(S.total);
  $('o-snd').checked = !S.mute; $('o-hap').checked = S.haptic; $('o-calm').checked = S.calm;
}

// ───── 회사 짓기
function fillBuilder() {
  const B = S.company, ch = () => { save(); fillBuilder(); act.preview(); };
  $('c-name').value = B.name;
  chips($('c-style'), STYLES.map(s => ({ v: s.v, n: s.n, lock: lockOf(s.rank) })), v => B.style === v, v => { B.style = v; ch(); });
  chips($('c-n'), [3, 4, 5, 6].map(n => ({ v: n, n: n + '층' })), v => B.floors.length + 1 === v, v => { while (B.floors.length > v - 1) B.floors.pop(); while (B.floors.length < v - 1) B.floors.push(pick(ROOM_IDS)); ch(); });
  const fl = $('c-floors'); fl.textContent = '';
  const top = el('div', 'fl'); top.appendChild(el('b', '', B.floors.length + 1 + '층')); top.appendChild(el('span', 'chip on', '대표실 (고정)')); fl.appendChild(top);
  for (let i = B.floors.length - 1; i >= 0; i--) {
    const row = el('div', 'fl'), box = el('div', 'chips'); row.appendChild(el('b', '', i + 1 + '층')); row.appendChild(box); fl.appendChild(row);
    chips(box, ROOM_IDS.map(id => ({ v: id, n: ROOMS[id].n })), v => B.floors[i] === v, v => { B.floors[i] = v; ch(); });
  }
  chips($('c-who'), WHOS.map(w => ({ v: w, n: w })), v => B.who === v, v => { B.who = v; $('c-who2').value = ''; ch(); });
  if (!WHOS.includes(B.who)) $('c-who2').value = B.who;
  chips($('c-sets'), Object.keys(SETS).map(k => ({ v: k, n: SETS[k].n })), v => B.sets.includes(v), v => {
    if (B.sets.includes(v)) { if (B.sets.length > 1) B.sets = B.sets.filter(x => x !== v); } else if (B.sets.length < 3) B.sets.push(v); else return toast('3개까지 고를 수 있어요'); ch();
  });
  document.querySelectorAll('.c-my').forEach((inp, i) => { inp.value = B.myLines[i] || ''; });
  chips($('c-motto'), MOTTOS.map(m => ({ v: m, n: m })), v => B.motto === v, v => { B.motto = v; $('c-motto2').value = ''; ch(); });
  if (!MOTTOS.includes(B.motto)) $('c-motto2').value = B.motto;
  const sl = [];
  S.slots.forEach((s, i) => { sl.push({ v: 's' + i, n: `${i + 1}번에 저장` }); if (s) sl.push({ v: 'l' + i, n: `${i + 1}번 불러오기: ${s.name}` }); });
  chips($('c-slots'), sl, () => false, v => { const i = +v[1]; if (v[0] === 's') { S.slots[i] = copy(B); toast(`${i + 1}번 칸에 저장했어요`); } else { S.company = copy(S.slots[i]); toast('불러왔어요'); } ch(); });
}
export function showBuilder() { only('s-build'); fillBuilder(); }

// ───── 캐릭터
function fillChars() {
  const list = $('ch-list'); list.textContent = '';
  for (const id of Object.keys(CHARS)) {
    const c = CHARS[id], lock = lockOf(c.rank), card = el('div', 'chc' + (S.char === id ? ' on' : '') + (lock ? ' lock' : ''));
    const cv = document.createElement('canvas'); cv.width = cv.height = 168; const x = cv.getContext('2d'); x.scale(2, 2);
    drawChar(x, id, 36, 44, { acc: S.char === id ? S.acc : null, swing: .35 });
    card.appendChild(cv); card.appendChild(el('b', '', charName(id))); card.appendChild(el('span', '', lock ? lock + '부터' : c.desc));
    const sp = el('div', 'hint', '필살기: ' + c.sp.name); card.appendChild(sp);
    card.onclick = () => { if (lock) return toast(lock + ' 직급부터 쓸 수 있어요'); S.char = id; save(); sfx('up'); fillChars(); };
    list.appendChild(card);
  }
  $('ch-name').value = charName(S.char);
  chips($('ch-acc'), ACCS.map(a => ({ v: a.id, n: a.n, lock: lockOf(a.rank) })), v => S.acc === v, v => { S.acc = v; save(); fillChars(); });
}
export function showChars() { only('s-chars'); fillChars(); }

// ───── 게임 중 표시
export function hudShow(on) {
  $('hud').classList.toggle('off', !on); show('pad', on && G.mobile);
  if (!on) show('keys', false);
  window.dispatchEvent(new Event('resize'));
}
export function keysHint(on) { if (G.mobile) return; const k = $('keys'); k.innerHTML = '<b>← →</b>이동 <b>↑</b>점프 <b>Z</b>때리기(누르고 있으면 연타) <b>X</b>강타(공중: 내려찍기) <b>C</b>필살기'; show('keys', on); }
let lastHud = {};
export function hud(d) {
  const set = (id, k, v) => { if (lastHud[k] !== v) { lastHud[k] = v; $(id).textContent = v; } };
  set('h-floor', 'f', d.floor); set('h-sub', 's', d.sub); set('h-money', 'm', won(d.money));
  set('h-time', 't', d.time); set('h-combo', 'c', d.combo >= 5 ? '연타 ' + d.combo + (d.mult > 1 ? ' ×' + d.mult : '') : '');
  set('h-pct', 'p', d.stress == null ? '' : Math.round(d.stress) + '%'); set('h-cname', 'n', d.cname || '');
  if (d.stress != null) { $('h-stress').style.width = d.stress + '%'; const f = d.stress > 60 ? 0 : d.stress > 0 ? 1 : 2; if (lastHud.face !== f) { lastHud.face = f; $('h-face').className = 'face f' + f; } }
  $('h-chp').style.width = Math.max(0, d.chp * 100) + '%';
  const sp = $('p-sp'); const ready = d.rage >= 100; if (lastHud.r !== ready) { lastHud.r = ready; sp.classList.toggle('ready', ready); }
  if (!ready) sp.style.background = `linear-gradient(90deg,#FF5C8A ${d.rage}%,#bbb ${d.rage}%)`; else sp.style.background = '';
}
let overT;
export function over(html) { clearTimeout(overT); $('over').innerHTML = html; }
export function card(small, title, sub, rows, cb) {
  const o = $('over'); o.textContent = ''; clearTimeout(overT);
  const c = el('div', 'card'); c.appendChild(el('small', '', small)); c.appendChild(el('b', '', title)); c.appendChild(el('span', '', sub));
  const t = el('table'); const tr = el('tr'); rows.forEach(r => tr.appendChild(el('td', '', r))); t.appendChild(tr); c.appendChild(t);
  let done = false; const go = () => { if (done) return; done = true; clearTimeout(overT); o.textContent = ''; cb(); };
  c.onclick = go; o.appendChild(c); overT = setTimeout(go, 2200);
}
export function stamp(text, cls, small) { const o = $('over'); o.textContent = ''; const s = el('div', 'stamp ' + cls, text); if (small) s.appendChild(el('small', '', small)); o.appendChild(s); }
export function big(text, sub) { const o = $('over'); o.textContent = ''; o.appendChild(el('div', 'big', text)); if (sub) o.appendChild(el('div', 'sub', sub)); }
export function mash(text) { const o = $('over'); o.textContent = ''; o.appendChild(el('div', 'mash', text)); }

// ───── 청구서
const TITLES = [[3e7, '참을 인 세 번'], [6e7, '소심한 반항러'], [1e8, '프로 퇴근러'], [1.5e8, '총무팀의 악몽'], [Infinity, '걸어 다니는 철거반']];
export function bill(d) {
  only('s-bill'); hudShow(false); over('');
  const b = $('bill'); b.textContent = '';
  b.appendChild(el('h2', '', '비품 파손 청구서'));
  b.appendChild(el('div', 'meta', `${d.company} 귀하 · ${new Date().toLocaleDateString('ko-KR')} · 담당 ${d.who}`));
  const items = Object.values(d.counts).sort((a, c) => c.sum - a.sum).slice(0, 8).map(c => [`${c.name} ×${c.n}`, won(c.sum)]);
  if (d.bubbles) items.push([`정신적 피해 (잔소리 ${d.bubbles}건)`, won(d.bubbleSum)]);
  if (!items.length) items.push(['부순 것이 없습니다', '0원']);
  items.forEach(([a, c], i) => { const li = el('div', 'li'); li.style.animationDelay = (.3 + i * .13) + 's'; li.appendChild(el('span', '', a)); li.appendChild(el('span', '', c)); b.appendChild(li); setTimeout(() => sfx('type'), 300 + i * 130); });
  const sum = el('div', 'sum'); sum.appendChild(el('span', '', '합계')); sum.appendChild(el('b', '', won(d.total))); b.appendChild(sum);
  const ex = el('div', 'ex'); ex.appendChild(el('span', '', '최고 연타 ' + d.maxCombo)); ex.appendChild(el('span', '', '걸린 시간 ' + Math.floor(d.sec / 60) + '분 ' + (d.sec % 60) + '초')); b.appendChild(ex);
  const seal = el('div', 'seal' + (rankOf(S.total) >= 7 ? ' gold' : ''), '전액'); seal.appendChild(document.createElement('br')); seal.appendChild(document.createTextNode('회사 부담')); b.appendChild(seal);
  setTimeout(() => sfx('stamp'), 1650);
  b.appendChild(el('div', 'title', '「' + TITLES.find(t => d.total < t[0])[1] + '」'));
  if (d.promo) b.appendChild(el('div', 'promo', `승진! ${d.promo.n} — ${d.promo.get || ''}`));
  const r = rankOf(S.total), nx = RANKS[r + 1], rk = el('div', 'rank');
  rk.appendChild(el('b', '', RANKS[r].n)); const bar = el('div', 'bar'), fill = el('div'); fill.style.width = (nx ? Math.min(100, (S.total - RANKS[r].at) / (nx.at - RANKS[r].at) * 100) : 100) + '%'; bar.appendChild(fill); rk.appendChild(bar);
  rk.appendChild(el('span', '', nx ? nx.n + '까지 ' + won(nx.at - S.total) : '끝까지 승진')); b.appendChild(rk);
  b.appendChild(el('div', 'bye', '오늘도 수고했어요. 스트레스 0%.'));
  const btns = el('div', 'p-btns');
  const mk = (t, cls, fn) => { const x = el('button', 'btn ' + cls, t); x.onclick = fn; btns.appendChild(x); };
  mk('한 판 더', 'main', () => act.again());
  mk('회사 고치기', '', () => { act.title(); showBuilder(); });
  mk('결과 복사', '', () => { const s = `[회사 뿌시기] ${d.company} 비품 파손 청구서 — 합계 ${won(d.total)}, 최고 연타 ${d.maxCombo}`; (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('복사했어요'), () => toast('복사하지 못했어요')); });
  mk('처음으로', '', () => act.title());
  b.appendChild(btns);
  if (d.promo) setTimeout(() => sfx('up'), 2000);
}

// ───── 일시정지 · 위장
export function pause(on) { show('s-pause', on); }
export function fake(on) {
  show('s-fake', on); if (!on) return;
  const t = $('fk-table'); if (t.rows.length) return;
  const heads = ['', 'A 부서', 'B 목표', 'C 실적', 'D 달성률', 'E 전년 대비', 'F 비고'];
  for (let r = 0; r < 18; r++) { const tr = t.insertRow(); heads.forEach((h, c) => { const td = tr.insertCell(); td.textContent = r === 0 ? h : c === 0 ? r : c === 1 ? ['영업1팀', '영업2팀', '기획팀', '총무팀', '개발팀', '인사팀'][r % 6] : c === 6 ? '' : c === 4 || c === 5 ? (60 + (r * 37 + c * 11) % 55) + '%' : ((r * 7919 + c * 104729) % 9000 + 1000).toLocaleString(); }); }
}

export function init() {
  $('b-quick').onclick = () => act.quick(); $('b-build').onclick = showBuilder; $('b-chars').onclick = showChars;
  $('b-endless').onclick = () => { only('s-endless'); chips($('e-rooms'), [...ROOM_IDS, 'ceo'].map(id => ({ v: id, n: ROOMS[id].n })), () => false, v => act.endless(v)); };
  $('e-back').onclick = showTitle;
  $('o-snd').onchange = e => { S.mute = !e.target.checked; save(); }; $('o-hap').onchange = e => { S.haptic = e.target.checked; save(); }; $('o-calm').onchange = e => { S.calm = e.target.checked; G.calm = S.calm; save(); };
  const B = () => S.company, upd = () => { save(); act.preview(); };
  $('c-name').oninput = e => { B().name = e.target.value.trim() || DEF_COMPANY.name; upd(); };
  $('c-who2').oninput = e => { const v = e.target.value.trim(); B().who = v || '부장님'; save(); }; $('c-who2').onchange = fillBuilder;
  $('c-motto2').oninput = e => { const v = e.target.value.trim(); B().motto = v || MOTTOS[0]; save(); }; $('c-motto2').onchange = fillBuilder;
  document.querySelectorAll('.c-my').forEach((inp, i) => { inp.oninput = e => { B().myLines[i] = e.target.value; save(); }; });
  $('c-rand').onclick = () => {
    const n = 2 + (Math.random() * 4 | 0), names = ['열정페이', '야근공화국', '월급루팡', '가족같은회사', '주말출근', '회의지옥'];
    Object.assign(B(), { name: pick(names), style: pick(STYLES.filter(s => !lockOf(s.rank))).v, floors: Array.from({ length: n }, () => pick(ROOM_IDS)), who: pick(WHOS), sets: Object.keys(SETS).sort(() => Math.random() - .5).slice(0, 2), motto: pick(MOTTOS) });
    upd(); fillBuilder(); sfx('up');
  };
  $('c-back').onclick = showTitle; $('c-go').onclick = () => act.quick();
  $('ch-name').oninput = e => { const v = e.target.value.trim(); if (v) S.charName[S.char] = v; else delete S.charName[S.char]; save(); };
  $('ch-ok').onclick = () => { act.preview(); showTitle(); };
  $('b-pause').onclick = () => act.pause(); $('p-resume').onclick = () => act.pause(); $('p-quit').onclick = () => act.quit();
}
export { only };
