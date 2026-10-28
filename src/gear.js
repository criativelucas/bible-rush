// What a hero wears as they evolve (content.js STAGES) and what the wardrobe sells (COSMETICS): small
// low-poly pieces attached to the rig's bones, so they follow every animation. All of them are built and
// attached once, in the rest pose, then shown or hidden.
import * as THREE from 'three';
import * as M from './models.js';

const T = THREE;
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
const ball = (r, d = 1) => new T.IcosahedronGeometry(r, d);
const ring = (R, r, arc = Math.PI * 2) => new T.TorusGeometry(R, r, 5, 14, arc);
function part(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = null) {
  const o = new T.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (s) o.scale.set(...s);
  return o;
}
const group = (...kids) => {
  const g = new T.Group();
  g.add(...kids);
  return g;
};

// A cape hanging from the shoulders; stripes: colours from top to bottom.
const cape = (stripes) => (h, sx, m) => {
  const n = stripes.length;
  return group(...stripes.map((c, k) => part(box(sx * 2, (0.46 * h) / n, 0.012 * h), m(c), 0, 0.8 * h - ((k + 0.5) * 0.46 * h) / n, -0.1 * h - k * 0.006 * h, 0.12)));
};
const crownOf = (gold, gem) => (h, sx, m) => group(
  part(ring(0.067 * h, 0.011 * h), m(gold), 0, 0.968 * h, -0.006 * h, Math.PI / 2),
  ...[0, 1, 2, 3, 4].map((k) => {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
    return part(new T.ConeGeometry(0.012 * h, 0.042 * h, 4), m(gold), Math.cos(a) * 0.066 * h, 0.995 * h, Math.sin(a) * 0.066 * h - 0.006 * h);
  }),
  part(ball(0.011 * h, 0), m(gem), 0, 0.968 * h, 0.064 * h),
);
const wreath = (leaf, berry) => (h, sx, m) => group(
  part(ring(0.066 * h, 0.007 * h), m(leaf), 0, 0.955 * h, -0.006 * h, Math.PI / 2),
  ...Array.from({ length: 10 }, (_, k) => {
    const a = (k / 10) * Math.PI * 2;
    return part(ball(0.013 * h, 0), m(k % 3 ? leaf : berry), Math.cos(a) * 0.066 * h, 0.958 * h, Math.sin(a) * 0.066 * h - 0.006 * h, 0, a, 0.6, [1, 0.6, 1.6]);
  }),
);
const quiver = (wood, rim) => (h, sx, m) => group(
  part(new T.CylinderGeometry(0.03 * h, 0.025 * h, 0.25 * h, 7), m(wood), -0.06 * h, 0.64 * h, -0.1 * h, 0, 0, -0.4),
  part(ring(0.03 * h, 0.006 * h), m(rim), -0.11 * h, 0.75 * h, -0.1 * h, Math.PI / 2, 0, -0.4),
  ...[-1, 0, 1].map((k) => part(new T.ConeGeometry(0.008 * h, 0.04 * h, 4), m(0xd8dee6), -0.115 * h + k * 0.012 * h, 0.79 * h, -0.1 * h, 0, 0, -0.4)),
);

