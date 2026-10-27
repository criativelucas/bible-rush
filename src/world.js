// Builds one biome: terrain, water, sky, clouds, landmarks, ruins/trees/rocks (colliders) and ground cover.
import * as THREE from 'three';
import { BIOMES } from './content.js';
import * as M from './models.js';

const o3 = new THREE.Object3D();
function instanced(geo, mat, list, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((t, i) => {
    o3.position.set(t.x, t.y, t.z);
    o3.rotation.set(0, t.rot ?? 0, 0);
    o3.scale.setScalar(t.s ?? 1);
    o3.updateMatrix();
    m.setMatrixAt(i, o3.matrix);
  });
  m.count = list.length;
  m.castShadow = m.receiveShadow = shadow;
  return m;
}

const SKY_VERT = 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const SKY_FRAG = `uniform vec3 top; uniform vec3 horizon; varying vec3 vP;
void main() {
  gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.55, vP.y)), 1.0);
  #include <colorspace_fragment>
}`;

export function buildWorld(scene, id, random, PROPS) {
  const B = BIOMES[id];
  const H = (x, z) => B.terrain(x, z);
  const ela = id === 'ela';
  const sea = id === 'mar';
  const geo = (name) => PROPS[name];
  const fadeMat = M.toon(0xffffff, { fade: true, grain: true });
  const placed = []; // landmarks: ruins, trees and rocks keep clear of them
  const obstacles = [];
  const inside = (x, z, k) => Math.hypot(x, z) < B.radius * k;
  const dry = (x, z, m) => H(x, z) > B.water + m;
  const shallow = (x, z) => H(x, z) < B.water - 0.15 && H(x, z) > B.water - 1.0;
  const clear = (x, z, gap) => placed.every((o) => Math.hypot(o.x - x, o.z - z) > gap)
    && obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 1.5);
  function spot(minD, maxD, gap, test = (x, z) => dry(x, z, 0.5)) {
    for (let t = 0; t < 400; t++) {
      const a = random() * Math.PI * 2;
      const r = minD + random() * (maxD - minD);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (inside(x, z, 0.97) && test(x, z) && clear(x, z, gap)) return { x, z };
    }
    return null;
  }
  // Nearest open ground to (x, z): used to drop the champion's chest somewhere reachable.
  function freeSpot(x, z) {
    for (let r = 0; r < 14; r += 1.5) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (inside(px, pz, 0.95) && dry(px, pz, -0.6) && obstacles.every((o) => Math.hypot(o.x - px, o.z - pz) > o.r + 1.8)) return { x: px, z: pz };
      }
    }
    return { x: 0, z: 0 };
  }

  // ---- Terrain height map (water depth), then the terrain itself ----
  const HM = 512;
  const hm = new Uint16Array(HM * HM);
  for (let j = 0; j < HM; j++) {
    for (let i = 0; i < HM; i++) hm[j * HM + i] = THREE.DataUtils.toHalfFloat(H(-128 + ((i + 0.5) * 256) / HM, -128 + ((j + 0.5) * 256) / HM));
  }
  const heightTex = new THREE.DataTexture(hm, HM, HM, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  {
    const geo = new THREE.PlaneGeometry(256, 256, 128, 128).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, H(pos.getX(i), pos.getZ(i)));
    const g = geo.toNonIndexed();
    g.computeVertexNormals();
    const p = g.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let t = 0; t < p.count; t += 3) {
      const x = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
      const y = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
      const z = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
      const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.6 + Math.sin(x * 0.07 + z * 0.05) * 0.6;
      c.set(B.ground(y, g.attributes.normal.getY(t), n, x, z));
      for (let k = 0; k < 3; k++) c.toArray(colors, (t + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(g, M.toon(0xffffff, { ground: B.groundKind }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ---- Water: the sea around the island, or the brook through the valley (and its waterfall) ----
  const water = { height: heightTex, ...B.water2 };
  const waterMat = M.toon(0xffffff, { vc: false, water, transparent: true, side: THREE.DoubleSide });
  const waters = [];
  if (ela) {
    const ribbon = (x0, x1, mat) => {
      const pts = [];
      const idx = [];
      for (let i = 0, x = x0; x <= x1 + 1e-6; x += 1, i++) {
        const z = B.brookZ(x);
        const y = H(x, z) + 0.45;
        pts.push(x, y, z - 2.4, x, y, z + 2.4);
        if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      waters.push(m);
    };
    ribbon(-128, 65, waterMat);
    ribbon(65, 71, M.toon(0xffffff, { vc: false, water: { ...water, fall: true }, transparent: true, side: THREE.DoubleSide }));
    ribbon(71, 128, waterMat);
  } else if (sea) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), waterMat);
    plane.position.y = B.water;
    plane.receiveShadow = true;
    waters.push(plane);
  }
  if (waters.length) scene.add(...waters);

  // ---- Sky dome and clouds ----
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(360, 24, 12), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  const cloudMat = M.toon(0xffffff, { fog: false, emissive: 0x606060 });
  const cloudGeos = [0, 1, 2].map((k) => geo(`prop_cloud${k}`));
  const clouds = Array.from({ length: 18 }, (_, k) => {
    const m = new THREE.Mesh(cloudGeos[k % 3], cloudMat);
    m.position.set((random() - 0.5) * 420, 40 + random() * 22, (random() - 0.5) * 420);
    m.scale.setScalar(1 + random() * 1.3);
    m.rotation.y = random() * 6;
    scene.add(m);
    return m;
  });

  // ---- Landmarks ----
  const stones = [];
  const pileGeo = geo('memorial');
  const a0 = random() * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    let x = 0;
    let z = 0;
    for (let t = 0; t < 60; t++) {
      const a = a0 + (k * Math.PI * 2) / 3 + (random() - 0.5) * 0.6;
      const r = 38 + random() * 14;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (dry(x, z, 0.8) && Math.abs(z - (B.brookZ?.(x) ?? 1e9)) > 5) break;
    }
    const y = H(x, z);
    const pile = new THREE.Mesh(pileGeo, fadeMat);
    pile.position.set(x, y, z);
    pile.castShadow = pile.receiveShadow = true;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 120, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    beam.position.set(x, y + 60, z);
    scene.add(pile, beam);
    obstacles.push({ x, z, r: 1.25, top: y + 1.3 }); // the cairn is solid (stand on top or beside it)
    placed.push({ x, z });
    stones.push({ x, z, y, p: 0, done: false, beam });
  }

  const altars = [];
  const altarGeo = geo('altar');
  const flameGeo = geo('flame');
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  for (let k = 0; k < 3; k++) {
    const s = spot(20, B.radius * 0.8, 14);
    if (!s) continue;
    const y = H(s.x, s.z);
    const m = new THREE.Mesh(altarGeo, fadeMat);
    m.position.set(s.x, y, s.z);
    m.castShadow = m.receiveShadow = true;
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(s.x, y + 1.05, s.z);
    scene.add(m, flame);
    obstacles.push({ x: s.x, z: s.z, r: 1.0, top: y + 1.05 });
    placed.push(s);
    altars.push({ ...s, y, p: 0, used: false, flame });
  }

  // Wells (or springs): drink to heal; they fill again after a while.
  const wells = [];
  for (let k = 0; k < 2; k++) {
    const s = spot(18, B.radius * 0.75, 16);
    if (!s) continue;
    const y = H(s.x, s.z);
    const m = M.solid(geo('prop_well'), fadeMat);
    m.position.set(s.x, y - 0.1, s.z);
    m.rotation.y = random() * 6;
    scene.add(m);
    obstacles.push({ x: s.x, z: s.z, r: 1.25, top: y + 0.95 });
    placed.push(s);
    wells.push({ ...s, y, p: 0, cd: 0 });
  }

  // Chests: cedar (costs siclos), the champion's (free) and the challenge chest (sealed: opening it
  // calls an ambush; surviving it pays out).
  const chests = [];
  function addChest(x, z, kind) {
    const y = H(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = random() * 6;
    const suffix = kind === 'dark' ? '_dark' : kind ? '_free' : '';
    g.add(M.solid(geo(`chest_base${suffix}`), fadeMat));
    const lid = new THREE.Group(); // hinge at the back edge
    lid.position.set(0, 0.6, -0.4);
    lid.add(M.solid(geo(`chest_lid${suffix}`), fadeMat));
    g.add(lid);
    scene.add(g);
    obstacles.push({ x, z, r: 0.7, top: y + 0.75 }); // no walking through closed chests
    const c = { x, z, y, free: kind === true, challenge: kind === 'dark', open: false, lid };
    chests.push(c);
    return c;
  }
  for (let k = 0; k < 8; k++) {
    const s = spot(12, B.radius * 0.8, 8);
    if (!s) continue;
    placed.push(s);
    addChest(s.x, s.z, false);
  }
  for (let k = 0; k < 2; k++) {
    const s = spot(28, B.radius * 0.8, 16);
    if (!s) continue;
    placed.push(s);
    addChest(s.x, s.z, 'dark');
  }

  // ---- Scenery pieces: one instanced mesh per model; collision circles in obstacles ----
  const kinds = {};
  const sink = 0.15; // bury bases a little so slopes never show a gap
  function piece(key, g, x, z, rot = random() * 6.28, s = 1, y = H(x, z) - sink) {
    (kinds[key] ??= { g, list: [] }).list.push({ x, y, z, s, rot });
  }
  const collide = (x, z, r, top) => obstacles.push({ x, z, r, top });
  // Place a piece and its colliders; colliders are [lx, lz, r, height] in the piece's frame.
  function build(key, g, x, z, rot, colliders = [], s = 1) {
    const y = H(x, z) - sink;
    piece(key, g, x, z, rot, s, y);
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    for (const [lx, lz, r, h] of colliders) collide(x + (lx * c + lz * sn) * s, z + (-lx * sn + lz * c) * s, r * s, y + h * s);
  }
  const STAIRS = [];
  for (let k = 0; k < 5; k++) for (const lx of [-0.6, 0.6]) STAIRS.push([lx, -1.1 + k * 0.55, 0.75, 0.25 * (k + 1)]);
  for (const lx of [-1.45, 1.45]) for (const lz of [-1.1, 0, 1.1]) STAIRS.push([lx, lz, 0.35, 1.5]);
  const WALL = [-1.6, -0.55, 0.55, 1.6].map((lx) => [lx, 0, 0.45, 1.4]);
  function scatter(n, key, g, r, height, sMin, sMax, { minD = 10, test, gap = 5 } = {}) {
    for (let k = 0; k < n; k++) {
      const p = spot(minD, B.radius * 0.97, gap, test);
      if (!p) continue;
      const s = sMin + random() * (sMax - sMin);
      piece(key, g, p.x, p.z, random() * 6.28, s);
      if (r) collide(p.x, p.z, r * s, H(p.x, p.z) + height * s);
    }
  }
  // A ruin site: stairs between two carved blocks, a broken wall behind, a tower or an arch, flagstones.
  const flags = [];
  function ruinSite(cx, cz) {
    const rot = random() * Math.PI * 2;
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const at = (lx, lz) => [cx + lx * c + lz * sn, cz - lx * sn + lz * c];
    build('stairs', geo('prop_stairs'), ...at(0, 0), rot, STAIRS);
    build('plinth', geo('prop_plinth'), ...at(-3.3, 0.4), rot, [[0, 0, 1.5, 1.57]]);
    build('plinth', geo('prop_plinth'), ...at(3.3, 0.4), rot, [[0, 0, 1.5, 1.57]]);
    build('wall', geo('prop_wall'), ...at(0, 4), rot, WALL);
    if (random() < 0.5) build('tower', geo('prop_tower'), ...at(random() < 0.5 ? 6 : -6, 3), rot, [[0, 0, 1.1, 5]]);
    else build('arch', geo('prop_arch'), ...at(random() < 0.5 ? 6.5 : -6.5, 2.5), rot, [[-1.4, 0, 0.6, 3], [1.4, 0, 0.6, 2.2]]);
    for (let k = 0; k < 6; k++) {
      const [x, z] = at((random() - 0.5) * 9, -2.5 - random() * 3);
      flags.push({ x, y: H(x, z) - 0.02, z, rot: random() * 6, s: 0.8 + random() * 0.5 });
    }
    placed.push({ x: cx, z: cz });
  }

  const flatMat = M.toon();
  const glints = [];
  const bonePiles = [];
  if (ela) {
    // Waterfall: the brook drops off the eastern ledge between two cliffs; more cliffs line the ledge.
    const lx = B.ledgeX;
    const bz = B.brookZ(lx);
    for (const dz of [-7.5, 7.5]) build('cliff', geo('prop_cliff'), lx, bz + dz, Math.PI / 2, [[-3, 0, 2, 8], [0, 0, 2, 8], [3, 0, 2, 8]]);
    for (let z = bz - 60; z < bz + 60; z += 17) {
      if (Math.abs(z - bz) < 14) continue;
      build('cliff', geo('prop_cliff'), lx, z + random() * 4, Math.PI / 2 + (random() - 0.5) * 0.3, [[-3, 0, 2, 8], [0, 0, 2, 8], [3, 0, 2, 8]]);
    }
    placed.push({ x: lx, z: bz });
    // Stone bridge over the brook.
    const bx = -30;
    const bzb = B.brookZ(bx);
    const deckY = Math.max(H(bx, bzb - 4.5), H(bx, bzb + 4.5)) + 0.1;
    piece('bridge', geo('prop_bridge'), bx, bzb, -Math.atan(0.32 * Math.cos(bx * 0.04)), 1, deckY); // across the brook
    for (let u = -4; u <= 4; u += 1.3) collide(bx, bzb + u, 1.2, deckY + 0.15);
    placed.push({ x: bx, z: bzb });
    for (let k = 0; k < 4; k++) {
      const s = spot(14, 70, 22);
      if (s) ruinSite(s.x, s.z);
    }
    scatter(5, 'wall', geo('prop_wall'), 0.9, 1.4, 0.9, 1.1, { gap: 8 });
    scatter(3, 'tower', geo('prop_tower'), 1.1, 5, 0.9, 1.1, { gap: 10 });
    for (const [kind, n] of [['gold', 12], ['orange', 12], ['red', 8], ['green', 8]]) scatter(n, `tree-${kind}`, geo(`prop_tree_${kind}`), 0.6, 6, 0.85, 1.25);
    scatter(5, 'bigTree', geo('prop_bigTree'), 0.8, 7, 0.9, 1.15, { gap: 8 });
    scatter(8, 'olive', geo('prop_olive'), 0.6, 6, 0.9, 1.3);
    scatter(10, 'cypress', geo('prop_cypress'), 0.5, 6, 0.8, 1.3);
    scatter(18, 'boulder', geo('prop_boulder'), 1.1, 1.1, 0.9, 1.7);
    scatter(14, 'sheep', geo('prop_sheep'), 0.45, 0.8, 0.9, 1.1, { minD: 8 });
    const FENCE = [[-1.5, 0, 0.25, 1], [0, 0, 0.25, 1], [1.5, 0, 0.25, 1]];
    for (let k = 0; k < 10; k++) { // sheepfolds
      const s = spot(14, 70, 6);
      if (s) build('fence', geo('prop_fence'), s.x, s.z, random() * 6.28, FENCE);
    }
    for (let k = 0; k < 2; k++) {
      const s = spot(20, 70, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    for (let k = 0; k < 5; k++) { // five smooth stones out of the brook (1 Sm 17:40)
      const x = -62 + k * 28 + (random() - 0.5) * 8;
      const z = B.brookZ(x) + (random() - 0.5) * 2;
      const y = H(x, z) + 0.05;
      const m = M.solid(geo('decor_glint'), flatMat);
      m.position.set(x, y, z);
      m.scale.setScalar(1.6);
      scene.add(m);
      glints.push({ x, y, z, m, got: false });
    }
    for (let k = 0; k < 12; k++) { // the two camps on the hills (1 Sm 17:3)
      const x = -66 + k * 11 + random() * 4;
      for (const [key, z] of [['tentI', -80 - random() * 6], ['tentP', 80 + random() * 6]]) {
        piece(key, geo(`prop_${key}`), x, z);
        collide(x, z, 1.5, H(x, z) + 2.2);
      }
    }
  } else if (sea) {
    for (let k = 0; k < 2; k++) {
      const s = spot(14, 40, 22);
      if (s) ruinSite(s.x, s.z);
    }
    // Ruins and sharp rocks standing in the turquoise shallows, each with a ring of foam.
    const foam = [];
    const wet = (x, z) => shallow(x, z);
    const inWater = (n, key, g, r, height, sMin, sMax) => {
      for (let k = 0; k < n; k++) {
        const p = spot(58, 84, 6, wet);
        if (!p) continue;
        const s = sMin + random() * (sMax - sMin);
        piece(key, g, p.x, p.z, random() * 6.28, s);
        collide(p.x, p.z, r * s, H(p.x, p.z) + height * s);
        foam.push({ x: p.x, y: B.water + 0.03, z: p.z, s: r * s + 0.5, rot: random() * 6 });
      }
    };
    inWater(7, 'tower', geo('prop_tower'), 1.1, 5, 0.9, 1.2);
    inWater(5, 'wall', geo('prop_wall'), 1.6, 1.4, 0.8, 1.1);
    inWater(34, 'shard', geo('prop_shard'), 0.9, 1.2, 0.7, 1.6);
    const foamGeo = new THREE.RingGeometry(0.75, 1.1, 10).rotateX(-Math.PI / 2);
    scene.add(instanced(foamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), foam, false));
    scatter(26, 'palm', geo('prop_palm'), 0.45, 6, 0.85, 1.25);
    scatter(6, 'bigTree', geo('prop_bigTree'), 0.8, 7, 0.9, 1.15, { gap: 8 });
    scatter(5, 'obelisk', geo('prop_obelisk'), 0.9, 7, 0.9, 1.2);
    scatter(2, 'colossus', geo('prop_colossus'), 1.9, 3.2, 1, 1.1, { minD: 20 });
    scatter(10, 'sandstone', geo('prop_sandstone'), 1.1, 1.0, 0.9, 1.7);
    for (let k = 0; k < 2; k++) { // sphinxes watching the sea
      const s = spot(20, 48, 18);
      if (!s) continue;
      build('sphinx', geo('prop_sphinx'), s.x, s.z, Math.atan2(s.x, s.z), [[0, -1.2, 1.2, 1.2], [0, 1.2, 1.1, 3.4], [0, 3.2, 0.7, 0.5]]);
      placed.push(s);
    }
    for (let k = 0; k < 2; k++) {
      const s = spot(14, 48, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    const pyrMat = M.toon(0xece6f2, { fog: false });
    for (let k = 0; k < 3; k++) {
      const pyr = M.solid(geo('prop_pyramid'), pyrMat);
      const a = 2.2 + k * 0.35;
      pyr.position.set(Math.cos(a) * (190 + k * 30), B.water - 2, Math.sin(a) * (190 + k * 30));
      pyr.scale.set(70 - k * 15, 55 - k * 12, 70 - k * 15);
      pyr.castShadow = pyr.receiveShadow = false;
      scene.add(pyr);
    }
  } else {
    // Valley of dry bones (Ez 37): ruins, dead trees, great ribcages and skulls, heaps of bones, red rock.
    for (let k = 0; k < 3; k++) {
      const s = spot(14, 60, 22);
      if (s) ruinSite(s.x, s.z);
    }
    const RIBS = [];
    for (const lz of [-2.25, -0.75, 0.75, 2.25]) RIBS.push([0, lz, 1.0, 2.7], [-1.6, lz, 0.4, 1.8], [1.6, lz, 0.4, 1.8]);
    for (let k = 0; k < 6; k++) {
      const s = spot(16, 72, 14);
      if (!s) continue;
      build('ribcage', geo('prop_ribcage'), s.x, s.z, random() * 6.28, RIBS, 0.9 + random() * 0.4);
      placed.push(s);
    }
    for (let k = 0; k < 2; k++) {
      const s = spot(25, 70, 26);
      if (!s) continue;
      build('skull', geo('prop_skull'), s.x, s.z, Math.atan2(-s.x, -s.z), [[0, 0, 1.9, 2.4]], 1.1); // staring at the valley floor
      placed.push(s);
    }
    for (let k = 0; k < 16; k++) { // big red boulders fallen from the valley walls
      const s = spot(62, 84, 8);
      if (!s) continue;
      const sc = 1.8 + random() * 1.2;
      build('sandstone', geo('prop_sandstone'), s.x, s.z, random() * 6.28, [[0, 0, 1.1, 1.0]], sc);
      placed.push(s);
    }
    scatter(22, 'deadTree', geo('prop_deadTree'), 0.4, 4.5, 0.9, 1.4);
    for (let k = 0; k < 18; k++) { // heaps of bones: the wind makes them stand up (Ez 37:9)
      const s = spot(10, 76, 6);
      if (!s) continue;
      build('bonepile', geo('prop_bonepile'), s.x, s.z, random() * 6.28, [[0, 0, 0.7, 0.7]], 0.9 + random() * 0.6);
      bonePiles.push(s);
    }
    for (let k = 0; k < 14; k++) {
      const s = spot(12, 76, 5);
      if (s) build('tomb', geo('prop_tomb'), s.x, s.z, random() * 6.28, [[0, 0.2, 0.7, 0.3], [0, -1, 0.5, 1.3]]);
    }
    for (let k = 0; k < 3; k++) {
      const s = spot(14, 70, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    scatter(12, 'sandstone', geo('prop_sandstone'), 1.1, 1.0, 0.9, 1.8);
    scatter(4, 'tower', geo('prop_tower'), 1.1, 5, 0.8, 1.0, { gap: 10 });
    scatter(5, 'wall', geo('prop_wall'), 0.9, 1.4, 0.9, 1.1, { gap: 8 });
  }
  for (const key in kinds) scene.add(instanced(kinds[key].g, fadeMat, kinds[key].list));
  scene.add(instanced(geo('decor_flags'), flatMat, flags, false));

  // Cântaros (jars): walk into them for siclos.
  const jars = [];
  for (let k = 0; k < 40; k++) {
    const s = spot(8, B.radius * 0.85, 3);
    if (s) jars.push({ ...s, y: H(s.x, s.z), broken: false, rot: random() * 6 });
  }
  const jarMesh = instanced(geo('jar'), fadeMat, jars);
  scene.add(jarMesh);

  // ---- Ground cover ----
  function decor(g, n, test, sMin = 0.8, sMax = 1.3, y = H) {
    const list = [];
    for (let k = 0; k < n; k++) {
      const x = (random() * 2 - 1) * B.radius * 1.1;
      const z = (random() * 2 - 1) * B.radius * 1.1;
      if (test(x, z, H(x, z))) list.push({ x, y: y(x, z), z, s: sMin + random() * (sMax - sMin), rot: random() * 6 });
    }
    scene.add(instanced(g, flatMat, list, false));
  }
  if (ela) {
    const bank = (x, z) => Math.abs(z - B.brookZ(x));
    decor(geo('decor_grass'), 3200, (x, z, h) => bank(x, z) > 2.8 && h < 13);
    decor(geo('decor_leaves'), 1100, (x, z, h) => bank(x, z) > 2.8 && h < 13);
    for (const k of [0, 1, 2]) decor(geo(`decor_flower${k}`), 130, (x, z, h) => bank(x, z) > 3 && h < 10);
    decor(geo('decor_pebble'), 320, (x, z) => bank(x, z) < 2.2, 0.6, 1.5);
    decor(geo('decor_reed'), 200, (x, z) => bank(x, z) > 2.2 && bank(x, z) < 3.4);
    decor(geo('decor_lily'), 70, (x, z) => bank(x, z) < 1.8 && x < 64, 0.7, 1.2, (x) => H(x, B.brookZ(x)) + 0.47);
  } else if (sea) {
    const w = B.water;
    decor(geo('decor_shrub'), 260, (x, z, h) => h > w + 1);
    decor(geo('decor_grass'), 900, (x, z, h) => h > w + 1.2);
    decor(geo('decor_shell'), 300, (x, z, h) => h > w && h < w + 0.8, 0.8, 1.6);
    decor(geo('decor_reed'), 200, (x, z, h) => h > w - 0.35 && h < w + 0.3);
    decor(geo('decor_pebble'), 260, (x, z, h) => h < w && h > w - 1, 0.8, 1.8);
  } else {
    decor(geo('decor_drygrass'), 1600, (x, z, h) => h < 9);
    decor(geo('decor_bone'), 500, (x, z, h) => h < 6, 0.8, 1.6);
    decor(geo('decor_skull'), 90, (x, z, h) => h < 6, 0.8, 1.3);
    decor(geo('decor_pebble'), 300, (x, z) => Math.abs(x - B.wadi(z)) < 2.2, 0.6, 1.5);
    decor(geo('decor_shrub'), 120, (x, z, h) => h < 8, 0.6, 1.0);
  }

  // ---- Per-frame: sky colours, clouds, water, flames, chest lids ----
  const top = [new THREE.Color(B.sky.top), new THREE.Color(B.sky.nightTop)];
  const hor = [new THREE.Color(B.sky.horizon), new THREE.Color(B.sky.nightHorizon)];
  function update(dt, time, night, camera) {
    sky.position.copy(camera.position);
    skyMat.uniforms.top.value.lerpColors(top[0], top[1], night);
    skyMat.uniforms.horizon.value.lerpColors(hor[0], hor[1], night);
    for (const c of clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 220) c.position.x = -220;
    }
    if (sea) waters[0].position.y = B.water + Math.sin(time * 0.8) * 0.04;
    for (const a of altars) {
      a.flame.visible = !a.used;
      a.flame.scale.set(1 + Math.sin(time * 11 + a.x) * 0.08, 1 + Math.sin(time * 9 + a.z) * 0.2, 1 + Math.cos(time * 10) * 0.08);
    }
    for (const c of chests) c.lid.rotation.x += ((c.open ? -1.9 : 0) - c.lid.rotation.x) * Math.min(1, dt * 8);
  }

  return { B, terrainH: H, obstacles, stones, altars, wells, chests, addChest, freeSpot, jars, jarMesh, glints, bonePiles, update, horizon: skyMat.uniforms.horizon.value };
}
