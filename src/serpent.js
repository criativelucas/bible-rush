// The Ancient Serpent (Ap 12:9), the hardest boss. Built here rather than in Blender so its body can
// follow the path its head took: the head is the boss (the game moves and turns the group), the body
// trails behind along the ground, swaying as it goes. Returns a rig shaped like makeRig()'s.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const N = 30; // body segments
const GAP = 0.72; // metres between them
// The red dragon-serpent: red scales in rows, a cream belly, bone horns, a white mane and beard.
const DARK = 0x5a1414;
const RED = 0xb8302a;
const RED2 = 0x962420;
const BELLY = 0xe8c89a;
const HORN = 0xd8c4a0;
const MANE = 0xf2eee6;
const CREST = 0x7a1a18;

// Vertex colours from a function of the (unscaled) vertex position.
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) col.setHex(fn(p.getX(i), p.getY(i), p.getZ(i))).toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.deleteAttribute('uv');
  return g;
}
const place = (g, [x, y, z], [rx, ry, rz] = [0, 0, 0], [sx, sy, sz] = [1, 1, 1]) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
// Back: rows of red scales, each row a shade apart; belly: cream plates.
const hide = (x, y, z) => (y < -0.3 ? BELLY : (Math.floor(z * 4 + Math.abs(x) * 2.5) & 1 ? RED : RED2));

function segmentGeo() {
  return mergeGeometries([
    place(paint(new THREE.IcosahedronGeometry(1, 2), hide), [0, 0, 0], [0, 0, 0], [1, 0.82, 1.2]),
    place(paint(new THREE.ConeGeometry(0.2, 0.55, 5), () => CREST), [0, 0.92, -0.1], [-0.5, 0, 0]),
  ]);
}

function headGeo() {
  const parts = [
    place(paint(new THREE.IcosahedronGeometry(1, 2), hide), [0, 0, 0], [0, 0, 0], [0.82, 0.58, 1.05]), // skull
    place(paint(new THREE.IcosahedronGeometry(1, 2), hide), [0, -0.08, 1.15], [0.06, 0, 0], [0.55, 0.42, 1.0]), // the long snout
    place(paint(new THREE.BoxGeometry(0.5, 0.12, 0.3), () => DARK), [0, 0.28, 2.0], [0.2, 0, 0]), // nose
    ...[-0.16, 0.16].map((x) => place(paint(new THREE.IcosahedronGeometry(0.07, 0), () => 0x2a0808), [x, 0.27, 2.15])), // nostrils
    ...[-0.2, -0.07, 0.07, 0.2].map((x, k) => place(paint(new THREE.ConeGeometry(0.05 + (k % 3 ? 0 : 0.02), 0.32, 5), () => 0xf4efe4), [x, -0.38, 1.5 + Math.abs(x)], [Math.PI, 0, 0])), // fangs
    ...[0, 1, 2, 3].map((k) => place(paint(new THREE.ConeGeometry(0.12, 0.5, 5), () => CREST), [0, 0.55 - k * 0.05, -0.45 - k * 0.4], [-0.9, 0, 0])), // crest down the neck
  ];
  for (const x of [-1, 1]) {
    parts.push(place(paint(new THREE.BoxGeometry(0.42, 0.14, 0.5), () => RED2), [x * 0.36, 0.42, 0.55], [0.35, x * 0.35, x * -0.35])); // brow ridge, angry
    // horns of bone: up from the brow, then sweeping back
    parts.push(place(paint(new THREE.CylinderGeometry(0.11, 0.15, 0.7, 6), () => HORN), [x * 0.42, 0.78, -0.1], [-0.5, 0, x * -0.25]));
    parts.push(place(paint(new THREE.CylinderGeometry(0.08, 0.11, 0.6, 6), () => HORN), [x * 0.5, 1.12, -0.48], [-1.1, 0, x * -0.25]));
    parts.push(place(paint(new THREE.ConeGeometry(0.08, 0.55, 6), () => HORN), [x * 0.54, 1.22, -0.92], [-1.6, 0, x * -0.2]));
    for (let k = 0; k < 7; k++) { // the white mane, swept back from the cheeks and over the neck
      const a = -0.4 + k * 0.32;
      parts.push(place(paint(new THREE.ConeGeometry(0.2, 1.1, 5), () => MANE), [x * (0.62 + Math.cos(a) * 0.12), 0.1 + Math.sin(a) * 0.45, -0.45 - k * 0.05], [-1.75, 0, x * (0.9 - k * 0.1)]));
    }
    // long whiskers from the snout, drooping
    for (let k = 0; k < 4; k++) parts.push(place(paint(new THREE.CylinderGeometry(0.025, 0.035, 0.5, 4), () => CREST), [x * (0.35 + k * 0.32), -0.12 - k * 0.15, 1.8 - k * 0.12], [0.3, 0, x * (1.2 + k * 0.15)]));
  }
  return mergeGeometries(parts);
}

