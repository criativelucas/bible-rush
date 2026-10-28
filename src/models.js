// Materials for the Blender-built models (vertex colours): toon shading with pixel detail, limb swing,
// see-through when blocking the hero, and the water surface. Models themselves live in assets/models.
import * as THREE from 'three';

// ---------- Materials ----------
const ramp = new THREE.DataTexture(new Uint8Array([78, 122, 170, 218, 255]), 5, 1, THREE.RedFormat); // five soft bands, not three hard ones
ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

// Shared uniforms: time (walk cycles, water) and the camera→player sightline (blockers dither away).
export const shared = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uFadeOn: { value: 0 } };

const VERT_HEAD = `
attribute vec2 swing;
uniform float uTime;
varying vec3 vWorld;`;
const WALK = `
#ifdef WALK
if (swing.x != 0.0) {
  #ifdef USE_INSTANCING
  float ph = uTime * 9.0 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.6;
  #else
  float ph = uTime * 9.0;
  #endif
  float a = swing.x * sin(ph) * 0.6;
  float c = cos(a);
  float s = sin(a);
  float yy = transformed.y - swing.y;
  transformed.y = swing.y + yy * c - transformed.z * s;
  transformed.z = yy * s + transformed.z * c;
}
#endif
{
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  #endif
  vWorld = (modelMatrix * wp).xyz;
}`;
const FRAG_HEAD = `
uniform vec3 uPlayer;
uniform float uFadeOn;
uniform float uTime;
varying vec3 vWorld;
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}`;
// Pixel-sized surface detail, in world space so it sticks to the surface.
const DETAIL = `
#ifdef GRAIN
diffuseColor.rgb *= (0.86 + 0.28 * hash3(floor(vWorld * 9.0))) * (0.9 + 0.2 * vnoise(vWorld.xz * 0.6 + vWorld.y * 0.8));
#endif
#ifdef GROUND
{
  vec2 c = floor(vWorld.xz * 8.0);
  float n = hash2(c);
  float patchy = hash2(floor(vWorld.xz * 0.45));
  vec3 wn = normalize(cross(dFdx(vWorld), dFdy(vWorld))); // the face's own normal (flat shaded)
  // Painted texture: broad patches of lush and dry ground, clumps, then pixel grain.
  float macro = vnoise(vWorld.xz * 0.07) * 0.6 + vnoise(vWorld.xz * 0.23) * 0.4;
  diffuseColor.rgb *= (0.84 + 0.3 * macro) * (0.9 + 0.2 * vnoise(vWorld.xz * 2.2));
  diffuseColor.rgb *= 0.88 + 0.22 * n;
  if (abs(wn.y) < 0.62) { // rock faces: courses of stone blocks, each its own shade, dark joints, lit top edges
    vec2 tg = normalize(vec2(-wn.z, wn.x) + 1e-5);
    float rowH = 0.9;
    float row = floor(vWorld.y / rowH);
    float uu = dot(vWorld.xz, tg) / (1.4 + 0.9 * hash2(vec2(row, 7.0))) + hash2(vec2(row, 3.0));
    vec2 f = vec2(fract(uu), fract(vWorld.y / rowH));
    float joint = min(1.0, step(f.x, 0.05) + step(f.y, 0.09));
    diffuseColor.rgb *= (0.8 + 0.32 * hash2(vec2(floor(uu), row))) * (1.0 - 0.42 * joint) * (1.0 + 0.14 * step(0.84, f.y));
  }
  #ifdef PAVE
  else if (length(vWorld.xz - uPave.xy) < uPave.z) { // a paved city: cobbles in staggered rows
    vec2 q = vWorld.xz / 0.85;
    q.x += 0.5 * mod(floor(q.y), 2.0);
    vec2 f = fract(q);
    float gap = min(1.0, step(f.x, 0.08) + step(f.y, 0.1));
    diffuseColor.rgb *= (0.82 + 0.3 * hash2(floor(q))) * (1.0 - 0.45 * gap);
  }
  #endif
  if (abs(wn.y) >= 0.62) { // leaves, shells and bone chips lie on the ground, not on the rock walls
  #if GROUND == 1
  if (n > 0.972 - patchy * 0.04) { // fallen autumn leaves
    float k = hash2(c + 3.7);
    diffuseColor.rgb = k < 0.33 ? vec3(0.78, 0.36, 0.08) : k < 0.66 ? vec3(0.86, 0.6, 0.12) : vec3(0.6, 0.16, 0.06);
  } else if (n < 0.07) diffuseColor.rgb *= 1.28; // light grass blades
  #elif GROUND == 2
  if (n > 0.985) diffuseColor.rgb = vec3(0.98, 0.88, 0.82); // shells, pale grains
  #else
  if (n > 0.982 - patchy * 0.01) diffuseColor.rgb = vec3(0.86, 0.82, 0.72); // chips of bone in the dust
  else if (n < 0.06) diffuseColor.rgb *= 0.74; // dry cracks
  #endif
  }
}
#endif`;
// Dissolve (a hero falling): bits of the body vanish in a fixed pixel pattern, with a glowing edge.
const DISSOLVE = `
#ifdef DISSOLVE
float dn = hash3(floor(vWorld * 14.0));
if (dn < uDissolve) discard;
#endif`;
const DISSOLVE_EDGE = `
#ifdef DISSOLVE
if (uDissolve > 0.0 && dn < uDissolve + 0.08) diffuseColor.rgb = vec3(1.0, 0.8, 0.42);
#endif`;
const FADE = `
#ifdef FADE
if (uFadeOn > 0.5) {
  vec3 sd = uPlayer - cameraPosition;
  vec3 rel = vWorld - cameraPosition;
  float tt = clamp(dot(rel, sd) / dot(sd, sd), 0.0, 1.0);
  float f = tt < 0.9 ? smoothstep(0.5, 1.8, length(rel - sd * tt)) : 1.0;
  f = min(f, smoothstep(1.5, 3.5, length(rel)));
  if (f <= bayer4(gl_FragCoord.xy)) discard;
}
#endif`;

