// spd m/s, jump m/s, pow 피해 배수, rate 공격 속도 배수
// 모습: skin 피부, hairCol 머리색, hair 머리 모양, top 윗옷 종류, suit 윗옷 색, shirt 셔츠, tie 넥타이, scarf 스카프, pants 바지(치마), skirt 치마, legs 다리(스타킹), shoes 신발, heels 굽
// 직급마다 남녀 모습이 따로 있다: g = 처음 성별, f = 여자일 때 바뀌는 것, m = 남자일 때 바뀌는 것
export const CHARS = {
  park: { n: '박인턴', rankName: '인턴', desc: '빠른 연타 · 2단 점프', g: 'm', skin: '#efc6a3', hairCol: '#2b211a', hair: 'mop', top: 'hoodie', suit: '#e2ad25', shirt: '#f4f2ec', tie: null, pants: '#3a5a86', shoes: '#e9e6df', badge: true,
    f: { hair: 'pony', hairCol: '#3a2a1f', skin: '#f2cbab' },
    spd: 6.6, jump: 6.9, dj: true, pow: .75, rate: 1.6, build: .95, sp: { type: 'rush', name: '믹스커피 폭주' }, rank: 0 },
  lee: { n: '이주임', rankName: '주임', desc: '던지기 달인 · 서류 폭풍', g: 'f', skin: '#f1cdb1', hairCol: '#241b17', hair: 'bob', glasses: true, top: 'blazer', suit: '#2d7350', shirt: '#ffffff', tie: null, pants: '#2b2f3a', shoes: '#2a1f1a', badge: true,
    m: { hair: 'short', skin: '#ecc3a3' },
    spd: 5.4, jump: 6.6, pow: .9, rate: 1.1, build: .95, thr: 1.5, sp: { type: 'storm', name: '서류 폭풍' }, rank: 0 },
  kim: { n: '김대리', rankName: '대리', desc: '균형형 · 무난하게 다 잘함', g: 'm', skin: '#e6b48f', hairCol: '#1b1714', hair: 'short', top: 'suit', suit: '#26457f', shirt: '#f4f2ec', tie: '#c22b23', pants: '#232838', shoes: '#18181a', badge: true,
    f: { hair: 'long', hairCol: '#2a1d17', skin: '#ecc0a0', tie: null, scarf: '#c22b23', shirt: '#ffffff', skirt: true, pants: '#26457f', legs: '#e1b698', shoes: '#1d1414', heels: true },
    spd: 5.4, jump: 6.6, pow: 1, rate: 1, build: 1, sp: { type: 'quake', n: 1, dmg: 45, slow: true, name: '책상 쾅' }, rank: 0 },
  choi: { n: '최과장', rankName: '과장', desc: '느리지만 한 방이 큼', g: 'm', skin: '#d5a07b', hairCol: '#6d665f', hair: 'bald', top: 'suit', suit: '#555a61', shirt: '#eef0f3', tie: '#24448a', pants: '#3a3e45', shoes: '#18181a', badge: true, belly: true,
    f: { hair: 'perm', hairCol: '#3b2f2a', skin: '#dcab88', tie: null, scarf: '#24448a', belly: false },
    spd: 4.5, jump: 6.0, pow: 1.6, rate: .75, build: 1.14, sp: { type: 'quake', n: 3, dmg: 48, name: '지진' }, rank: 0 },
  jung: { n: '정차장', rankName: '차장', desc: '골프 스윙 · 멀리 날림', g: 'm', skin: '#d29c76', hairCol: '#1c1916', hair: 'cap', capCol: '#6a3fb0', top: 'suit', suit: '#4b3a72', shirt: '#f4f2ec', tie: '#e3b23c', pants: '#2e2a3a', shoes: '#18181a', badge: true,
    f: { hair: 'capPony', hairCol: '#2b201a', skin: '#dcaa85', tie: null, scarf: '#e3b23c' },
    spd: 5.0, jump: 6.3, pow: 1.15, rate: .95, build: 1.05, launch: 1.6, sp: { type: 'line', name: '홀인원' }, rank: 4 },
  free: { n: '자유인', rankName: '자유인', desc: '2단 점프 · 사직서 폭탄', g: 'm', skin: '#c78d66', hairCol: '#4a3426', hair: 'slick', sun: true, top: 'aloha', suit: '#e5701f', shirt: '#e5701f', tie: null, pants: '#cdb88e', shoes: '#7a5532', badge: false,
    f: { hair: 'long', hairCol: '#6a4428', skin: '#cf9670' },
    spd: 6.0, jump: 6.9, dj: true, pow: 1.1, rate: 1.2, build: 1, sp: { type: 'rain', name: '사직서 폭탄' }, rank: 6 },
};
// 성별에 맞춘 모습 (능력치는 같다)
export function look(id, g) {
  const b = CHARS[id] || NPCS[id], gg = g || b.g || 'm', o = Object.assign({}, b, (gg === 'f' ? b.f : b.m) || {});
  delete o.f; delete o.m; o.gender = gg; o.key = id + gg; return o;
}
// 때릴 수 있는 사람들. 능력치는 없고 모습과 잔소리만 있다
export const NPCS = {
  bujang: { n: '부장님', g: 'm', skin: '#d8a680', hairCol: '#5c5650', hair: 'bald', top: 'suit', suit: '#6a6f77', shirt: '#eef0f3', tie: '#7a2030', pants: '#3a3e45', shoes: '#18181a', badge: true, belly: true, build: 1.12, lines: ['보고서는 아직인가?', '오늘 야근 되지?', '주말에 등산 어때?', '요즘 친구들은 말이야…'] },
  timjang: { n: '팀장님', g: 'f', skin: '#eec4a4', hairCol: '#3b2f2a', hair: 'perm', top: 'blazer', suit: '#7a2a3a', shirt: '#ffffff', tie: null, scarf: '#e3b23c', pants: '#2b2f3a', shoes: '#1d1414', badge: true, build: .98, lines: ['이거 오늘까지예요', '회의 한 번 더 하죠', '메일 못 봤어요?'] },
  insa: { n: '인사팀 과장', g: 'm', skin: '#e6b48f', hairCol: '#1b1714', hair: 'short', glasses: true, top: 'suit', suit: '#3d4a3f', shirt: '#f4f2ec', tie: '#2a3a2e', pants: '#2b2f3a', shoes: '#18181a', badge: true, build: .97, lines: ['연차는 반려입니다', '근태 확인 좀 하죠', '평가 기간인 거 알죠?'] },
  sajang: { n: '사장님', g: 'm', skin: '#cf9a74', hairCol: '#8a857e', hair: 'slick', top: 'suit', suit: '#1b1d22', shirt: '#f4f2ec', tie: '#e3b23c', pants: '#1b1d22', shoes: '#18181a', badge: false, belly: true, build: 1.1, lines: ['우리는 가족이야', '열정! 도전! 혁신!', '월급은 마음으로 받는 걸세'] },
  sangmu: { n: '상무님', g: 'm', skin: '#d5a07b', hairCol: '#4a4540', hair: 'short', top: 'suit', suit: '#1d2a44', shirt: '#eef0f3', tie: '#24448a', pants: '#1d2a44', shoes: '#18181a', badge: true, build: 1.04, lines: ['자네 이름이 뭐였지?', '골프는 좀 치나?', '내가 왕년에는 말이야'] },
  gap: { n: '거래처 김 사장', g: 'm', skin: '#c78d66', hairCol: '#2a211a', hair: 'slick', sun: true, top: 'aloha', suit: '#2f6bff', shirt: '#2f6bff', tie: null, pants: '#e9e1cf', shoes: '#7a5532', badge: false, belly: true, build: 1.08, lines: ['단가 좀 깎지?', '오늘 접대 있지?', '갑이 누군지 알지?'] },
};
export const ACCS = [
  { id: null, n: '없음', rank: 0 }, { id: 'band', n: '「투쟁」 머리띠', rank: 2 }, { id: 'sun', n: '선글라스', rank: 3 },
  { id: 'helmet', n: '안전모', rank: 5 }, { id: 'chain', n: '금목걸이', rank: 6 },
];
