import { S } from './save.js';
import { G } from './state.js';
import * as ui from './ui.js';

const MACHINE = ['복합기', '컴퓨터', '전화', '단톡방', '전자레인지'];
export function say(who, text) {
  ui.subtitle(who, text);
  if (who !== '나' && !MACHINE.includes(who)) G.nags++;
  if (!S.voice || S.mute || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/[—…~()「」]/g, ' '));
    u.lang = 'ko-KR'; u.rate = who === '나' ? 1 : 1.08; u.pitch = who === '나' ? 1.1 : MACHINE.includes(who) ? 1.7 : .5; u.volume = .9;
    speechSynthesis.speak(u);
  } catch (e) {}
}
export function hush() { try { speechSynthesis.cancel(); } catch (e) {} }
