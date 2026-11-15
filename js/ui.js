import { S, save, RANKS, rankOf, DEF_COMPANY } from './save.js';
import { CHARS, ACCS } from './data/chars.js';
import { SETS, WHOS, MOTTOS } from './data/lines.js';
import { G, won } from './state.js';
import { sfx } from './audio.js';
import { refreshMusic } from './music.js';
import { FLOORS, FLOOR_IDS } from './floors.js';

export const act = {};
const $ = id => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('off', !on);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const STYLES = [{ v: 'glass', n: '유리 빌딩', rank: 0 }, { v: 'brick', n: '벽돌 상가', rank: 1 }, { v: 'gov', n: '관공서풍', rank: 3 }];
const SCREENS = ['s-title', 's-pick', 's-floors', 's-build', 's-chars', 's-pause', 's-bill', 's-fake'];
export function only(id) { SCREENS.forEach(s => show(s, s === id)); }
export function charName(id) { return S.charName[id] || CHARS[id].n; }
// 저장이 브라우저에만 남는 게임이라 캐릭터·소품·건물은 처음부터 모두 연다(직급은 칭호로만 쓴다)
const lockOf = () => null;
const genderOf = id => (S.gender && S.gender[id]) || CHARS[id].g || 'm';

function chips(box, items, isOn, onClick) {
  box.textContent = '';
  for (const it of items) {
    const b = el('button', 'chip' + (isOn(it.v) ? ' on' : '') + (it.lock ? ' lock' : ''), it.n + (it.lock ? ' (' + it.lock + ')' : ''));
    b.type = 'button'; b.onclick = () => { if (it.lock) return toast(it.lock + ' 직급부터 쓸 수 있어요'); sfx('type'); onClick(it.v); };
    box.appendChild(b);
  }
}
let toastT;
export function toast(s) { const t = $('toast'); t.textContent = s; t.classList.remove('off'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('off'), 2000); }

// ───── 첫 화면
export function showTitle() {
  only('s-title'); hudShow(false); over(''); objectives(null); prompt(null); subtitle(null); clearTips(); show('tip', false);
  const r = rankOf(S.total), nx = RANKS[r + 1];
  $('t-rank').textContent = RANKS[r].n;
  $('t-rankbar').style.width = (nx ? Math.min(100, (S.total - RANKS[r].at) / (nx.at - RANKS[r].at) * 100) : 100) + '%';
  $('t-total').textContent = '누적 피해액 ' + won(S.total);
  $('o-snd').checked = !S.mute; $('o-bgm').checked = S.bgm !== false; $('o-hap').checked = S.haptic; $('o-calm').checked = S.calm; $('o-skip').checked = !!S.skipArrive;
  show('o-skipw', S.runs > 0);
}
function showPick(missions, ids) {
  only('s-pick'); const box = $('pk-list'); box.textContent = '';
  for (const id of [...ids, 'resign']) {
    const m = missions[id], b = el('button', 'pk'); b.appendChild(el('small', '', act.clock(m.clock[0] * 60 + m.clock[1]))); b.appendChild(el('b', '', m.n)); b.appendChild(el('span', '', m.sub + ' · ' + m.steps.filter(s => !s.hide).length + '단계'));
    b.onclick = () => act.single(id); box.appendChild(b);
  }
}

