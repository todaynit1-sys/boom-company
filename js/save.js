const KEY = 'boom-company-v1';
export const DEF_COMPANY = { name: '가족같은회사', style: 'glass', who: '부장님', sets: ['late', 'report'], myLines: ['', '', ''], motto: '가족 같은 회사' };
export const copy = o => JSON.parse(JSON.stringify(o));
function load() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  return Object.assign({ total: 0, best: 0, runs: 0, char: 'kim', charName: {}, gender: {}, acc: null, company: copy(DEF_COMPANY), slots: [null, null, null], mute: false, bgm: true, haptic: true, calm: false, seenHelp: false, counts: {}, lastAm: null, lastPm: null, skipArrive: false }, d);
}
export const S = load();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

export const RANKS = [
  { n: '인턴', at: 0 }, { n: '사원', at: 1.5e7, get: '수습 딱지를 뗐다' }, { n: '주임', at: 6e7, get: '일은 두 배, 월급은 그대로' },
  { n: '대리', at: 2e8, get: '책임만 늘었다' }, { n: '과장', at: 5e8, get: '회의가 두 배로 늘었다' },
  { n: '차장', at: 1.2e9, get: '결재판이 무거워졌다' }, { n: '부장', at: 3e9, get: '이제 내가 잔소리할 차례?' }, { n: '자유인', at: 8e9, get: '출근 안 해도 되는 사람' },
];
export function rankOf(total) { let i = 0; RANKS.forEach((r, k) => { if (total >= r.at) i = k; }); return i; }