function jawGeo() {
  return mergeGeometries([
    place(paint(new THREE.IcosahedronGeometry(1, 1), (x, y) => (y > 0.2 ? DARK : BELLY)), [0, 0, 0.85], [0, 0, 0], [0.72, 0.24, 1.1]),
    ...[-0.2, 0.2].map((x) => place(paint(new THREE.ConeGeometry(0.05, 0.25, 4), () => 0xf4efe4), [x, 0.2, 1.6])),
    place(paint(new THREE.ConeGeometry(0.22, 0.9, 6), () => MANE), [0, -0.35, 0.6], [Math.PI * 0.85, 0, 0]), // the white beard
  ]);
}
// The tail's tip: a tuft, cream and red.
function tuftGeo() {
  return mergeGeometries([-1, 0, 1].map((k) => place(paint(new THREE.ConeGeometry(0.22, 1.1, 5), () => (k ? BELLY : RED)), [k * 0.18, 0, -0.5], [-Math.PI / 2, k * 0.35, 0])));
}

export function makeSerpent(M, terrainH, getBoss) {
  const dissolve = { value: 0 };
  const mat = M.toon(0xffffff, { dissolve, rim: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.6) }); // pale, glowing eyes (bloom)
  const solid = (geo, m = mat) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.frustumCulled = false;
    return o;
  };

  const group = new THREE.Group(); // where the boss is, turned to its heading
  const head = new THREE.Group();
  head.scale.setScalar(1.25);
  head.add(solid(headGeo()));
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.25, -0.05);
  jaw.add(solid(jawGeo()));
  head.add(jaw);
  const eyeGeo = new THREE.IcosahedronGeometry(0.11, 1);
  for (const x of [-0.4, 0.4]) { // under the brows, at the sides
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(x, 0.26, 0.62);
    e.scale.set(0.7, 0.8, 1.2);
    head.add(e);
  }
  group.add(head);
  // The body lives in world space: its parent undoes the group's transform every frame.
  const body = new THREE.Group();
  body.matrixAutoUpdate = false;
  group.add(body);
  const segGeo = segmentGeo();
  const segs = Array.from({ length: N }, () => {
    const s = solid(segGeo);
    s.rotation.order = 'YXZ';
    body.add(s);
    return s;
  });
  const tuft = solid(tuftGeo());
  tuft.rotation.order = 'YXZ';
  body.add(tuft);

  const trail = []; // ground points the head passed over, newest first
  let t = 0;
  let rise = 2.6;
  let lunge = 0;
  let open = 0;
  let pitch = 0;
  const inv = new THREE.Matrix4();
  const pts = Array.from({ length: N + 1 }, () => new THREE.Vector3());

  function update(dt) {
    t += dt;
    const b = getBoss();
    // The head's pose from the move: rear up to call or slam, draw back and strike, gape to spit.
    let r = 2.6;
    let l = 0;
    let o = 0.08;
    let p = 0;
    if (b.st !== 'walk' && b.st !== 'rest') {
      if (b.anim === 'stomp') { const up = b.t > 0.12; r = up ? 5.4 : 0.9; p = up ? -0.45 : 0.55; o = 0.7; }
      else if (b.anim === 'summon') { r = 4.8; p = -0.55; o = 1; }
      else if (b.anim === 'spear') { r = b.step ? 1.7 : 2.3; l = b.step ? 1.8 : -0.9; o = b.step ? 1 : 0.5; p = b.step ? 0.25 : -0.2; }
      else if (b.anim === 'walk') { r = 1.7; l = 0.6; o = 0.8; p = 0.2; } // the charge
      else if (b.anim === 'sweep') { r = 1.5; o = 0.3; }
    }
    const e = 1 - Math.exp(-dt * 9);
    rise += (r - rise) * e;
    lunge += (l - lunge) * e;
    open += (o - open) * e;
    pitch += (p - pitch) * e;
    head.position.set(0, rise + Math.sin(t * 2) * 0.12, lunge);
    head.rotation.set(pitch + Math.sin(t * 1.3) * 0.05, Math.sin(t * 0.9) * 0.08, 0);
    jaw.rotation.x = open * 0.75;

    group.updateMatrixWorld(true);
    inv.copy(group.matrixWorld).invert();
    body.matrix.copy(inv);
    body.matrixWorldNeedsUpdate = true;
    const hx = group.position.x;
    const hz = group.position.z;
    if (!trail.length || Math.hypot(hx - trail[0].x, hz - trail[0].z) > 0.25) {
      trail.unshift({ x: hx, z: hz });
      if (trail.length > 300) trail.pop();
    }
    // Points every GAP metres back along the trail (straight on behind where it runs out).
    const fx = Math.sin(group.rotation.y);
    const fz = Math.cos(group.rotation.y);
    let px = hx;
    let pz = hz;
    let k = 0;
    let left = 0.9; // the neck starts just behind the head
    for (let j = 0; j <= N; j++) {
      while (k < trail.length) {
        const q = trail[k];
        const d = Math.hypot(q.x - px, q.z - pz);
        if (d >= left && d > 1e-6) {
          px += ((q.x - px) * left) / d;
          pz += ((q.z - pz) * left) / d;
          left = -1;
          break;
        }
        left -= d;
        px = q.x;
        pz = q.z;
        k++;
      }
      if (left >= 0) { px -= fx * left; pz -= fz * left; }
      pts[j].set(px, 0, pz);
      left = GAP;
    }
    const sway = b.moving ? 0.4 : 0.15;
    for (let j = 0; j < N; j++) {
      const a = pts[j];
      const c = pts[j + 1];
      const dx = a.x - c.x;
      const dz = a.z - c.z;
      const dl = Math.hypot(dx, dz) || 1;
      const w = Math.sin(t * 5 - j * 0.55) * sway * Math.min(1, j / 4);
      const x = a.x - (dz / dl) * w;
      const z = a.z + (dx / dl) * w;
      const rad = 0.22 + 0.95 * (1 - j / N) ** 0.75;
      const neck = Math.max(0, 1 - j / 6) ** 1.6; // the first coils rise toward the head
      const y = terrainH(x, z) + rad * 0.75 + neck * (rise * 1.1 - 0.4);
      const s = segs[j];
      s.position.set(x, y, z);
      s.scale.set(rad, rad, rad);
      const prevY = j ? segs[j - 1].position.y : group.position.y + rise;
      s.rotation.set(Math.atan2(y - prevY, GAP) * 0.8, Math.atan2(dx, dz), 0);
      if (j === N - 1) {
        tuft.position.set(x, y, z);
        tuft.rotation.set(0, Math.atan2(dx, dz) + Math.sin(t * 4) * 0.3, 0);
      }
    }
  }

  const clip = { reset() { return clip; }, setLoop() { return clip; }, fadeIn() { return clip; }, play() { return clip; }, fadeOut() {}, timeScale: 1, clampWhenFinished: false };
  group.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group, mixer: { update }, act: { idle: clip, walk: clip }, mat, dissolve, current: null, w: {} };
}
