// Blender로 만든 가구 모델(assets/models/*.glb). 불러오기에 실패하면 예전처럼 코드로 만든 모양을 쓴다.
// 모델은 tools/make_models.py로 다시 만든다.
import { THREE } from './gfx.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEFS } from './data/props.js';

const NAMES = ['desk', 'chair', 'cabinet', 'plant', 'sofa', 'table', 'trash', 'watercooler', 'partition', 'lowcab', 'bookshelf', 'fridge', 'cafetable', 'cafechair', 'stool', 'foldchair', 'bench'];
const MODELS = {}, tint = {};
// 색을 바꿔 쓰는 물건(소파)의 천 재질
const TINT = { sofa: 'sofaFabric', stool: 'stoolSeat' };

function place(g, name, o, size) {
  const src = MODELS[name]; if (!src) return false;
  const m = src.clone(true), ds = DEFS[name].size;
  m.scale.set(size[0] / ds[0], size[1] / ds[1], size[2] / ds[2]);
  if (o.col && TINT[name]) m.traverse(c => { if (c.isMesh && c.material.name === TINT[name]) c.material = tint[o.col] || (tint[o.col] = new THREE.MeshStandardMaterial({ color: o.col, roughness: .9 })); });
  g.add(m); return true;
}
export async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(NAMES.map(n => loader.loadAsync('assets/models/' + n + '.glb?v=4').then(gl => {
    gl.scene.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    MODELS[n] = gl.scene;
  }).catch(() => { })));
  for (const n of NAMES) {
    const d = DEFS[n], old = d.build; if (!MODELS[n] || d.modeled) continue; d.modeled = true;
    // 부장 의자(가죽·높은 등받이)는 예전 모양 그대로
    d.build = (g, o, size) => { if ((n === 'chair' && o.boss) || !place(g, n, o, size)) old(g, o, size); };
  }
}
