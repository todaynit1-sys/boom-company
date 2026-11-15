// cd는 밀리초, 나머지는 세계 단위
export const CHARS = {
  kim: { n: '김대리', desc: '균형형 · 서류가방', col: '#2F6BFF', spd: 5.2, jump: 13, wpn: 'bag',
    A: { dmg: 10, cd: 140, r: 46, push: 4 }, B: { dmg: 36, cd: 520, r: 70, push: 14 },
    sp: { type: 'quake', n: 1, dmg: 40, slow: true, name: '책상 쾅' }, rank: 0 },
  park: { n: '박인턴', desc: '빠른 연타 · 2단 점프', col: '#F2B705', spd: 6.6, jump: 13.4, dj: true, wpn: 'fist',
    A: { dmg: 7, cd: 85, r: 40, push: 3 }, B: { dmg: 24, cd: 420, r: 60, push: 11 },
    sp: { type: 'rush', name: '믹스커피 폭주' }, rank: 0 },
  choi: { n: '최과장', desc: '느리지만 한 방 · 오함마', col: '#E5342B', spd: 4.0, jump: 12, wpn: 'hammer',
    A: { dmg: 16, cd: 230, r: 58, push: 7 }, B: { dmg: 70, cd: 800, r: 100, push: 20 },
    sp: { type: 'quake', n: 3, dmg: 45, name: '지진' }, rank: 0 },
  lee: { n: '이주임', desc: '멀리서 던지기', col: '#1F9D57', spd: 5.0, jump: 13, wpn: 'stapler',
    A: { dmg: 12, cd: 200, proj: 'stapler' }, B: { dmg: 30, cd: 500, proj: 'binderang', pierce: true },
    sp: { type: 'storm', name: '서류 폭풍' }, rank: 0 },
  jung: { n: '정차장', desc: '골프채로 날리기', col: '#7B4BD6', spd: 4.8, jump: 12.6, wpn: 'golf',
    A: { dmg: 12, cd: 200, r: 54, push: 6, up: true }, B: { dmg: 40, cd: 600, r: 80, push: 26, word: '나이스 샷!' },
    sp: { type: 'line', name: '홀인원' }, rank: 4 },
  free: { n: '자유인', desc: '사직서 수리검 · 2단 점프', col: '#FF8A1F', spd: 5.8, jump: 13.4, dj: true, wpn: 'envelope',
    A: { dmg: 9, cd: 150, proj: 'envelope', pierce: true }, B: { dmg: 30, cd: 400, r: 70, push: 14 },
    sp: { type: 'rain', name: '사직서 폭탄' }, rank: 6 },
};
export const ACCS = [
  { id: null, n: '없음', rank: 0 }, { id: 'band', n: '「투쟁」 머리띠', rank: 2 }, { id: 'sun', n: '선글라스', rank: 3 },
  { id: 'helmet', n: '안전모', rank: 5 }, { id: 'chain', n: '금목걸이', rank: 6 },
];
