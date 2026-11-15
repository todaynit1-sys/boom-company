const KEY = 'boom-company-v1';
export const DEF_COMPANY = { name: '가족같은회사', style: 'glass', who: '부장님', sets: ['late', 'report'], myLines: ['', '', ''], motto: '가족 같은 회사' };
export const copy = o => JSON.parse(JSON.stringify(o));
function load() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  return Object.assign({ total: 0, best: 0, runs: 0, char: 'kim', charName: {}, acc: null, company: copy(DEF_COMPANY), slots: [null, null, null], mute: false, bgm: true, haptic: true, calm: false, seenHelp: false, counts: {}, lastAm: null, lastPm: null, skipArrive: false }, d);
}
export const S = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

export const RANKS = [
  { n: '인턴', at: 0 }, { n: '사원', at: 1.5e7, get: '벽돌 상가 건물' }, { n: '주임', at: 6e7, get: '「투쟁」 머리띠' },
  { n: '대리', at: 2e8, get: '관공서풍 건물 · 선글라스' }, { n: '과장', at: 5e8, get: '정차장 캐릭터' },
  { n: '차장', at: 1.2e9, get: '안전모' }, { n: '부장', at: 3e9, get: '자유인 캐릭터 · 금목걸이' }, { n: '자유인', at: 8e9, get: '칭호 「출근 안 해도 되는 사람」' },
];
export function rankOf(total) { let i = 0; RANKS.forEach((r, k) => { if (total >= r.at) i = k; }); return i; }
