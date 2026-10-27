// Materials for the Blender-built models (vertex colours): toon shading with pixel detail, limb swing,
// see-through when blocking the hero, and the water surface. Models themselves live in assets/models.
import * as THREE from 'three';

// ---------- Materials ----------
const ramp = new THREE.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, THREE.RedFormat);
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
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`;
// Pixel-sized surface detail, in world space so it sticks to the surface.
const DETAIL = `
#ifdef GRAIN
diffuseColor.rgb *= 0.86 + 0.28 * hash3(floor(vWorld * 9.0));
#endif
#ifdef GROUND
{
  vec2 c = floor(vWorld.xz * 8.0);
  float n = hash2(c);
  float patchy = hash2(floor(vWorld.xz * 0.45));
  diffuseColor.rgb *= 0.88 + 0.22 * n;
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
  float g = texture2D(uHeight, (vWorld.xz + 128.0) / 256.0).r;
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

// Toon material. vc: vertex colours. walk: limbs swing (instanced enemies). fade: dither away when
// blocking the view of the player. grain: pixel noise. ground: 1 = grass with fallen leaves, 2 = sand,
// 3 = cracked dust with chips of bone.
// water: { height, shallow, deep, fall } makes it a water surface.
export function toon(color = 0xffffff, { vc = true, walk = false, fade = false, grain = false, ground = 0, water = null, ...extra } = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, vertexColors: vc, ...extra });
  if (!(walk || fade || grain || ground || water)) return m;
  m.defines = {
    ...m.defines, ...(walk && { WALK: '' }), ...(fade && { FADE: '' }), ...(grain && { GRAIN: '' }),
    ...(ground && { GROUND: String(ground) }), ...(water?.fall && { FALL: '' }),
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    if (water) {
      Object.assign(sh.uniforms, {
        uHeight: { value: water.height }, uShallow: { value: new THREE.Color(water.shallow) }, uDeep: { value: new THREE.Color(water.deep) },
      });
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${WALK}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_HEAD}${water ? '\nuniform sampler2D uHeight; uniform vec3 uShallow; uniform vec3 uDeep;' : ''}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>${FADE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${water ? WATER : DETAIL}`);
  };
  m.customProgramCacheKey = () => `otr-${walk}-${fade}-${grain}-${ground}-${!!water}-${!!water?.fall}`;
  return m;
}

// A mesh that casts and receives shadows.
export function solid(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