// Water: turquoise in the shallows, deep blue further out, foam at the shore, drifting ripple dashes.
// Depth comes from a height map of the terrain. FALL turns it into a waterfall (streaks running down).
const WATER = `
{
  float g = texture2D(uHeight, (vWorld.xz + 176.0) / 352.0).r; // world.js: the height map spans [-176, 176]
  float depth = vWorld.y - g;
  vec3 col = mix(uShallow, uDeep, smoothstep(0.1, 2.4, depth));
  float wob = sin(vWorld.x * 1.7 + uTime * 1.6) * sin(vWorld.z * 1.3 - uTime * 1.1) * 0.04;
  float foam = step(depth, 0.045 + wob) * 0.85;
  float dash = step(0.988, hash2(floor(vec2(vWorld.x * 0.7 + uTime * 0.25, vWorld.z * 3.2)))) * step(0.35, depth);
  #ifdef FALL
  foam = step(0.55, hash2(vec2(floor((vWorld.x + vWorld.z) * 7.0), floor(vWorld.y * 5.0 + uTime * 9.0))));
  dash = 0.0;
  #endif
  diffuseColor.rgb = mix(col, vec3(1.0), max(foam * 0.9, dash * 0.8));
  diffuseColor.a = max(foam, smoothstep(-0.05, 1.2, depth) * 0.35 + 0.55);
}`;

// Rim light: a thin bright edge on the side away from the camera's view, like the light catching a sprite.
const RIM = `
#ifdef RIM
totalEmissiveRadiance += vec3(1.0, 0.92, 0.78) * pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0) * 0.55;
#endif`;

// Toon material. vc: vertex colours. walk: limbs swing (instanced enemies). fade: dither away when
// blocking the view of the player. grain: pixel noise. ground: 1 = grass with fallen leaves, 2 = sand,
// 3 = cracked dust with chips of bone.
// water: { height, shallow, deep, fall } makes it a water surface.
// dissolve: a { value } uniform from 0 (whole) to 1 (gone).
// rim: a lit edge (characters). pave: [x, z, r], a paved circle on the ground (Jericho's streets).
export function toon(color = 0xffffff, { vc = true, walk = false, fade = false, grain = false, ground = 0, water = null, dissolve = null, rim = false, pave = null, ...extra } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, vertexColors: vc, ...extra });
  if (!(walk || fade || grain || ground || water || dissolve || rim)) return m;
  m.defines = {
    ...m.defines, ...(walk && { WALK: '' }), ...(fade && { FADE: '' }), ...(grain && { GRAIN: '' }),
    ...(ground && { GROUND: String(ground) }), ...(water?.fall && { FALL: '' }), ...(dissolve && { DISSOLVE: '' }),
    ...(rim && { RIM: '' }), ...(pave && { PAVE: '' }),
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    if (dissolve) sh.uniforms.uDissolve = dissolve;
    if (pave) sh.uniforms.uPave = { value: new THREE.Vector3(...pave) };
    if (water) {
      Object.assign(sh.uniforms, {
        uHeight: { value: water.height }, uShallow: { value: new THREE.Color(water.shallow) }, uDeep: { value: new THREE.Color(water.deep) },
      });
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${WALK}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_HEAD}${water ? '\nuniform sampler2D uHeight; uniform vec3 uShallow; uniform vec3 uDeep;' : ''}${dissolve ? '\nuniform float uDissolve;' : ''}${pave ? '\nuniform vec3 uPave;' : ''}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${FADE}${DISSOLVE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${water ? WATER : DETAIL}${DISSOLVE_EDGE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${RIM}`);
  };
  m.customProgramCacheKey = () => `otr-${walk}-${fade}-${grain}-${ground}-${!!water}-${!!water?.fall}-${!!dissolve}-${rim}-${!!pave}`;
  return m;
}

// A mesh that casts and receives shadows.
export function solid(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