// ───── 자유 난동: 시작할 층 고르기(깬 도전과제 수는 이 기기에만 남는다)
function showFloors() {
  only('s-floors'); const box = $('fl-list'); box.textContent = '';
  for (const id of FLOOR_IDS) {
    const f = FLOORS[id], got = f.goals.filter(g => S.done && S.done[g.id]).length, b = el('button', 'fl fl-' + id);
    b.type = 'button'; b.appendChild(el('b', 'lv', f.lv));
    const t = el('div', 'tx'); t.appendChild(el('strong', '', f.n)); t.appendChild(el('span', '', f.sub)); t.appendChild(el('em', '', f.desc)); b.appendChild(t);
    b.appendChild(el('small', 'gl', '도전과제 ' + got + '/' + f.goals.length));
    b.onclick = () => { sfx('up'); act.free(id); }; box.appendChild(b);
  }
}
// 엘리베이터 층 버튼: 안에 들어서면 뜬다. PC에서는 버튼을 누를 수 있게 마우스 고정을 푼다
let elevOn = false;
export const elevOpen = () => elevOn;
export function elev(d) {
  elevOn = !!d;
  if (!d) { G.uiFree = false; return show('elev', false); }
  const box = $('el-btns'); box.textContent = '';
  d.floors.forEach((f, i) => {
    const b = el('button', 'eb' + (f.id === d.cur ? ' on' : '')); b.type = 'button';
    b.appendChild(el('b', '', f.lv)); b.appendChild(el('span', '', f.id === d.cur ? f.n + ' (여기)' : f.n)); if (!G.mobile) b.appendChild(el('kbd', '', String(i + 1)));
    if (f.id !== d.cur) b.onclick = () => act.goFloor(f.id);
    box.appendChild(b);
  });
  show('elev', true);
  if (document.pointerLockElement) { G.uiFree = true; document.exitPointerLock(); }
}
// 층 도전과제 목록과 달성 알림
export function goals(title, items, foot) {
  const o = $('obj'); show('obj', true); o.textContent = ''; o.classList.add('goals');
  const h = el('h3'); h.appendChild(el('span', '', title)); h.appendChild(el('span', '', items.filter(i => i.done).length + ' / ' + items.length)); o.appendChild(h);
  let left = 0;
  items.forEach(it => {
    const d = el('div', it.done ? 'done' : left++ >= 2 ? 'later' : ''); d.appendChild(el('i', '', it.done ? '✓' : ''));
    const s = el('span', '', it.t); if (!it.done && it.n > 1) s.appendChild(el('em', '', ` ${it.have}/${it.n}`)); d.appendChild(s); o.appendChild(d);
  });
  if (foot) o.appendChild(el('p', '', '→ ' + foot));
}
let goalT;
export function goalToast(text, n) {
  const g = $('goalt'); g.textContent = ''; g.appendChild(el('small', '', '도전과제 달성 · 오늘 ' + n + '개째')); g.appendChild(el('b', '', text)); g.appendChild(el('em', '', '보너스 +3,000,000원'));
  g.classList.remove('off', 'pop'); void g.offsetWidth; g.classList.add('pop'); clearTimeout(goalT); goalT = setTimeout(() => g.classList.add('off'), 2800);
}
export function alarm(on) { $('alarmfx').classList.toggle('on', !!on); }

// ───── 회사 설정
function fillBuilder() {
  const B = S.company, ch = () => { save(); fillBuilder(); };
  $('c-name').value = B.name;
  chips($('c-who'), WHOS.map(w => ({ v: w, n: w })), v => B.who === v, v => { B.who = v; $('c-who2').value = ''; ch(); });
  if (!WHOS.includes(B.who)) $('c-who2').value = B.who;
  chips($('c-motto'), MOTTOS.map(m => ({ v: m, n: m })), v => B.motto === v, v => { B.motto = v; $('c-motto2').value = ''; ch(); });
  if (!MOTTOS.includes(B.motto)) $('c-motto2').value = B.motto;
  chips($('c-sets'), Object.keys(SETS).map(k => ({ v: k, n: SETS[k].n })), v => B.sets.includes(v), v => {
    if (B.sets.includes(v)) { if (B.sets.length > 1) B.sets = B.sets.filter(x => x !== v); } else if (B.sets.length < 3) B.sets.push(v); else return toast('3개까지 고를 수 있어요'); ch();
  });
  document.querySelectorAll('.c-my').forEach((inp, i) => { inp.value = B.myLines[i] || ''; });
  chips($('c-style'), STYLES.map(s => ({ v: s.v, n: s.n, lock: lockOf(s.rank) })), v => B.style === v, v => { B.style = v; ch(); });
}
export function showBuilder() { only('s-build'); fillBuilder(); }

// ───── 캐릭터 (뒤의 3D 화면에 고른 캐릭터가 보인다)
function fillChars() {
  const list = $('ch-list'); list.textContent = '';
  for (const id of Object.keys(CHARS)) {
    const c = CHARS[id], lock = lockOf(c.rank), card = el('div', 'chc' + (S.char === id ? ' on' : '') + (lock ? ' lock' : ''));
    const dot = el('i'); dot.style.background = c.suit; card.appendChild(dot);
    card.appendChild(el('em', 'rk', c.rankName + ' · ' + (genderOf(id) === 'f' ? '여' : '남')));
    card.appendChild(el('b', '', charName(id))); card.appendChild(el('span', '', lock ? lock + '부터' : c.desc)); card.appendChild(el('div', 'hint', '필살기 ' + c.sp.name));
    card.onclick = () => { if (lock) return toast(lock + ' 직급부터 쓸 수 있어요'); S.char = id; save(); sfx('up'); fillChars(); act.preview(true); };
    list.appendChild(card);
  }
  $('ch-name').value = charName(S.char);
  chips($('ch-g'), [{ v: 'm', n: '남자' }, { v: 'f', n: '여자' }], v => genderOf(S.char) === v, v => { S.gender = S.gender || {}; S.gender[S.char] = v; save(); fillChars(); act.preview(true); });
  chips($('ch-acc'), ACCS.map(a => ({ v: a.id, n: a.n, lock: lockOf(a.rank) })), v => S.acc === v, v => { S.acc = v; save(); fillChars(); act.preview(true); });
}
export function showChars() { only('s-chars'); fillChars(); act.preview(true); }

