import * as THREE from 'three';
import { rng, FlowField, SpatialHash } from './sim.js';
import {
  HEROES, WEAPONS, SCROLLS, RELICS, RARITY, ENEMIES, BOSS, BIOMES, EVOLUTIONS, PICKUPS, MAX_LEVEL, TROPHIES, TIERS, openSet, unlockedBy,
  baseStats, weaponStats, describeLevel, rollOffers, rollRelic, rollRarity, pickWeighted, spawnWeights, statText, applyEntry, readyToEvolve,
} from './content.js';
import * as M from './models.js';
import { buildWorld } from './world.js';
import { loadAll } from './assets.js';

// ---------- Profile: trophies won and what they opened, kept in this browser ----------
const PROFILE_KEY = 'bible-rush-profile';
const profile = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; } })();
profile.trophies ??= {};
profile.wins ??= {}; // hero -> { map: true }
const saveProfile = () => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch {} };
let OPEN = openSet(profile);
const isOpen = (kind, id) => OPEN.has(`${kind}:${id}`);
const unlockName = (key) => {
  const [kind, id] = key.split(':');
  return kind === 'hero' ? HEROES[id].name : kind === 'map' ? BIOMES[id].name : `relíquia ${RELICS[id].name}`;
};

// ---------- URL + settings ----------
const params = new URLSearchParams(location.search);
const wantBiome = params.get('biome');
const BIOME_ID = BIOMES[wantBiome] && isOpen('map', wantBiome) ? wantBiome : 'ela'; // a locked map in the URL falls back
const DEFAULTS = { style: 'crisp', shadows: true, dmgNumbers: true, fps: false, sens: 1, camDist: 8.5, invertY: false, autoCam: true, lockMouse: true, volume: 0.7 };
const cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('otr-cfg') || '{}')); } catch {}
const saveCfg = () => { try { localStorage.setItem('otr-cfg', JSON.stringify(cfg)); } catch {} };

// ---------- Tuning ----------
const HALF = 100; // grids span [-100, 100] on X and Z
const MAX_ENEMIES = 1000;
const MAX_SHOTS = 600;
const MAX_ESHOTS = 300;
const MAX_GEMS = 1500;
const MAX_STRIKES = 64;
const MAX_ORBS = 24;
const MAX_PARTS = 700;
const GRAVITY = 32;
const JUMP = 11;
const MAX_SPEED = 30;
const MAX_R = 1.4; // largest enemy radius (boss)
const RUN_TIME = 600; // the boss comes at 10:00 even if the stones are not done
const DAY_LEN = 150;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const random = rng(Date.now() % 1e9);

// ---------- Renderer: low-res scene, outline pass, CSS scales it with hard pixels ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.id = 'view';
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(0, 48, 135);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 420);

const target = new THREE.WebGLRenderTarget(1, 1, {
  minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1),
});
// Dark outline wherever a neighbour pixel is much farther away (silhouettes), fading into the fog.
const postMat = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: target.texture }, tDepth: { value: target.depthTexture }, texel: { value: new THREE.Vector2() }, near: { value: camera.near }, far: { value: camera.far } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 texel; uniform float near; uniform float far;
    varying vec2 vUv;
    float dist(vec2 uv) { float z = texture2D(tDepth, uv).x; return near * far / (far - z * (far - near)); }
    void main() {
      vec3 col = texture2D(tColor, vUv).rgb;
      float d = dist(vUv);
      float n = max(max(dist(vUv + vec2(texel.x, 0.0)), dist(vUv - vec2(texel.x, 0.0))),
                    max(dist(vUv + vec2(0.0, texel.y)), dist(vUv - vec2(0.0, texel.y))));
      float edge = step(d * 0.06 + 0.15, n - d) * (1.0 - smoothstep(30.0, 80.0, d));
      gl_FragColor = vec4(mix(col, col * 0.28, edge), 1.0);
      #include <colorspace_fragment>
    }`,
  depthTest: false,
  depthWrite: false,
});
const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
postQuad.frustumCulled = false;
postScene.add(postQuad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const STYLE_LINES = { pixel: 300, crisp: 600 };
function resize() {
  const lines = STYLE_LINES[cfg.style];
  const scale = lines ? Math.max(1, Math.round(innerHeight / lines)) : 1 / Math.min(devicePixelRatio, 1.5);
  const w = Math.ceil(innerWidth / scale);
  const h = Math.ceil(innerHeight / scale);
  renderer.setSize(w, h, false);
  target.setSize(w, h);
  postMat.uniforms.texel.value.set(1 / w, 1 / h);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  canvas.classList.toggle('smooth', !lines);
}
addEventListener('resize', resize);
resize();

function render() {
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}

// Warm sun, cool sky light: shadows come out bluish like in pixel-art landscapes.
const hemi = new THREE.HemisphereLight(0xc6d6f2, 0x8a7a5a, 1.45);
const sun = new THREE.DirectionalLight(0xffeccc, 2.5);
sun.castShadow = cfg.shadows;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 180 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);

// ---------- World ----------
const ASSETS = await loadAll(BIOMES[BIOME_ID].bossModel, Object.keys(HEROES)); // models built in Blender (tools/build_models.sh)
const world = buildWorld(scene, BIOME_ID, random, ASSETS.props);
const B = world.B;
const terrainH = world.terrainH;
const { obstacles, stones, altars, chests, jars } = world;
function slope(x, z) {
  const e = 0.25;
  return [(terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e)];
}
const walkable = (x, z) => Math.hypot(x, z) < B.radius - 2 && terrainH(x, z) > B.water - 0.9; // shallows are wadeable

const flow = new FlowField(HALF, 2);
const hash = new SpatialHash(HALF, 2, MAX_ENEMIES);
for (const o of obstacles) flow.blockCircle(o.x, o.z, o.r + 0.6);
// Colliders by 4 m cell: "is this point inside a rock, ruin, tree or chest?" for shots, enemies and drops.
const OB_CELL = 4;
const obGrid = new Map();
const obKey = (x, z) => (Math.floor(x / OB_CELL) + 64) * 256 + Math.floor(z / OB_CELL) + 64;
function indexObstacle(id) {
  const o = obstacles[id];
  const m = o.r + 1; // margin: padded queries near a cell edge still find it
  for (let cx = Math.floor((o.x - m) / OB_CELL); cx <= Math.floor((o.x + m) / OB_CELL); cx++) {
    for (let cz = Math.floor((o.z - m) / OB_CELL); cz <= Math.floor((o.z + m) / OB_CELL); cz++) {
      const k = (cx + 64) * 256 + cz + 64;
      if (!obGrid.has(k)) obGrid.set(k, []);
      obGrid.get(k).push(id);
    }
  }
}
obstacles.forEach((o, id) => indexObstacle(id));
const NO_IDS = [];
const obstaclesNear = (x, z) => obGrid.get(obKey(x, z)) ?? NO_IDS;
function obstacleAt(x, z, pad = 0) {
  for (const id of obstaclesNear(x, z)) {
    const o = obstacles[id];
    if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) return o;
  }
  return null;
}
for (let c = 0; c < flow.n * flow.n; c++) { // sea and the world's edge
  const x = -HALF + ((c % flow.n) + 0.5) * flow.cell;
  const z = -HALF + (Math.floor(c / flow.n) + 0.5) * flow.cell;
  if (!walkable(x, z)) flow.blocked[c] = 1;
}
flow.update(0, 0);

// ---------- Entities: flat typed arrays, swap-remove, instanced meshes ----------
function pool(max, fields) {
  const p = { n: 0, fields };
  for (const f of fields) p[f] = new Float32Array(max);
  return p;
}
function removeAt(p, i) {
  const last = --p.n;
  for (const f of p.fields) p[f][i] = p[f][last];
}
const E = pool(MAX_ENEMIES, ['x', 'y', 'z', 'hp', 'maxhp', 'kx', 'kz', 'flash', 'spd', 'face', 'type', 'elite',
  'st', 't', 'dx', 'dz', 'slow', 'stun', 'burn', 'cd', 'r', 'h', 'mark', 'sw']); // sw: last sweep that hit it
// ret: boomerang (s until it turns back, 0 = coming back, -1 = not a boomerang); glow: from an evolved weapon
const S = pool(MAX_SHOTS, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'bounce', 'pierce', 'last', 'dmg', 'seek', 'speed', 'size', 'crit', 'kind',
  'ret', 'glow', 'burn']);
const EP = pool(MAX_ESHOTS, ['x', 'y', 'z', 'vx', 'vz', 'life', 'graze', 'dmg']);
const G = pool(MAX_GEMS, ['x', 'y', 'z', 'val', 'pull', 'kind']); // kind 0 = maná (XP), 1 = siclo (gold), 2+ = PICKUPS
const K = pool(MAX_STRIKES, ['x', 'z', 'r', 'dmg', 't', 't0', 'fire', 'burn']); // falling hail, or fire from heaven
const PT = pool(MAX_PARTS, ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'col']);
const near = new Int32Array(2048);

const WHITE = new THREE.Color(1, 1, 1);
function instanced(geo, mat, max, colors = false, shadow = false) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  if (colors) for (let i = 0; i < max; i++) m.setColorAt(i, WHITE);
  m.count = 0;
  m.frustumCulled = false; // instances spread over the whole map
  m.castShadow = shadow;
  scene.add(m);
  return m;
}
const enemyMat = M.toon(0xffffff, { walk: true, fade: true });
const enemyMeshes = [0, 1, 2, 3].map((t) => instanced(ASSETS.mobs[`mob_${t}_${BIOME_ID}`], enemyMat, MAX_ENEMIES, true, true));
const PROJ = ['stone', 'arrow', 'snake', 'axe'];
const shotMeshes = PROJ.map((k) => instanced(ASSETS.items[`proj_${k}`], M.toon(), MAX_SHOTS, true));
const eshotMesh = instanced(new THREE.IcosahedronGeometry(0.25, 0), new THREE.MeshBasicMaterial({ color: 0xff3fb4 }), MAX_ESHOTS);
const manaMesh = instanced(ASSETS.items.proj_mana, new THREE.MeshBasicMaterial({ vertexColors: true }), MAX_GEMS);
const coinMesh = instanced(ASSETS.items.proj_coin, M.toon(), MAX_GEMS);
const orbMesh = instanced(ASSETS.items.proj_wheel, M.toon(), MAX_ORBS, false, true);
const strikeMesh = instanced(new THREE.RingGeometry(0.8, 1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7, depthWrite: false }), MAX_STRIKES);
const hailMesh = instanced(ASSETS.items.proj_hail, M.toon(), MAX_STRIKES, false, true);
const fireBolt = instanced(ASSETS.items.proj_fire, flameMatOf(), MAX_STRIKES); // fire strikes fall as a bolt
const starMesh = instanced(ASSETS.items.proj_mana, new THREE.MeshBasicMaterial({ color: 0xfff1b8 }), MAX_STRIKES); // Débora's stars
const pickMeshes = PICKUPS.map((p) => instanced(ASSETS.items[`pick_${p.id}`], M.toon(), 64, false, true));
const pickGlow = instanced(new THREE.RingGeometry(0.3, 0.62, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.75, depthWrite: false }), 256);
const locustMesh = instanced(ASSETS.items.proj_locust, M.toon(), 160);
function flameMatOf() { return new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }); }
const partMesh = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), MAX_PARTS, true);
const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const auraFlames = instanced(ASSETS.props.flame, flameMat, 10);

const glow = (color, opacity = 0.5, extra) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
// Flat effects lying on the ground follow it (slopes, banks) instead of cutting into it or floating.
function drape(geo, base, cx, cz, r, lift) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = cx + base[i * 3] * r;
    const z = cz + base[i * 3 + 2] * r;
    pos.setXYZ(i, x, terrainH(x, z) + lift, z);
  }
  pos.needsUpdate = true;
}
function groundMesh(geo, mat) {
  const m = mesh(geo.clone(), mat);
  m.userData.base = Float32Array.from(geo.attributes.position.array);
  m.frustumCulled = false; // vertices are in world space
  return m;
}
const auraDisk = groundMesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), glow(0xff8a3d, 0.2));
const harpMesh = groundMesh(new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2), glow(0xf2c14e, 0.55, { side: THREE.DoubleSide }));
const tele = { depthTest: false };
const teleLine = mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glow(0xff3b30, 0.35, tele));
const teleCircle = mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), glow(0xff3b30, 0.35, tele));
const spearMesh = M.solid(ASSETS.items.proj_spear, M.toon());
for (const m of [auraDisk, harpMesh, teleLine, teleCircle, spearMesh]) {
  m.visible = false;
  m.renderOrder = 5;
  scene.add(m);
}

// Short-lived effects: rings, arcs, the relic rising from a chest.
const fxList = [];
const sectorGeos = new Map();
function sectorGeo(arc) {
  if (!sectorGeos.has(arc)) sectorGeos.set(arc, new THREE.RingGeometry(0.2, 1, 12, 1, -arc / 2, arc).rotateX(-Math.PI / 2));
  return sectorGeos.get(arc);
}
const ringGeo = new THREE.RingGeometry(0.8, 1, 28).rotateX(-Math.PI / 2);
// ground: the ring lies on the terrain (y is then the lift above it).
function addFx(geo, color, x, y, z, scale, life, { rotY = 0, grow = 0, opacity = 0.6, ground = false } = {}) {
  const mat = glow(color, opacity, { side: THREE.DoubleSide });
  const m = ground ? groundMesh(geo, mat) : mesh(geo, mat, x, y, z);
  if (ground) drape(m.geometry, m.userData.base, x, z, scale, y);
  else {
    m.rotation.y = rotY;
    m.scale.setScalar(scale);
  }
  scene.add(m);
  fxList.push({ m, life, max: life, grow, scale, opacity, ground: ground && { x, z, lift: y } });
}
function addObjFx(obj, life, update) {
  scene.add(obj);
  fxList.push({ m: obj, life, max: life, update });
}
function updateFx(dt) {
  for (let i = fxList.length - 1; i >= 0; i--) {
    const f = fxList[i];
    f.life -= dt;
    const k = 1 - f.life / f.max;
    if (f.update) f.update(f.m, k);
    else {
      f.m.material.opacity = f.opacity * (1 - k);
      if (f.ground) drape(f.m.geometry, f.m.userData.base, f.ground.x, f.ground.z, f.scale * (1 + f.grow * k), f.ground.lift);
      else if (f.grow) f.m.scale.setScalar(f.scale * (1 + f.grow * k));
    }
    if (f.life <= 0) {
      scene.remove(f.m);
      if (!f.update) f.m.material.dispose();
      if (f.ground) f.m.geometry.dispose();
      fxList.splice(i, 1);
    }
  }
}

// Rigged model (hero or boss): toon material, shadows, an animation mixer and its clips. Heroes carry
// their sprite sheet as a texture (crisp pixels); bosses use vertex colours.
function makeRig({ scene: root, clips }) {
  let map = null;
  root.traverse((o) => { if (o.isMesh && o.material.map) map = o.material.map; });
  if (map) {
    map.magFilter = map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.needsUpdate = true;
  }
  const dissolve = { value: 0 };
  const mat = map ? M.toon(0xffffff, { vc: false, map, dissolve }) : M.toon(0xffffff, { dissolve });
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.material = mat;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false; // skinned: the bind-pose bounds do not follow the animation
  });
  const mixer = new THREE.AnimationMixer(root);
  const act = Object.fromEntries(Object.entries(clips).map(([n, c]) => [n, mixer.clipAction(c)]));
  return { group: root, mixer, act, mat, dissolve, current: null, w: {} };
}
const bossRig = makeRig(ASSETS.boss);
bossRig.group.visible = false;
scene.add(bossRig.group);

// Boss clip follows its state; attacks play once and hold their last pose.
function bossAnim(dt) {
  const want = boss.st === 'walk' ? (boss.moving ? 'walk' : 'idle') : boss.st === 'rest' ? 'idle' : boss.st;
  if (bossRig.current !== want && bossRig.act[want]) {
    const next = bossRig.act[want];
    const once = want === 'spear' || want === 'stomp' || want === 'summon';
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.fadeIn(0.15).play();
    bossRig.act[bossRig.current]?.fadeOut(0.15);
    bossRig.current = want;
  }
  bossRig.mixer.update(dt);
}

// ---------- Hero sprites: assets/heroes/<id>.png = 4 views (front, back, facing left, facing right) ----------
// Built from the turnaround sheets by tools/make_sprites.py. In game the heroes are the 3D models
// Blender builds from these same sprites; the sprites remain for portraits.
const SPRITES = Object.fromEntries(await Promise.all(Object.keys(HEROES).filter((id) => !HEROES[id].noSprite).map((id) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok([id, img]);
  img.onerror = () => fail(new Error(`missing assets/heroes/${id}.png`));
  img.src = `assets/heroes/${id}.png`;
}))));

// A square around the head of the front view, for the HUD portrait.
function spriteFace(id) {
  const img = SPRITES[id];
  const cw = img.width / 4;
  const ch = img.height;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  cv.width = cw;
  cv.height = ch;
  ctx.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);
  const a = ctx.getImageData(0, 0, cw, ch).data;
  const solid = (x, y) => a[(y * cw + x) * 4 + 3] > 0;
  const row = Math.round(ch * 0.12); // through the hair: the widest run is the head, not the staff
  let best = [0, cw];
  for (let x = 0; x < cw;) {
    if (!solid(x, row)) { x++; continue; }
    const s = x;
    while (x < cw && solid(x, row)) x++;
    if (x - s > best[1] - best[0] || best[1] === cw) best = [s, x];
  }
  const cx = (best[0] + best[1]) / 2;
  let top = 0;
  while (top < ch && ![-4, 0, 4].some((d) => solid(Math.round(cx + d), top))) top++;
  const size = Math.round(ch * 0.3);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const o = out.getContext('2d');
  o.imageSmoothingEnabled = false;
  o.drawImage(img, cx - size / 2, Math.max(0, top - 2), size, size, 0, 0, size, size);
  return out.toDataURL();
}

const HERO_RIGS = Object.fromEntries(Object.keys(HEROES).map((id) => [id, makeRig(ASSETS.heroes[id])]));

// ---------- Icons: 3D models rendered once into small pixel images ----------
// Each scroll shows what it improves: an emblem from assets/ui drawn over its paper.
const SCROLL_EMBLEM = { forca: 'sword', prontidao: 'hourglass', amplidao: 'burst', constancia: 'candle', corrida: 'wing',
  vida: 'heart', alcance: 'magnet', sorte: 'die', precisao: 'eye', sabedoria: 'book' };
const EMBLEMS = Object.fromEntries(await Promise.all(Object.entries({ ...SCROLL_EMBLEM, star: 'star' }).map(([id, file]) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok([id, img]);
  img.onerror = () => fail(new Error(`missing assets/ui/${file}.png`));
  img.src = `assets/ui/${file}.png`;
}))));

// Rendered small, then given hard edges and a dark one-pixel outline: pixel-art sprites shown at 2-4x.
const ICON = (() => {
  const S = 24;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xfff2d8, 0x8a7558, 1.7));
  const l = new THREE.DirectionalLight(0xffffff, 2.6);
  l.position.set(2, 4, 5);
  sc.add(l);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  const targets = {}; // one render target per icon size
  const target = (n) => targets[n] ??= (() => {
    const rt = new THREE.WebGLRenderTarget(n, n);
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const cv = document.createElement('canvas');
    cv.width = cv.height = n;
    return { rt, cv, ctx: cv.getContext('2d'), buf: new Uint8Array(n * n * 4) };
  })();
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  const sz = new THREE.Vector3();
  function snap(obj, { yaw = 0.5, pitch = 0.25, center, r, size = S, over, edge = [26, 15, 11, 255] } = {}) {
    const { rt, cv, ctx, buf } = target(size);
    sc.add(obj);
    obj.updateMatrixWorld(true);
    box.setFromObject(obj).getCenter(c);
    box.getSize(sz);
    if (center) c.copy(center);
    const rad = r ?? Math.max(sz.x, sz.y, sz.z) * 0.6; // room for the outline
    const d = rad / Math.tan(THREE.MathUtils.degToRad(15));
    cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
    cam.lookAt(c);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(sc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    renderer.setRenderTarget(null);
    sc.remove(obj);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // flip rows
    const px = img.data;
    const solid = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) {
      solid[i] = px[i * 4 + 3] > 90 ? 1 : 0;
      px[i * 4 + 3] = solid[i] * 255;
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (solid[i] || !((x > 0 && solid[i - 1]) || (x < size - 1 && solid[i + 1]) || (y > 0 && solid[i - size]) || (y < size - 1 && solid[i + size]))) continue;
        px.set(edge, i * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    over?.(ctx, size);
    return cv.toDataURL();
  }
  const out = { hero: {}, face: {}, weapon: {}, relic: {} };
  for (const id in HEROES) {
    out.hero[id] = snap(HERO_RIGS[id].group, { yaw: 0.42, pitch: 0.1, size: 32 }); // the 3D model as a 32 px sprite
    if (SPRITES[id]) out.face[id] = spriteFace(id);
    else { // no sprite sheet: a close-up of the 3D model's head
      const top = new THREE.Box3().setFromObject(HERO_RIGS[id].group).max.y;
      out.face[id] = snap(HERO_RIGS[id].group, { yaw: 0.25, pitch: 0.05, size: 32, center: new THREE.Vector3(0, top - 0.2, 0.04), r: 0.3 });
    }
  }
  const item = (name) => M.solid(ASSETS.items[name], M.toon());
  for (const [id, w] of Object.entries(WEAPONS)) { // evolutions: the base weapon with a gold outline and a star
    out.weapon[id] = snap(item(`weapon_${w.from ?? id}`), w.evo
      ? { yaw: 0.6, pitch: 0.3, edge: [242, 193, 78, 255], over: (c, n) => c.drawImage(EMBLEMS.star, n - EMBLEMS.star.width, 0) }
      : { yaw: 0.6, pitch: 0.3 });
  }
  out.pickup = Object.fromEntries(PICKUPS.map((p) => [p.id, snap(item(`pick_${p.id}`), { yaw: 0.5, pitch: 0.35 })]));
  for (const id in RELICS) out.relic[id] = snap(item(`relic_${id}`), { yaw: 0.6, pitch: 0.35 });
  out.scroll = snap(item('scroll'), { yaw: 0.4, pitch: 0.2 });
  out.scrolls = {};
  for (const id in SCROLLS) {
    const e = EMBLEMS[id];
    out.scrolls[id] = snap(item('scroll'), { yaw: 0.4, pitch: 0.2, over: (c, n) => c.drawImage(e, Math.round((n - e.width) / 2), Math.round((n - e.height) / 2) + 1) });
  }
  return out;
})();
const iconImg = (src) => `<img class="icon" src="${src}" alt="">`;

// ---------- Player ----------
const P = {
  hero: null,
  pos: new THREE.Vector3(0, terrainH(0, 0), 0),
  vel: new THREE.Vector3(),
  grounded: true, ground: 0, groundTime: 1, coyote: 0, jumpBuffer: 0,
  sliding: false, slideCd: 0, airJumps: 0, wishX: 0, wishZ: 0, faceX: 0, faceZ: -1,
  st: null, weapons: [], relics: [],
  hp: 100, fe: 0, gold: 0, level: 1, xp: 0, xpNext: 5, kills: 0, iframes: 0, hurtT: 0,
  stacks: 0, shotCount: 0, specialCd: 0, dashT: 0, dashX: 0, dashZ: 0, dashSpeed: 0, dashId: 0, harpT: 0, attackT: 0, castT: 0,
  sunT: 0, miracles: 0, conquests: 0, // Josué: the sun standing still, and stones/chests taken
};
const moveSpeed = () => HEROES[P.hero].speed * (1 + P.st.speed);
const pickupR = () => 3.5 * (1 + P.st.pickup);
const globalDmg = () => (1 + P.st.dmg) * (P.hero === 'sansao' ? 1 + P.stacks / 100 : 1)
  * (P.hero === 'josue' ? 1 + Math.min(0.8, 0.08 * P.conquests) : 1);

const player = new THREE.Group();
scene.add(player);
let heroRig = null;
const shadowBlob = mesh(new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
scene.add(shadowBlob);

function setHero(id) {
  if (heroRig) player.remove(heroRig.group);
  heroRig = HERO_RIGS[id];
  player.add(heroRig.group);
  for (const [k, a] of Object.entries(heroRig.act)) { // locomotion loops blend by weight; attack and cast fire once
    a.stop();
    if (k === 'attack' || k === 'cast') {
      a.setLoop(THREE.LoopOnce, 1);
      a.setEffectiveWeight(k === 'cast' ? 3 : 2);
    } else a.play().setEffectiveWeight(k === 'idle' ? 1 : 0);
  }
  heroRig.w = { idle: 1, walk: 0, jump: 0, slide: 0 };
  player.position.set(0, terrainH(0, 0), 0);
  player.rotation.set(0, 0, 0);
}

// ---------- State ----------
let state = 'menu'; // menu | setup | settings | howto | play | pause | choice | end
let prevScreen = 'menu';
let runStarted = false;
let selHero = HEROES[params.get('hero')] && isOpen('hero', params.get('hero')) ? params.get('hero') : 'davi';
let time = 0;
let night = 0;
let wasNight = false;
let flowTimer = 0;
let spawnAcc = 0;
let pendingLevels = 0;
let choice = null;
let combo = 0;
let comboT = 0;
let shake = 0;
let lastHitSound = 0;
let elitesSpawned = 0;
let stonesDone = 0;
let chestsOpened = 0;
let feReady = false;
let nextCarrier = 75; // a treasure carrier every 150 s
let nextEvent = 120; // the map's own event every 150 s
let challenge = null; // the sealed chest being fought for: { c, t, wave }
let dustT = 0; // wind over the bones: dust closes in
let glintsGot = 0;
let promptText = '';
let orbitCount = 0;
let auraRadius = 0;
const boss = { spawned: false, enraged: false, idx: -1, st: 'walk', t: 0, n: 0, dx: 0, dz: 1, moving: false };
const spear = { on: false, x: 0, y: 0, z: 0, dx: 0, dz: 0, life: 0, dmg: 0 };
const miracles = [];

// ---------- Camera & input ----------
let yaw = 0;
let pitch = 0.5;
let camIdle = 0;
let dragging = false;
const keys = new Set();

function turnCamera(dx, dy) {
  yaw -= dx * 0.0025 * cfg.sens;
  pitch = clamp(pitch + dy * 0.0025 * cfg.sens * (cfg.invertY ? -1 : 1), -0.1, 1.3);
  camIdle = 0;
}
addEventListener('keydown', (e) => {
  const typing = document.activeElement?.tagName === 'INPUT';
  if (!typing) keys.add(e.code);
  if ((e.code === 'Space' || e.code.startsWith('Arrow')) && !typing) e.preventDefault();
  if (state !== 'play' && state !== 'choice' && !typing && e.code.startsWith('Arrow')) navMove(e.code === 'ArrowUp' || e.code === 'ArrowLeft' ? -1 : 1);
  if (e.code === 'Space' && !e.repeat) P.jumpBuffer = 0.15;
  if (e.repeat) return;
  if (state === 'choice') {
    if (/^Digit[1-4]$/.test(e.code)) pick(Number(e.code.slice(5)) - 1);
    if (e.code === 'KeyR') reroll();
  } else if (state === 'play') {
    if (e.code === 'KeyE') useSpecial();
    if (e.code === 'KeyQ') useMiracle();
    if (e.code === 'Escape' || e.code === 'KeyP') pause();
    if (e.code === 'KeyK') for (let i = 0; i < 100; i++) spawnEnemy(0);
  } else if (state === 'pause' && e.code === 'Escape') resume();
});
addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', (e) => {
  if (state !== 'play') return;
  if (e.button === 2) return useMiracle();
  if (cfg.lockMouse && document.pointerLockElement !== canvas) lock();
  dragging = true; // without pointer lock: drag to turn
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (state === 'play' && (document.pointerLockElement === canvas || dragging)) turnCamera(e.movementX, e.movementY);
});
addEventListener('wheel', (e) => {
  if (state !== 'play') return;
  cfg.camDist = clamp(cfg.camDist + e.deltaY * 0.01, 5, 14);
  saveCfg();
}, { passive: true });

function lock() {
  try {
    canvas.requestPointerLock()?.catch?.(() => {});
  } catch {}
}
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hadLock = true;
  else if (state === 'play' && hadLock) pause();
});

// ---------- Screens ----------
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
  const first = id && document.querySelector(`#${id} .nav .btn`);
  if (first) setCur(first);
}
// Menu cursor: the current line of a .nav list gets .cur (mouse over, focus or arrow keys).
function setCur(btn) {
  btn.closest('.nav').querySelectorAll('.cur').forEach((b) => b.classList.remove('cur'));
  btn.classList.add('cur');
}
function navMove(dir) {
  const btns = [...document.querySelectorAll('.screen.on .nav .btn')].filter((b) => b.offsetParent);
  if (!btns.length) return;
  const at = btns.findIndex((b) => b.classList.contains('cur'));
  const next = btns[(at + dir + btns.length) % btns.length];
  setCur(next); // focus events wait while the window is in the background
  next.focus();
  beep(520, 0.03, 'square', 0.02);
}
for (const type of ['pointerover', 'focusin']) {
  document.addEventListener(type, (e) => { const b = e.target.closest?.('.nav .btn'); if (b && !b.classList.contains('cur')) setCur(b); });
}
function go(id) {
  if (id === 'settings' || id === 'howto') {
    if (state !== 'settings' && state !== 'howto') prevScreen = state;
    syncSettingsForm();
  }
  if (id === 'setup') renderSetup();
  if (id === 'trophies') renderTrophies();
  state = id;
  show(id);
  beep(660, 0.05, 'triangle', 0.03);
}
document.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => (prevScreen === 'pause' ? pause() : go(prevScreen)); });
function resume() {
  state = 'play';
  show(null);
  if (cfg.lockMouse) lock();
}
function pause() {
  state = 'pause';
  renderBuild();
  show('pause');
}
$('resume').onclick = resume;
const reload = (q) => { location.search = new URLSearchParams(q).toString(); };
$('quit').onclick = () => reload({ biome: BIOME_ID });
$('to-menu').onclick = () => reload({ biome: BIOME_ID });
$('again').onclick = () => reload({ biome: BIOME_ID, hero: P.hero, screen: 'setup' });
$('reroll').onclick = () => reroll();
$('go').onclick = () => startRun();
addEventListener('pointerdown', () => audio(), { once: true });

