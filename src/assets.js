// Loads the models built in Blender (tools/build_models.sh → assets/models/*.glb).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);

// Static models: one geometry per Blender object name. The `_swx`/`_swy` attributes (limb swing,
// pivot height) become the `swing` attribute the walk shader reads.
async function library(url) {
  const { scene } = await loader.loadAsync(url);
  scene.updateMatrixWorld(true);
  const out = {};
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const sx = g.getAttribute('_swx');
    const sy = g.getAttribute('_swy');
    if (sx && sy) {
      const sw = new Float32Array(sx.count * 2);
      for (let i = 0; i < sx.count; i++) {
        sw[i * 2] = sx.getX(i);
        sw[i * 2 + 1] = sy.getX(i);
      }
      g.setAttribute('swing', new THREE.BufferAttribute(sw, 2));
      g.deleteAttribute('_swx');
      g.deleteAttribute('_swy');
    }
    out[o.name] = g;
  });
  return out;
}

// Rigged models: the scene (armature + skinned mesh) and its clips by short name. The exporter also
// writes other rigs' actions into each file, so only clips named "<rig>|<clip>" for this rig are kept.
export async function rigged(url) {
  const gltf = await loader.loadAsync(url);
  let rig = '';
  gltf.scene.traverse((o) => { if (!rig && o.name.endsWith('_rig')) rig = o.name; });
  const clips = {};
  for (const c of gltf.animations) {
    const [owner, name] = c.name.split('|');
    if (owner === rig && name) clips[name] = c;
  }
  return { scene: gltf.scene, clips };
}

export async function loadAll(bossModel, heroes) {
  const [mobs, items, props, boss, ...heroRigs] = await Promise.all([
    library('assets/models/mobs.glb'),
    library('assets/models/items.glb'),
    library('assets/models/props.glb'),
    rigged(`assets/models/bosses/${bossModel}.glb`),
    ...heroes.map((id) => rigged(`assets/models/heroes/${id}.glb`)),
  ]);
  return { mobs, items, props, boss, heroes: Object.fromEntries(heroes.map((id, k) => [id, heroRigs[k]])) };
}