// ───── 게임 중 표시
export function hudShow(on) { show('hud', on); show('status', on); show('pad', on && G.mobile); show('cross', on && !G.mobile); if (!on) { show('keys', false); show('obj', false); show('band', false); show('elev', false); elevOn = false; $('vig').style.opacity = 0; alarm(false); } }
// 시계 넘김: 화면이 검게 됐다가 시각이 크게 뜬다
export function fade(on, instant) {
  const f = $('fade');
  if (on) { f.classList.remove('off', 'show'); f.style.transition = 'none'; f.style.opacity = 0; void f.offsetWidth; f.style.transition = 'opacity .42s'; f.style.opacity = 1; return; }
  if (instant) { f.style.transition = 'none'; f.style.opacity = 0; f.classList.add('off'); return; }
  f.style.transition = 'opacity .42s'; f.style.opacity = 0; setTimeout(() => { if (f.style.opacity === '0') f.classList.add('off'); }, 460);
}
export function fadeText(time, title) { $('fade-time').textContent = time; $('fade-title').textContent = title; const f = $('fade'); f.classList.remove('show'); void f.offsetWidth; f.classList.add('show'); }
export function band(slot) { const b = $('band'); if (slot == null) return show('band', false); show('band', true); [...b.children].forEach((e, k) => { e.className = k < slot ? 'done' : k === slot ? 'now' : ''; }); }
// 조작 안내를 한 줄씩
const tq = []; let tBusy = false;
export function tips(list) { tq.push(...list); if (!tBusy) nextTip(); }
function nextTip() { const t = $('tip'); if (!tq.length) { tBusy = false; show('tip', false); return; } tBusy = true; t.innerHTML = tq.shift(); show('tip', true); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; setTimeout(nextTip, 3300); }
export function clearTips() { tq.length = 0; }
export function boil() { const b = $('h-stressbox'); b.classList.remove('boil'); void b.offsetWidth; b.classList.add('boil'); }
export function keysHint(on) { if (G.mobile || !on) return show('keys', false); const k = $('keys'); k.innerHTML = '<b>WASD</b>이동<b>마우스</b>시점(화면을 클릭하면 고정)<b>스페이스</b>점프<br><b>좌클릭</b>때리기<b>우클릭</b>강타<b>E</b>집기·던지기·엎기' + (G.toys ? '·타기' : '') + '<b>Q</b>필살기'; show('keys', on); }
let last = {};
export function hud(d) {
  const set = (id, k, v) => { if (last[k] !== v) { last[k] = v; $(id).textContent = v; } };
  set('h-title', 'f', d.title); set('h-sub', 's', d.sub); set('h-money', 'm', won(d.money)); set('h-time', 't', d.time); set('h-clock', 'k', d.clock || '');
  const vg = d.stress == null ? 0 : Math.max(0, Math.min(1, (d.stress - 55) / 45)) * .9; if (last.vg !== vg) { last.vg = vg; $('vig').style.opacity = vg; }
  set('h-combo', 'c', d.combo >= 5 ? '연타 ' + d.combo + (d.combo >= 15 ? ' ×' + (d.combo >= 80 ? 2 : d.combo >= 40 ? 1.5 : 1.2) : '') : '');
  set('h-weapon', 'w', d.weapon || '');
  const has = d.stress != null; if (last.has !== has) { last.has = has; $('h-stressbox').style.visibility = has ? 'visible' : 'hidden'; }
  if (has) { set('h-pct', 'p', Math.round(d.stress) + '%'); $('h-stress').style.width = d.stress + '%'; const f = d.stress > 60 ? 0 : d.stress > 0 ? 1 : 2; if (last.face !== f) { last.face = f; $('h-face').className = 'face f' + f; } }
  $('h-rage').style.width = d.rage + '%'; const ready = d.rage >= 100;
  if (last.r !== ready) { last.r = ready; $('status').classList.toggle('ready', ready); $('p-sp').classList.toggle('ready', ready); $('h-ragel').textContent = ready ? (G.mobile ? '필살기!' : 'Q 필살기!') : '필살기'; }
}
export function objectives(list, idx, hint) {
  const o = $('obj'); if (!list) return show('obj', false); show('obj', true); o.textContent = ''; o.classList.remove('goals');
  const h = el('h3'); h.appendChild(el('span', '', idx < 0 ? '자유 난동' : '할 일')); if (idx >= 0) h.appendChild(el('span', '', Math.min(idx, list.length) + ' / ' + list.length)); o.appendChild(h);
  list.forEach((t, i) => { const d = el('div', idx < 0 ? 'now' : i < idx ? 'done' : i === idx ? 'now' : ''); d.appendChild(el('i', '', i < idx && idx >= 0 ? '✓' : '')); d.appendChild(el('span', '', t)); if (idx < 0) d.style.background = 'none'; o.appendChild(d); });
  if (hint) o.appendChild(el('p', '', '→ ' + hint));
  if (idx >= list.length) o.appendChild(el('p', '', '→ 전부 완료! 마음껏 부수세요'));
}
let pBusy = false;
export const promptBusy = () => pBusy;
export function prompt(text, prog = 0, wait) {
  const p = $('prompt'); pBusy = !!text; if (!text) { if (!p.classList.contains('soft')) show('prompt', false); return; }
  show('prompt', true); p.classList.remove('soft'); p.firstElementChild.textContent = wait ? text : (G.mobile ? '[행동] ' : '[E] ') + text;
  const b = p.lastElementChild; b.style.display = prog > 0 || wait ? 'block' : 'none'; b.firstElementChild.style.width = Math.min(100, prog * 100) + '%';
}
export function hint(text, prog = 0) {
  const p = $('prompt'); if (pBusy) return; if (!text) { show('prompt', false); p.classList.remove('soft'); return; }
  show('prompt', true); p.classList.add('soft'); p.firstElementChild.textContent = G.mobile ? text.replace(/^E 꾹/, '[행동] 꾹').replace(/^E /, '[행동] ') : text;
  const b = p.lastElementChild; b.style.display = prog > 0 ? 'block' : 'none'; b.firstElementChild.style.width = Math.min(100, prog * 100) + '%';
}
let subT;
export function subtitle(who, text) { const s = $('subt'); clearTimeout(subT); if (!text) return show('subt', false); show('subt', true); s.firstElementChild.textContent = who; s.lastElementChild.textContent = text; s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop'); subT = setTimeout(() => show('subt', false), 2100 + text.length * 95); }
let overT;
export function over(html) { clearTimeout(overT); $('over').innerHTML = html; }
export function card(small, title, sub, rows, cb) {
  const o = $('over'); o.textContent = ''; clearTimeout(overT);
  const c = el('div', 'card'); c.appendChild(el('small', '', small)); c.appendChild(el('b', '', title)); c.appendChild(el('span', '', sub));
  const t = el('table'), tr = el('tr'); rows.forEach(r => tr.appendChild(el('td', '', r))); t.appendChild(tr); c.appendChild(t); c.appendChild(el('em', '', '누르면 바로 시작'));
  let done = false; const go = () => { if (done) return; done = true; clearTimeout(overT); o.textContent = ''; cb(); };
  c.onclick = go; o.appendChild(c); overT = setTimeout(go, 3000);
}
export function stamp(text, cls, small) { const o = $('over'); o.textContent = ''; const s = el('div', 'stamp ' + cls, text); if (small) s.appendChild(el('small', '', small)); o.appendChild(s); }
export function big(text, sub) { const o = $('over'); o.textContent = ''; o.appendChild(el('div', 'big', text)); if (sub) o.appendChild(el('div', 'sub', sub)); }
export function mash(text) { const o = $('over'); o.textContent = ''; o.appendChild(el('div', 'mash', text)); }

// ───── 청구서
const TITLES = [[3e7, '참을 인 세 번'], [9e7, '소심한 반항러'], [1.8e8, '프로 퇴근러'], [3e8, '총무팀의 악몽'], [Infinity, '걸어 다니는 철거반']];
export function bill(d) {
  only('s-bill'); hudShow(false); over(''); subtitle(null);
  const b = $('bill'); b.textContent = '';
  b.appendChild(el('h2', '', '비품 파손 청구서'));
  b.appendChild(el('div', 'meta', `${d.company} 귀하 · ${new Date().toLocaleDateString('ko-KR')} · 담당 ${d.who}`));
  const items = Object.values(d.counts).sort((a, c) => c.sum - a.sum).slice(0, 8).map(c => [`${c.name} ×${c.n}`, won(c.sum)]);
  if (d.nags) items.push([`정신적 피해 위자료 (잔소리 ${d.nags}건)`, won(d.nagSum)]);
  if (!items.length) items.push(['부순 것이 없습니다', '0원']);
  items.forEach(([a, c], i) => { const li = el('div', 'li'); li.style.animationDelay = (.3 + i * .13) + 's'; li.appendChild(el('span', '', a)); li.appendChild(el('span', '', c)); b.appendChild(li); setTimeout(() => sfx('type'), 300 + i * 130); });
  const sum = el('div', 'sum'); sum.appendChild(el('span', '', '합계')); sum.appendChild(el('b', '', won(d.total))); b.appendChild(sum);
  const ex = el('div', 'ex'); ex.appendChild(el('span', '', '최고 연타 ' + d.maxCombo)); ex.appendChild(el('span', '', '걸린 시간 ' + Math.floor(d.sec / 60) + '분 ' + (d.sec % 60) + '초')); b.appendChild(ex);
  if (d.stressMax != null) { const sx = el('div', 'ex'); sx.appendChild(el('span', '', '하루 스트레스 최고 ' + Math.round(d.stressMax) + '%')); sx.appendChild(el('span', '', '퇴근할 때 ' + Math.round(d.stressEnd) + '%')); b.appendChild(sx); }
  if (d.goals) { const gx = el('div', 'ex'); gx.appendChild(el('span', '', '도전과제 ' + d.goals.got + ' / ' + d.goals.total)); gx.appendChild(el('span', '', '다녀간 층 ' + d.goals.floors + '곳')); b.appendChild(gx); }
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
  mk('결과 복사', '', () => { const s = `[회사 뿌시기] ${d.company} 비품 파손 청구서 — 합계 ${won(d.total)}, 최고 연타 ${d.maxCombo}`; (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('복사했어요'), () => toast('복사하지 못했어요')); });
  mk('처음으로', '', () => act.title());
  b.appendChild(btns);
  if (d.promo) setTimeout(() => sfx('up'), 2000);
}

export function pause(on) { show('s-pause', on); }
export function fake(on) {
  show('s-fake', on); if (!on) return;
  const t = $('fk-table'); if (t.rows.length) return;
  const heads = ['', 'A 부서', 'B 목표', 'C 실적', 'D 달성률', 'E 전년 대비', 'F 비고'];
  for (let r = 0; r < 18; r++) { const tr = t.insertRow(); heads.forEach((h, c) => { const td = tr.insertCell(); td.textContent = r === 0 ? h : c === 0 ? r : c === 1 ? ['영업1팀', '영업2팀', '기획팀', '총무팀', '개발팀', '인사팀'][r % 6] : c === 6 ? '' : c === 4 || c === 5 ? (60 + (r * 37 + c * 11) % 55) + '%' : ((r * 7919 + c * 104729) % 9000 + 1000).toLocaleString(); }); }
}

export function init(missions, ids) {
  $('b-course').onclick = () => act.course(); $('b-pick').onclick = () => showPick(missions, ids); $('b-free').onclick = showFloors; $('fl-back').onclick = () => only('s-title');
  $('b-build').onclick = showBuilder; $('b-chars').onclick = showChars; $('pk-back').onclick = () => only('s-title');
  $('o-snd').onchange = e => { S.mute = !e.target.checked; save(); refreshMusic(); }; $('o-bgm').onchange = e => { S.bgm = e.target.checked; save(); refreshMusic(); };
  $('o-hap').onchange = e => { S.haptic = e.target.checked; save(); }; $('o-calm').onchange = e => { S.calm = e.target.checked; G.calm = S.calm; save(); };
  $('o-skip').onchange = e => { S.skipArrive = e.target.checked; save(); };
  const B = () => S.company;
  $('c-name').oninput = e => { B().name = e.target.value.trim() || DEF_COMPANY.name; save(); };
  $('c-who2').oninput = e => { B().who = e.target.value.trim() || '부장님'; save(); }; $('c-who2').onchange = fillBuilder;
  $('c-motto2').oninput = e => { B().motto = e.target.value.trim() || MOTTOS[0]; save(); }; $('c-motto2').onchange = fillBuilder;
  document.querySelectorAll('.c-my').forEach((inp, i) => { inp.oninput = e => { B().myLines[i] = e.target.value; save(); }; });
  $('c-back').onclick = () => { act.preview(); only('s-title'); }; $('c-go').onclick = () => act.course();
  $('ch-name').oninput = e => { const v = e.target.value.trim(); if (v) S.charName[S.char] = v; else delete S.charName[S.char]; save(); };
  $('ch-ok').onclick = () => { act.preview(); showTitle(); };
  $('b-pause').onclick = () => act.pause(); $('p-resume').onclick = () => act.pause(); $('p-quit').onclick = () => act.quit(); $('p-title').onclick = () => act.home();
}