// Locked heroes and maps show as dark silhouettes with a padlock; clicking says which trophy opens them.
function lockedHint(key) {
  $('lock-hint').textContent = `${unlockName(key)} está bloqueado. Para abrir: ${TROPHIES[unlockedBy(key)].desc}`;
  beep(180, 0.12, 'square', 0.03);
}
function renderSetup() {
  $('lock-hint').textContent = '';
  $('heroes').replaceChildren(...Object.entries(HEROES).map(([id, h]) => {
    const b = document.createElement('button');
    const open = isOpen('hero', id);
    b.className = `opt well${id === selHero ? ' sel' : ''}${open ? '' : ' locked'}`;
    b.innerHTML = `${iconImg(ICON.hero[id])}<b>${h.name}</b><small>${open ? h.role : 'Bloqueado'}</small>`;
    b.onclick = () => {
      if (!open) return lockedHint(`hero:${id}`);
      selHero = id;
      setHero(id);
      renderSetup();
      beep(520, 0.06, 'triangle', 0.03);
    };
    return b;
  }));
  const h = HEROES[selHero];
  const w = WEAPONS[h.weapon];
  const bar = (label, v, kind = '') => `<div class="stat"><span>${label}</span><div class="bar ${kind}"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;
  const ab = (badge, name, text) => `<div class="ab">${badge}<div><em>${name}.</em> ${text}</div></div>`;
  $('hero-info').innerHTML = `
    ${bar('Vida', h.hp / 140, 'hp')}${bar('Velocidade', h.speed / 8.6)}
    ${ab(iconImg(ICON.weapon[h.weapon]), `Arma: ${w.name}`, w.desc)}
    ${ab('<img class="ico" src="assets/ui/star.png" alt="">', `Passiva: ${h.passive[0]}`, h.passive[1])}
    ${ab('<kbd class="k">E</kbd>', h.move[0], h.move[1])}
    ${ab('<kbd class="k">Q</kbd>', h.miracle[0], h.miracle[1])}`;
  $('biomes').replaceChildren(...Object.entries(BIOMES).map(([id, b]) => {
    const el = document.createElement('button');
    const open = isOpen('map', id);
    el.className = `opt biome well${id === BIOME_ID ? ' sel' : ''}${open ? '' : ' locked'}`;
    el.title = b.desc;
    el.innerHTML = `<div class="art ${id}"></div><div class="t"><b>${b.name}</b><small>${open ? b.ref : 'Bloqueado'}</small></div>`;
    el.onclick = () => {
      if (!open) return lockedHint(`map:${id}`);
      if (id !== BIOME_ID) reload({ biome: id, hero: selHero, screen: 'setup' });
    };
    return el;
  }));
}

function renderTrophies() {
  const ids = Object.keys(TROPHIES);
  $('trophy-count').textContent = `${ids.filter((id) => profile.trophies[id]).length} de ${ids.length} troféus`;
  $('trophy-grid').innerHTML = ids.map((id) => {
    const t = TROPHIES[id];
    const won = profile.trophies[id];
    const opens = t.unlock ? `<em>${won ? 'Desbloqueou' : 'Desbloqueia'}: ${unlockName(t.unlock)}</em>` : '';
    return `<div class="tro${won ? ' won' : ''}"><img class="icon" src="assets/ui/trophy-${won ? t.tier : 'off'}.png" alt="${TIERS[t.tier].name}">
      <div><b>${t.name}</b><small>${t.desc}</small>${opens}</div></div>`;
  }).join('');
}

function syncSettingsForm() {
  document.querySelectorAll('[data-cfg]').forEach((el) => {
    const k = el.dataset.cfg;
    if (el.type === 'checkbox') el.checked = cfg[k];
    else if (el.type === 'radio') el.checked = cfg[k] === el.value;
    else el.value = cfg[k];
  });
}
document.querySelectorAll('[data-cfg]').forEach((el) => el.addEventListener('input', () => {
  const k = el.dataset.cfg;
  cfg[k] = el.type === 'checkbox' ? el.checked : el.type === 'radio' ? el.value : Number(el.value);
  saveCfg();
  applyCfg();
}));
function applyCfg() {
  resize();
  sun.castShadow = cfg.shadows;
  if (master) master.gain.value = cfg.volume;
  $('fps').hidden = !cfg.fps;
}

function startRun() {
  const h = HEROES[selHero];
  P.hero = selHero;
  P.st = baseStats(h);
  P.hp = P.st.maxHp;
  P.weapons = [{ id: h.weapon, level: 1, timer: 0 }];
  refreshWeapons();
  if (!heroRig) setHero(selHero);
  P.pos.set(0, terrainH(0, 0), 0);
  yaw = 0;
  pitch = 0.5;
  audio();
  runStarted = true;
  M.shared.uFadeOn.value = 1;
  $('hud').hidden = false;
  $('hero-face').src = ICON.face[P.hero];
  $('hero-name').textContent = h.name;
  $('boss-name').textContent = B.boss;
  $('skill-e').querySelector('span').textContent = h.move[0];
  $('skill-q').querySelector('span').textContent = h.miracle[0];
  resume();
  toast('Siga as colunas de luz até as Pedras do Memorial', '#ffe08f');
}

function renderBuild() {
  const evoLine = (w) => {
    const e = EVOLUTIONS[w.id];
    if (!e) return '<small class="evo">Evoluída</small>';
    const has = P.relics.some((r) => r.id === e.needs);
    return `<small class="evo">Evolui: nível ${MAX_LEVEL} ${w.level >= MAX_LEVEL ? '✓' : `(${w.level}/${MAX_LEVEL})`} + ${RELICS[e.needs].name} ${has ? '✓' : ''} → ${WEAPONS[e.into].name}</small>`;
  };
  const w = P.weapons.map((w) => `<li>${iconImg(ICON.weapon[w.id])}<div>${WEAPONS[w.id].name} · nv ${w.level}<small>${WEAPONS[w.id].desc}</small>${evoLine(w)}</div></li>`).join('');
  const r = P.relics.map((r) => `<li>${iconImg(ICON.relic[r.id])}<div style="color:${RARITY[r.tier].color}">${RELICS[r.id].name}<small>${statText(RELICS[r.id], r.tier)} · ${RELICS[r.id].ref}</small></div></li>`).join('')
    || '<li><small>Abra baús de cedro para encontrar relíquias.</small></li>';
  $('pause-build').innerHTML = `<div><h3>Armas</h3><ul>${w}</ul></div><div><h3>Relíquias</h3><ul>${r}</ul></div>`;
}

// ---------- Sound: tiny WebAudio beeps through a master volume ----------
let actx = null;
let master = null;
function audio() {
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain();
    master.connect(actx.destination);
  }
  master.gain.value = cfg.volume;
  actx.resume();
}
function beep(freq, dur = 0.08, type = 'square', vol = 0.04, at = 0, to = 0) {
  if (!actx) return;
  const t = actx.currentTime + at;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}
const chord = (notes, type = 'sawtooth') => notes.forEach((f, k) => beep(f, 0.2, type, 0.04, k * 0.08));
let noiseBuf = null;
function boom(dur = 1.2, vol = 0.9, freq = 900) { // low rumble: filtered noise that fades out
  if (!actx) return;
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = actx.currentTime;
  const src = actx.createBufferSource();
  src.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(60, t + dur);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

function toast(text, color = '#fbf4e4', img) {
  const box = $('toasts');
  const d = document.createElement('div');
  d.className = 'toast glass';
  d.innerHTML = `${img ? iconImg(img) : ''}<span></span>`;
  d.lastChild.textContent = text;
  d.style.color = color;
  box.append(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 3200);
}

// ---------- Particles & damage numbers ----------
function burst(x, y, z, color, n, speed = 4, size = 0.14, up = 4) {
  for (let k = 0; k < n && PT.n < MAX_PARTS; k++) {
    const i = PT.n++;
    const a = random() * Math.PI * 2;
    const sp = speed * (0.4 + random() * 0.6);
    PT.x[i] = x;
    PT.y[i] = y;
    PT.z[i] = z;
    PT.vx[i] = Math.cos(a) * sp;
    PT.vz[i] = Math.sin(a) * sp;
    PT.vy[i] = up * (0.4 + random());
    PT.life[i] = PT.max[i] = 0.35 + random() * 0.4;
    PT.size[i] = size * (0.6 + random() * 0.8);
    PT.col[i] = color;
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PT.n; ) {
    PT.vy[i] -= 18 * dt;
    PT.x[i] += PT.vx[i] * dt;
    PT.y[i] += PT.vy[i] * dt;
    PT.z[i] += PT.vz[i] * dt;
    if ((PT.life[i] -= dt) <= 0) removeAt(PT, i);
    else i++;
  }
}
const dmgEls = Array.from({ length: 40 }, () => {
  const el = document.createElement('div');
  el.style.opacity = 0;
  $('dmg').append(el);
  return { el, t: 0, x: 0, y: 0, z: 0 };
});
let dmgNext = 0;
let dmgLast = 0;
function dmgNumber(x, y, z, v, crit, label) {
  if (!cfg.dmgNumbers || (!crit && !label && time - dmgLast < 0.04)) return;
  dmgLast = time;
  const d = dmgEls[dmgNext++ % dmgEls.length];
  Object.assign(d, { t: 0.8, x: x + (random() - 0.5) * 0.6, y, z });
  d.el.textContent = label ?? Math.round(v);
  d.el.className = crit ? 'crit' : '';
}
const _v = new THREE.Vector3();
function updateDmgNumbers(dt) {
  for (const d of dmgEls) {
    if (d.t <= 0) continue;
    d.t -= dt;
    d.y += dt * 1.8;
    _v.set(d.x, d.y, d.z).project(camera);
    if (_v.z > 1 || d.t <= 0) { d.el.style.opacity = 0; continue; }
    d.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
    d.el.style.opacity = Math.min(1, d.t * 3);
  }
}

// ---------- Player ----------
function updatePlayer(dt) {
  const v = P.vel;
  const p = P.pos;
  const ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const iz = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  let wx = -Math.sin(yaw) * iz + Math.cos(yaw) * ix; // wish direction, relative to camera
  let wz = -Math.cos(yaw) * iz - Math.sin(yaw) * ix;
  const wl = Math.hypot(wx, wz);
  if (wl) { wx /= wl; wz /= wl; }
  P.wishX = wx;
  P.wishZ = wz;
  const speed = moveSpeed();
  const hs = Math.hypot(v.x, v.z);
  const slideKey = keys.has('ShiftLeft') || keys.has('ShiftRight');
  P.slideCd -= dt;
  P.jumpBuffer -= dt;
  P.coyote -= dt;
  P.specialCd -= dt;

  if (P.dashT > 0) {
    P.dashT -= dt;
    v.x = P.dashX * P.dashSpeed;
    v.z = P.dashZ * P.dashSpeed;
  } else if (P.grounded) {
    if (slideKey && !P.sliding && P.slideCd <= 0 && hs > 3) {
      P.sliding = true;
      const boost = Math.max(hs, speed * 1.6) / hs; // slide start = burst of speed
      v.x *= boost;
      v.z *= boost;
      burst(p.x, p.y + 0.1, p.z, 0xcbb89a, 6, 3, 0.12, 1.5);
    }
    if (P.sliding && (!slideKey || hs < speed * 0.5)) { P.sliding = false; P.slideCd = 0.4; }
    if (P.sliding) {
      const [gx, gz] = slope(p.x, p.z);
      v.x -= gx * GRAVITY * dt; // downhill pulls, uphill brakes
      v.z -= gz * GRAVITY * dt;
      const f = Math.exp(-1.2 * dt);
      v.x = v.x * f + wx * 5 * dt;
      v.z = v.z * f + wz * 5 * dt;
    } else if (!(P.groundTime < 0.12 && hs > speed)) { // bhop grace: no braking right after landing
      const tx = wx * speed - v.x;
      const tz = wz * speed - v.z;
      const tl = Math.hypot(tx, tz);
      const a = 70 * dt;
      if (tl <= a) { v.x += tx; v.z += tz; } else { v.x += (tx / tl) * a; v.z += (tz / tl) * a; }
    }
  } else {
    // Air: keep momentum, only add speed up to walk speed along the wish direction.
    const add = speed - (v.x * wx + v.z * wz);
    if (wl && add > 0) {
      const a = Math.min(add, 30 * dt);
      v.x += wx * a;
      v.z += wz * a;
    }
  }

  const wantJump = P.jumpBuffer > 0 || keys.has('Space'); // holding Space = auto bunny hop
  if (wantJump && (P.grounded || P.coyote > 0)) {
    v.y = JUMP;
    P.grounded = false;
    P.coyote = 0;
    P.jumpBuffer = 0;
    P.sliding = false;
  } else if (P.jumpBuffer > 0 && !P.grounded && P.airJumps > 0) {
    v.y = JUMP * 0.9;
    P.airJumps--;
    P.jumpBuffer = 0;
    burst(p.x, p.y, p.z, 0xffffff, 8, 3, 0.1, -1);
  }

  const hs2 = Math.hypot(v.x, v.z);
  if (hs2 > MAX_SPEED) { v.x *= MAX_SPEED / hs2; v.z *= MAX_SPEED / hs2; }
  v.y -= GRAVITY * dt;
  p.addScaledVector(v, dt);

  // Collider sides push out; low rock tops are floor.
  for (const o of obstacles) {
    const dx = p.x - o.x;
    const dz = p.z - o.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const min = o.r + 0.4;
    if (d >= min || p.y >= o.top - 0.3) continue;
    const nx = dx / d;
    const nz = dz / d;
    p.x = o.x + nx * min;
    p.z = o.z + nz * min;
    const vn = v.x * nx + v.z * nz;
    if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
  }
  const rr = Math.hypot(p.x, p.z); // world edge: hills or the sea
  if (rr > B.radius - 1) {
    p.x *= (B.radius - 1) / rr;
    p.z *= (B.radius - 1) / rr;
  }

  let g = terrainH(p.x, p.z);
  for (const o of obstacles) {
    if (p.y >= o.top - 0.3 && Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.4) g = Math.max(g, o.top);
  }
  P.ground = g;
  if (p.y <= g || (P.grounded && v.y <= 0 && p.y - g < 0.4)) {
    if (!P.grounded) {
      P.groundTime = 0;
      P.airJumps = P.st.airJumps;
      if (v.y < -12) burst(p.x, g + 0.1, p.z, 0xcbb89a, 8, 3, 0.12, 1.5);
    }
    p.y = g;
    v.y = 0;
    P.grounded = true;
    P.groundTime += dt;
  } else {
    if (P.grounded) P.coyote = 0.1;
    P.grounded = false;
    gainFe(1.2 * dt); // time in the air feeds Fé
  }
  if (hs > 0.5) { P.faceX = v.x / hs; P.faceZ = v.z / hs; }
  P.hp = Math.min(P.st.maxHp, P.hp + (P.st.regen + (P.harpT > 0 ? 6 : 0)) * dt);
}

function hurt(dmg, fromX, fromZ) {
  if (P.iframes > 0 || state !== 'play') return;
  if (random() < P.st.dodge) { // Escudo de Abraão
    P.iframes = 0.3;
    burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xf2c14e, 8, 3, 0.1, 3);
    dmgNumber(P.pos.x, P.pos.y + 2, P.pos.z, 0, false, 'Esquiva');
    return;
  }
  P.hp -= dmg * (1 - Math.min(0.6, P.st.armor));
  P.iframes = 0.6;
  P.hurtT = 0.25;
  shake = 0.35;
  if (P.hero === 'sansao') P.stacks = Math.floor(P.stacks / 2);
  const dx = P.pos.x - fromX;
  const dz = P.pos.z - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  P.vel.x += (dx / d) * 6;
  P.vel.z += (dz / d) * 6;
  burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xe5534b, 6, 3);
  beep(110, 0.2, 'sawtooth', 0.06);
}

function gainFe(v) {
  P.fe = Math.min(100, P.fe + v * (1 + P.st.faith)); // Harpa de Davi
  if (P.fe >= 100 && !feReady) {
    feReady = true;
    toast(`Milagre pronto: ${HEROES[P.hero].miracle[0]} (Q)`, '#ffe08f');
    chord([523, 784]);
  }
}

// E: hero's special move. All three are dashes with different side effects (see dashHits).
function useSpecial() {
  if (P.specialCd > 0) return;
  let dx = P.wishX;
  let dz = P.wishZ;
  if (!dx && !dz) { dx = P.faceX; dz = P.faceZ; }
  const [speed, dur] = { davi: [24, 0.22], sansao: [26, 0.32], moises: [20, 0.32], josue: [24, 0.28], debora: [22, 0.3] }[P.hero];
  Object.assign(P, { dashX: dx, dashZ: dz, dashSpeed: speed, dashT: dur, sliding: false });
  P.dashId++;
  P.iframes = Math.max(P.iframes, dur + 0.12);
  P.specialCd = HEROES[P.hero].move[2] * Math.max(0.4, 1 - P.st.cd);
  burst(P.pos.x, P.pos.y + 0.2, P.pos.z, P.hero === 'moises' || P.hero === 'debora' ? 0x9fd8ff : 0xcbb89a, 10, 4, 0.13, 1);
  beep(260, 0.18, 'sawtooth', 0.04, 0, 900);
}

function dashHits() {
  if (P.dashT <= 0 || P.hero === 'davi') return;
  if (P.hero === 'debora' && random() < 0.6) burst(P.pos.x, P.pos.y + 0.3, P.pos.z, 0x9fd8ff, 2, 3, 0.14, 2); // the torrent of Kishon
  const n = hash.query(P.pos.x, P.pos.z, 2.2 + MAX_R, near);
  for (let q = 0; q < n; q++) {
    const j = near[q];
    if (E.mark[j] === P.dashId || E.hp[j] <= 0) continue;
    const ex = E.x[j] - P.pos.x;
    const ez = E.z[j] - P.pos.z;
    if (Math.hypot(ex, ez) > 2.2 + E.r[j]) continue;
    E.mark[j] = P.dashId;
    if (P.hero === 'sansao') damage(j, 40, P.dashX, P.dashZ, 16);
    else if (P.hero === 'josue') { // Avançar: rams through and leaves them dazed
      damage(j, 25, P.dashX, P.dashZ, 10);
      if (!ENEMIES[E.type[j]].boss) E.stun[j] = Math.max(E.stun[j], 1.2);
    } else { // Moisés and Débora: a wave that sweeps them aside
      const side = ex * -P.dashZ + ez * P.dashX >= 0 ? 1 : -1;
      damage(j, 8, -P.dashZ * side, P.dashX * side, 18);
    }
  }
}

// Q: Milagre, costs a full Fé bar. Aimed where the camera looks.
function useMiracle() {
  if (P.fe < 100) return;
  P.fe = 0;
  feReady = false;
  P.castT = 0.8;
  const dx = -Math.sin(yaw);
  const dz = -Math.cos(yaw);
  const { x, z } = P.pos;
  const y = terrainH(x, z);
  P.miracles++;
  if (P.miracles >= 5) award('maos');
  if (P.hero === 'davi') P.harpT = 6 * (1 + P.st.dur);
  else if (P.hero === 'josue') { // "Sun, stand still" (Js 10:13): enemies freeze in time
    P.sunT = 7 * (1 + P.st.dur);
    toast('O sol parou!', '#ffe08f');
  } else if (P.hero === 'debora') { // "The stars fought from heaven" (Jz 5:20)
    const m = nearestEnemies(x, z, 16, 26, -1);
    for (let k = 0; k < 30; k++) {
      const t = m ? targets[k % m] : -1;
      const sx = t >= 0 ? E.x[t] + (random() - 0.5) * 2 : x + (random() - 0.5) * 30;
      const sz = t >= 0 ? E.z[t] + (random() - 0.5) * 2 : z + (random() - 0.5) * 30;
      addStrike(sx, sz, 2.2, 70, 0.25 + k * 0.08, 2);
    }
  } else {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(dx, dz); // local +Z = forward
    const parts = [];
    const groundAt = (px, pz) => Math.max(terrainH(px, pz), obstacleAt(px, pz)?.top ?? -1e9); // terrain or a rock top
    for (const side of [-1, 1]) {
      const bx = x + dz * side * 2.2; // the pillar's base, beside the hero (local +X = right of forward)
      const bz = z - dx * side * 2.2;
      if (P.hero === 'sansao') {
        const pivot = new THREE.Group(); // pillar falls forward around its base
        const by = terrainH(bx, bz);
        pivot.position.set(side * 2.2, by - y, 0);
        const col = M.solid(ASSETS.props.prop_column, M.toon());
        col.scale.set(1.8, 4.2, 1.8);
        pivot.add(col);
        // Where does it land? It stops at the first slope or rock it would cut into.
        const len = 3.85 * 4.2;
        pivot.userData.stop = Math.PI / 2;
        for (let a = 0.05; a <= Math.PI / 2 + 1e-6; a += 0.05) {
          let hit = false;
          for (let s = 2; s <= len && !hit; s += 1) hit = by + s * Math.cos(a) - 0.5 < groundAt(bx + dx * s * Math.sin(a), bz + dz * s * Math.sin(a));
          if (hit) { pivot.userData.stop = a - 0.05; break; }
        }
        parts.push(pivot);
      } else {
        // Each water wall is a row of blocks standing on the ground beneath it.
        const wall = new THREE.Group();
        const mat = glow(0x3d8bd9, 0.55);
        wall.userData.mat = mat;
        wall.position.x = side * 5.5;
        const n = 12;
        const seg = new THREE.BoxGeometry(5, 4.6, 34 / n + 0.05);
        for (let k = 0; k < n; k++) {
          const lz = (k + 0.5) * (34 / n);
          const gy = terrainH(x + dz * side * 5.5 + dx * lz, z - dx * side * 5.5 + dz * lz);
          wall.add(mesh(seg, mat, 0, gy - y + 2, lz));
        }
        parts.push(wall);
      }
    }
    g.add(...parts);
    scene.add(g);
    miracles.push({ kind: P.hero, x, z, dx, dz, t: 0, hit: false, g, parts });
  }
  shake = 0.4;
  burst(x, y + 1, z, 0xffe08f, 24, 6, 0.15, 6);
  chord([392, 523, 659, 784], 'triangle');
}

// Enemy inside the miracle's rectangle? Returns its lateral offset, or null.
function inRect(m, i, len, halfW) {
  const ex = E.x[i] - m.x;
  const ez = E.z[i] - m.z;
  const along = ex * m.dx + ez * m.dz;
  const lat = ex * -m.dz + ez * m.dx;
  return along >= -1 && along <= len && Math.abs(lat) <= halfW + E.r[i] ? lat : null;
}

function updateMiracles(dt) {
  if (P.sunT > 0) { // the sun stands still: everyone but the boss is frozen, the boss slowed
    P.sunT -= dt;
    for (let i = 0; i < E.n; i++) {
      if (ENEMIES[E.type[i]].boss) E.slow[i] = 0.3;
      else E.stun[i] = Math.max(E.stun[i], 0.15);
    }
  }
  if (P.harpT > 0) {
    const r = 7 * (1 + P.st.area);
    const n = hash.query(P.pos.x, P.pos.z, r + MAX_R, near);
    for (let q = 0; q < n; q++) {
      const j = near[q];
      if (Math.hypot(E.x[j] - P.pos.x, E.z[j] - P.pos.z) < r) E.slow[j] = 0.25;
    }
  }
  for (let k = miracles.length - 1; k >= 0; k--) {
    const m = miracles[k];
    m.t += dt;
    if (m.kind === 'sansao') {
      const fall = Math.min(1, m.t / 0.45);
      for (const pv of m.parts) pv.rotation.x = Math.min(pv.userData.stop, (fall * fall * Math.PI) / 2);
      if (!m.hit && fall >= 1) {
        m.hit = true;
        for (let i = 0; i < E.n; i++) if (inRect(m, i, 17, 3.6) !== null) damage(i, 260);
        for (let s = 0; s < 8; s++) burst(m.x + m.dx * s * 2, terrainH(m.x, m.z) + 0.5, m.z + m.dz * s * 2, 0xd8cfbe, 6, 5, 0.2, 5);
        shake = 0.9;
        beep(70, 0.5, 'sawtooth', 0.08);
      }
    } else if (m.t < 3) {
      // The sea opens: enemies in the corridor are shoved into the water walls and stuck there.
      for (let i = 0; i < E.n; i++) {
        const lat = inRect(m, i, 34, 8);
        if (lat === null || ENEMIES[E.type[i]].boss) continue;
        E.slow[i] = 0.2;
        if (Math.abs(lat) < 3.2) {
          const shift = (lat >= 0 ? 3.2 : -3.2) - lat;
          E.x[i] += -m.dz * shift;
          E.z[i] += m.dx * shift;
        }
      }
    } else {
      const close = Math.min(1, (m.t - 3) / 0.3);
      m.parts.forEach((w, s) => { w.position.x = (s ? 1 : -1) * (5.5 - 3 * close); w.userData.mat.opacity = 0.55 * (1 - close * 0.6); });
      if (!m.hit) {
        m.hit = true;
        for (let i = 0; i < E.n; i++) {
          if (inRect(m, i, 34, 8) === null) continue;
          damage(i, 220);
          if (!ENEMIES[E.type[i]].boss) E.stun[i] = 1;
        }
        for (let s = 0; s < 10; s++) burst(m.x + m.dx * s * 3.4, terrainH(m.x, m.z) + 1, m.z + m.dz * s * 3.4, 0x9fd8ff, 8, 6, 0.18, 6);
        shake = 0.8;
        beep(90, 0.6, 'sawtooth', 0.07, 0, 40);
      }
    }
    if (m.t > (m.kind === 'sansao' ? 1.6 : 3.8)) {
      scene.remove(m.g);
      miracles.splice(k, 1);
    }
  }
}

// Moisés: a plague on every level-up.
const PLAGUES = ['Granizo', 'Trevas', 'Úlceras'];
function plague() {
  const kind = Math.floor(random() * 3);
  toast(`Praga: ${PLAGUES[kind]}!`, '#9fe8ff');
  for (let i = 0; i < E.n; i++) {
    if (Math.hypot(E.x[i] - P.pos.x, E.z[i] - P.pos.z) > 25) continue;
    if (kind === 0 && random() < 0.5) addStrike(E.x[i], E.z[i], 2, 30, 0.4 + random() * 0.6);
    if (kind === 1 && !ENEMIES[E.type[i]].boss) E.stun[i] = 3;
    if (kind === 2) E.burn[i] = 5;
  }
}

// ---------- Damage ----------
function damage(i, base, kx = 0, kz = 0, knock = 0, forceCrit = false) {
  const type = ENEMIES[E.type[i]];
  let dmg = base * globalDmg();
  if (P.hero === 'davi' && (type.big || E.elite[i])) dmg *= 1.5;
  const crit = forceCrit || random() < P.st.crit;
  if (crit) dmg *= 2 + P.st.critDmg; // Tábuas da Lei
  E.hp[i] -= dmg;
  E.flash[i] = 0.1;
  if (knock && type.mass) {
    const d = Math.hypot(kx, kz) || 1;
    const k = knock * type.mass * (E.elite[i] ? 0.4 : 1);
    E.kx[i] += (kx / d) * k;
    E.kz[i] += (kz / d) * k;
  }
  if (P.st.burn && random() < P.st.burn) E.burn[i] = 3;
  dmgNumber(E.x[i], E.y[i] + E.h[i] + 0.2, E.z[i], dmg, crit || base >= 100);
  if (crit) burst(E.x[i], E.y[i] + E.h[i] * 0.6, E.z[i], 0xffe08f, 4, 3, 0.1);
  if (time - lastHitSound > 0.04) {
    beep(140 + random() * 40, 0.05, 'square', 0.03);
    lastHitSound = time;
  }
}

// ---------- Enemies ----------
// Puts enemy i on a ring around the player, mostly ahead when the player is moving.
function placeOnRing(i) {
  for (let t = 0; t < 12; t++) {
    let a = random() * Math.PI * 2;
    if (Math.hypot(P.vel.x, P.vel.z) > 2 && random() < 0.7) a = Math.atan2(P.vel.z, P.vel.x) + (random() - 0.5) * 1.6;
    const r = 34 + random() * 10;
    const x = P.pos.x + Math.cos(a) * r;
    const z = P.pos.z + Math.sin(a) * r;
    if (!walkable(x, z) || flow.blocked[flow.index(x, z)]) continue;
    E.x[i] = x;
    E.z[i] = z;
    E.y[i] = terrainH(x, z);
    E.kx[i] = 0;
    E.kz[i] = 0;
    return true;
  }
  return false;
}

function spawnEnemy(type, x, z) {
  if (E.n >= MAX_ENEMIES) return -1;
  const i = E.n;
  if (x === undefined) {
    if (!placeOnRing(i)) return -1;
  } else {
    E.x[i] = x;
    E.z[i] = z;
    E.y[i] = terrainH(x, z);
    E.kx[i] = E.kz[i] = 0;
  }
  E.n++;
  const t = ENEMIES[type];
  E.type[i] = type;
  E.elite[i] = 0;
  E.hp[i] = E.maxhp[i] = t.boss ? t.hp : t.hp * (1 + time / 120) * (night > 0.5 ? 1.2 : 1);
  E.spd[i] = t.speed + random() * t.speedVar;
  E.r[i] = t.r;
  E.h[i] = t.h;
  E.flash[i] = E.slow[i] = E.stun[i] = E.burn[i] = E.st[i] = E.t[i] = E.mark[i] = E.face[i] = 0;
  E.cd[i] = 1 + random() * 2;
  return i;
}

function spawnElite() {
  const i = spawnEnemy(3);
  if (i < 0) return;
  E.elite[i] = 1;
  E.hp[i] = E.maxhp[i] *= 6;
  E.r[i] *= 1.4;
  E.h[i] *= 1.4;
  toast(B.elite, '#ffd66b');
}

// Treasure carrier: runs from the hero; catch it within 25 s for siclos and supplies.
function spawnCarrier() {
  const i = spawnEnemy(0);
  if (i < 0) return;
  E.elite[i] = 2;
  E.hp[i] = E.maxhp[i] *= 5;
  E.spd[i] = 6.4;
  E.t[i] = 25;
  toast(B.carrier, '#ffd66b');
}
// Each map's own event (see BIOMES[id].event).
function mapEvent() {
  toast(B.event, '#ff9a8a');
  beep(98, 0.9, 'sawtooth', 0.07, 0, 147);
  const a = random() * Math.PI * 2;
  const fx = Math.cos(a);
  const fz = Math.sin(a);
  const cx = P.pos.x + fx * 30;
  const cz = P.pos.z + fz * 30;
  const at = (k, n, gap) => {
    const off = (k - (n - 1) / 2) * gap;
    const x = cx - fz * off;
    const z = cz + fx * off;
    return walkable(x, z) && !flow.blocked[flow.index(x, z)] ? [x, z] : null;
  };
  if (BIOME_ID === 'jerico') { // guards pour out of both gates
    for (const g of world.gates) {
      for (let k = 0; k < 13; k++) {
        const x = g.x + (random() - 0.5) * 6;
        const z = g.z + (random() - 0.5) * 6;
        if (walkable(x, z) && !flow.blocked[flow.index(x, z)]) spawnEnemy(k === 12 ? 2 : k % 4 === 3 ? 1 : 0, x, z);
      }
      burst(g.x, terrainH(g.x, g.z) + 1, g.z, 0xcbb89a, 20, 5, 0.2, 4);
    }
  } else if (BIOME_ID === 'ela') { // the Philistine line advances (1 Sm 17:21)
    for (let k = 0; k < 30; k++) {
      const p = at(k, 30, 1.8);
      if (p) spawnEnemy(k % 5 === 2 ? 1 : 0, ...p);
    }
  } else if (BIOME_ID === 'mar') { // a row of chariots charging across the island
    for (let k = 0; k < 9; k++) {
      const p = at(k, 9, 3.5);
      if (!p) continue;
      const i = spawnEnemy(2, ...p);
      if (i < 0) continue;
      E.st[i] = 2;
      E.t[i] = 2.6;
      E.dx[i] = -fx;
      E.dz[i] = -fz;
    }
  } else { // the wind blows and the nearest heaps of bones stand up (Ez 37:9-10)
    dustT = 16;
    const piles = [...world.bonePiles].sort((p, q) => Math.hypot(p.x - P.pos.x, p.z - P.pos.z) - Math.hypot(q.x - P.pos.x, q.z - P.pos.z)).slice(0, 5);
    for (const pile of piles) {
      burst(pile.x, terrainH(pile.x, pile.z) + 0.5, pile.z, 0xe6dcc2, 16, 4, 0.18, 5);
      for (let k = 0; k < 5; k++) {
        const x = pile.x + Math.cos(k * 1.26) * 1.6;
        const z = pile.z + Math.sin(k * 1.26) * 1.6;
        if (walkable(x, z)) spawnEnemy(k === 2 ? 1 : 0, x, z);
      }
    }
  }
}

function spawnBoss(enraged) {
  Object.assign(boss, { spawned: true, enraged, st: 'walk', t: 2.5, n: 0 });
  let x = 0;
  let z = 0;
  for (let t = 0; t < 40; t++) {
    const a = random() * Math.PI * 2;
    x = P.pos.x + Math.cos(a) * 22;
    z = P.pos.z + Math.sin(a) * 22;
    if (walkable(x, z) && !flow.blocked[flow.index(x, z)]) break;
  }
  const i = spawnEnemy(BOSS, x, z);
  if (enraged) E.hp[i] = E.maxhp[i] *= 1.3;
  bossRig.group.visible = true;
  $('bossbar').hidden = false;
  toast(enraged ? `O tempo acabou: ${B.boss} vem furioso!` : B.bossIntro, '#ff9a8a');
  burst(x, terrainH(x, z) + 1, z, 0xcbb89a, 30, 8, 0.25, 6);
  shake = 0.8;
  beep(55, 1.2, 'sawtooth', 0.08);
}

// Spawn budget: a gentle start that grows with the minutes and at night, coming in waves (45 s) with
// calmer gaps between them to raise stones and pray at altars. The alive cap keeps the screen readable.
const WAVE = 45;
function director(dt) {
  const wave = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos((time / WAVE) * Math.PI * 2));
  const k = (1 + night * 0.25) * (boss.spawned ? 0.5 : 1) * wave;
  const cap = Math.min(MAX_ENEMIES * 0.5, (14 + time * 0.5) * k);
  spawnAcc += dt * (0.8 + time / 40) * k;
  for (; spawnAcc >= 1; spawnAcc--) if (E.n < cap) spawnEnemy(pickWeighted(spawnWeights(time), random));
  if (elitesSpawned < 2 && time >= 180 * (elitesSpawned + 1)) { elitesSpawned++; spawnElite(); }
  if (!boss.spawned && time >= nextCarrier) { nextCarrier += 150; spawnCarrier(); }
  if (!boss.spawned && time >= nextEvent) { nextEvent += 150; mapEvent(); }
  if (!boss.spawned && time >= RUN_TIME) spawnBoss(true);
}

function enemyShot(x, y, z, dx, dz, dmg) {
  if (EP.n >= MAX_ESHOTS) return;
  const i = EP.n++;
  EP.x[i] = x;
  EP.y[i] = y;
  EP.z[i] = z;
  EP.vx[i] = dx * 13;
  EP.vz[i] = dz * 13;
  EP.life[i] = 3;
  EP.graze[i] = 0;
  EP.dmg[i] = dmg;
}

function updateEnemies(dt) {
  hash.build(E.x, E.z, E.n);
  const px = P.pos.x;
  const pz = P.pos.z;
  const decay = Math.exp(-8 * dt);
  const nightDmg = night > 0.5 ? 1.2 : 1;
  for (let i = 0; i < E.n; i++) {
    const type = ENEMIES[E.type[i]];
    E.flash[i] -= dt;
    if (E.burn[i] > 0) { E.burn[i] -= dt; E.hp[i] -= 8 * globalDmg() * dt; }
    if (type.boss) { updateBoss(i, dt); continue; }
    let x = E.x[i];
    let z = E.z[i];
    const dx = px - x;
    const dz = pz - z;
    const dist = Math.hypot(dx, dz) || 1e-3;
    if (E.elite[i] === 2 && (dist > 55 || (E.t[i] -= dt) <= 0)) { E.elite[i] = 3; E.hp[i] = 0; continue; } // the carrier got away
    if (dist > 60) { placeOnRing(i); continue; } // left behind: recycle ahead of the player
    E.cd[i] -= dt;
    E.slow[i] -= dt;
    E.stun[i] -= dt;

    const c = flow.index(x, z);
    let mx = flow.dirX[c];
    let mz = flow.dirZ[c];
    if (dist < 3 || (!mx && !mz)) { mx = dx / dist; mz = dz / dist; }
    let speed = E.spd[i];
    let face = Math.atan2(mx, mz);
    if (E.elite[i] === 2) { // treasure carrier: runs away, zigzagging
      const zig = Math.sin(time * 2 + i) * 0.5;
      mx = -dx / dist - (dz / dist) * zig;
      mz = -dz / dist + (dx / dist) * zig;
      face = Math.atan2(mx, mz);
    }

    if (type.ranged) {
      // Keep 11-17 m away, circle, and shoot at the player.
      if (dist < 11) { mx = -dx / dist; mz = -dz / dist; }
      else if (dist < 17) {
        const side = i & 1 ? 1 : -1;
        mx = (-dz / dist) * side;
        mz = (dx / dist) * side;
        speed *= 0.5;
      }
      face = Math.atan2(dx, dz);
      if (E.cd[i] <= 0 && dist < 20 && E.stun[i] <= 0) {
        enemyShot(x, E.y[i] + 1.1, z, dx / dist, dz / dist, type.dmg * nightDmg);
        E.cd[i] = 2.2 + random() * 1.5;
      }
    } else if (type.charger) {
      // 0 chase, 1 wind-up (glows orange), 2 charge in a straight line, 3 recover.
      if (E.st[i] === 0 && dist < 13 && E.cd[i] <= 0 && E.stun[i] <= 0) {
        E.st[i] = 1;
        E.t[i] = 0.7;
        E.dx[i] = dx / dist;
        E.dz[i] = dz / dist;
      }
      if (E.st[i] === 1) {
        speed = 0;
        face = Math.atan2(E.dx[i], E.dz[i]);
        if ((E.t[i] -= dt) <= 0) { E.st[i] = 2; E.t[i] = 0.55; }
      } else if (E.st[i] === 2) {
        mx = E.dx[i];
        mz = E.dz[i];
        speed = 17;
        face = Math.atan2(mx, mz);
        if (random() < 0.5) burst(x, E.y[i] + 0.1, z, 0xcbb89a, 1, 1.5, 0.15, 1);
        if ((E.t[i] -= dt) <= 0) { E.st[i] = 3; E.t[i] = 0.8; E.cd[i] = 3; }
      } else if (E.st[i] === 3) {
        speed *= 0.3;
        if ((E.t[i] -= dt) <= 0) E.st[i] = 0;
      }
    }
    if (E.stun[i] > 0) speed = 0;
    else if (E.slow[i] > 0) speed *= 0.4;

    // Separation: push out of overlapping neighbours.
    let sx = 0;
    let sz = 0;
    const m = hash.query(x, z, E.r[i] + MAX_R, near);
    for (let k = 0; k < m; k++) {
      const j = near[k];
      if (j === i) continue;
      const ox = x - E.x[j];
      const oz = z - E.z[j];
      const d2 = ox * ox + oz * oz;
      const rr = E.r[i] + E.r[j];
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const s = (rr - d) / d;
        sx += ox * s;
        sz += oz * s;
      }
    }
    const sl = Math.hypot(sx, sz);
    if (sl > 0.5) { sx *= 0.5 / sl; sz *= 0.5 / sl; }

    x += (mx * speed + E.kx[i]) * dt + sx * 0.3;
    z += (mz * speed + E.kz[i]) * dt + sz * 0.3;
    E.kx[i] *= decay;
    E.kz[i] *= decay;

    for (const id of obstaclesNear(x, z)) {
      const o = obstacles[id];
      const ox = x - o.x;
      const oz = z - o.z;
      const min = o.r + E.r[i];
      if (ox * ox + oz * oz >= min * min || E.y[i] > o.top - 0.3) continue;
      const d = Math.hypot(ox, oz) || 1e-3;
      x = o.x + (ox / d) * min;
      z = o.z + (oz / d) * min;
    }

    E.x[i] = x;
    E.z[i] = z;
    E.y[i] = terrainH(x, z);
    E.face[i] = face;
    const dy = P.pos.y - E.y[i];
    if (dist < E.r[i] + 0.45 && dy < E.h[i] && dy > -1.6) hurt(type.dmg * (E.elite[i] ? 1.5 : 1) * nightDmg, x, z);
  }
}

// Boss: walk, then spear throw (line), stomp (circle, jump to dodge) or call soldiers.
function updateBoss(i, dt) {
  const k = boss.enraged ? 1.4 : 1;
  const x0 = E.x[i];
  const z0 = E.z[i];
  const dx = P.pos.x - x0;
  const dz = P.pos.z - z0;
  const dist = Math.hypot(dx, dz) || 1e-3;
  boss.t -= dt * k;
  let move = 0;
  teleLine.visible = teleCircle.visible = false;
  if (boss.st === 'walk') {
    move = dist > 2.5 ? ENEMIES[BOSS].speed * k : 0;
    E.face[i] = Math.atan2(dx, dz);
    if (boss.t <= 0) {
      boss.n++;
      if (boss.n % 3 === 0) { boss.st = 'summon'; boss.t = 0.8; }
      else if (dist > 9) { boss.st = 'spear'; boss.t = 1.1; }
      else { boss.st = 'stomp'; boss.t = 1.2; }
    }
  } else if (boss.st === 'spear') {
    if (boss.t > 0.45) { // track the player, then lock the line
      boss.dx = dx / dist;
      boss.dz = dz / dist;
      E.face[i] = Math.atan2(dx, dz);
    }
    teleLine.visible = true;
    teleLine.position.set(x0 + boss.dx * 16, E.y[i] + 0.3, z0 + boss.dz * 16);
    teleLine.rotation.y = Math.atan2(boss.dx, boss.dz);
    teleLine.scale.set(1.8, 1, 32);
    if (boss.t <= 0) {
      Object.assign(spear, { on: true, x: x0, z: z0, dx: boss.dx, dz: boss.dz, life: 1, dmg: 35 * k });
      boss.st = 'rest';
      boss.t = 1;
      beep(200, 0.3, 'triangle', 0.05, 0, 80);
    }
  } else if (boss.st === 'stomp') {
    teleCircle.visible = true;
    teleCircle.position.set(x0, E.y[i] + 0.3, z0);
    teleCircle.scale.setScalar(7);
    if (boss.t <= 0) {
      if (dist < 7 && P.pos.y - P.ground < 0.5) hurt(30 * k, x0, z0);
      addFx(ringGeo, 0xd9483b, x0, 0.3, z0, 1, 0.4, { grow: 6, ground: true });
      for (let s = 0; s < 6; s++) burst(x0 + Math.cos(s) * 4, E.y[i] + 0.2, z0 + Math.sin(s) * 4, 0xcbb89a, 6, 6, 0.2, 4);
      shake = 0.7;
      beep(60, 0.4, 'sawtooth', 0.08);
      boss.st = 'rest';
      boss.t = 1.1;
    }
  } else if (boss.st === 'summon') {
    if (boss.t <= 0) {
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        spawnEnemy(B.summonChariots && s % 2 ? 2 : 0, x0 + Math.cos(a) * 3.5, z0 + Math.sin(a) * 3.5);
      }
      toast(B.summon, '#ff9a8a');
      boss.st = 'rest';
      boss.t = 0.6;
    }
  } else if (boss.t <= 0) {
    boss.st = 'walk';
    boss.t = 2.2;
  }
  if (teleLine.visible || teleCircle.visible) {
    teleLine.material.opacity = teleCircle.material.opacity = 0.25 + 0.2 * Math.sin(time * 20);
  }
  boss.moving = move > 0;
  let x = x0 + (dx / dist) * move * dt;
  let z = z0 + (dz / dist) * move * dt;
  for (const o of obstacles) {
    const ox = x - o.x;
    const oz = z - o.z;
    const d = Math.hypot(ox, oz) || 1e-3;
    if (d < o.r + 1.4) { x = o.x + (ox / d) * (o.r + 1.4); z = o.z + (oz / d) * (o.r + 1.4); }
  }
  E.x[i] = x;
  E.z[i] = z;
  E.y[i] = terrainH(x, z);
  if (dist < 1.9 && P.pos.y - E.y[i] < E.h[i]) hurt(25 * k, x, z);
}

function updateSpear(dt) {
  spearMesh.visible = spear.on;
  if (!spear.on) return;
  spear.x += spear.dx * 40 * dt;
  spear.z += spear.dz * 40 * dt;
  spear.y = terrainH(spear.x, spear.z) + 1; // hugs the ground: jump over it
  spear.life -= dt;
  if (Math.hypot(P.pos.x - spear.x, P.pos.z - spear.z) < 1.4 && Math.abs(P.pos.y + 0.9 - spear.y) < 1.4) {
    hurt(spear.dmg, spear.x - spear.dx, spear.z - spear.dz);
  }
  if (spear.life <= 0) spear.on = false;
  spearMesh.position.set(spear.x, spear.y, spear.z);
  spearMesh.rotation.y = Math.atan2(spear.dx, spear.dz);
}

function updateEnemyShots(dt) {
  for (let i = 0; i < EP.n; ) {
    EP.x[i] += EP.vx[i] * dt;
    EP.z[i] += EP.vz[i] * dt;
    EP.life[i] -= dt;
    const d = Math.hypot(P.pos.x - EP.x[i], P.pos.z - EP.z[i]);
    const dy = P.pos.y + 0.9 - EP.y[i];
    const wall = obstacleAt(EP.x[i], EP.z[i]);
    let dead = EP.life[i] <= 0 || (wall && EP.y[i] < wall.top);
    if (!dead && d < 0.6 && Math.abs(dy) < 1) {
      hurt(EP.dmg[i], EP.x[i], EP.z[i]);
      dead = true;
    } else if (!dead && !EP.graze[i] && d < 1.6 && Math.abs(dy) < 1.5 && P.iframes <= 0) {
      EP.graze[i] = 1; // near miss: skill feeds Fé
      gainFe(4);
      burst(EP.x[i], EP.y[i], EP.z[i], 0xffe08f, 3, 2, 0.08);
      beep(1400, 0.03, 'sine', 0.03);
    }
    if (dead) removeAt(EP, i);
    else i++;
  }
}

const DEATH = B.death;
function reapEnemies() {
  for (let i = 0; i < E.n; ) {
    if (E.hp[i] > 0) { i++; continue; }
    const type = ENEMIES[E.type[i]];
    const x = E.x[i];
    const y = E.y[i];
    const z = E.z[i];
    if (type.boss) {
      burst(x, y + 2, z, 0xffe08f, 60, 10, 0.3, 10);
      removeAt(E, i);
      win();
      return;
    }
    if (E.elite[i] === 3) { // a treasure carrier that got away
      burst(x, y + 1, z, 0xcbb89a, 10, 3, 0.2, 3);
      toast('O tesouro escapou...', '#9a8f80');
      removeAt(E, i);
      continue;
    }
    burst(x, y + E.h[i] * 0.5, z, DEATH[E.type[i]], 5, 3.5, 0.16);
    burst(x, y + 0.2, z, 0xcbb89a, 3, 2.5, 0.2, 2);
    dropGem(x, y + 0.4, z, type.xp * (night > 0.5 ? 2 : 1) * (E.elite[i] ? 10 : 1), 0);
    if (E.elite[i] === 2) { // treasure carrier caught
      for (let k = 0; k < 22; k++) dropGem(x + random() * 4 - 2, y + 0.4, z + random() * 4 - 2, 1, 1);
      dropPickup(x - 0.8, y + 0.5, z);
      dropPickup(x + 0.8, y + 0.5, z, 0);
      burst(x, y + 1, z, 0xf2c14e, 30, 6, 0.14, 7);
      toast('Tesouro recuperado!', '#ffd66b');
      award('tesouro');
      chord([784, 988, 1175], 'square');
    } else if (E.elite[i]) {
      const s = world.freeSpot(x, z); // never inside a rock or tree, where it could not be reached
      world.addChest(s.x, s.z, true);
      indexObstacle(obstacles.length - 1);
      for (let k = 0; k < 8; k++) dropGem(x + random() * 2 - 1, y + 0.4, z + random() * 2 - 1, 1, 1);
      dropPickup(x, y + 0.5, z);
    } else if (random() < 0.1) dropGem(x, y + 0.4, z, 1, 1);
    if (random() < 0.004) dropPickup(x, y + 0.5, z);
    P.hp = Math.min(P.st.maxHp, P.hp + P.st.vamp); // Favo de Mel
    P.kills++;
    gainFe(E.elite[i] ? 15 : 0.6);
    if (P.hero === 'sansao') P.stacks = Math.min(100, P.stacks + 1);
    removeAt(E, i);
  }
}

// ---------- Weapons ----------
const evoHinted = new Set();
function refreshWeapons() {
  for (const w of P.weapons) w.s = weaponStats(w.id, w.level, P.st);
  for (const w of readyToEvolve(P.weapons, P.relics)) { // tell once: the next chest evolves it
    if (evoHinted.has(w.id)) continue;
    evoHinted.add(w.id);
    toast(`${WEAPONS[w.id].name} pode evoluir: abra um baú!`, '#ffd66b', ICON.weapon[EVOLUTIONS[w.id].into]);
  }
}
// A weapon at its last level, holding its relic, becomes its evolution (Funda + Cinco Pedras Lisas...).
function evolve(w) {
  const from = WEAPONS[w.id];
  const evo = EVOLUTIONS[w.id];
  w.id = evo.into;
  w.level = MAX_LEVEL;
  w.swarm = null;
  refreshWeapons();
  const e = WEAPONS[w.id];
  banner(ICON.weapon[w.id], 'Evolução!', e.name, '#ffd66b', `${from.name} + ${RELICS[evo.needs].name}`, `${e.ref} · ${e.desc}`);
  award('evolucao');
  burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xffd66b, 40, 7, 0.16, 8);
  chord([523, 659, 784, 1046, 1318], 'square');
}

// Fills `targets` with the k nearest live enemies to (x, z); returns how many.
const targets = new Int32Array(16);
const targetD = new Float32Array(16);
function nearestEnemies(x, z, k, maxR, skip) {
  let m = 0;
  for (let i = 0; i < E.n; i++) {
    if (i === skip || E.hp[i] <= 0) continue;
    const d = (E.x[i] - x) ** 2 + (E.z[i] - z) ** 2;
    if (d > maxR * maxR || (m === k && d >= targetD[m - 1])) continue;
    let j = m < k ? m++ : k - 1;
    while (j > 0 && targetD[j - 1] > d) { targetD[j] = targetD[j - 1]; targets[j] = targets[j - 1]; j--; }
    targetD[j] = d;
    targets[j] = i;
  }
  return m;
}

// Davi aims at the boss's head (weak point); everyone else aims at the chest.
function aimShot(i, t) {
  const h = P.hero === 'davi' && E.type[t] === BOSS ? E.h[t] - 0.6 : E.h[t] * 0.5;
  const dx = E.x[t] - S.x[i];
  const dy = E.y[t] + h - S.y[i];
  const dz = E.z[t] - S.z[i];
  const d = Math.hypot(dx, dy, dz) || 1;
  S.vx[i] = (dx / d) * S.speed[i];
  S.vy[i] = (dy / d) * S.speed[i];
  S.vz[i] = (dz / d) * S.speed[i];
}

function fireShot(s, t, spread) {
  if (S.n >= MAX_SHOTS) return;
  const i = S.n++;
  S.x[i] = P.pos.x;
  S.y[i] = P.pos.y + 1.2;
  S.z[i] = P.pos.z;
  S.speed[i] = s.speed;
  aimShot(i, t);
  if (spread) {
    const c = Math.cos(spread);
    const sn = Math.sin(spread);
    const vx = S.vx[i];
    S.vx[i] = vx * c - S.vz[i] * sn;
    S.vz[i] = vx * sn + S.vz[i] * c;
  }
  S.life[i] = s.life;
  S.bounce[i] = s.bounce || 0;
  S.pierce[i] = s.pierce || 0;
  S.last[i] = -1;
  S.dmg[i] = s.dmg;
  S.seek[i] = s.kind === 'seeker' ? s.turn : 0;
  S.size[i] = s.size;
  S.kind[i] = PROJ.indexOf(s.proj);
  S.crit[i] = 0;
  S.ret[i] = s.kind === 'boomerang' ? s.range / s.speed : -1;
  if (s.kind === 'boomerang') S.pierce[i] = 999;
  S.glow[i] = s.evo ? 1 : 0;
  S.burn[i] = s.burn || 0;
  if (P.hero === 'davi' && ++P.shotCount % 5 === 0) { // Pedras Lisas
    S.dmg[i] *= 5;
    S.size[i] *= 1.7;
    S.crit[i] = 1;
  }
}

// Hits every enemy within r of (x, z) whose body spans height y.
function hitArea(x, y, z, r, dmg, knock = 0, burn = 0, stun = 0) {
  const n = hash.query(x, z, r + MAX_R, near);
  for (let q = 0; q < n; q++) {
    const j = near[q];
    if (E.hp[j] <= 0) continue;
    const ex = E.x[j] - x;
    const ez = E.z[j] - z;
    const rel = y - E.y[j];
    if (Math.hypot(ex, ez) >= r + E.r[j] || rel <= -2 || rel >= E.h[j] + 1.5) continue;
    damage(j, dmg, ex, ez, knock);
    if (burn) E.burn[j] = Math.max(E.burn[j], burn);
    if (stun && !ENEMIES[E.type[j]].boss) E.stun[j] = Math.max(E.stun[j], stun);
  }
}
// Like hitArea, but each enemy only once per sweep id (a chariot runs over everyone once).
function hitOnce(x, y, z, r, dmg, knock, id, dx, dz, burn) {
  const n = hash.query(x, z, r + MAX_R, near);
  for (let q = 0; q < n; q++) {
    const j = near[q];
    if (E.hp[j] <= 0 || E.sw[j] === id) continue;
    const ex = E.x[j] - x;
    const ez = E.z[j] - z;
    if (Math.hypot(ex, ez) >= r + E.r[j] || Math.abs(y - E.y[j]) > 3) continue;
    E.sw[j] = id;
    const side = ex * -dz + ez * dx >= 0 ? 1 : -1; // thrown aside, away from the wheels
    damage(j, dmg, dx - dz * side * 1.5, dz + dx * side * 1.5, knock);
    if (burn) E.burn[j] = Math.max(E.burn[j], burn);
  }
}

function updateWeapons(dt) {
  const px = P.pos.x;
  const py = P.pos.y;
  const pz = P.pos.z;
  orbitCount = 0;
  auraRadius = 0;
  swarmDraw.length = 0;
  for (const w of P.weapons) {
    const s = w.s;
    w.timer -= dt;
    if (s.kind === 'swarm') { updateSwarms(w, s, dt); continue; } // moves every frame, bites on its timer
    if (s.kind === 'shot' || s.kind === 'seeker' || s.kind === 'boomerang') {
      if (w.timer > 0) continue;
      const m = nearestEnemies(px, pz, Math.min(s.count, 16), s.range, -1);
      if (!m) continue;
      w.timer = s.cd;
      P.attackT = 0.3;
      for (let k = 0; k < s.count; k++) {
        const extra = k - m + 1; // more projectiles than targets: fan them out
        fireShot(s, targets[k % m], k < m ? 0 : extra * 0.15 * (k % 2 ? 1 : -1));
      }
      beep(240, 0.04, 'triangle', 0.02);
    } else if (s.kind === 'melee' || s.kind === 'cone') {
      if (w.timer > 0 || !nearestEnemies(px, pz, 1, s.radius + 1.5, -1)) continue;
      w.timer = s.cd;
      P.attackT = 0.3;
      const t = targets[0];
      let ax = E.x[t] - px;
      let az = E.z[t] - pz;
      const al = Math.hypot(ax, az) || 1;
      ax /= al;
      az /= al;
      if (s.kind === 'melee') { P.faceX = ax; P.faceZ = az; }
      const cosHalf = Math.cos(s.arc / 2);
      const n = hash.query(px, pz, s.radius + MAX_R, near);
      for (let q = 0; q < n; q++) {
        const j = near[q];
        if (E.hp[j] <= 0) continue;
        const ex = E.x[j] - px;
        const ez = E.z[j] - pz;
        const d = Math.hypot(ex, ez);
        if (d > s.radius + E.r[j] || Math.abs(E.y[j] - py) > 2.5) continue;
        if (d > 0.6 && (ex * ax + ez * az) / d < cosHalf) continue;
        damage(j, s.dmg, ex, ez, s.knock);
        if (s.stun && !ENEMIES[E.type[j]].boss) E.stun[j] = Math.max(E.stun[j], s.stun);
        if (s.burn) E.burn[j] = Math.max(E.burn[j], s.burn);
      }
      const melee = s.kind === 'melee';
      addFx(sectorGeo(s.arc), melee ? 0xfff4dc : 0xf2c14e, px, py + (melee ? 0.9 : 0.5), pz, melee ? s.radius : 2, 0.2,
        { rotY: Math.atan2(-az, ax), grow: melee ? 0 : s.radius / 2 - 1 });
      beep(melee ? 120 : 330, 0.12, melee ? 'square' : 'sawtooth', 0.04, 0, melee ? 60 : 500);
    } else if (s.kind === 'orbit') {
      const hitNow = w.timer <= 0;
      if (hitNow) w.timer = s.cd;
      for (let k = 0; k < s.count && orbitCount < MAX_ORBS; k++) {
        const a = time * s.spin + (k / s.count) * Math.PI * 2;
        const ox = px + Math.cos(a) * s.radius;
        const oz = pz + Math.sin(a) * s.radius;
        const under = obstacleAt(ox, oz, s.size * 0.5);
        const oy = Math.max(py, terrainH(ox, oz), under ? under.top - 0.2 : -1e9) + 0.9; // roll over slopes and rocks
        dummy.position.set(ox, oy, oz);
        dummy.rotation.set(0, -a, time * 6);
        dummy.scale.setScalar(s.size * 1.6);
        dummy.updateMatrix();
        orbMesh.setMatrixAt(orbitCount++, dummy.matrix);
        if (hitNow) hitArea(ox, oy, oz, s.size, s.dmg, 4, s.burn || 0);
      }
    } else if (s.kind === 'aura') {
      auraRadius = s.radius;
      if (w.timer > 0) continue;
      w.timer = s.cd;
      hitArea(px, py + 0.5, pz, s.radius, s.dmg, 0, s.burn || 0);
    } else if (s.kind === 'sky') {
      if (w.timer > 0) continue;
      const m = nearestEnemies(px, pz, 16, s.range, -1);
      if (!m) continue;
      w.timer = s.cd;
      // Fire from heaven picks the strongest enemies near you; hail falls at random among them.
      const pool = s.target === 'strong' ? [...targets.subarray(0, m)].sort((a, b) => E.hp[b] - E.hp[a]) : null;
      for (let k = 0; k < s.count; k++) {
        const t = pool ? pool[k % m] : targets[Math.floor(random() * m)];
        addStrike(E.x[t], E.z[t], s.radius, s.dmg, s.delay, s.fire ? 1 : 0, s.burn || 0);
      }
    } else if (s.kind === 'sweep') {
      if (w.timer > 0) continue;
      w.timer = s.cd;
      for (let k = 0; k < s.count; k++) launchChariot(s, k);
      beep(80, 0.5, 'sawtooth', 0.05, 0, 160);
    }
  }
  orbMesh.count = orbitCount;
  orbMesh.instanceMatrix.needsUpdate = true;
}

// Chariots of fire: each crosses the field through the hero's spot and runs over everyone once.
const sweeps = [];
let sweepId = 0;
const chariotMat = new THREE.MeshBasicMaterial({ vertexColors: true });
function launchChariot(s, k) {
  const a = random() * Math.PI * 2;
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  const side = (k - (s.count - 1) / 2) * 4 + (random() - 0.5) * 3;
  const x = P.pos.x - dx * 24 - dz * side;
  const z = P.pos.z - dz * 24 + dx * side;
  const mesh = new THREE.Mesh(ASSETS.items.proj_chariot, chariotMat);
  mesh.scale.setScalar(1.15);
  scene.add(mesh);
  sweeps.push({ x, z, dx, dz, left: 48, id: ++sweepId, s, mesh });
}
function updateSweeps(dt) {
  for (let k = sweeps.length - 1; k >= 0; k--) {
    const c = sweeps[k];
    const step = c.s.speed * dt;
    c.x += c.dx * step;
    c.z += c.dz * step;
    c.left -= step;
    const y = terrainH(c.x, c.z);
    c.mesh.position.set(c.x, y, c.z);
    c.mesh.rotation.y = Math.atan2(c.dx, c.dz);
    hitOnce(c.x, y, c.z, c.s.radius, c.s.dmg, c.s.knock, c.id, c.dx, c.dz, c.s.burn || 0);
    if (random() < 0.7) burst(c.x - c.dx * 1.5, y + 1, c.z - c.dz * 1.5, random() < 0.5 ? 0xff8a3d : 0xffd25a, 2, 2, 0.2, 3);
    if (c.left <= 0) {
      scene.remove(c.mesh);
      sweeps.splice(k, 1);
    }
  }
}

// Locust swarms: each drifts to the nearest enemy and bites everything around it on the weapon's beat.
const swarmDraw = [];
function updateSwarms(w, s, dt) {
  w.swarm ??= [];
  while (w.swarm.length < s.count) w.swarm.push({ x: P.pos.x, z: P.pos.z, vx: 0, vz: 0 });
  w.swarm.length = s.count;
  const bite = w.timer <= 0;
  if (bite) w.timer = s.cd;
  w.swarm.forEach((sw, k) => {
    let tx = P.pos.x + Math.cos(time + k * 2.1) * 3;
    let tz = P.pos.z + Math.sin(time + k * 2.1) * 3;
    if (nearestEnemies(sw.x, sw.z, k + 1, 18, -1) > k) { tx = E.x[targets[k]]; tz = E.z[targets[k]]; }
    const dx = tx - sw.x;
    const dz = tz - sw.z;
    const d = Math.hypot(dx, dz) || 1;
    const f = Math.min(1, dt * 3);
    sw.vx += ((dx / d) * s.speed - sw.vx) * f;
    sw.vz += ((dz / d) * s.speed - sw.vz) * f;
    if (d > 0.5) { sw.x += sw.vx * dt; sw.z += sw.vz * dt; }
    const y = terrainH(sw.x, sw.z);
    if (bite) hitArea(sw.x, y + 1, sw.z, s.radius, s.dmg);
    swarmDraw.push(sw.x, y, sw.z, s.radius);
  });
}

function updateShots(dt) {
  for (let i = 0; i < S.n; ) {
    if (S.seek[i]) {
      // Serpent: steer toward the nearest enemy it has not just bitten.
      if (nearestEnemies(S.x[i], S.z[i], 1, 14, S.last[i])) {
        const t = targets[0];
        const dx = E.x[t] - S.x[i];
        const dy = E.y[t] + E.h[t] * 0.5 - S.y[i];
        const dz = E.z[t] - S.z[i];
        const d = Math.hypot(dx, dy, dz) || 1;
        const sp = S.speed[i];
        S.vx[i] += (dx / d) * sp * S.seek[i] * dt;
        S.vy[i] += (dy / d) * sp * S.seek[i] * dt;
        S.vz[i] += (dz / d) * sp * S.seek[i] * dt;
        const v = Math.hypot(S.vx[i], S.vy[i], S.vz[i]) || 1;
        S.vx[i] *= sp / v;
        S.vy[i] *= sp / v;
        S.vz[i] *= sp / v;
      }
    }
    if (S.ret[i] >= 0) { // boomerang: out to its range, then home to the hero, over the ground
      if (S.ret[i] > 0 && (S.ret[i] -= dt) <= 0) { S.ret[i] = 0; S.last[i] = -1; }
      if (S.ret[i] === 0) {
        const dx = P.pos.x - S.x[i];
        const dz = P.pos.z - S.z[i];
        const d = Math.hypot(dx, dz) || 1;
        S.vx[i] = (dx / d) * S.speed[i] * 1.15;
        S.vz[i] = (dz / d) * S.speed[i] * 1.15;
        S.life[i] = d < 1.2 ? 0 : Math.max(S.life[i], 0.1); // alive until it is back in the hand
      }
      S.vy[i] = 0;
      S.y[i] = Math.max(S.y[i], terrainH(S.x[i], S.z[i]) + 1);
    }
    S.x[i] += S.vx[i] * dt;
    S.y[i] += S.vy[i] * dt;
    S.z[i] += S.vz[i] * dt;
    S.life[i] -= dt;
    let dead = S.life[i] <= 0 || S.y[i] < terrainH(S.x[i], S.z[i]);
    const wall = !dead && obstacleAt(S.x[i], S.z[i]);
    if (wall && S.y[i] < wall.top) { // stones and arrows stop at rocks, ruins and trees; axes turn back
      if (S.ret[i] > 0) S.ret[i] = 0;
      else if (S.ret[i] < 0) {
        dead = true;
        burst(S.x[i], S.y[i], S.z[i], 0xcbb89a, 3, 2, 0.1, 1);
      }
    }
    if (!dead) {
      const m = hash.query(S.x[i], S.z[i], S.size[i] + MAX_R, near);
      for (let k = 0; k < m; k++) {
        const j = near[k];
        if (j === S.last[i] || E.hp[j] <= 0) continue;
        const dx = E.x[j] - S.x[i];
        const dz = E.z[j] - S.z[i];
        const rr = E.r[j] + S.size[i];
        const rel = S.y[i] - E.y[j];
        if (dx * dx + dz * dz > rr * rr || rel < -0.3 || rel > E.h[j] + 0.3) continue;
        const head = E.type[j] === BOSS && rel > E.h[j] - 1.1; // the boss's forehead: always critical
        damage(j, S.dmg[i], S.vx[i], S.vz[i], 5, head || S.crit[i] > 0);
        if (S.burn[i]) E.burn[j] = Math.max(E.burn[j], S.burn[i]);
        if (head) addFx(ringGeo, 0xf2c14e, S.x[i], S.y[i], S.z[i], 0.5, 0.3, { grow: 2 });
        S.last[i] = j;
        if (S.pierce[i] > 0) S.pierce[i]--;
        else if (S.bounce[i] > 0 && nearestEnemies(E.x[j], E.z[j], 1, 12, j)) {
          S.x[i] = E.x[j];
          S.y[i] = E.y[j] + E.h[j] * 0.5;
          S.z[i] = E.z[j];
          aimShot(i, targets[0]);
          S.bounce[i]--;
          S.life[i] = Math.max(S.life[i], 0.8);
        } else dead = true;
        break;
      }
    }
    if (dead) removeAt(S, i);
    else i++;
  }
}

function addStrike(x, z, r, dmg, delay, fire = 0, burn = 0) {
  if (K.n >= MAX_STRIKES) return;
  const i = K.n++;
  K.x[i] = x;
  K.z[i] = z;
  K.r[i] = r;
  K.dmg[i] = dmg;
  K.t[i] = K.t0[i] = delay;
  K.fire[i] = fire;
  K.burn[i] = burn;
}

function updateStrikes(dt) {
  for (let i = 0; i < K.n; ) {
    if ((K.t[i] -= dt) > 0) { i++; continue; }
    const y = terrainH(K.x[i], K.z[i]);
    const fire = K.fire[i] === 1;
    if (K.fire[i] === 2) burst(K.x[i], y + 0.4, K.z[i], 0xfff1b8, 10, 5, 0.12, 5); // a star lands
    hitArea(K.x[i], y + 0.5, K.z[i], K.r[i], K.dmg[i], 0, K.burn[i]);
    addFx(ringGeo, fire ? 0xff8a3d : 0xdff4ff, K.x[i], 0.2, K.z[i], K.r[i], fire ? 0.5 : 0.25, { grow: 0.5, ground: true });
    burst(K.x[i], y + 0.3, K.z[i], fire ? 0xffb347 : 0xdff4ff, fire ? 14 : 6, fire ? 6 : 4, fire ? 0.18 : 0.12, fire ? 6 : 3);
    if (fire) beep(110, 0.25, 'sawtooth', 0.04, 0, 50);
    removeAt(K, i);
  }
}

// ---------- Pickups & world ----------
const PICK_WEIGHTS = [0.35, 0.25, 0.2, 0.2]; // pão, codornizes, botija, tocha
function dropPickup(x, y, z, k = pickWeighted(PICK_WEIGHTS, random)) {
  dropGem(x, y, z, 1, 2 + k);
}
function addGold(v) {
  const g = v * (1 + P.st.gold); // Anel de José
  P.gold += Math.floor(g) + (random() < g % 1 ? 1 : 0);
}
function usePickup(k) {
  const p = PICKUPS[k];
  if (p.id === 'pao') P.hp = Math.min(P.st.maxHp, P.hp + P.st.maxHp * 0.3);
  else if (p.id === 'codornizes') {
    for (let i = 0; i < G.n; i++) if (G.kind[i] === 0) G.pull[i] = 1; // every maná on the map flies in
  } else if (p.id === 'botija') gainFe(50);
  else { // Gideon's torch: the camp panics (Jz 7:21-22)
    const n = hash.query(P.pos.x, P.pos.z, 14 + MAX_R, near);
    for (let q = 0; q < n; q++) {
      const j = near[q];
      const ex = E.x[j] - P.pos.x;
      const ez = E.z[j] - P.pos.z;
      if (E.hp[j] <= 0 || Math.hypot(ex, ez) > 14) continue;
      damage(j, 30, ex, ez, 16);
      if (!ENEMIES[E.type[j]].boss) E.stun[j] = 2;
    }
    addFx(ringGeo, 0xffb347, P.pos.x, 0.3, P.pos.z, 1, 0.6, { grow: 13, ground: true });
    shake = 0.5;
  }
  burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xffe08f, 14, 4, 0.12, 5);
  toast(`${p.name}: ${p.text}`, '#ffe08f', ICON.pickup[p.id]);
  chord([660, 880], 'triangle');
}
function dropGem(x, y, z, v, kind) {
  if (G.n >= MAX_GEMS) { // ponytail: when full, overflow goes straight to the player
    if (kind >= 2) usePickup(kind - 2);
    else if (kind) addGold(v);
    else gainXp(v);
    return;
  }
  const o = obstacleAt(x, z, 0.4);
  if (o && y < o.top + 0.4) { // nudge out of rocks and ruins, where it could not be picked up
    const d = Math.hypot(x - o.x, z - o.z) || 1;
    x = o.x + ((x - o.x) / d) * (o.r + 0.7);
    z = o.z + ((z - o.z) / d) * (o.r + 0.7);
  }
  y = Math.max(y, terrainH(x, z) + 0.4);
  const i = G.n++;
  G.x[i] = x;
  G.y[i] = y;
  G.z[i] = z;
  G.val[i] = v;
  G.pull[i] = 0;
  G.kind[i] = kind;
}

function updateGems(dt) {
  const pr = pickupR();
  for (let i = 0; i < G.n; ) {
    const dx = P.pos.x - G.x[i];
    const dy = P.pos.y + 0.8 - G.y[i];
    const dz = P.pos.z - G.z[i];
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.9) {
      if (G.kind[i] >= 2) usePickup(G.kind[i] - 2);
      else if (G.kind[i]) {
        addGold(G.val[i]);
        beep(1500, 0.05, 'square', 0.025);
      } else gainXp(G.val[i]);
      removeAt(G, i);
      continue;
    }
    if (G.pull[i] > 0 || d < pr) {
      G.pull[i] += dt;
      const step = Math.min(d, (8 + G.pull[i] * 40) * dt);
      G.x[i] += (dx / d) * step;
      G.y[i] += (dy / d) * step;
      G.z[i] += (dz / d) * step;
    }
    i++;
  }
}

function gainXp(v) {
  P.xp += v * (1 + P.st.xp);
  beep(520 * 2 ** (Math.min(combo++, 24) / 12), 0.05, 'triangle', 0.035); // pitch climbs with the combo
  comboT = 0.5;
  while (P.xp >= P.xpNext) {
    P.xp -= P.xpNext;
    P.level++;
    P.xpNext = Math.round(5 + (P.level - 1) * 7 + 0.3 * (P.level - 1) ** 2);
    pendingLevels++;
    burst(P.pos.x, P.pos.y + 1, P.pos.z, 0x8fdcff, 20, 5, 0.12, 6);
    if (P.hero === 'moises') plague();
  }
}

const chestCost = () => 10 + 8 * chestsOpened; // linear: every chest stays within reach of a run's siclos
function openChest(c) {
  c.open = true;
  P.conquests++;
  if (!c.free && !c.challenge) {
    P.gold -= chestCost();
    chestsOpened++;
  }
  if (c.challenge) { // the sealed chest's prize on top of its relic
    for (let k = 0; k < 25; k++) dropGem(c.x + random() * 4 - 2, c.y + 0.6, c.z + random() * 4 - 2, 1, 1);
    dropPickup(c.x, c.y + 0.8, c.z + 1.4);
  }
  const evoW = readyToEvolve(P.weapons, P.relics)[0]; // a weapon ready to evolve takes the chest's gift
  const r = rollRelic(P.st.luck, random, c.challenge ? 3 : c.free ? 1 : 0, Object.keys(RELICS).filter((id) => isOpen('relic', id)));
  const e = RELICS[r.id];
  // The gift rises out of the chest, then flies into the hero: that is when it counts.
  const relic = M.solid(ASSETS.items[evoW ? `weapon_${evoW.id}` : `relic_${r.id}`], M.toon());
  const from = new THREE.Vector3(c.x, c.y + 0.8, c.z);
  let got = false;
  addObjFx(relic, 1.3, (m, k) => {
    m.rotation.y = k * 14;
    if (k < 0.45) {
      m.position.set(from.x, from.y + (k / 0.45) * 1.6, from.z);
      m.scale.setScalar(0.3 + k);
    } else {
      const f = (k - 0.45) / 0.55;
      m.position.lerpVectors(m.position, _v.set(P.pos.x, P.pos.y + 1, P.pos.z), Math.min(1, f * 0.6 + 0.15));
      m.scale.setScalar(0.75 * (1 - f * 0.7));
    }
    if (k > 0.97 && !got) {
      got = true;
      if (evoW) {
        evolve(evoW);
        return;
      }
      applyEntry(P.st, e, r.tier);
      P.relics.push(r);
      refreshWeapons();
      relicBanner(r);
      burst(P.pos.x, P.pos.y + 1, P.pos.z, 0xf2c14e, 28, 5, 0.12, 6);
      chord([784, 1046, 1318], 'triangle');
    }
  });
  burst(c.x, c.y + 1, c.z, 0xf2c14e, 24, 4, 0.12, 6);
  chord([523, 659, 784, 1046], 'square');
}

let bannerTimer = 0;
function relicBanner(r) {
  const e = RELICS[r.id];
  banner(ICON.relic[r.id], `Relíquia obtida · ${RARITY[r.tier].name}`, e.name, RARITY[r.tier].color, statText(e, r.tier), e.ref);
}
function banner(icon, small, title, color, line, ref) {
  const el = $('relic');
  el.innerHTML = `${iconImg(icon)}<div><small>${small}</small><b style="color:${color}">${title}</b><span>${line}</span><em>${ref}</em></div>`;
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

const STONE_R = 6; // stand this close to a memorial stone to raise it
const STONE_DONE = new THREE.Color(0xf2c14e);
const CLOUD = new THREE.Color(0xffffff);
const FIRE = new THREE.Color(0xff8a3d);
function updateWorld(dt) {
  promptText = '';
  const p = P.pos;
  for (const s of stones) {
    if (s.done) continue;
    s.beam.material.color.lerpColors(CLOUD, FIRE, night);
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    if (d < STONE_R) {
      s.p += dt / 6;
      if ((s.pulse = (s.pulse ?? 0) - dt) <= 0) { // the stone pushes the horde back while you raise it
        s.pulse = 1.5;
        hitArea(s.x, s.y, s.z, STONE_R + 1, 8 * globalDmg(), 16);
        addFx(ringGeo, 0xffe08f, s.x, 0.3, s.z, 1, 0.6, { grow: STONE_R + 1, ground: true });
      }
      promptText = `Erguendo a Pedra do Memorial · ${Math.floor(Math.min(1, s.p) * 100)}%`;
      if (random() < 0.3) burst(s.x + random() * 2 - 1, s.y + 0.3, s.z + random() * 2 - 1, 0xffe08f, 1, 1, 0.1, 3);
      if (s.p >= 1) {
        s.done = true;
        stonesDone++;
        P.conquests++;
        if (stonesDone === 3) award('memorial');
        s.beam.scale.set(0.3, 1, 0.3);
        s.beam.material.color.copy(STONE_DONE);
        gainFe(30);
        for (let g = 0; g < 10; g++) dropGem(s.x + random() * 4 - 2, s.y + 0.5, s.z + random() * 4 - 2, 2, 0);
        burst(s.x, s.y + 1.5, s.z, 0xffe08f, 30, 6, 0.15, 8);
        toast(stonesDone < 3 ? `Pedra do Memorial erguida (${stonesDone}/3)` : 'As três pedras estão erguidas!', '#ffe08f');
        chord([392, 494, 587, 784]);
        if (stonesDone === 3 && !boss.spawned) spawnBoss(false);
      }
    } else s.p = Math.max(0, s.p - dt / 90); // stepping away to fight costs little progress
    s.beam.material.opacity = 0.22 + 0.08 * Math.sin(time * 3) + (d < STONE_R ? 0.2 : 0);
  }
  for (const a of altars) {
    if (a.used) continue;
    if (Math.hypot(p.x - a.x, p.z - a.z) < 4) {
      a.p += dt / 3;
      promptText = `Orando no altar · ${Math.floor(Math.min(1, a.p) * 100)}%`;
      if (a.p >= 1) {
        a.used = true;
        burst(a.x, a.y + 1.2, a.z, 0xff8a3d, 20, 4, 0.12, 6);
        const ids = Object.keys(SCROLLS);
        const offers = [];
        while (offers.length < 3) {
          const id = ids.splice(Math.floor(random() * ids.length), 1)[0];
          offers.push({ kind: 'scroll', id, tier: rollRarity(P.st.luck, random, 1) });
        }
        openChoice('Altar de Pedras', offers, 'altar');
        return;
      }
    } else a.p = Math.max(0, a.p - dt / 6);
  }
  for (const w of world.wells) { // drink: full life, then the well fills again in 90 s
    w.cd -= dt;
    if (Math.hypot(p.x - w.x, p.z - w.z) > 3.6) { w.p = 0; continue; }
    if (w.cd > 0) { promptText = `${B.well[0]} · volta a encher em ${Math.ceil(w.cd)} s`; continue; }
    w.p += dt / 1.5;
    promptText = `Bebendo: ${B.well[0]} · ${Math.floor(Math.min(1, w.p) * 100)}%`;
    if (w.p >= 1) {
      P.hp = P.st.maxHp;
      w.cd = 90;
      w.p = 0;
      burst(w.x, w.y + 1.2, w.z, 0x9fd8ff, 24, 4, 0.14, 6);
      toast(`${B.well[0]} (${B.well[1]}): vida restaurada`, '#9fd8ff');
      award('poco');
      chord([523, 784, 1046], 'triangle');
    }
  }
  for (const g of world.glints) { // Elá: the five smooth stones in the brook
    if (g.got) continue;
    g.m.rotation.y += dt * 2;
    if (random() < dt * 2) burst(g.x, g.y + 0.3, g.z, 0xffffff, 1, 1, 0.08, 2);
    if (Math.hypot(p.x - g.x, p.z - g.z) > 1.8) continue;
    g.got = true;
    g.m.visible = false;
    glintsGot++;
    burst(g.x, g.y + 0.5, g.z, 0xffffff, 12, 3, 0.1, 4);
    if (glintsGot < 5) toast(`Pedra lisa do ribeiro ${glintsGot}/5`, '#e8e4da');
    else {
      award('pedras');
      P.st.amount += 1;
      P.st.dmg += 0.1;
      refreshWeapons();
      toast('As cinco pedras lisas (1 Sm 17:40): +1 projétil, +10% de dano', '#ffe08f');
      chord([392, 494, 587, 784]);
    }
  }
  const rh = world.rahab; // Jericho: the scarlet cord in Rahab's window (Js 2:18-21)
  if (rh && !rh.used && Math.hypot(p.x - rh.x, p.z - rh.z) < 3.5) {
    rh.used = true;
    P.st.revives += 1;
    burst(rh.x, terrainH(rh.x, rh.z) + 1.5, rh.z, 0xe03a50, 24, 4, 0.12, 6);
    toast('Cordão escarlate (Js 2:18): você se levantará uma vez nesta jornada', '#ff8a9a');
    chord([523, 659, 784], 'triangle');
  }
  if (challenge) { // the sealed chest's ambush: waves until the timer runs out
    challenge.t -= dt;
    if ((challenge.wave -= dt) <= 0 && challenge.t > 3) {
      challenge.wave = 4;
      const { c } = challenge;
      for (let k = 0; k < 12; k++) {
        const a = random() * Math.PI * 2;
        const r = 9 + random() * 4;
        const x = c.x + Math.cos(a) * r;
        const z = c.z + Math.sin(a) * r;
        if (walkable(x, z) && !flow.blocked[flow.index(x, z)]) spawnEnemy(k % 6 === 5 ? 3 : k % 4 === 3 ? 1 : 0, x, z);
      }
    }
    promptText = `Emboscada · resista ${Math.ceil(Math.max(0, challenge.t))} s`;
    if (challenge.t <= 0) {
      openChest(challenge.c);
      toast('Você resistiu! O selo se rompeu.', '#ffd66b');
      award('selo');
      challenge = null;
    }
  }
  for (const c of chests) {
    if (c.open) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (c.challenge) {
      if (challenge || d > 5) continue;
      if (d < 2.4) {
        challenge = { c, t: 20, wave: 0 };
        toast('Emboscada! Resista 20 s e o baú selado se abre.', '#ff9a8a');
        beep(70, 0.8, 'sawtooth', 0.08, 0, 50);
        shake = 0.4;
      } else promptText = 'Baú selado · encoste para romper o selo (emboscada, prêmio maior)';
      continue;
    }
    if (d > 5) continue;
    const cost = c.free ? 0 : chestCost();
    if (d < 2.4 && P.gold >= cost) openChest(c);
    else promptText = c.free ? 'Baú do campeão · grátis: encoste para abrir'
      : P.gold >= cost ? `Baú de cedro · ${cost} siclos: encoste para abrir`
        : `Baú de cedro · faltam ${cost - P.gold} siclos (quebre cântaros e derrote inimigos)`;
  }
  jars.forEach((j, k) => {
    if (j.broken || Math.hypot(p.x - j.x, p.z - j.z) > 1.1 || p.y - j.y > 1.2) return;
    j.broken = true;
    world.jarMesh.setMatrixAt(k, new THREE.Matrix4().makeScale(0, 0, 0));
    world.jarMesh.instanceMatrix.needsUpdate = true;
    burst(j.x, j.y + 0.4, j.z, 0xb0643a, 10, 3, 0.12, 4);
    const n = 2 + Math.floor(random() * 4);
    for (let s = 0; s < n; s++) dropGem(j.x + random() * 2 - 1, j.y + 0.4, j.z + random() * 2 - 1, 1, 1);
    if (random() < 0.08) dropPickup(j.x, j.y + 0.5, j.z);
    beep(700, 0.08, 'square', 0.04, 0, 200);
  });
}

// ---------- Choices (level-up cards and altars) ----------
const cardCount = () => (P.hero === 'debora' ? 4 : 3); // Débora, the prophetess, sees one card more
function openLevelUp() {
  openChoice(`Nível ${P.level - pendingLevels + 1}!`, rollOffers({ weapons: P.weapons, luck: P.st.luck }, random, cardCount()), 'level');
}

function openChoice(title, offers, source) {
  state = 'choice';
  choice = { title, offers, source };
  document.exitPointerLock?.();
  renderChoice();
  show('choice');
  chord([523, 659, 784]);
}

function renderChoice() {
  $('choice-title').textContent = choice.title;
  $('cards').replaceChildren(...choice.offers.map((o, i) => {
    const b = document.createElement('button');
    b.className = 'card';
    let tag;
    let name;
    let text;
    let icon;
    const evoHint = (id) => `<em class="evo">Evolui com ${RELICS[EVOLUTIONS[id].needs].name} no nível ${MAX_LEVEL}</em>`;
    if (o.kind === 'weapon') {
      tag = 'Nova arma';
      name = WEAPONS[o.id].name;
      text = `${WEAPONS[o.id].desc}${evoHint(o.id)}`;
      icon = ICON.weapon[o.id];
    } else if (o.kind === 'upgrade') {
      const lv = P.weapons.find((w) => w.id === o.id).level + 1;
      tag = `Arma · nível ${lv}`;
      name = WEAPONS[o.id].name;
      text = `${describeLevel(o.id, lv)}${evoHint(o.id)}`;
      icon = ICON.weapon[o.id];
    } else {
      tag = `Rolo · ${RARITY[o.tier].name}`;
      name = SCROLLS[o.id].name;
      text = statText(SCROLLS[o.id], o.tier);
      icon = ICON.scrolls[o.id];
      b.classList.add('rare');
      b.style.setProperty('--rar', RARITY[o.tier].color);
    }
    b.innerHTML = `<kbd class="k">${i + 1}</kbd>${iconImg(icon)}<small>${tag}</small><b>${name}</b><span>${text}</span>`;
    b.onclick = () => pick(i);
    return b;
  }));
  const r = $('reroll');
  r.hidden = choice.source !== 'level' || P.st.rerolls < 1;
  r.innerHTML = `<kbd class="k">R</kbd>Rolar de novo (${P.st.rerolls})`;
}

function pick(i) {
  if (state !== 'choice' || !choice.offers[i]) return;
  const o = choice.offers[i];
  if (o.kind === 'weapon') P.weapons.push({ id: o.id, level: 1, timer: 0 });
  else if (o.kind === 'upgrade') P.weapons.find((w) => w.id === o.id).level++;
  else {
    const before = P.st.maxHp;
    applyEntry(P.st, SCROLLS[o.id], o.tier);
    P.hp += P.st.maxHp - before;
  }
  refreshWeapons();
  beep(880, 0.08, 'triangle', 0.04);
  if (choice.source === 'level' && --pendingLevels > 0) return openLevelUp();
  choice = null;
  resume();
}

function reroll() {
  if (state !== 'choice' || choice.source !== 'level' || P.st.rerolls < 1) return;
  P.st.rerolls--;
  choice.offers = rollOffers({ weapons: P.weapons, luck: P.st.luck }, random, cardCount());
  renderChoice();
}

// ---------- End of run ----------
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// ---------- Trophies ----------
const runTrophies = [];
function award(id) {
  if (!id || profile.trophies[id] || !runStarted) return;
  profile.trophies[id] = Date.now();
  saveProfile();
  OPEN = openSet(profile);
  runTrophies.push(id);
  const t = TROPHIES[id];
  banner(`assets/ui/trophy-${t.tier}.png`, `Troféu de ${TIERS[t.tier].name.toLowerCase()}`, t.name, TIERS[t.tier].color, t.desc,
    t.unlock ? `Desbloqueado: ${unlockName(t.unlock)}` : '');
  toast(`Troféu: ${t.name}${t.unlock ? ` · ${unlockName(t.unlock)} desbloqueado` : ''}`, TIERS[t.tier].color);
  chord([659, 784, 988, 1319], 'triangle');
}
let trophyT = 0;
function checkTrophies(dt) { // the ones that build up over a run, checked once a second
  if ((trophyT -= dt) > 0) return;
  trophyT = 1;
  if (time >= 480) award('perseveranca');
  if (P.kills >= 1000) award('mil');
  if (P.level >= 20) award('ungido');
  if (P.gold >= 300) award('salomao');
  if (P.relics.length >= 8) award('relicario');
}

function endScreen(title, text) {
  award('inicio');
  state = 'end';
  document.exitPointerLock?.();
  $('end-title').textContent = title;
  $('end-text').textContent = text;
  $('end-summary').innerHTML = [[fmt(time), 'Tempo', 'hourglass'], [P.level, 'Nível', 'star'], [P.kills, 'Abates', 'skull'], [P.relics.length, 'Relíquias', 'gem']]
    .map(([v, l, ic]) => `<div class="well"><img class="ico" src="assets/ui/${ic}.png" alt=""><b>${v}</b><small>${l}</small></div>`).join('');
  $('end-trophies').innerHTML = runTrophies.length ? `<h3>Troféus nesta jornada</h3>${runTrophies.map((id) => {
    const t = TROPHIES[id];
    return `<div class="tro-line"><img class="ico" src="assets/ui/trophy-${t.tier}.png" alt=""><b>${t.name}</b>${t.unlock ? `<small>Desbloqueado: ${unlockName(t.unlock)}</small>` : ''}</div>`;
  }).join('')}` : '';
  show('end');
}
function revive() {
  P.st.revives--;
  P.hp = P.st.maxHp * 0.5;
  P.iframes = 2;
  hitArea(P.pos.x, P.pos.y, P.pos.z, 9, 20, 20);
  addFx(ringGeo, 0xd9483b, P.pos.x, 0.3, P.pos.z, 1, 0.7, { grow: 8, ground: true });
  toast('Cordão Escarlate: você se levanta!', RARITY[4].color, ICON.relic.cordao);
}
// Death: the world freezes, the hero falls and crumbles into dust, then the end screen.
let outro = null;
let camZoom = 1;
function startDeath() {
  state = 'dying';
  outro = { t: 0 };
  P.vel.set(0, 0, 0);
  P.hurtT = 0.6;
  shake = 1.2;
  boom(1.6, 1, 800);
  beep(98, 1.2, 'sine', 0.18, 0, 30);
  beep(196, 0.9, 'sawtooth', 0.07, 0, 45);
  [392, 349, 311, 262].forEach((f, k) => beep(f, k === 3 ? 0.9 : 0.3, 'triangle', 0.06, 0.9 + k * 0.3));
  document.body.classList.add('outro');
}
function updateOutro(dt) {
  const o = outro;
  o.t += dt;
  P.hurtT -= dt;
  shake = Math.max(0, shake - dt * 1.5);
  updateParticles(dt);
  updateFx(dt);
  camZoom += (0.6 - camZoom) * Math.min(1, dt * 2);
  const k = clamp((o.t - 0.5) / 1.6, 0, 1); // how much has crumbled
  heroRig.group.visible = k < 1;
  heroRig.group.rotation.x = Math.min(1, o.t * 2) * 0.35;
  heroRig.group.position.y = -k * 0.4;
  heroRig.dissolve.value = k;
  heroRig.mat.emissive.setRGB(P.hurtT > 0 ? 0.55 : 0, 0, 0);
  if (k > 0.6) heroRig.group.traverse((m) => { m.castShadow = false; });
  shadowBlob.scale.setScalar(1 - k);
  if (k > 0 && k < 1) {
    const x = P.pos.x + (random() - 0.5) * 0.6;
    const z = P.pos.z + (random() - 0.5) * 0.6;
    burst(x, P.pos.y + 0.3 + random() * 1.6, z, random() < 0.5 ? 0xffd27a : 0x6b5a48, 2, 1.2, 0.12, 3);
  }
  if (o.t > 2.6) { outro = null; die(); }
}
function die() {
  endScreen('Você caiu', `${HEROES[P.hero].name} lutou bravamente em ${B.name}.`);
}
function win() {
  bossRig.group.visible = false;
  teleLine.visible = teleCircle.visible = false;
  $('bossbar').hidden = true;
  profile.wins[P.hero] = { ...profile.wins[P.hero], [BIOME_ID]: true };
  saveProfile();
  award({ ela: 'golias', mar: 'farao', ossos: 'gogue', jerico: 'rei' }[BIOME_ID]);
  if (Object.keys(profile.wins).length >= 3) award('valentes');
  const mapsWon = new Set(Object.values(profile.wins).flatMap((w) => Object.keys(w)));
  if (Object.keys(BIOMES).every((m) => mapsWon.has(m))) award('conquista');
  endScreen('Vitória!', B.win);
  chord([523, 659, 784, 1046, 1318], 'square');
}

// ---------- Day and night ----------
const MOON = new THREE.Color(0x8fa8ff);
const SUN = new THREE.Color(0xffeccc);
function updateSky() {
  const t2 = time % (DAY_LEN * 2);
  night = t2 < DAY_LEN ? (time > DAY_LEN ? clamp(1 - t2 / 6, 0, 1) : 0) : clamp((t2 - DAY_LEN) / 6, 0, 1);
  hemi.intensity = 1.45 - 0.85 * night;
  sun.intensity = 2.5 - 1.75 * night;
  sun.color.lerpColors(SUN, MOON, night);
  const isNight = night > 0.5;
  if (isNight !== wasNight) {
    wasNight = isNight;
    if (!isNight) award('noite'); // dawn after a whole night
    toast(isNight ? 'A noite caiu · Coluna de Fogo · Maná em dobro' : 'Amanheceu · Coluna de Nuvem', isNight ? '#ffb37a' : '#fbf4e4');
  }
}

// ---------- Frame ----------
function step(dt) {
  time += dt;
  M.shared.uTime.value = time;
  updateSky();
  director(dt);
  if ((flowTimer -= dt) <= 0) { flow.update(P.pos.x, P.pos.z); flowTimer = 0.25; }
  updatePlayer(dt);
  updateEnemies(dt);
  hash.build(E.x, E.z, E.n); // enemies moved: rebuild before attacks look them up
  dashHits();
  updateWeapons(dt);
  updateSweeps(dt);
  updateShots(dt);
  updateStrikes(dt);
  updateEnemyShots(dt);
  updateSpear(dt);
  updateMiracles(dt);
  reapEnemies();
  updateParticles(dt);
  updateFx(dt);
  if (state !== 'play') return;
  updateGems(dt);
  updateWorld(dt);
  checkTrophies(dt);
  P.iframes -= dt;
  P.hurtT -= dt;
  P.harpT -= dt;
  P.attackT -= dt;
  P.castT -= dt;
  if ((comboT -= dt) <= 0) combo = 0;
  if (P.hp <= 0) {
    if (P.st.revives >= 1) revive();
    else return startDeath();
  }
  if (state === 'play' && pendingLevels > 0) openLevelUp();
}

const dummy = new THREE.Object3D();
dummy.rotation.order = 'YXZ'; // yaw first, then lean
const tmpColor = new THREE.Color();
const ELITE = new THREE.Color(1.5, 1.15, 0.5);
const STUN = new THREE.Color(0.55, 0.55, 0.62);
const SLOW = new THREE.Color(0.6, 0.85, 1.5);
const WIND = new THREE.Color(2.2, 1.1, 0.4);
const FLASH = new THREE.Color(3, 3, 3);
const counts = [0, 0, 0, 0];
function syncMeshes(dt) {
  if (heroRig) {
    if (runStarted) {
      player.position.copy(P.pos);
      player.rotation.y = Math.atan2(P.faceX, P.faceZ);
    }
    const hs = runStarted ? Math.hypot(P.vel.x, P.vel.z) : 0;
    const target = { idle: 0, walk: 0, jump: 0, slide: 0 };
    if (P.sliding) target.slide = 1;
    else if (runStarted && !P.grounded) target.jump = 1;
    else {
      target.walk = Math.min(1, hs / 4);
      target.idle = 1 - target.walk;
    }
    const f = Math.min(1, dt * 12);
    for (const k in target) {
      heroRig.w[k] += (target[k] - heroRig.w[k]) * f;
      heroRig.act[k]?.setEffectiveWeight(heroRig.w[k]);
    }
    heroRig.act.walk.timeScale = 0.7 + hs / 7;
    if (P.attackT > 0.25 && !heroRig.act.attack.isRunning()) heroRig.act.attack.reset().play();
    if (P.castT > 0.7 && !heroRig.act.cast.isRunning()) heroRig.act.cast.reset().play();
    const roll = P.dashT > 0 && P.hero === 'davi'; // Davi's dodge: a quick spin
    heroRig.group.rotation.y = roll ? heroRig.group.rotation.y + dt * 40 : 0;
    if (!outro) heroRig.group.visible = !runStarted || P.iframes <= 0 || P.dashT > 0 || P.harpT > 0 || Math.floor(time * 20) % 2 === 0;
    const glowing = P.castT > 0 || P.harpT > 0;
    heroRig.mat.emissive.setRGB(P.hurtT > 0 ? 0.55 : glowing ? 0.18 : 0, glowing ? 0.14 : 0, 0);
    heroRig.mixer.update(dt);
  }
  shadowBlob.visible = runStarted;
  shadowBlob.position.set(P.pos.x, P.ground + 0.06, P.pos.z);
  shadowBlob.scale.setScalar(clamp(1 - (P.pos.y - P.ground) / 8, 0.4, 1));
  auraDisk.visible = auraRadius > 0;
  if (auraRadius > 0) drape(auraDisk.geometry, auraDisk.userData.base, P.pos.x, P.pos.z, auraRadius, 0.12);
  auraFlames.count = auraRadius > 0 ? 10 : 0;
  for (let k = 0; k < auraFlames.count; k++) {
    const a = (k / 10) * Math.PI * 2 + time * 0.8;
    const fx = P.pos.x + Math.cos(a) * auraRadius;
    const fz = P.pos.z + Math.sin(a) * auraRadius;
    dummy.position.set(fx, terrainH(fx, fz), fz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.45, 0.45 + Math.sin(time * 10 + k) * 0.15, 0.45);
    dummy.updateMatrix();
    auraFlames.setMatrixAt(k, dummy.matrix);
  }
  auraFlames.instanceMatrix.needsUpdate = true;
  harpMesh.visible = P.harpT > 0;
  if (P.harpT > 0) drape(harpMesh.geometry, harpMesh.userData.base, P.pos.x, P.pos.z, 7 * (1 + (P.st?.area || 0)) * (0.95 + 0.05 * Math.sin(time * 6)), 0.3);

  counts.fill(0);
  boss.idx = -1;
  for (let i = 0; i < E.n; i++) {
    const t = E.type[i];
    if (t === BOSS) {
      boss.idx = i;
      bossRig.group.position.set(E.x[i], E.y[i], E.z[i]);
      bossRig.group.rotation.y = E.face[i];
      bossRig.mat.emissive.setScalar(E.flash[i] > 0 ? 0.5 : 0);
      continue;
    }
    const bob = E.stun[i] > 0 ? 0 : Math.abs(Math.sin(time * 9 + i)) * 0.06;
    dummy.position.set(E.x[i], E.y[i] + bob, E.z[i]);
    dummy.rotation.set(E.st[i] === 2 ? 0.25 : 0.06, E.face[i], 0);
    dummy.scale.setScalar(E.elite[i] === 1 ? 1.4 : E.elite[i] ? 1.15 : 1);
    dummy.updateMatrix();
    const m = enemyMeshes[t];
    const k = counts[t]++;
    m.setMatrixAt(k, dummy.matrix);
    let col = E.elite[i] ? ELITE : WHITE;
    if (E.flash[i] > 0) col = FLASH;
    else if (E.st[i] === 1 && Math.floor(time * 16) % 2) col = WIND;
    else if (E.stun[i] > 0) col = STUN;
    else if (E.slow[i] > 0) col = SLOW;
    m.setColorAt(k, col);
  }
  enemyMeshes.forEach((m, t) => {
    m.count = counts[t];
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  });
  if (bossRig.group.visible) bossAnim(dt);

  const sc = [0, 0, 0];
  for (let i = 0; i < S.n; i++) {
    const kind = S.kind[i];
    dummy.position.set(S.x[i], S.y[i], S.z[i]);
    if (kind === 0) dummy.rotation.set(time * 9 + i, time * 7, 0);
    else if (kind === 3) dummy.rotation.set(0.35, time * 16 + i, 0); // a spinning axe
    else dummy.lookAt(S.x[i] + S.vx[i], S.y[i] + S.vy[i], S.z[i] + S.vz[i]);
    dummy.scale.setScalar(S.size[i]);
    dummy.updateMatrix();
    const k = sc[kind]++;
    shotMeshes[kind].setMatrixAt(k, dummy.matrix);
    shotMeshes[kind].setColorAt(k, S.crit[i] || S.glow[i] ? ELITE : WHITE);
  }
  shotMeshes.forEach((m, kind) => {
    m.count = sc[kind];
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
  });

  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(1);
  for (let i = 0; i < EP.n; i++) {
    dummy.position.set(EP.x[i], EP.y[i], EP.z[i]);
    dummy.updateMatrix();
    eshotMesh.setMatrixAt(i, dummy.matrix);
  }
  eshotMesh.count = EP.n;
  eshotMesh.instanceMatrix.needsUpdate = true;

  let nm = 0;
  let nc = 0;
  const np = PICKUPS.map(() => 0);
  let ng = 0;
  for (let i = 0; i < G.n; i++) {
    const kind = G.kind[i];
    dummy.position.set(G.x[i], G.y[i] + Math.sin(time * 4 + i) * 0.1 + (kind >= 2 ? 0.3 : 0), G.z[i]);
    dummy.rotation.set(0, time * (kind >= 2 ? 1.5 : 3) + i, 0);
    dummy.scale.setScalar(kind >= 2 ? 1 : 1 + Math.log2(G.val[i]) * 0.35);
    dummy.updateMatrix();
    if (kind >= 2) {
      if (np[kind - 2] < 64) pickMeshes[kind - 2].setMatrixAt(np[kind - 2]++, dummy.matrix);
      if (ng < 256) { // a pulsing golden halo on the ground: this one is a pickup
        dummy.position.y = terrainH(G.x[i], G.z[i]) + 0.06;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1 + Math.sin(time * 5 + i) * 0.15);
        dummy.updateMatrix();
        pickGlow.setMatrixAt(ng++, dummy.matrix);
      }
    }
    else if (kind) coinMesh.setMatrixAt(nc++, dummy.matrix);
    else manaMesh.setMatrixAt(nm++, dummy.matrix);
  }
  manaMesh.count = nm;
  coinMesh.count = nc;
  manaMesh.instanceMatrix.needsUpdate = coinMesh.instanceMatrix.needsUpdate = true;
  pickMeshes.forEach((m, k) => { m.count = np[k]; m.instanceMatrix.needsUpdate = true; });
  pickGlow.count = ng;
  pickGlow.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < K.n; i++) {
    const y = terrainH(K.x[i], K.z[i]);
    dummy.position.set(K.x[i], y + 0.15, K.z[i]);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(K.r[i]);
    dummy.updateMatrix();
    strikeMesh.setMatrixAt(i, dummy.matrix);
    const fall = K.t[i] / K.t0[i];
    dummy.position.y = y + 0.3 + fall * 12;
    dummy.rotation.set(time * 5, time * 4, 0);
    dummy.scale.setScalar(K.fire[i] ? 0 : 1);
    dummy.updateMatrix();
    hailMesh.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(K.fire[i] === 2 ? 2.4 : 0);
    dummy.updateMatrix();
    starMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.y = y + fall * 14; // fire: a narrow bolt coming down
    dummy.rotation.set(0, time * 3, 0);
    const bolt = K.fire[i] === 1;
    dummy.scale.set(bolt ? 0.35 : 0, bolt ? 0.7 : 0, bolt ? 0.35 : 0);
    dummy.updateMatrix();
    fireBolt.setMatrixAt(i, dummy.matrix);
  }
  strikeMesh.count = hailMesh.count = fireBolt.count = starMesh.count = K.n;
  strikeMesh.instanceMatrix.needsUpdate = hailMesh.instanceMatrix.needsUpdate = fireBolt.instanceMatrix.needsUpdate = starMesh.instanceMatrix.needsUpdate = true;

  let nl = 0; // locusts whirling around each swarm's centre
  for (let k = 0; k < swarmDraw.length; k += 4) {
    for (let j = 0; j < 16 && nl < 160; j++) {
      const a = time * (2.5 + (j % 5) * 0.6) + j * 2.39;
      const rr = swarmDraw[k + 3] * (0.3 + ((j * 0.618) % 1) * 0.7);
      dummy.position.set(swarmDraw[k] + Math.cos(a) * rr, swarmDraw[k + 1] + 0.8 + Math.sin(time * 6 + j) * 0.35 + (j % 3) * 0.25, swarmDraw[k + 2] + Math.sin(a) * rr);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.setScalar(0.9);
      dummy.updateMatrix();
      locustMesh.setMatrixAt(nl++, dummy.matrix);
    }
  }
  locustMesh.count = nl;
  locustMesh.instanceMatrix.needsUpdate = true;

  dummy.rotation.set(0, 0, 0);
  for (let i = 0; i < PT.n; i++) {
    dummy.position.set(PT.x[i], PT.y[i], PT.z[i]);
    dummy.scale.setScalar(PT.size[i] * (PT.life[i] / PT.max[i]));
    dummy.updateMatrix();
    partMesh.setMatrixAt(i, dummy.matrix);
    partMesh.setColorAt(i, tmpColor.setHex(PT.col[i]));
  }
  partMesh.count = PT.n;
  partMesh.instanceMatrix.needsUpdate = true;
  if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
}

// Follow camera while playing; slow orbit on the menu; close-up of the hero on the setup screen.
const camTarget = new THREE.Vector3();
const focus = new THREE.Vector3();
function updateCamera(dt) {
  const t = performance.now() / 1000;
  if (runStarted) {
    if (state === 'play') {
      const kt = 2.2 * cfg.sens * dt;
      if (keys.has('ArrowLeft')) { yaw += kt; camIdle = 0; }
      if (keys.has('ArrowRight')) { yaw -= kt; camIdle = 0; }
      if (keys.has('ArrowUp')) pitch = clamp(pitch - kt * 0.6, -0.1, 1.3);
      if (keys.has('ArrowDown')) pitch = clamp(pitch + kt * 0.6, -0.1, 1.3);
      camIdle += dt;
      const hs = Math.hypot(P.vel.x, P.vel.z);
      if (cfg.autoCam && camIdle > 1.5 && hs > 3) { // ease behind the movement, unless running at the camera
        const want = Math.atan2(-P.vel.x, -P.vel.z);
        if ((P.vel.x * -Math.sin(yaw) + P.vel.z * -Math.cos(yaw)) / hs > -0.5) yaw += wrap(want - yaw) * Math.min(1, dt * 1.2);
      }
    }
    const d = cfg.camDist * camZoom;
    camTarget.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
    const cp = Math.cos(pitch);
    const cx = camTarget.x + Math.sin(yaw) * cp * d;
    const cz = camTarget.z + Math.cos(yaw) * cp * d;
    const cy = Math.max(camTarget.y + Math.sin(pitch) * d, terrainH(cx, cz) + 0.5);
    shake = state === 'play' ? Math.max(0, shake - dt * 2) : outro ? shake : 0; // paused, cards or end screen: hold still
  if (state === 'play') dustT = Math.max(0, dustT - dt);
  scene.fog.far = 135 - 75 * Math.min(1, dustT / 3, (16 - dustT) / 2); // wind over the bones: dust closes in, then clears
    camera.position.set(cx + (Math.random() - 0.5) * shake, cy + (Math.random() - 0.5) * shake, cz);
    camera.lookAt(camTarget);
    focus.copy(P.pos);
  } else if (heroRig && (state === 'setup' || prevScreen === 'setup')) {
    const a = 0.35 + Math.sin(t * 0.3) * 0.15;
    const y0 = terrainH(0, 0);
    camera.position.set(Math.sin(a) * 4.6, y0 + 1.7, Math.cos(a) * 4.6);
    camera.lookAt(-Math.cos(a) * 1.3, y0 + 1.0, Math.sin(a) * 1.3); // hero sits right of the panel
    focus.set(0, y0, 0);
  } else {
    const a = t * 0.04;
    camera.position.set(Math.cos(a) * 34, terrainH(0, 0) + 16, Math.sin(a) * 34);
    camera.lookAt(0, terrainH(0, 0) + 2, 0);
    focus.set(Math.cos(a) * 12, 0, Math.sin(a) * 12);
  }
  sun.position.set(focus.x + 30, focus.y + 60, focus.z + 22);
  sun.target.position.copy(focus);
  M.shared.uPlayer.value.set(P.pos.x, P.pos.y + 1, P.pos.z);
}

// ---------- HUD (only touches the DOM when something changes) ----------
const setText = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const setHtml = (el, s) => { if (el._t !== s) { el._t = s; el.innerHTML = s; } };
const hud = Object.fromEntries(['hp', 'hp-text', 'fe', 'fe-text', 'fe-bar', 'extra', 'timer', 'phase-dot', 'objective', 'boss-hp', 'level',
  'kills', 'gold', 'slots', 'skill-e', 'skill-q', 'prompt', 'fps', 'xp-fill', 'hurt', 'compass'].map((id) => [id, $(id)]));
const compassTicks = [['N', Math.PI], ['L', Math.PI / 2], ['S', 0], ['O', -Math.PI / 2]].map(([txt, h]) => {
  const el = document.createElement('span');
  el.className = 'tick';
  el.textContent = txt;
  hud.compass.append(el);
  return { el, h };
});
// Price tags floating over nearby chests (red when you cannot pay yet).
const tagEls = Array.from({ length: 4 }, () => {
  const el = document.createElement('div');
  el.className = 'tag';
  $('tags').append(el);
  return el;
});
function updateChestTags() {
  let n = 0;
  for (const c of chests) {
    if (c.open || n >= tagEls.length || Math.hypot(c.x - P.pos.x, c.z - P.pos.z) > 16) continue;
    _v.set(c.x, c.y + 1.6, c.z).project(camera);
    if (_v.z > 1) continue;
    const el = tagEls[n++];
    const cost = c.free ? 0 : chestCost();
    setText(el, c.free ? 'Grátis' : `${cost} siclos`);
    el.classList.toggle('no', P.gold < cost);
    el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * innerWidth}px, ${(-_v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
    el.style.display = '';
  }
  for (; n < tagEls.length; n++) tagEls[n].style.display = 'none';
}
const compassMarks = Array.from({ length: 18 }, () => {
  const el = document.createElement('i');
  el.className = 'mark';
  el.innerHTML = '<small></small>';
  hud.compass.append(el);
  return el;
});
function updateCompass() {
  const camHeading = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
  const place = (el, h) => {
    const x = -wrap(h - camHeading) / (Math.PI / 2); // screen right = negative angle
    el.style.left = `${50 + clamp(x, -1.05, 1.05) * 46}%`;
    el.style.opacity = Math.abs(x) > 1.05 ? 0.35 : 1;
  };
  for (const t of compassTicks) place(t.el, t.h);
  const marks = [];
  for (const s of stones) if (!s.done) marks.push([s, '#f2c14e']);
  for (const a of altars) if (!a.used) marks.push([a, '#ff8a3d']);
  for (const c of chests) { // champion chests always; others when close, gold if affordable
    if (c.open || c.challenge || (!c.free && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) > 45)) continue;
    marks.push([c, c.free || P.gold >= chestCost() ? '#ffd66b' : '#9a8f80']);
  }
  for (const w of world.wells) if (w.cd <= 0) marks.push([w, '#7fc6ff']);
  if (world.rahab && !world.rahab.used) marks.push([world.rahab, '#e03a50']);
  for (const c of chests) if (c.challenge && !c.open && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 60) marks.push([c, '#c8243a']);
  for (const g of world.glints) if (!g.got && Math.hypot(g.x - P.pos.x, g.z - P.pos.z) < 40) marks.push([g, '#e8e4da']);
  for (let i = 0; i < E.n; i++) if (E.elite[i] === 2) marks.push([{ x: E.x[i], z: E.z[i] }, '#ffd66b']);
  if (boss.idx >= 0) marks.push([{ x: E.x[boss.idx], z: E.z[boss.idx] }, '#e5534b']);
  compassMarks.forEach((el, k) => {
    const m = marks[k];
    el.style.display = m ? '' : 'none';
    if (!m) return;
    const dx = m[0].x - P.pos.x;
    const dz = m[0].z - P.pos.z;
    place(el, Math.atan2(dx, dz));
    el.style.background = m[1];
    setText(el.firstChild, `${Math.round(Math.hypot(dx, dz))}m`);
  });
}
let fps = 60;
let slotsKey = '';
function updateHud() {
  if (!runStarted) return;
  const h = HEROES[P.hero];
  hud.hp.style.width = `${clamp(P.hp / P.st.maxHp, 0, 1) * 100}%`;
  setText(hud['hp-text'], `${Math.max(0, Math.ceil(P.hp))} / ${Math.round(P.st.maxHp)}`);
  hud.fe.style.width = `${P.fe}%`;
  hud['fe-bar'].classList.toggle('full', P.fe >= 100);
  setText(hud['fe-text'], P.fe >= 100 ? `Fé cheia · Q ${h.miracle[0]}` : `Fé ${Math.floor(P.fe)}`);
  setText(hud.extra, {
    sansao: `Nazireu +${P.stacks}%`, davi: `Pedra Lisa em ${5 - (P.shotCount % 5)}`, moises: 'Praga a cada nível',
    josue: `Conquista +${Math.round(Math.min(0.8, 0.08 * P.conquests) * 100)}%`, debora: 'Profetisa: 4 cartas',
  }[P.hero]);
  document.body.classList.toggle('sunstop', P.sunT > 0);
  setText(hud.timer, fmt(time));
  hud['phase-dot'].classList.toggle('night', night > 0.5);
  setHtml(hud.objective, boss.spawned ? `<b>Derrote ${B.boss}</b>`
    : `<span>Pedras do Memorial</span><span class="pips">${stones.map((s) => `<i class="${s.done ? 'on' : ''}"></i>`).join('')}</span><span style="opacity:.7">· ${B.boss} em ${fmt(Math.max(0, RUN_TIME - time))}</span>`);
  if (boss.idx >= 0) hud['boss-hp'].style.width = `${clamp(E.hp[boss.idx] / E.maxhp[boss.idx], 0, 1) * 100}%`;
  setText(hud.level, String(P.level));
  setText(hud.kills, String(P.kills));
  setText(hud.gold, String(P.gold));
  const key = P.weapons.map((w) => w.id + w.level).join() + P.relics.length;
  if (key !== slotsKey) {
    slotsKey = key;
    const ready = new Set(readyToEvolve(P.weapons, P.relics));
    hud.slots.innerHTML = [0, 1, 2, 3].map((k) => {
      const w = P.weapons[k];
      const cls = w && WEAPONS[w.id].evo ? ' evo' : ready.has(w) ? ' ready' : '';
      return `<div class="slot${cls}">${w ? `${iconImg(ICON.weapon[w.id])}<div class="lv">${[1, 2, 3, 4, 5].map((l) => `<i class="${l <= w.level ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>`;
    }).join('');
  }
  const cdE = Math.max(0, P.specialCd) / (h.move[2] * Math.max(0.4, 1 - P.st.cd));
  hud['skill-e'].querySelector('.cd').style.transform = `scaleY(${cdE})`;
  hud['skill-e'].classList.toggle('ready', cdE <= 0);
  hud['skill-q'].querySelector('.cd').style.transform = `scaleY(${1 - P.fe / 100})`;
  hud['skill-q'].classList.toggle('ready', P.fe >= 100);
  setText(hud.prompt, promptText);
  if (cfg.fps) setText(hud.fps, `${fps.toFixed(0)} fps · ${E.n} inimigos`);
  hud['xp-fill'].style.width = `${(P.xp / P.xpNext) * 100}%`;
  hud.hurt.style.opacity = P.hurtT > 0 ? 1 : 0;
  updateCompass();
  updateChestTags();
}

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const raw = Math.min((now - last) / 1000, 0.1);
  last = now;
  fps += (1 / Math.max(raw, 1e-3) - fps) * 0.05;
  const playing = state === 'play';
  const dt = Math.min(raw, 1 / 30);
  if (playing) step(dt);
  else M.shared.uTime.value = now / 1000; // keep water moving on the menus
  world.update(raw, playing ? time : now / 1000, night, camera);
  scene.fog.color.copy(world.horizon);
  scene.background.copy(world.horizon);
  syncMeshes(playing ? dt : raw);
  if (outro) updateOutro(raw);
  updateCamera(raw);
  updateHud();
  updateDmgNumbers(playing ? dt : 0);
  render();
});

