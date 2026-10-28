// Models for the weapons added after the Blender set (see tools/blender/assets.py for the others):
// built here from primitives with vertex colours, in the same conventions (forward is +Z for projectiles).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const col = new THREE.Color();
const rot = new THREE.Matrix4();
function part(geo, hex, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  if (s) g.scale(...s);
  g.applyMatrix4(rot.makeRotationFromEuler(new THREE.Euler(...r)));
  g.translate(...p);
  col.set(hex);
  const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) c.set([col.r, col.g, col.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const merge = (...parts) => mergeGeometries(parts);
const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const Z = [Math.PI / 2, 0, 0]; // a cylinder lying along Z

const WOOD = 0x8a5a2b;
const IRON = 0xc8ccd2;
const STONE = 0x9a948a;

const spear = () => merge(
  part(cyl(0.12, 0.12, 6), WOOD, [0, 0, 0], Z),
  part(cyl(0.16, 0.16, 0.5), 0x5e3a20, [0, 0, 2.7], Z),
  part(new THREE.ConeGeometry(0.34, 1.3, 5), IRON, [0, 0, 3.6], Z),
  part(cyl(0.16, 0.1, 0.5), IRON, [0, 0, -3.1], Z),
);
const raven = () => merge(
  part(ball(1, 1), 0x2a2630, [0, 0, 0], [0, 0, 0], [0.45, 0.38, 0.85]),
  part(ball(0.32, 1), 0x34303c, [0, 0.18, 0.75]),
  part(new THREE.ConeGeometry(0.11, 0.42, 4), 0x8a7a5a, [0, 0.14, 1.12], Z),
  part(ball(0.06, 0), 0xf2c14e, [0.16, 0.28, 0.9]),
  part(ball(0.06, 0), 0xf2c14e, [-0.16, 0.28, 0.9]),
  part(new THREE.BoxGeometry(1.5, 0.07, 0.6), 0x23202a, [0.9, 0.12, 0], [0, 0, 0.25]),
  part(new THREE.BoxGeometry(1.5, 0.07, 0.6), 0x23202a, [-0.9, 0.12, 0], [0, 0, -0.25]),
  part(new THREE.BoxGeometry(0.5, 0.06, 0.7), 0x23202a, [0, 0.02, -0.95]),
);
const mill = () => merge(
  part(cyl(1.25, 1.25, 0.5, 12), STONE),
  part(new THREE.TorusGeometry(0.85, 0.06, 4, 16), 0x7a746a, [0, 0.26, 0], [Math.PI / 2, 0, 0]),
  part(cyl(0.28, 0.28, 0.54, 8), 0x3a342c),
);
const peg = () => merge( // Jael's tent peg and the workman's hammer (Jz 4:21)
  part(cyl(0.16, 0.05, 2.2, 6), 0xb8a27a, [0.5, -0.3, 0], [0, 0, 0.5]),
  part(cyl(0.22, 0.22, 0.2, 6), 0x9a8460, [0.95, 0.6, 0], [0, 0, 0.5]),
  part(cyl(0.1, 0.1, 2.6, 6), WOOD, [-0.4, 0.2, 0], [0, 0, -0.6]),
  part(new THREE.BoxGeometry(1.3, 0.7, 0.7), 0x6b4a2e, [-1.05, 1.3, 0], [0, 0, -0.6]),
);

export function forgeModels() {
  return {
    weapon_lanca: spear(), proj_lanca: spear(),
    weapon_corvos: raven(), proj_raven: raven(),
    weapon_mo: mill(), proj_mill: mill(),
    weapon_estaca: peg(),
  };
}
