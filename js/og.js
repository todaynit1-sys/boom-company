// 카카오톡·SNS 링크 미리보기용 장면(1200×630). 주소 끝에 #og 를 붙이면 이 장면만 그린다.
import { G } from './state.js';
import { DEF_COMPANY, copy } from './save.js';
import { buildOffice, find } from './world.js';
import { spawnPlayer, equip, setFace, camHold, P } from './player.js';
import { setScreen } from './engine.js';
import * as fx from './fx.js';
import * as ui from './ui.js';

export function stageOg() {
  ui.only(null); ui.hudShow(false);
  buildOffice(copy(DEF_COMPANY), 'afternoon');
  // 구도를 가리는 기둥은 이 장면에서만 숨긴다
  for (const m of G.camBlock) if (Math.abs(m.position.x - 2) < .4 && Math.abs(m.position.z + 3.6) < .4) m.visible = false;
  for (const t of ['clock', 'frame_col']) { const p = find(t); if (p) p.g.visible = false; }
  spawnPlayer('kim', 1.0, -4.55, .95);
  equip('bat'); fx.clearFxSoft();
  setFace('rage'); P.blinkT = 1e9;
  P.atk = { type: 'smash', t: .38, dur: 1, hit: true, k: 'b' };
  // 뒤 책상이 엎어지는 중, 모니터·키보드·의자가 날아간다
  const fly = (tag, x, y, z, rx, ry, rz) => { const p = find(tag); if (!p) return p; p.body.position.set(x, y, z); p.body.quaternion.setFromEuler(rx, ry, rz); p.g.position.copy(p.body.position); p.g.quaternion.copy(p.body.quaternion); return p; };
  fly('d1_Desk', .2, .8, -5.5, -1.1, .25, 0);
  setScreen(fly('d1_Monitor', -.7, 2.0, -4.3, .45, .9, .35), 'blue');
  fly('d1_Chair', 2.3, .62, -5.75, 0, .5, 1.15);
  fly('d1_Keyboard', -1.1, 1.6, -4.1, .9, .3, .7);
  fx.sheet({ x: .3, y: 1.3, z: -4.6 }, 50, '#ffffff', 4.4);
  fx.bitsAt({ x: -.5, y: 1.7, z: -4.4 }, 46, '#cfeaf5', 4, 3);
  for (let i = 0; i < 20; i++) fx.update(1 / 60);
  camHold([3.15, 1.05, -3.25], [-2.5, 1.2, -4.75]);
  const o = document.createElement('div'); o.id = 'og';
  o.innerHTML = '<div class="og-l"><h1><span>회</span><span>사</span> <span>뿌</span><span>시</span><span>기</span></h1><p>출근부터 퇴근까지,<br>참다가 터뜨린다</p><div class="og-c"><i>회의</i><i>보고서</i><i>점심</i><i>복합기</i><i>야근</i><i>사직서</i></div></div><div class="og-s">속이 뻥</div>';
  document.getElementById('app').appendChild(o);
  G.paused = true; G.onTick = null;
}
