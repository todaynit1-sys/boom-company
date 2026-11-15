// spd m/s, jump m/s, pow 피해 배수, rate 공격 속도 배수
export const CHARS = {
  kim: { n: '김대리', desc: '균형형 · 무난하게 다 잘함', suit: '#2b4a8a', tie: '#c9281f', hair: 'short', spd: 5.4, jump: 6.6, pow: 1, rate: 1, build: 1,
    sp: { type: 'quake', n: 1, dmg: 45, slow: true, name: '책상 쾅' }, rank: 0 },
  park: { n: '박인턴', desc: '빠른 연타 · 2단 점프', suit: '#d9a520', tie: null, hair: 'mop', spd: 6.6, jump: 6.9, dj: true, pow: .75, rate: 1.6, build: .93,
    sp: { type: 'rush', name: '믹스커피 폭주' }, rank: 0 },
  choi: { n: '최과장', desc: '느리지만 한 방이 큼', suit: '#5a5f66', tie: '#2b4a8a', hair: 'bald', spd: 4.5, jump: 6.0, pow: 1.6, rate: .75, build: 1.14,
    sp: { type: 'quake', n: 3, dmg: 48, name: '지진' }, rank: 0 },
  lee: { n: '이주임', desc: '던지기 달인 · 서류 폭풍', suit: '#2a7a4a', tie: null, hair: 'bob', glasses: true, spd: 5.4, jump: 6.6, pow: .9, rate: 1.1, build: .95, thr: 1.5,
    sp: { type: 'storm', name: '서류 폭풍' }, rank: 0 },
  jung: { n: '정차장', desc: '골프 스윙 · 멀리 날림', suit: '#6a3fb0', tie: '#e3b23c', hair: 'cap', spd: 5.0, jump: 6.3, pow: 1.15, rate: .95, build: 1.05, launch: 1.6,
    sp: { type: 'line', name: '홀인원' }, rank: 4 },
  free: { n: '자유인', desc: '2단 점프 · 사직서 폭탄', suit: '#e5701f', tie: null, hair: 'short', sun: true, spd: 6.0, jump: 6.9, dj: true, pow: 1.1, rate: 1.2, build: 1,
    sp: { type: 'rain', name: '사직서 폭탄' }, rank: 6 },
};
export const ACCS = [
  { id: null, n: '없음', rank: 0 }, { id: 'band', n: '「투쟁」 머리띠', rank: 2 }, { id: 'sun', n: '선글라스', rank: 3 },
  { id: 'helmet', n: '안전모', rank: 5 }, { id: 'chain', n: '금목걸이', rank: 6 },
];
