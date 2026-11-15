import { G } from './state.js';
import * as ui from './ui.js';

// 대사는 자막으로만 보여 준다(기계 음성은 쓰지 않는다)
// 잔소리로 세지 않는 것: 기계·방송·가게
const MACHINE = ['복합기', '컴퓨터', '전화', '단톡방', '전자레인지', '단말기', '안내 방송', '경비실 방송', '주차 관리', '카페', '비둘기', '노래방 기계', '사회자'];
export function say(who, text) {
  ui.subtitle(who, text);
  if (who !== '나' && !MACHINE.includes(who)) G.nags++;
}
export function hush() { ui.subtitle(null); }