// ---------- Boot ----------
applyCfg();
syncSettingsForm();
setHero(selHero);
if (params.get('screen') === 'setup') go('setup');
else setCur(document.querySelector('#menu .nav .btn'));

// Debug: run `bench()` in the console. Steps + renders frames back to back with N enemies
// and reports ms per frame (works even in a background tab). Leaves the run invulnerable.
window.bench = (enemies = 500, frames = 300) => {
  if (!runStarted) startRun();
  P.hp = P.st.maxHp = 1e9;
  const t0 = performance.now();
  for (let f = 0; f < frames; f++) {
    state = 'play';
    while (E.n < enemies) spawnEnemy(pickWeighted(spawnWeights(time), random));
    step(1 / 60);
    pendingLevels = 0;
    world.update(1 / 60, time, night, camera);
    syncMeshes(1 / 60);
    updateCamera(1 / 60);
    render();
  }
  renderer.getContext().finish();
  state = 'play';
  show(null);
  const ms = (performance.now() - t0) / frames;
  return `${ms.toFixed(2)} ms/frame (~${Math.round(1000 / ms)} fps max) · ${E.n} inimigos · ${S.n} projéteis · ${G.n} gemas`;
};
// Debug: give the current hero weapons/levels, e.g. arm(['rodas', 'granizo'], 3).
window.arm = (ids, level = 1) => {
  for (const id of ids) {
    const w = P.weapons.find((x) => x.id === id);
    if (w) w.level = level;
    else P.weapons.push({ id, level, timer: 0 });
  }
  refreshWeapons();
  return P.weapons.map((w) => `${w.id} ${w.level}`).join(', ');
};
// Debug: poke at the run from the console, e.g. dev.look(Math.PI) or dev.spawnBoss().
window.dev = {
  P, E, boss, stones, altars, chests, obstacles, miracles, spawnBoss, cfg, scene, ASSETS,
  look: (y, p = pitch) => { yaw = y; pitch = p; },
  // Give a relic, e.g. dev.relic('pedras'); open the nearest closed chest as if touched.
  relic: (id, tier = 2) => { const r = { id, tier: RELICS[id].flat ? RELICS[id].tier : tier }; applyEntry(P.st, RELICS[id], r.tier); P.relics.push(r); refreshWeapons(); return P.relics.map((x) => x.id); },
  chest: () => { const c = chests.filter((k) => !k.open && !k.challenge).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; c.free = true; openChest(c); return c; },
  pickup: (k) => usePickup(k),
  // Trophies: dev.unlockAll() opens everything; dev.resetProfile() starts over (reload after either).
  unlockAll: () => { for (const id in TROPHIES) profile.trophies[id] ??= Date.now(); saveProfile(); OPEN = openSet(profile); return 'ok'; },
  resetProfile: () => { localStorage.removeItem(PROFILE_KEY); return 'ok'; },
  award: (id) => award(id),
  event: () => mapEvent(),
  carrier: () => spawnCarrier(),
  // Show a choice of cards, e.g. dev.choice([{ kind: 'scroll', id: 'sorte', tier: 2 }]).
  choice: (offers = rollOffers({ weapons: P.weapons, luck: P.st.luck }, random, cardCount()), title = 'Nível 2!') => openChoice(title, offers, 'level'),
  // Renders one w×h frame and saves it through serve.py (PUT, shots/ or assets/ui/ only), optionally
  // from cam = [[x, y, z], [lookX, lookY, lookZ]], e.g. dev.shot('shots/a.png', 640, 360).
  shot: (path, w = 640, h = 360, cam) => new Promise((ok, fail) => {
    renderer.setSize(w, h, false);
    target.setSize(w, h);
    postMat.uniforms.texel.value.set(1 / w, 1 / h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (cam) {
      camera.position.set(...cam[0]);
      camera.lookAt(...cam[1]);
    }
    world.update(0, runStarted ? time : performance.now() / 1000, night, camera); // sky colours, even in a background tab
    scene.fog.color.copy(world.horizon);
    scene.background.copy(world.horizon);
    render();
    canvas.toBlob((b) => fetch(path, { method: 'PUT', body: b }).then((r) => (r.ok ? ok(path) : fail(r.status))).finally(resize),
      path.endsWith('.jpg') ? 'image/jpeg' : 'image/png', 0.88);
  }),
  skip: (s) => { time += s; },
};
