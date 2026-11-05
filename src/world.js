// Builds one biome: terrain, water, sky, clouds, landmarks, ruins/trees/rocks (colliders) and ground cover.
import * as THREE from 'three';
import { BIOMES, TOWER } from './content.js';
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
  const B = id === 'babel' ? TOWER : BIOMES[id];
  const T = !!B.tower; // the Tower of Babel: an arena, its floors built by towerFloor()
  const H = (x, z) => B.terrain(x, z);
  const ela = id === 'ela';
  const sea = id === 'mar';
  const geo = (name) => PROPS[name];
  const fadeMat = M.toon(0xffffff, { fade: true, grain: true });
  const placed = []; // landmarks: ruins, trees and rocks keep clear of them
  const obstacles = [];
  const S = B.radius / 90; // the maps were first laid out ~90 m wide: distances and counts scale with them
  const n2 = (n) => Math.round(n * S * S); // twice the area, twice the things
  const inside = (x, z, k) => Math.hypot(x, z) < B.radius * k;
  const slopeAt = (x, z) => Math.hypot(H(x + 0.3, z) - H(x - 0.3, z), H(x, z + 0.3) - H(x, z - 0.3)) / 0.6;
  const dry = (x, z, m) => H(x, z) > B.water + m && slopeAt(x, z) < 0.6; // dry, level enough to stand a thing on
  const shallow = (x, z) => H(x, z) < B.water - 0.15 && H(x, z) > B.water - 1.0;
  const clear = (x, z, gap) => placed.every((o) => Math.hypot(o.x - x, o.z - z) > gap)
    && obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + 1.5);
  // Ground you can walk to from the start without climbing a rock face (2 m cells): stones, chests,
  // altars, wells and springs only go there, never on a step that no ramp reaches.
  const RC = 2;
  const RN = Math.ceil((2 * B.radius) / RC);
  const reach = new Uint8Array(RN * RN);
  {
    const cellOf = (x, z) => Math.floor((z + B.radius) / RC) * RN + Math.floor((x + B.radius) / RC);
    const open = (i) => {
      const x = -B.radius + ((i % RN) + 0.5) * RC;
      const z = -B.radius + (Math.floor(i / RN) + 0.5) * RC;
      return Math.hypot(x, z) < B.radius - 2 && H(x, z) > B.water - 0.9 && slopeAt(x, z) < 1.0;
    };
    const queue = [cellOf(0, 0)];
    reach[queue[0]] = 1;
    while (queue.length) {
      const i = queue.pop();
      const cx = i % RN;
      for (const j of [cx > 0 ? i - 1 : -1, cx < RN - 1 ? i + 1 : -1, i - RN, i + RN]) {
        if (j < 0 || j >= RN * RN || reach[j]) continue;
        reach[j] = 2; // seen
        if (open(j)) { reach[j] = 1; queue.push(j); }
      }
    }
  }
  const reachable = (x, z) => reach[Math.floor((z + B.radius) / RC) * RN + Math.floor((x + B.radius) / RC)] === 1;
  function spot(minD, maxD, gap, test = (x, z) => dry(x, z, 0.5) && reachable(x, z)) {
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
  const TH = 176; // the terrain spans [-176, 176] (models.js reads the water depth over the same square)
  const HM = 512;
  const hm = new Uint16Array(HM * HM);
  for (let j = 0; j < HM; j++) {
    for (let i = 0; i < HM; i++) hm[j * HM + i] = THREE.DataUtils.toHalfFloat(H(-TH + ((i + 0.5) * 2 * TH) / HM, -TH + ((j + 0.5) * 2 * TH) / HM));
  }
  const heightTex = new THREE.DataTexture(hm, HM, HM, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;
  {
    const geo = new THREE.PlaneGeometry(2 * TH, 2 * TH, 240, 240).rotateX(-Math.PI / 2); // a vertex every ~1.5 m: crisp cliff edges
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
    const ground = new THREE.Mesh(g, M.toon(0xffffff, { ground: B.groundKind, pave: B.city ? [B.city.x, B.city.z, B.city.r - 1] : T ? [0, 0, 40] : null }));
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
    const lx = B.ledgeX;
    ribbon(-TH, lx - 3, waterMat);
    ribbon(lx - 3, lx + 3, M.toon(0xffffff, { vc: false, water: { ...water, fall: true }, transparent: true, side: THREE.DoubleSide }));
    ribbon(lx + 3, TH, waterMat);
  } else if (B.water > -20) { // the sea, or Jericho's spring pool
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
    m.position.set((random() - 0.5) * 560, 40 + random() * 22, (random() - 0.5) * 560);
    m.scale.setScalar(1 + random() * 1.3);
    m.rotation.y = random() * 6;
    scene.add(m);
    return m;
  });

  // ---- Landmarks ----
  // Jericho's wall ring is reserved before anything else is placed (altars and chests keep clear of it).
  const C = B.city;
  const wallAt = (k, n, extra = 0) => {
    const a = (k / n) * Math.PI * 2;
    return { a, x: C.x + Math.cos(a) * (C.r + extra), z: C.z + Math.sin(a) * (C.r + extra) };
  };
  const CITY_N = C ? Math.round((2 * Math.PI * C.r) / 5.4) : 0; // wall pieces round the city, 5.4 m each
  if (C) for (let k = 0; k < CITY_N; k++) placed.push(wallAt(k, CITY_N));
  const stones = [];
  const pileGeo = geo('memorial');
  const a0 = random() * Math.PI * 2;
  for (let k = 0; k < (T ? 0 : 3); k++) {
    let x = 0;
    let z = 0;
    for (let t = 0; t < 60; t++) {
      const a = a0 + (k * Math.PI * 2) / 3 + (random() - 0.5) * 0.6;
      const r = (38 + random() * 14) * S;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      if (dry(x, z, 0.8) && reachable(x, z) && Math.abs(z - (B.brookZ?.(x) ?? 1e9)) > 5) break;
    }
    const y = H(x, z);
    const pile = new THREE.Mesh(pileGeo, fadeMat);
    pile.position.set(x, y, z);
    pile.castShadow = pile.receiveShadow = true;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 120, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2), transparent: true, opacity: 0.28, depthWrite: false, fog: false, side: THREE.DoubleSide })); // glows (bloom)
    beam.position.set(x, y + 60, z);
    scene.add(pile, beam);
    obstacles.push({ x, z, r: 1.25, top: y + 1.3 }); // the cairn is solid (stand on top or beside it)
    placed.push({ x, z });
    stones.push({ x, z, y, p: 0, done: false, beam });
  }

  const altars = [];
  const altarGeo = geo('altar');
  const flameGeo = geo('flame');
  const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) }); // fire glows
  for (let k = 0; k < (T ? 0 : n2(3)); k++) {
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
  for (let k = 0; k < (T ? 0 : 3); k++) {
    const s = B.oasis && k === 0 ? { x: B.oasis.x + 8, z: B.oasis.z + 2 } : spot(18, B.radius * 0.75, 16); // Elisha's spring by the pool
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

  // Rocks of Horeb (Êx 17:6): a spring at the foot of a cliff; stepping on it throws you up onto the step above.
  const pads = [];
  const padMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9fe4ff).multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false });
  const spoutGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.4, 8, 1, true).translate(0, 1.2, 0);
  const ringGeoP = new THREE.RingGeometry(0.9, 1.3, 16).rotateX(-Math.PI / 2);
  for (let k = 0, t = 0; k < (T ? 0 : Math.round(4 * S * S)) && t < 4000; t++) {
    const a = random() * Math.PI * 2;
    const r = 14 + random() * (B.radius * 0.88 - 14);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!dry(x, z, 0.5) || slopeAt(x, z) > 0.3 || !reachable(x, z) || !clear(x, z, 10)) continue;
    const h0 = H(x, z);
    let best = 0;
    let dx = 0;
    let dz = 0;
    for (let q = 0; q < 16; q++) { // the highest step within 6 m, and which way it is
      const b = (q / 16) * Math.PI * 2;
      const dh = H(x + Math.cos(b) * 6, z + Math.sin(b) * 6) - h0;
      if (dh > best) { best = dh; dx = Math.cos(b); dz = Math.sin(b); }
    }
    if (best < 2.6 || best > 10) continue;
    const rock = M.solid(geo('prop_sandstone'), fadeMat);
    rock.position.set(x, h0 - 0.35, z);
    rock.scale.set(0.95, 0.4, 0.95);
    const spout = new THREE.Mesh(spoutGeo, padMat);
    spout.position.set(x, h0 + 0.1, z);
    const ring = new THREE.Mesh(ringGeoP, padMat);
    ring.position.set(x, h0 + 0.08, z);
    scene.add(rock, spout, ring);
    placed.push({ x, z });
    pads.push({ x, z, y: h0, dx, dz, up: best, spout, cd: 0 });
    k++;
  }

  // ---- Things to use on the way (see updateWorld in main.js) ----
  // Silver veins to mine for siclos, fruit trees that heal and grow back, Gideon's jars that blind the horde
  // (Jz 7:20), Jacob's pillar at Bethel that blesses for a minute (Gn 28:18), and a caravan of Ishmaelite
  // traders who sell for siclos (Gn 37:25).
  const things = [];
  const silverMat = M.toon(0xaab6c6);
  const shineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf2f8ff).multiplyScalar(1.8) });
  for (let k = 0; k < (T ? 0 : n2(5)); k++) {
    const s = spot(16, B.radius * 0.9, 12);
    if (!s) continue;
    const y = H(s.x, s.z);
    const g = new THREE.Group();
    g.position.set(s.x, y - 0.2, s.z);
    g.rotation.y = random() * 6;
    g.add(M.solid(geo('prop_boulder'), silverMat));
    for (let q = 0; q < 5; q++) {
      const c = M.solid(geo('decor_glint'), shineMat);
      c.position.set((random() - 0.5) * 1.4, 0.5 + random() * 0.7, (random() - 0.5) * 1.4);
      c.scale.setScalar(1.2 + random());
      g.add(c);
    }
    g.scale.setScalar(1.15);
    scene.add(g);
    obstacles.push({ x: s.x, z: s.z, r: 1.1, top: y + 1.2 });
    placed.push(s);
    things.push({ kind: 'vein', x: s.x, z: s.z, y, mesh: g, p: 0, used: false });
  }
  const fruitGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const green = !sea && id !== 'ossos';
  for (let k = 0; k < (T ? 0 : n2(4)); k++) {
    const s = spot(14, B.radius * 0.88, 12);
    if (!s) continue;
    const y = H(s.x, s.z);
    const tree = M.solid(geo(green ? 'prop_bigTree' : 'prop_palm'), fadeMat);
    tree.position.set(s.x, y - 0.15, s.z);
    tree.rotation.y = random() * 6;
    const fruit = new THREE.Group();
    const fm = M.toon(green ? (k % 2 ? 0xd7303a : 0x6a3a7a) : 0x8a4a22); // pomegranates and figs; dates on the palms
    for (let q = 0; q < 9; q++) {
      const f = new THREE.Mesh(fruitGeo, fm);
      const a = random() * Math.PI * 2;
      f.position.set(Math.cos(a) * (0.8 + random() * 1.2), green ? 2.4 + random() * 1.6 : 4.6 + random() * 0.5, Math.sin(a) * (0.8 + random() * 1.2));
      fruit.add(f);
    }
    fruit.position.copy(tree.position);
    scene.add(tree, fruit);
    obstacles.push({ x: s.x, z: s.z, r: 0.7, top: y + 6 });
    placed.push(s);
    things.push({ kind: 'fruit', x: s.x, z: s.z, y, fruit, cd: 0 });
  }
  const gideonMat = M.toon(0xd9a066, { emissive: 0x6a3a10 });
  for (let k = 0; k < (T ? 0 : n2(6)); k++) {
    const s = spot(12, B.radius * 0.88, 8);
    if (!s) continue;
    const y = H(s.x, s.z);
    const jar = M.solid(geo('jar'), gideonMat);
    jar.position.set(s.x, y, s.z);
    jar.scale.setScalar(1.6);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(s.x, y + 1.3, s.z);
    f.scale.setScalar(0.7);
    scene.add(jar, f);
    placed.push(s);
    things.push({ kind: 'gideon', x: s.x, z: s.z, y, mesh: jar, flame: f, used: false });
  }
  for (let k = 0; k < (T ? 0 : 2); k++) {
    const s = spot(24, B.radius * 0.8, 20);
    if (!s) continue;
    const y = H(s.x, s.z);
    const pillar = M.solid(geo('prop_obelisk'), fadeMat);
    pillar.position.set(s.x, y - 0.2, s.z);
    pillar.scale.set(0.55, 0.42, 0.55);
    const f = new THREE.Mesh(flameGeo, flameMat);
    f.position.set(s.x, y + 3.1, s.z);
    scene.add(pillar, f);
    obstacles.push({ x: s.x, z: s.z, r: 0.7, top: y + 3 });
    placed.push(s);
    things.push({ kind: 'bethel', x: s.x, z: s.z, y, flame: f, p: 0, cd: 0 });
  }
  {
    const s = T ? null : spot(30, B.radius * 0.7, 24);
    if (s) {
      const rot = random() * 6;
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      const at = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
      const tent = M.solid(geo('prop_tentI'), fadeMat);
      const [tx, tz] = at(0, -2.5);
      tent.position.set(tx, H(tx, tz) - 0.1, tz);
      tent.rotation.y = rot;
      const cart = M.solid(geo('prop_cart'), fadeMat);
      const [cx, cz] = at(3.2, 0.5);
      cart.position.set(cx, H(cx, cz) - 0.1, cz);
      cart.rotation.y = rot + 1.2;
      scene.add(tent, cart);
      for (let q = 0; q < 4; q++) {
        const [jx, jz] = at(-2.2 + (q % 2) * 0.8, 1 + Math.floor(q / 2) * 0.8);
        const j = M.solid(geo('jar'), fadeMat);
        j.position.set(jx, H(jx, jz), jz);
        scene.add(j);
      }
      obstacles.push({ x: tx, z: tz, r: 1.5, top: H(tx, tz) + 2.2 }, { x: cx, z: cz, r: 1.2, top: H(cx, cz) + 1 });
      placed.push(s);
      things.push({ kind: 'merchant', x: s.x, z: s.z, y: H(s.x, s.z), sold: 0, cd: 0 });
    }
  }

  // Chests: cedar (costs siclos), the champion's (free) and the challenge chest (sealed: opening it
  // calls an ambush; surviving it pays out).
  const chests = [];
  function addChest(x, z, kind, y = H(x, z)) {
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
  for (let k = 0; k < (T ? 0 : n2(8)); k++) {
    const s = spot(12, B.radius * 0.8, 8);
    if (!s) continue;
    placed.push(s);
    addChest(s.x, s.z, false);
  }
  for (let k = 0; k < (T ? 0 : 3); k++) {
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
  // Pieces with height (PLANO.md 3): somewhere level enough for the whole footprint (lx 0..len along the piece).
  function levelSpot(minD, maxD, gap, len, rot) {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    return spot(minD, maxD, gap, (x, z) => {
      if (!dry(x, z, 0.5) || !reachable(x, z)) return false;
      const hs = [0, 0.5, 1].map((f) => H(x + len * f * c, z - len * f * sn));
      return Math.max(...hs) - Math.min(...hs) < 0.7 && dry(x + len * c, z - len * sn, 0.5);
    });
  }
  const BIG = 1.45; // the climbable pieces are built large: room to fight on top
  function tall(key, list, n, minD, maxD, gap, len, colliders, sc = BIG) {
    for (let k = 0; k < n; k++) {
      const rot = random() * Math.PI * 2;
      const s = levelSpot(minD, maxD, gap, len * sc, rot);
      if (!s) continue;
      build(key, geo(`prop_${key}`), s.x, s.z, rot, colliders, sc);
      placed.push(s, { x: s.x + len * sc * Math.cos(rot), z: s.z - len * sc * Math.sin(rot) });
      list?.push(s);
    }
  }

  // ---- The Tower of Babel: the arena's wall with eight portals, then one layout of brick per floor ----
  const BRICKC = [0xc98a5a, 0xb8784a, 0xd49a68];
  const GLAZE = 0x2f5f9a; // the glazed blue of Babylon's gates
  const brickMats = {};
  const brickMat = (c) => (brickMats[c] ??= M.toon(c, { vc: false, grain: true, fade: true }));
  const portals = [];
  const torches = [];
  let door = null;
  const CEIL = 20; // the tower is closed: a ceiling of beams and brick over the floor
  const box = (w, h, d, y = 0) => new THREE.BoxGeometry(w, h, d).translate(0, y + h / 2, 0);
  function towerShell() {
    const g = new THREE.Group();
    const R = 35.5;
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      for (const [geom, c] of [[box(8.2, CEIL + 0.4, 1.6, -0.2), BRICKC[k % 3]], [box(8.3, 0.4, 1.7, 2.8), GLAZE], [box(8.3, 0.4, 1.7, 11), GLAZE]]) {
        const m = new THREE.Mesh(geom, brickMat(c));
        m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        m.rotation.y = -a + Math.PI / 2;
        m.receiveShadow = true;
        g.add(m);
      }
    }
    const ceilMat = M.toon(0x5a3a26, { vc: false, grain: true, side: THREE.DoubleSide });
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(37, 40).rotateX(Math.PI / 2), ceilMat);
    ceil.position.y = CEIL;
    g.add(ceil);
    for (let k = 0; k < 12; k++) { // beams from the wall to a ring in the middle
      const a = (k / 12) * Math.PI * 2;
      const beam = new THREE.Mesh(box(0.8, 0.8, 34), M.toon(0x4a2e1c, { vc: false, grain: true }));
      beam.position.set(Math.cos(a) * 17.5, CEIL - 0.8, Math.sin(a) * 17.5);
      beam.rotation.y = Math.PI / 2 - a;
      g.add(beam);
    }
    const flameMatT = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5) }); // glows (bloom)
    for (let k = 0; k < 16; k++) { // torches round the wall
      const a = (k / 16) * Math.PI * 2;
      const x = Math.cos(a) * (R - 1.1);
      const z = Math.sin(a) * (R - 1.1);
      const t = new THREE.Group();
      t.position.set(x, 4.2, z);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.9, 6), M.toon(0x4a2e1c, { vc: false }));
      stick.rotation.z = 0.4;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.25, 8).translate(0, 0.45, 0), brickMat(0xe8b84a));
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6).translate(0, 0.85, 0), flameMatT);
      t.add(stick, cup, fl);
      t.rotation.y = -a;
      g.add(t);
      torches.push({ x, y: 5.1, z, fl });
    }
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 2.4), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    for (let k = 0; k < 8; k++) { // portals in the wall: the horde comes through them
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * (R - 1.2), 0, Math.sin(a) * (R - 1.2));
      p.rotation.y = -a - Math.PI / 2;
      for (const x of [-1.7, 1.7]) {
        const pil = new THREE.Mesh(box(0.9, 4.4, 0.9), brickMat(GLAZE));
        pil.position.x = x;
        p.add(pil);
      }
      const lintel = new THREE.Mesh(box(4.4, 0.8, 1.0, 4.3), brickMat(0xe8b84a));
      const veil = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 4.2).translate(0, 2.1, 0), glow);
      p.add(lintel, veil);
      g.add(p);
      portals.push({ x: Math.cos(a) * (R - 3.5), z: Math.sin(a) * (R - 3.5) });
    }
    // The way up: a door in the north wall, barred until the floor is cleared.
    const dg = new THREE.Group();
    const da = Math.PI * 1.5;
    dg.position.set(Math.cos(da) * (R - 1.0), 0, Math.sin(da) * (R - 1.0));
    dg.rotation.y = -da - Math.PI / 2;
    for (const x of [-2.2, 2.2]) {
      const pil = new THREE.Mesh(box(1.1, 6, 1.4), brickMat(0xe8b84a));
      pil.position.x = x;
      dg.add(pil);
    }
    const lin = new THREE.Mesh(box(5.6, 1.0, 1.5, 6), brickMat(GLAZE));
    const bars = new THREE.Mesh(box(3.4, 5.6, 0.3), M.toon(0x3a3a42, { vc: false }));
    const way = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 5.6).translate(0, 2.8, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.0), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    way.visible = false;
    dg.add(lin, bars, way);
    g.add(dg);
    door = { x: Math.cos(da) * (R - 3.5), z: Math.sin(da) * (R - 3.5), open: false, set(o) { this.open = o; bars.visible = !o; way.visible = o; } };
    scene.add(g);
  }
  let floorGroup = null;
  let shellN = 0;
  // Builds a floor's layout (main.js calls it on every new floor): bricks with colliders, and springs.
  function towerFloor(layout) {
    if (floorGroup) {
      scene.remove(floorGroup);
      floorGroup.traverse((o) => o.geometry?.dispose());
    } else shellN = obstacles.length;
    obstacles.length = shellN;
    pads.length = 0;
    floorGroup = new THREE.Group();
    const block = (x, z, w, d, h, rot = 0) => {
      const c = BRICKC[Math.abs(Math.round(x * 7 + z * 3)) % 3];
      for (const [geom, col] of [[box(w, h - 0.12, d, -0.1), c], [box(w + 0.12, 0.3, d + 0.12, h - 0.32), GLAZE]]) { // brick, then the glazed band on top
        const m = new THREE.Mesh(geom, brickMat(col));
        m.position.set(x, 0, z);
        m.rotation.y = rot;
        m.castShadow = m.receiveShadow = true;
        floorGroup.add(m);
      }
      const long = Math.max(w, d);
      const short = Math.min(w, d);
      const n = Math.max(1, Math.ceil((long - short) / (short * 0.8)) + 1);
      const [ux, uz] = w >= d ? [Math.cos(rot), -Math.sin(rot)] : [Math.sin(rot), Math.cos(rot)];
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? 0 : -(long - short) / 2 + (k * (long - short)) / (n - 1);
        obstacles.push({ x: x + ux * off, z: z + uz * off, r: (short / 2) * 1.08, top: h - 0.02 });
      }
    };
    const ring = (r, n, depth, h, skip = () => false) => {
      for (let k = 0; k < n; k++) {
        if (skip(k)) continue;
        const a = (k / n) * Math.PI * 2;
        block(Math.cos(a) * r, Math.sin(a) * r, ((2 * Math.PI * r) / n) * 0.94, depth, h, Math.atan2(-Math.cos(a), -Math.sin(a)));
      }
    };
    const spring = (x, z, up) => { // a Rock of Horeb throwing you toward the middle
      const d = Math.hypot(x, z) || 1;
      const spout = new THREE.Mesh(spoutGeo, padMat);
      spout.position.set(x, 0.1, z);
      const rg = new THREE.Mesh(ringGeoP, padMat);
      rg.position.set(x, 0.08, z);
      floorGroup.add(spout, rg);
      pads.push({ x, z, y: 0, dx: -x / d, dz: -z / d, up, spout, cd: 0 });
    };
    let fire = false;
    if (layout === 'anfiteatro') { // low middle, two rings of benches round it, a tier in the middle
      ring(19, 14, 4.5, 1.6, (k) => k % 7 === 0);
      ring(26, 18, 4.5, 3.2);
      block(0, 0, 7, 7, 1.6);
      spring(0, 23, 1.5);
      spring(0, -23, 1.5);
    } else if (layout === 'zigurate') { // a three-step pyramid in the middle, springs on each side
      block(0, 0, 15, 15, 1.6);
      block(0, 0, 10.5, 10.5, 3.2);
      block(0, 0, 6, 6, 4.8);
      block(0, 0, 2.5, 2.5, 6.4);
      for (const [x, z] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) block(x, z, 4, 4, 2.4); // corner platforms
      spring(19, 0, 4.8);
      spring(-19, 0, 4.8);
    } else if (layout === 'pontes') { // four pillars and a middle joined high over a burning floor
      block(0, 0, 9, 9, 6);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        const ux = Math.round(Math.cos(a));
        const uz = Math.round(Math.sin(a));
        block(ux * 16, uz * 16, 6, 6, 6);
        block(ux * 9.7, uz * 9.7, ux ? 7 : 3.6, ux ? 3.6 : 7, 6); // the bridge, wide enough to fight on
        for (let s = 1; s <= 4; s++) block(ux * (18.5 + s * 2.2), uz * (18.5 + s * 2.2), 3, 3, 6 - s * 1.2); // steps up
      }
      fire = true;
    } else if (layout === 'espiral') { // a broken ramp round the edge up to a platform hung in the middle
      const n = 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 1.7;
        block(Math.cos(a) * 26, Math.sin(a) * 26, 6.6, 4.5, 0.8 + k * 0.45, Math.atan2(-Math.cos(a), -Math.sin(a)));
      }
      const a = Math.PI * 1.7 * ((n - 1) / n);
      const top = 0.8 + (n - 1) * 0.45;
      block(0, 0, 9, 9, top);
      block(Math.cos(a) * 14.5, Math.sin(a) * 14.5, 19, 3.6, top, -a);
      spring(Math.cos(a + 0.6) * 8, Math.sin(a + 0.6) * 8, top - 1);
    } else { // the throne room: wide, four columns to hide behind
      for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) block(x, z, 3.4, 3.4, 9);
      block(0, 24, 14, 5, 1.4);
      block(0, 25.5, 4, 2, 3.6);
      for (const [x, z] of [[-22, 0], [22, 0]]) { block(x, z, 5, 5, 2); block(x, z, 2.5, 2.5, 3.6); }
    }
    scene.add(floorGroup);
    return { fire };
  }
  const STAIRS = [];
  for (let k = 0; k < 5; k++) for (const lx of [-0.6, 0.6]) STAIRS.push([lx, -1.1 + k * 0.55, 0.75, 0.25 * (k + 1)]);
  for (const lx of [-1.45, 1.45]) for (const lz of [-1.1, 0, 1.1]) STAIRS.push([lx, lz, 0.35, 1.5]);
  const WALL = [-1.6, -0.55, 0.55, 1.6].map((lx) => [lx, 0, 0.45, 1.4]);
  function scatter(n, key, g, r, height, sMin, sMax, { minD = 10, test, gap = 5 } = {}) {
    for (let k = 0; k < n2(n); k++) {
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
  const gates = [];
  let rahab = null;
  const fallingWalls = [];
  if (T) towerShell();
  else if (ela) {
    // Waterfall: the brook drops off the eastern ledge between two cliffs; more cliffs line the ledge.
    const lx = B.ledgeX;
    const bz = B.brookZ(lx);
    for (const dz of [-7.5, 7.5]) build('cliff', geo('prop_cliff'), lx, bz + dz, Math.PI / 2, [[-3, 0, 2, 8], [0, 0, 2, 8], [3, 0, 2, 8]]);
    for (let z = bz - 90; z < bz + 90; z += 17) {
      if (Math.abs(z - bz) < 14) continue;
      build('cliff', geo('prop_cliff'), lx, z + random() * 4, Math.PI / 2 + (random() - 0.5) * 0.3, [[-3, 0, 2, 8], [0, 0, 2, 8], [3, 0, 2, 8]]);
    }
    placed.push({ x: lx, z: bz });
    // Stone bridge over the brook.
    const bx = -42;
    const bzb = B.brookZ(bx);
    const deckY = Math.max(H(bx, bzb - 4.5), H(bx, bzb + 4.5)) + 0.1;
    piece('bridge', geo('prop_bridge'), bx, bzb, -Math.atan(0.32 * Math.cos(bx * 0.04)), 1, deckY); // across the brook
    for (let u = -4; u <= 4; u += 1.3) collide(bx, bzb + u, 1.2, deckY + 0.15);
    placed.push({ x: bx, z: bzb });
    for (let k = 0; k < n2(4); k++) {
      const s = spot(14, 70 * S, 22);
      if (s) ruinSite(s.x, s.z);
    }
    // Philistine watchtowers joined by a broken walkway (jump the gap), and ruins up a ramp of fallen pillars.
    const WATCH = [];
    for (const tx of [0, 10]) {
      WATCH.push([tx, 0, 1.7, 2.6], [tx, 0, 0.95, 5.05], [tx + 1.1, 0.7, 0.45, 3.6]);
      for (let k = 0; k < 5; k++) WATCH.push([tx + (tx ? 2.2 : -2.2), -1.4 + k * 0.7, 0.42, 0.5 * (k + 1)]);
    }
    for (let x = 1.3; x < 8.8; x += 0.8) if (x < 4.3 || x > 5.7) WATCH.push([x, 0, 1.0, 5.02]); // the walkway, 2 m wide
    tall('watchpair', null, 3, 18, 80 * S, 16, 10, WATCH);
    const RAMP = [[0, 0, 3.0, 3.6], [-1.6, -1.4, 0.5, 6.7], [1.0, -1.4, 0.5, 5.7]];
    for (let lx = 6.6; lx > 3.2; lx -= 0.5) RAMP.push([lx, 0, 1.2, Math.min(3.6, 2.17 + (5.2 - lx) * 1.557)]);
    tall('ruinramp', null, 2, 20, 75 * S, 18, 7, RAMP);
    scatter(5, 'wall', geo('prop_wall'), 0.9, 1.4, 0.9, 1.1, { gap: 8 });
    scatter(3, 'tower', geo('prop_tower'), 1.1, 5, 0.9, 1.1, { gap: 10 });
    for (const [kind, n] of [['gold', 12], ['orange', 12], ['red', 8], ['green', 8]]) scatter(n, `tree-${kind}`, geo(`prop_tree_${kind}`), 0.6, 6, 0.85, 1.25);
    scatter(5, 'bigTree', geo('prop_bigTree'), 0.8, 7, 0.9, 1.15, { gap: 8 });
    scatter(8, 'olive', geo('prop_olive'), 0.6, 6, 0.9, 1.3);
    scatter(10, 'cypress', geo('prop_cypress'), 0.5, 6, 0.8, 1.3);
    scatter(18, 'boulder', geo('prop_boulder'), 1.1, 1.1, 0.9, 1.7);
    scatter(14, 'sheep', geo('prop_sheep'), 0.45, 0.8, 0.9, 1.1, { minD: 8 });
    const FENCE = [[-1.5, 0, 0.25, 1], [0, 0, 0.25, 1], [1.5, 0, 0.25, 1]];
    for (let k = 0; k < n2(10); k++) { // sheepfolds
      const s = spot(14, 70 * S, 6);
      if (s) build('fence', geo('prop_fence'), s.x, s.z, random() * 6.28, FENCE);
    }
    for (let k = 0; k < n2(2); k++) {
      const s = spot(20, 70 * S, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    for (let k = 0; k < 5; k++) { // five smooth stones out of the brook (1 Sm 17:40)
      const x = -88 + k * 40 + (random() - 0.5) * 8;
      const z = B.brookZ(x) + (random() - 0.5) * 2;
      const y = H(x, z) + 0.05;
      const m = M.solid(geo('decor_glint'), flatMat);
      m.position.set(x, y, z);
      m.scale.setScalar(1.6);
      scene.add(m);
      glints.push({ x, y, z, m, got: false });
    }
    for (let k = 0; k < 14; k++) { // the two camps on the hilltops (1 Sm 17:3)
      const x = -72 + k * 11 + random() * 4;
      for (const [key, z] of [['tentI', B.brookZ(x) - 104 - random() * 6], ['tentP', B.brookZ(x) + 104 + random() * 6]]) {
        if (!inside(x, z, 0.96) || slopeAt(x, z) > 0.5) continue;
        piece(key, geo(`prop_${key}`), x, z);
        collide(x, z, 1.5, H(x, z) + 2.2);
      }
    }
  } else if (sea) {
    for (let k = 0; k < 3; k++) {
      const s = spot(14, 40 * S, 22);
      if (s) ruinSite(s.x, s.z);
    }
    // Ruins and sharp rocks standing in the turquoise shallows, each with a ring of foam.
    const foam = [];
    const wet = (x, z) => shallow(x, z);
    const inWater = (n, key, g, r, height, sMin, sMax) => {
      for (let k = 0; k < n2(n); k++) {
        const p = spot(82, 116, 6, wet);
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
    scatter(2, 'colossus', geo('prop_colossus'), 1.9, 3.2, 1, 1.1, { minD: 20 * S });
    scatter(10, 'sandstone', geo('prop_sandstone'), 1.1, 1.0, 0.9, 1.7);
    for (let k = 0; k < 3; k++) { // sphinxes watching the sea
      const s = spot(20 * S, 70 * S, 18);
      if (!s) continue;
      build('sphinx', geo('prop_sphinx'), s.x, s.z, Math.atan2(s.x, s.z), [[0, -1.2, 1.2, 1.2], [0, 1.2, 1.1, 3.4], [0, 3.2, 0.7, 0.5]]);
      placed.push(s);
    }
    // Coral terraces with a wrecked chariot, and the columns of Baal-zephon to hop along (Êx 14:2).
    tall('coralstack', null, 5, 14, 75 * S, 12, 2, [[0, 0, 2.2, 1.4], [0.7, 0.4, 1.55, 2.8], [1.3, 0.8, 0.95, 4.2]]);
    tall('columns', null, 2, 16, 60 * S, 16, 9.2, [1.5, 2.7, 3.9, 5.1, 6.3].map((h, k) => [k * 2.3, Math.sin(k * 0.9) * 1.2, 0.85, h]));
    for (let k = 0; k < n2(2); k++) {
      const s = spot(14, 70 * S, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    const pyrMat = M.toon(0xece6f2, { fog: false });
    for (let k = 0; k < 3; k++) {
      const pyr = M.solid(geo('prop_pyramid'), pyrMat);
      const a = 2.2 + k * 0.35;
      pyr.position.set(Math.cos(a) * (250 + k * 34), B.water - 2, Math.sin(a) * (250 + k * 34));
      pyr.scale.set(70 - k * 15, 55 - k * 12, 70 - k * 15);
      pyr.castShadow = pyr.receiveShadow = false;
      scene.add(pyr);
    }
  } else if (C) {
    // Jericho (Js 6): the walled city on its mound, two gates, fallen stretches you can climb, houses inside,
    // Rahab's house built into the wall; palms by the spring (Dt 34:3, "the city of palms"); Israel's camp.
    // Gates east and west (ramps climb the tell to them), towers along the wall, three breaches.
    const n = CITY_N;
    const breach = [Math.round(n * 0.2), Math.round(n * 0.7), Math.round(n * 0.85)];
    const rahabK = Math.round(n * 0.35);
    const falls = [Math.round(n * 0.45), Math.round(n * 0.95)].filter((k) => k % 6 !== 3);
    for (let k = 0; k < n; k++) {
      const w = wallAt(k, n);
      const rot = -w.a - Math.PI / 2; // along the ring
      if (k === 0 || k === n / 2 || k === Math.round(n / 2)) {
        build('gate', geo('prop_gate'), w.x, w.z, rot, [[-2.6, 0, 1.25, 6], [2.6, 0, 1.25, 6]]);
        gates.push({ x: C.x + Math.cos(w.a) * (C.r + 4), z: C.z + Math.sin(w.a) * (C.r + 4) });
      } else if (breach.includes(k)) {
        build('rubble', geo('prop_wallRubble'), w.x, w.z, rot, [[-2, 0, 0.9, 0.8], [0, 0, 0.9, 1.0], [2, 0, 0.9, 0.8]]);
      } else if (k % 6 === 3 && k !== rahabK) {
        build('tower', geo('prop_tower'), w.x, w.z, rot, [[0, 0, 1.2, 5]], 1.15);
      } else if (falls.includes(k)) { // these stretches fall at 5:00 (main.js), changing the way up
        const y = H(w.x, w.z) - sink;
        const wall = M.solid(geo('prop_cityWall'), fadeMat);
        const rubble = M.solid(geo('prop_wallRubble'), fadeMat);
        for (const o of [wall, rubble]) { o.position.set(w.x, y, w.z); o.rotation.y = rot; scene.add(o); }
        rubble.visible = false;
        const cols = [-2.2, 0, 2.2].map((lx) => ({ x: w.x + lx * Math.cos(rot), z: w.z - lx * Math.sin(rot), r: 1.0, top: y + 4.6 }));
        obstacles.push(...cols);
        fallingWalls.push({ wall, rubble, cols, y, x: w.x, z: w.z });
      } else build('cityWall', geo('prop_cityWall'), w.x, w.z, rot, [[-2.2, 0, 1.0, 4.6], [0, 0, 1.0, 4.6], [2.2, 0, 1.0, 4.6]]);
      if (k === rahabK) { // Rahab's house against the outside of the wall, its window toward the plain
        const h = wallAt(k, n, 2.4);
        build('rahab', geo('prop_rahab'), h.x, h.z, Math.atan2(Math.cos(w.a), Math.sin(w.a)), [[0, 0, 1.5, 2.4]]);
        rahab = { x: C.x + Math.cos(w.a) * (C.r + 4.4), z: C.z + Math.sin(w.a) * (C.r + 4.4), used: false };
      }
    }
    // Houses in four rings round a square with the king's house; the main street runs gate to gate.
    for (const [r, count] of [[8, 6], [14, 10], [20, 14], [26, 18]]) {
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + r * 0.05;
        if (Math.abs(Math.sin(a)) < 0.2) continue; // the street from gate to gate
        const sc = 0.95 + random() * 0.35;
        build('house', geo('prop_house'), C.x + Math.cos(a) * r, C.z + Math.sin(a) * r, -a + (random() - 0.5) * 0.3, [[0, 0, 1.7, 2.6]], sc);
      }
    }
    build('tower', geo('prop_tower'), C.x, C.z + 3, 0, [[0, 0, 1.4, 6]], 1.5); // the king of Jericho's house
    // Corner towers outside the wall (their tops reach the wall walk) and houses stepped up against it inside.
    for (const f of [0.1, 0.4, 0.6, 0.9]) {
      const k = Math.round(n * f);
      const w = wallAt(k, n, 4.4);
      build('cornertower', geo('prop_cornertower'), w.x, w.z, -w.a, [[0, 0, 2.1, 1.6], [0, 0, 1.45, 3.2], [0, 0, 0.95, 4.8], [2.6, -0.4, 0.42, 0.55], [2.6, 0.3, 0.42, 1.1]], 1.3);
      const h = wallAt(k + 2, n, -2.9);
      build('rooftops', geo('prop_rooftops'), h.x, h.z, Math.atan2(-Math.cos(h.a), -Math.sin(h.a)), [[0, 0, 1.3, 2.0], [2.6, 0, 1.3, 3.0], [5.2, 0, 1.3, 4.0]], 1.3);
    }
    for (let k = 0; k < 4; k++) build('cart', geo('prop_cart'), C.x - 4 + k * 2.6, C.z - 4, random() * 6, [[0, 0, 1.2, 1.0]]); // market stalls
    placed.push({ x: C.x, z: C.z });
    const O = B.oasis;
    for (let k = 0; k < 12; k++) { // palms round the spring
      const a = (k / 12) * Math.PI * 2 + random() * 0.4;
      const r = 7 + random() * 5;
      const x = O.x + Math.cos(a) * r;
      const z = O.z + Math.sin(a) * r;
      if (dry(x, z, 0.4) && clear(x, z, 3)) { piece('palm', geo('prop_palm'), x, z, random() * 6.28, 0.9 + random() * 0.4); collide(x, z, 0.45, H(x, z) + 6); }
    }
    placed.push({ x: O.x, z: O.z });
    scatter(22, 'palm', geo('prop_palm'), 0.45, 6, 0.85, 1.25);
    scatter(6, 'olive', geo('prop_olive'), 0.6, 6, 0.9, 1.3);
    scatter(10, 'sandstone', geo('prop_sandstone'), 1.1, 1.0, 0.9, 1.7);
    for (let k = 0; k < n2(2); k++) {
      const s = spot(18, 70 * S, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    for (let k = 0; k < 13; k++) { // Israel's camp out on the plain (Js 6:11)
      const a = 0.62 + k * 0.12;
      const x = Math.cos(a) * (70 + (k % 2) * 6);
      const z = Math.sin(a) * (70 + (k % 2) * 6);
      if (!dry(x, z, 0.5)) continue;
      piece('tentI', geo('prop_tentI'), x, z);
      collide(x, z, 1.5, H(x, z) + 2.2);
    }
  } else if (B.gardens) {
    // Babylon (Dn 1-5): the Ishtar Gate on the processional way, temples of glazed blue brick with gold bands,
    // trees and palms up the terraces of the Hanging Gardens, palms along the Euphrates, houses round about.
    const blue = brickMat(GLAZE);
    const blue2 = brickMat(0x234c94);
    const gold = M.toon(0xe8b84a, { vc: false, fade: true });
    const solidBox = (g, w, h, d, x, y, z, mat) => { const b = new THREE.Mesh(box(w, h, d), mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    const crenels = (g, w, d, y, mat) => {
      for (let u = -w / 2 + 0.5; u <= w / 2 - 0.4; u += 1.4) for (const v of [-d / 2 + 0.4, d / 2 - 0.4]) solidBox(g, 0.8, 0.8, 0.8, u, y, v, mat);
    };
    { // the Ishtar Gate, astride the processional way north of the start
      const gz = 46;
      const y0 = H(0, gz) - 0.2;
      const g = new THREE.Group();
      g.position.set(0, y0, gz);
      for (const x of [-5.2, 5.2]) {
        solidBox(g, 4.4, 11, 5, x, 0, 0, blue);
        for (const ly of [2.5, 5.5, 8.5]) for (const lz of [-2.55, 2.55]) solidBox(g, 1.6, 0.9, 0.12, x, ly, lz, gold); // gold beasts in relief
        const top = new THREE.Group();
        top.position.set(x, 11, 0);
        crenels(top, 4.4, 5, 0, blue2);
        g.add(top);
        for (const lz of [-1.6, 0, 1.6]) collide(x, gz + lz, 1.9, y0 + 11);
      }
      solidBox(g, 6, 3, 5, 0, 8, 0, blue); // the lintel over the way
      solidBox(g, 6.2, 0.4, 5.2, 0, 7.8, 0, gold);
      scene.add(g);
      placed.push({ x: 0, z: gz }, { x: -5, z: gz }, { x: 5, z: gz });
    }
    for (let k = 0; k < 4; k++) { // temples of blue brick on level ground
      const rot = random() * Math.PI * 2;
      const s = levelSpot(24, 90 * S, 22, 9, rot);
      if (!s) continue;
      const y = H(s.x, s.z) - 0.2;
      const g = new THREE.Group();
      g.position.set(s.x, y, s.z);
      g.rotation.y = rot;
      solidBox(g, 9, 6, 7, 0, 0, 0, k % 2 ? blue : blue2);
      solidBox(g, 9.2, 0.5, 7.2, 0, 4.4, 0, gold);
      const top = new THREE.Group();
      top.position.y = 6;
      crenels(top, 9, 7, 0, k % 2 ? blue2 : blue);
      g.add(top);
      solidBox(g, 2.4, 4, 0.3, 0, 0, 3.55, M.toon(0x2a1a10, { vc: false })); // the doorway
      scene.add(g);
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      for (let lx = -3.5; lx <= 3.5; lx += 2.3) for (let lz = -2.5; lz <= 2.5; lz += 2.5) collide(s.x + lx * c + lz * sn, s.z - lx * sn + lz * c, 1.6, y + 6);
      placed.push(s);
    }
    const G = B.gardens;
    const garden = (x, z) => Math.max(Math.abs(x - G.x), Math.abs(z - G.z)) < G.r - 3 && H(x, z) > 3 && slopeAt(x, z) < 0.5;
    // ponytail: rejection sampling over the whole map, so dense counts here; a garden-only sampler if it ever gets slow
    scatter(40, 'cypress', geo('prop_cypress'), 0.5, 6, 0.8, 1.2, { minD: 4, gap: 2.5, test: garden });
    scatter(34, 'tree-green', geo('prop_tree_green'), 0.6, 6, 0.8, 1.15, { minD: 4, gap: 2.5, test: garden });
    scatter(26, 'palm', geo('prop_palm'), 0.45, 6, 0.85, 1.2, { minD: 4, gap: 2.5, test: garden });
    scatter(14, 'olive', geo('prop_olive'), 0.6, 6, 0.85, 1.2, { minD: 4, gap: 2.5, test: garden });
    scatter(8, 'bigTree', geo('prop_bigTree'), 0.8, 7, 0.8, 1.0, { minD: 4, gap: 4, test: garden });
    const bank = (x, z) => Math.abs(z - B.euphrates(x));
    scatter(16, 'palm', geo('prop_palm'), 0.45, 6, 0.85, 1.25, { test: (x, z) => bank(x, z) > 5 && bank(x, z) < 10 && dry(x, z, 0.5) });
    for (let k = 0; k < n2(8); k++) { // mud-brick houses round the temples
      const s = spot(18, 95 * S, 9);
      if (s) build('house', geo('prop_house'), s.x, s.z, random() * 6.28, [[0, 0, 2.2, 3.2]]);
    }
    for (let k = 0; k < n2(2); k++) {
      const s = spot(14, 70 * S, 22);
      if (s) ruinSite(s.x, s.z);
    }
    scatter(6, 'obelisk', geo('prop_obelisk'), 0.9, 7, 0.9, 1.2);
    scatter(10, 'sandstone', geo('prop_sandstone'), 1.1, 1.0, 0.9, 1.5);
    for (let k = 0; k < n2(2); k++) {
      const s = spot(14, 70 * S, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
  } else if (B.top) {
    // Mount Carmel (1 Rs 18): on the summit, Elijah's altar of twelve stones with the fire of the Lord on it
    // and Baal's altar across from it; olive groves and vineyards down the terraces, Israel's camp below.
    const A = B.top;
    const ex = A.x + 6;
    const ez = A.z;
    for (let k = 0; k < 12; k++) { // one stone for each tribe (1 Rs 18:31)
      const a = (k / 12) * Math.PI * 2;
      build('boulder', geo('prop_boulder'), ex + Math.cos(a) * 2.2, ez + Math.sin(a) * 2.2, a, [[0, 0, 0.9, 1.1]], 0.55);
    }
    piece('plinth', geo('prop_plinth'), ex, ez, 0, 0.9);
    collide(ex, ez, 1.3, H(ex, ez) + 1.4);
    const fire = new THREE.Mesh(flameGeo, flameMat);
    fire.position.set(ex, H(ex, ez) + 1.6, ez);
    fire.scale.setScalar(2.4);
    scene.add(fire);
    const bx = A.x - 7;
    const bz = A.z + 2;
    build('plinth', geo('prop_plinth'), bx, bz, 0.3, [[0, 0, 1.5, 1.57]]);
    build('obelisk', geo('prop_obelisk'), bx - 2.5, bz - 2, 0.3, [[0, 0, 0.9, 7]]);
    build('obelisk', geo('prop_obelisk'), bx + 2.5, bz + 2, 0.3, [[0, 0, 0.9, 7]]);
    placed.push({ x: ex, z: ez }, { x: bx, z: bz });
    for (let k = 0; k < n2(3); k++) {
      const s = spot(20, 80 * S, 22);
      if (s) ruinSite(s.x, s.z);
    }
    const RAMP = [[0, 0, 3.0, 3.6], [-1.6, -1.4, 0.5, 6.7], [1.0, -1.4, 0.5, 5.7]];
    for (let lx = 6.6; lx > 3.2; lx -= 0.5) RAMP.push([lx, 0, 1.2, Math.min(3.6, 2.17 + (5.2 - lx) * 1.557)]);
    tall('ruinramp', null, 2, 20, 75 * S, 18, 7, RAMP);
    tall('columns', null, 2, 16, 70 * S, 16, 9.2, [1.5, 2.7, 3.9, 5.1, 6.3].map((h, k) => [k * 2.3, Math.sin(k * 0.9) * 1.2, 0.85, h]));
    const land = (x, z) => B.coast(x, z) > 6;
    scatter(30, 'olive', geo('prop_olive'), 0.6, 6, 0.9, 1.35, { test: (x, z) => land(x, z) && dry(x, z, 0.5) });
    scatter(12, 'cypress', geo('prop_cypress'), 0.5, 6, 0.8, 1.3);
    scatter(8, 'tree-green', geo('prop_tree_green'), 0.6, 6, 0.85, 1.25);
    scatter(4, 'bigTree', geo('prop_bigTree'), 0.8, 7, 0.9, 1.15, { gap: 8 });
    scatter(8, 'palm', geo('prop_palm'), 0.45, 6, 0.85, 1.2, { test: (x, z) => !land(x, z) && dry(x, z, 0.3) });
    scatter(16, 'boulder', geo('prop_boulder'), 1.1, 1.1, 0.9, 1.7);
    scatter(4, 'wall', geo('prop_wall'), 0.9, 1.4, 0.9, 1.1, { gap: 8 });
    scatter(12, 'sheep', geo('prop_sheep'), 0.45, 0.8, 0.9, 1.1, { minD: 8 });
    for (let k = 0; k < n2(2); k++) {
      const s = spot(20, 70 * S, 10);
      if (s) build('cart', geo('prop_cart'), s.x, s.z, random() * 6.28, [[0, 0, 1.2, 1.0]]);
    }
    for (let k = 0; k < 10; k++) { // Israel's camp on the lower slope, watching (1 Rs 18:21)
      const x = -30 + k * 7 + random() * 3;
      const z = 58 + random() * 8;
      if (!inside(x, z, 0.96) || !dry(x, z, 0.5)) continue;
      piece('tentI', geo('prop_tentI'), x, z);
      collide(x, z, 1.5, H(x, z) + 2.2);
    }
  } else {
    // Valley of dry bones (Ez 37): ruins, dead trees, great ribcages and skulls, heaps of bones, red rock.
    for (let k = 0; k < n2(3); k++) {
      const s = spot(14, 60 * S, 22);
      if (s) ruinSite(s.x, s.z);
    }
    const RIBS = [];
    for (const lz of [-2.25, -0.75, 0.75, 2.25]) RIBS.push([0, lz, 1.0, 2.7], [-1.6, lz, 0.4, 1.8], [1.6, lz, 0.4, 1.8]);
    for (let k = 0; k < n2(6); k++) {
      const s = spot(16, 72 * S, 14);
      if (!s) continue;
      build('ribcage', geo('prop_ribcage'), s.x, s.z, random() * 6.28, RIBS, 0.9 + random() * 0.4);
      placed.push(s);
    }
    for (let k = 0; k < 3; k++) {
      const s = spot(25, 70 * S, 26);
      if (!s) continue;
      build('skull', geo('prop_skull'), s.x, s.z, Math.atan2(-s.x, -s.z), [[0, 0, 1.9, 2.4]], 1.1); // staring at the valley floor
      placed.push(s);
    }
    // A giant's spine arching over the ground (walk over it), and a stepped mausoleum with a sealed chest on top.
    const SPINE = [];
    for (let lx = -8; lx <= 8.01; lx += 0.8) SPINE.push([lx, 0, 0.75, 4.6 * (1 - (lx / 8.5) ** 2) + 0.65]);
    const spines = [];
    for (let k = 0; k < 3; k++) {
      const rot = random() * Math.PI * 2;
      const e = levelSpot(18, 70 * S, 18, 16 * BIG, rot); // one end; the piece is centred half its length along
      if (!e) continue;
      const s = { x: e.x + 8 * BIG * Math.cos(rot), z: e.z - 8 * BIG * Math.sin(rot) };
      build('spinebridge', geo('prop_spinebridge'), s.x, s.z, rot, SPINE, BIG);
      placed.push(s);
      spines.push(s);
    }
    const zig = [];
    const flat = (x, z) => dry(x, z, 0.5) && reachable(x, z) && [0, 1.57, 3.14, 4.71].every((a) => Math.abs(H(x + Math.cos(a) * 6.5, z + Math.sin(a) * 6.5) - H(x, z)) < 0.9);
    const zs = spot(20, 90 * S, 14, flat);
    if (zs) {
      build('ziggurat', geo('prop_ziggurat'), zs.x, zs.z, random() * 6.28, [[0, 0, 4.6, 1.5], [0, 0, 3.1, 3.0], [0, 0, 1.7, 4.5]], BIG);
      placed.push(zs);
      zig.push(zs);
    }
    for (const z of zig) addChest(z.x, z.z, 'dark', H(z.x, z.z) - sink + 4.5 * BIG);
    for (let k = 0; k < n2(16); k++) { // big red boulders fallen from the cliffs
      const s = spot(30, 112, 8);
      if (!s) continue;
      const sc = 1.8 + random() * 1.2;
      build('sandstone', geo('prop_sandstone'), s.x, s.z, random() * 6.28, [[0, 0, 1.1, 1.0]], sc);
      placed.push(s);
    }
    scatter(22, 'deadTree', geo('prop_deadTree'), 0.4, 4.5, 0.9, 1.4);
    for (let k = 0; k < n2(18); k++) { // heaps of bones: the wind makes them stand up (Ez 37:9)
      const s = spot(10, 76 * S, 6);
      if (!s) continue;
      build('bonepile', geo('prop_bonepile'), s.x, s.z, random() * 6.28, [[0, 0, 0.7, 0.7]], 0.9 + random() * 0.6);
      bonePiles.push(s);
    }
    for (let k = 0; k < n2(14); k++) {
      const s = spot(12, 76 * S, 5);
      if (s) build('tomb', geo('prop_tomb'), s.x, s.z, random() * 6.28, [[0, 0.2, 0.7, 0.3], [0, -1, 0.5, 1.3]]);
    }
    for (let k = 0; k < n2(3); k++) {
      const s = spot(14, 70 * S, 10);
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
  for (let k = 0; k < (T ? 0 : n2(40)); k++) {
    const s = spot(8, B.radius * 0.85, 3);
    if (s) jars.push({ ...s, y: H(s.x, s.z), broken: false, rot: random() * 6 });
  }
  const jarMesh = instanced(geo('jar'), fadeMat, jars);
  scene.add(jarMesh);

  // ---- Ground cover ----
  function decor(g, n, test, sMin = 0.8, sMax = 1.3, y = H) {
    const list = [];
    for (let k = 0; k < n2(n); k++) {
      const x = (random() * 2 - 1) * B.radius * 1.1;
      const z = (random() * 2 - 1) * B.radius * 1.1;
      if (test(x, z, H(x, z))) list.push({ x, y: y(x, z), z, s: sMin + random() * (sMax - sMin), rot: random() * 6 });
    }
    scene.add(instanced(g, flatMat, list, false));
  }
  if (ela) {
    const bank = (x, z) => Math.abs(z - B.brookZ(x));
    const level = (x, z) => slopeAt(x, z) < 0.9; // nothing grows on the rock faces
    decor(geo('decor_grass'), 3200, (x, z, h) => bank(x, z) > 2.8 && h < 26 && level(x, z));
    decor(geo('decor_leaves'), 1100, (x, z, h) => bank(x, z) > 2.8 && h < 26 && level(x, z));
    for (const k of [0, 1, 2]) decor(geo(`decor_flower${k}`), 130, (x, z, h) => bank(x, z) > 3 && h < 24 && level(x, z));
    decor(geo('decor_pebble'), 320, (x, z) => bank(x, z) < 2.2, 0.6, 1.5);
    decor(geo('decor_reed'), 200, (x, z) => bank(x, z) > 2.2 && bank(x, z) < 3.4);
    decor(geo('decor_lily'), 70, (x, z) => bank(x, z) < 1.8 && x < B.ledgeX - 4, 0.7, 1.2, (x) => H(x, B.brookZ(x)) + 0.47);
  } else if (sea) {
    const w = B.water;
    decor(geo('decor_shrub'), 260, (x, z, h) => h > w + 1);
    decor(geo('decor_grass'), 900, (x, z, h) => h > w + 1.2);
    decor(geo('decor_shell'), 300, (x, z, h) => h > w && h < w + 0.8, 0.8, 1.6);
    decor(geo('decor_reed'), 200, (x, z, h) => h > w - 0.35 && h < w + 0.3);
    decor(geo('decor_pebble'), 260, (x, z, h) => h < w && h > w - 1, 0.8, 1.8);
  } else if (C) {
    const O = B.oasis;
    const nearPool = (x, z) => Math.hypot(x - O.x, z - O.z);
    decor(geo('decor_grass'), 900, (x, z, h) => nearPool(x, z) < 16 && h > B.water + 0.2);
    decor(geo('decor_reed'), 160, (x, z, h) => h > B.water - 0.3 && h < B.water + 0.5);
    decor(geo('decor_lily'), 30, (x, z, h) => h < B.water - 0.4, 0.7, 1.1, () => B.water + 0.02);
    for (const k of [0, 1, 2]) decor(geo(`decor_flower${k}`), 40, (x, z, h) => nearPool(x, z) < 15 && h > B.water + 0.3);
    decor(geo('decor_shrub'), 240, (x, z, h) => h > B.water + 1 && Math.hypot(x - C.x, z - C.z) > C.r + 3);
    decor(geo('decor_drygrass'), 600, (x, z, h) => h > B.water + 1 && Math.hypot(x - C.x, z - C.z) > C.r + 3);
    decor(geo('decor_pebble'), 200, () => true, 0.6, 1.4);
  } else if (B.gardens) {
    const G = B.gardens;
    const inGarden = (x, z, h) => Math.max(Math.abs(x - G.x), Math.abs(z - G.z)) < G.r - 2 && h > 3 && slopeAt(x, z) < 0.9;
    decor(geo('decor_grass'), 3000, inGarden);
    decor(geo('decor_leaves'), 1800, inGarden);
    for (const k of [0, 1, 2]) decor(geo(`decor_flower${k}`), 300, inGarden);
    const bank = (x, z) => Math.abs(z - B.euphrates(x));
    decor(geo('decor_reed'), 260, (x, z, h) => bank(x, z) < 7 && h > B.water - 0.3 && h < B.water + 0.6);
    decor(geo('decor_grass'), 600, (x, z, h) => bank(x, z) < 9 && h > B.water + 0.3);
    decor(geo('decor_shrub'), 160, (x, z, h) => h > 1 && h < 3 && slopeAt(x, z) < 0.5);
    decor(geo('decor_pebble'), 200, () => true, 0.6, 1.4);
  } else if (B.top) {
    const level = (x, z) => slopeAt(x, z) < 0.9;
    const green = (x, z, h) => h > B.water + 0.8 && level(x, z) && Math.hypot(x - B.top.x, z - B.top.z) > B.top.r;
    decor(geo('decor_grass'), 2600, green);
    decor(geo('decor_leaves'), 800, green);
    for (const k of [0, 1, 2]) decor(geo(`decor_flower${k}`), 120, green);
    decor(geo('decor_drygrass'), 300, (x, z) => Math.hypot(x - B.top.x, z - B.top.z) < B.top.r);
    decor(geo('decor_shell'), 220, (x, z, h) => h > B.water && h < B.water + 0.8, 0.8, 1.6);
    decor(geo('decor_pebble'), 260, () => true, 0.6, 1.4);
  } else if (!T) {
    decor(geo('decor_drygrass'), 1600, (x, z, h) => h < 20 && slopeAt(x, z) < 0.9);
    decor(geo('decor_bone'), 500, (x, z, h) => h < 8 && slopeAt(x, z) < 0.9, 0.8, 1.6);
    decor(geo('decor_skull'), 90, (x, z, h) => h < 8 && slopeAt(x, z) < 0.9, 0.8, 1.3);
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
      c.visible = !T;
      c.position.x += dt * 1.5;
      if (c.position.x > 220) c.position.x = -220;
    }
    if (sea) waters[0].position.y = B.water + Math.sin(time * 0.8) * 0.04;
    for (const a of altars) {
      a.flame.visible = !a.used;
      a.flame.scale.set(1 + Math.sin(time * 11 + a.x) * 0.08, 1 + Math.sin(time * 9 + a.z) * 0.2, 1 + Math.cos(time * 10) * 0.08);
    }
    for (const c of chests) c.lid.rotation.x += ((c.open ? -1.9 : 0) - c.lid.rotation.x) * Math.min(1, dt * 8);
    for (const t of things) if (t.flame) t.flame.scale.setScalar((t.kind === 'gideon' ? 0.7 : 1) * (1 + Math.sin(time * 11 + t.x) * 0.12));
    for (const t of torches) t.fl.scale.set(1 + Math.sin(time * 13 + t.x) * 0.12, 1 + Math.sin(time * 17 + t.z) * 0.25, 1);
    for (const p of pads) p.spout.scale.set(1, 0.6 + 0.4 * Math.abs(Math.sin(time * 3 + p.x)) + (p.cd > 0 ? 2 * p.cd : 0), 1);
  }

  // Jericho at 5:00: two stretches of the wall come down to rubble.
  function collapse() {
    for (const f of fallingWalls) {
      f.wall.visible = false;
      f.rubble.visible = true;
      for (const c of f.cols) c.top = f.y + 0.9;
    }
    return fallingWalls;
  }
  return { B, terrainH: H, slopeAt, obstacles, collapse, towerFloor, portals, torches, get door() { return door; }, CEIL, stones, altars, wells, pads, things, chests, addChest, freeSpot, jars, jarMesh, glints, bonePiles, gates, rahab, update, horizon: skyMat.uniforms.horizon.value };
}