// id: [bone, slot, build(h, sx, toonMaterial, glowMaterial)] in the hero's space (feet at 0, Y up, +Z ahead).
// h: the hero's height; sx: half the shoulder width. Slots: head and back give way to the wardrobe's.
export const PIECES = {
  crown: ['head', 'head', crownOf(0xf2c14e, 0xd7303a)],
  leafCrown: ['head', 'head', wreath(0x4f7a2e, 0xf2c14e)],
  louros: ['head', 'head', wreath(0x8aa03a, 0xe8d36a)],
  turbante: ['head', 'head', (h, sx, m) => group(
    part(ball(1, 1), m(0xf0e6d0), 0, 0.962 * h, -0.008 * h, 0, 0, 0, [0.084 * h, 0.05 * h, 0.086 * h]),
    part(ring(0.072 * h, 0.01 * h), m(0xb8463a), 0, 0.944 * h, -0.008 * h, Math.PI / 2))],
  capuz: ['head', 'head', (h, sx, m) => part(new T.SphereGeometry(1, 10, 8, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.6),
    m(0x7a5634, T.DoubleSide), 0, 0.905 * h, -0.012 * h, 0, 0, 0, [0.083 * h, 0.09 * h, 0.085 * h])],
  veil: ['head', 'hair', (h, sx, m) => group(
    part(new T.SphereGeometry(1, 10, 8, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.66), m(0x7a4a9a, T.DoubleSide),
      0, 0.91 * h, -0.016 * h, 0, 0, 0, [0.084 * h, 0.088 * h, 0.088 * h]),
    part(ring(0.07 * h, 0.006 * h), m(0xf2c14e), 0, 0.95 * h, -0.012 * h, Math.PI / 2))],
  halo: ['head', 'fx', (h, sx, m, g) => part(ring(0.1 * h, 0.007 * h), g(0xffe08f), 0, 0.955 * h, -0.095 * h)],
  fireEyes: ['head', 'fx', (h, sx, m, g) => group(...[-1, 1].map((x) => part(ball(0.0095 * h, 0), g(0xff7a2a), 0.024 * h * x, 0.922 * h, 0.066 * h)))],
  braids: ['head', 'body', (h, sx, m) => group(...[-0.05, -0.018, 0.018, 0.05].map((x, k) =>
    part(new T.CapsuleGeometry(0.011 * h, 0.22 * h, 2, 6), m(0x2a1a10), x * h, 0.79 * h, -0.058 * h, 0.08, 0, x * 1.5)))],
  bracelets: [null, 'body', (h, sx, m) => [-1, 1].map((x) => [x > 0 ? 'forearmL' : 'forearmR',
    part(ring(0.026 * h, 0.008 * h), m(0xc08a3e), (sx + 0.02 * h) * x, 0.51 * h, 0.01 * h, Math.PI / 2)])],
  cuirass: ['chest', 'body', (h, sx, m) => group(
    part(new T.CylinderGeometry(sx * 0.8, sx * 0.72, 0.17 * h, 10), m(0x8a5a32), 0, 0.705 * h, 0.004 * h),
    part(box(0.02 * h, 0.2 * h, sx * 1.65), m(0x5e3a20), 0, 0.71 * h, 0.004 * h, 0.75, Math.PI / 2, 0))],
  armor: ['chest', 'body', (h, sx, m) => group(
    part(new T.CylinderGeometry(sx * 0.82, sx * 0.74, 0.18 * h, 10), m(0xb8863a), 0, 0.705 * h, 0.004 * h),
    ...[-1, 1].map((x) => part(ball(sx * 0.36, 1), m(0xc8964a), sx * x, 0.79 * h, 0, 0, 0, 0, [1, 0.7, 1])),
    part(new T.CylinderGeometry(sx * 0.8, sx * 0.86, 0.08 * h, 10, 1, true), m(0x8a6430, T.DoubleSide), 0, 0.555 * h, 0.004 * h))],
  swordBack: ['chest', 'back', (h, sx, m) => {
    const s = group(
      part(box(0.022 * h, 0.38 * h, 0.006 * h), m(0xd8dee6), 0, 0, 0),
      part(box(0.09 * h, 0.014 * h, 0.016 * h), m(0xe8b84a), 0, 0.19 * h, 0),
      part(new T.CylinderGeometry(0.009 * h, 0.009 * h, 0.07 * h, 6), m(0x5e3a20), 0, 0.235 * h, 0),
      part(ball(0.012 * h, 0), m(0xe8b84a), 0, 0.275 * h, 0));
    s.position.set(0, 0.62 * h, -0.105 * h);
    s.rotation.z = 0.65;
    return s;
  }],
  capeRoyal: ['cape', 'back', cape([0xb8283a, 0xb8283a, 0x9a1f2e, 0xe8b84a])],
  capeBlue: ['cape', 'back', cape([0x3a6ea8, 0x3a6ea8, 0x2f5a8a])],
  capeTravel: ['cape', 'back', cape([0x7a5634, 0x6b4a2e, 0x5e4028])],
  mantoRubro: ['cape', 'back', cape([0xc8243a, 0xa81d30, 0x8e1a28])],
  mantoCores: ['cape', 'back', cape([0xd7303a, 0xf2c14e, 0x3a6ea8, 0x5a8a3a, 0x7a4a9a])],
  aljava: ['chest', 'back', quiver(0x7a4a2a, 0xe8b84a)],
  quiverGold: ['chest', 'back', quiver(0xe8b84a, 0xfff1b8)],
  gates: ['chest', 'back', (h, sx, m) => {
    const w = m(0x7a5a3a);
    return group(
      ...[-1, 1].map((x) => part(box(0.028 * h, 0.44 * h, 0.028 * h), w, 0.13 * h * x, 0.62 * h, -0.13 * h)),
      ...[0, 1, 2].map((k) => part(box(0.28 * h, 0.024 * h, 0.02 * h), w, 0, 0.47 * h + k * 0.14 * h, -0.13 * h)),
      part(box(0.05 * h, 0.05 * h, 0.03 * h), m(0x5a5a62), 0, 0.62 * h, -0.135 * h)); // the bolt
  }],
  banner: ['chest', 'back', (h, sx, m) => group(
    part(new T.CylinderGeometry(0.007 * h, 0.007 * h, 0.95 * h, 5), m(0x6b4a2e), 0.07 * h, 0.78 * h, -0.1 * h),
    part(box(0.2 * h, 0.13 * h, 0.006 * h), m(0x3e5f99), 0.17 * h, 1.17 * h, -0.1 * h),
    part(box(0.2 * h, 0.025 * h, 0.008 * h), m(0xf0e6d0), 0.17 * h, 1.17 * h, -0.1 * h))],
  harp: ['spine', 'hip', (h, sx, m) => group(
    part(ring(0.045 * h, 0.006 * h, Math.PI * 1.2), m(0xd9a441), sx * 1.15, 0.5 * h, 0.02 * h, 0, Math.PI / 2, 0),
    ...[-1, 0, 1].map((k) => part(new T.CylinderGeometry(0.0018 * h, 0.0018 * h, 0.06 * h, 3), m(0xfff1b8), sx * 1.15, 0.5 * h, 0.02 * h + k * 0.012 * h)))],
  tablets: ['spine', 'hip', (h, sx, m) => group(...[-1, 1].map((k) =>
    part(box(0.014 * h, 0.13 * h, 0.075 * h), m(0xbab3a4), sx * 1.3, 0.52 * h, 0.04 * h * k, 0, 0, 0.1)))],
  grapes: ['spine', 'hip', (h, sx, m) => group(
    ...[[0, 0], [1, 0], [-1, 0], [0.5, -1], [-0.5, -1], [0, -2], [0, 1]].map(([x, y]) => part(ball(0.016 * h, 0), m(0x5a2a6a), -sx * 1.15 + x * 0.018 * h, 0.48 * h + y * 0.02 * h, 0.03 * h)),
    part(ball(0.02 * h, 0), m(0x5a8a3a), -sx * 1.15, 0.52 * h, 0.03 * h, 0, 0, 0, [1.4, 0.5, 1]))],
};

