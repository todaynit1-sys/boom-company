import { G } from './state.js';
import * as ui from './ui.js';

// 대사는 자막으로만 보여 준다(기계 음성은 쓰지 않는다)
const MACHINE = ['복합기', '컴퓨터', '전화', '단톡방', '전자레인지', '단말기'];
export function say(who, text) {
  ui.subtitle(who, text);
  if (who !== '나' && !MACHINE.includes(who)) G.nags++;
}
export function hush() { ui.subtitle(null); }