// Builds and attaches every piece to this rig (hidden), in the rest pose. rig.dissolve: they crumble with it.
export function buildGear(rig) {
  const root = rig.group;
  root.updateMatrixWorld(true);
  const v = new T.Vector3();
  const local = (name) => root.worldToLocal(root.getObjectByName(name).getWorldPosition(v)).clone();
  const h = local('head').y / 0.83;
  const sx = Math.abs(local('upperarmL').x);
  const mats = {};
  const toon = (c, side) => (mats[`${c}${side ?? ''}`] ??= M.toon(c, { vc: false, dissolve: rig.dissolve, ...(side ? { side } : {}) }));
  const glow = (c) => (mats[`g${c}`] ??= new T.MeshBasicMaterial({ color: c }));
  const out = {};
  for (const [id, [boneName, slot, build]] of Object.entries(PIECES)) {
    const made = build(h, sx, toon, glow);
    const list = Array.isArray(made) ? made : [[boneName, made]];
    const objs = list.map(([bn, obj]) => {
      const bone = root.getObjectByName(bn) ?? root.getObjectByName('chest');
      obj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      root.add(obj);
      bone.attach(obj); // keeps its place in the rest pose, then follows the bone
      obj.visible = false;
      return obj;
    });
    out[id] = { objs, slot };
  }
  return out;
}

// Shows exactly these pieces on the rig.
export function dress(rig, ids) {
  for (const [id, p] of Object.entries(rig.gear)) for (const o of p.objs) o.visible = ids.includes(id);
}
