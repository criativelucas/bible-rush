// Run: node check.mjs — checks the pure logic in src/sim.js and src/content.js.
import assert from 'node:assert/strict';
import { FlowField, SpatialHash, rng } from './src/sim.js';
import { HEROES, WEAPONS, BIOMES, RELICS, EVOLUTIONS, TROPHIES, MAX_WEAPONS, MAX_LEVEL, baseStats, rollOffers, weaponStats, rollRarity, readyToEvolve, openSet, unlockedBy, migrateProfile, exportCode, importCode, PROFILE_VERSION } from './src/content.js';

// Open field: west of the player, arrows point straight east.
{
  const f = new FlowField(10, 1);
  f.update(5.5, 0.5);
  const c = f.index(-5.5, 0.5);
  assert.equal(f.dirX[c], 1);
  assert.equal(f.dirZ[c], 0);
}

// Wall with one gap: following the arrows from behind it reaches the player without entering the wall.
{
  const f = new FlowField(10, 1);
  for (let z = -10; z < 8; z++) f.blockCircle(2.5, z + 0.5, 0.1); // wall at x in [2,3), gap at z >= 8
  f.update(8.5, 0.5);
  const goal = f.index(8.5, 0.5);
  let x = -5.5;
  let z = 0.5;
  let steps = 0;
  while (f.index(x, z) !== goal) {
    const c = f.index(x, z);
    assert.equal(f.blocked[c], 0, 'walked into the wall');
    assert.ok(f.dirX[c] || f.dirZ[c], 'dead end');
    x += Math.sign(f.dirX[c]);
    z += Math.sign(f.dirZ[c]);
    assert.ok(++steps < 400, 'no path');
  }
  assert.ok(steps > 14, 'path should detour through the gap');
}

// Sealed pocket: cells inside get no direction.
{
  const f = new FlowField(10, 1);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) f.blockCircle(-5.5 + dx, -5.5 + dz, 0.1);
  f.update(5.5, 5.5);
  const c = f.index(-5.5, -5.5);
  assert.equal(f.dist[c], -1);
  assert.equal(f.dirX[c], 0);
  assert.equal(f.dirZ[c], 0);
}

// Spatial hash finds exactly what a brute-force scan finds.
{
  const r = rng(1);
  const N = 500;
  const xs = new Float32Array(N);
  const zs = new Float32Array(N);
  for (let i = 0; i < N; i++) { xs[i] = (r() * 2 - 1) * 50; zs[i] = (r() * 2 - 1) * 50; }
  const h = new SpatialHash(50, 2, N);
  const out = new Int32Array(N);
  h.build(xs, zs, N);
  for (let t = 0; t < 100; t++) {
    const x = (r() * 2 - 1) * 50;
    const z = (r() * 2 - 1) * 50;
    const rad = r() * 6;
    const inside = (i) => (xs[i] - x) ** 2 + (zs[i] - z) ** 2 <= rad * rad;
    const got = new Set(Array.from(out.subarray(0, h.query(x, z, rad, out))).filter(inside));
    const want = new Set([...Array(N).keys()].filter(inside));
    assert.deepEqual(got, want);
  }
}

// Level-up cards: no duplicates, no new weapon when slots are full, no upgrade past max level.
{
  const r = rng(3);
  const st = baseStats(HEROES.davi);
  for (let t = 0; t < 300; t++) {
    const ids = Object.keys(WEAPONS);
    const weapons = ids.slice(0, t % (MAX_WEAPONS + 1)).map((id, k) => ({ id, level: 1 + ((t + k) % MAX_LEVEL) }));
    const offers = rollOffers({ weapons, luck: st.luck }, r);
    assert.equal(offers.length, 3);
    assert.equal(new Set(offers.map((o) => o.kind + o.id)).size, 3, 'duplicate card');
    for (const o of offers) {
      if (o.kind === 'weapon') assert.ok(weapons.length < MAX_WEAPONS && !weapons.some((w) => w.id === o.id));
      if (o.kind === 'upgrade') assert.ok(weapons.find((w) => w.id === o.id).level < MAX_LEVEL);
      if (o.kind === 'scroll') assert.ok(o.tier >= 0 && o.tier <= 4);
    }
  }
}

// Weapon levels and player stats stack the way the cards say.
{
  const st = baseStats(HEROES.davi);
  assert.equal(weaponStats('funda', 1, st).count, 1);
  assert.equal(weaponStats('funda', 5, st).count, 3);
  assert.equal(weaponStats('funda', 5, st).bounce, 2);
  st.amount = 1;
  st.area = 0.5;
  assert.equal(weaponStats('funda', 1, st).count, 2);
  assert.ok(Math.abs(weaponStats('sarca', 1, st).radius - 3.2 * 1.5) < 1e-9);
  assert.equal(weaponStats('queixada', 5, st).count, 0, 'melee has no projectiles');
  for (const id in WEAPONS) if (!WEAPONS[id].evo) assert.equal(WEAPONS[id].levels.length, MAX_LEVEL - 1, id);
}

// Luck makes rare tiers more common.
{
  const r = rng(9);
  const avg = (luck) => {
    let s = 0;
    for (let i = 0; i < 20000; i++) s += rollRarity(luck, r);
    return s / 20000;
  };
  assert.ok(avg(1) > avg(0) + 0.2);
  assert.equal(rollRarity(0, () => 0.99, 2), 2, 'min tier respected');
}

// Biomes: spawn and the ring where the memorial stones go are on dry land; the edge of the island is sea.
{
  for (const [id, b] of Object.entries(BIOMES)) {
    assert.ok(b.terrain(0, 0) > b.water + 0.5, `${id}: spawn under water`);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      for (const r of [38, 52]) assert.ok(b.terrain(Math.cos(a) * r, Math.sin(a) * r) > b.water + 0.5, `${id}: stone ring under water`);
      assert.equal(typeof b.ground(1, 1, 0, Math.cos(a) * 30, Math.sin(a) * 30), 'number');
    }
  }
  assert.ok(BIOMES.mar.terrain(95, 0) < BIOMES.mar.water, 'island edge should be sea');
  for (let a = 0; a < Math.PI * 2; a += 0.2) { // shallows: wadeable ring around the island
    const h = BIOMES.mar.terrain(Math.cos(a) * 75, Math.sin(a) * 75);
    assert.ok(h < BIOMES.mar.water && h > BIOMES.mar.water - 0.9, `shallows at ${a.toFixed(1)}: ${h}`);
  }
}

// Evolutions: every base weapon has one, its relic exists, it keeps the base's behaviour; cards never offer
// an evolution, nor a base weapon already evolved; a max-level weapon with its relic is ready.
{
  for (const [id, w] of Object.entries(WEAPONS)) {
    if (w.evo) {
      assert.ok(RELICS[w.needs], `${id} needs a missing relic ${w.needs}`);
      assert.equal(w.kind, WEAPONS[w.from].kind, `${id} changes kind`);
      assert.ok(weaponStats(id, MAX_LEVEL, baseStats(HEROES.davi)).dmg > weaponStats(w.from, MAX_LEVEL, baseStats(HEROES.davi)).dmg * 0.9, `${id} weaker than its base`);
    } else assert.ok(EVOLUTIONS[id], `${id} has no evolution`);
  }
  const weapons = [{ id: 'funda_evo', level: MAX_LEVEL }];
  for (let k = 0; k < 300; k++) {
    for (const o of rollOffers({ weapons, luck: 0 }, Math.random)) {
      assert.ok(!WEAPONS[o.id]?.evo && o.id !== 'funda', `offered ${o.id}`);
    }
  }
  assert.equal(readyToEvolve([{ id: 'funda', level: MAX_LEVEL }], [{ id: 'pedras' }]).length, 1);
  assert.equal(readyToEvolve([{ id: 'funda', level: MAX_LEVEL - 1 }], [{ id: 'pedras' }]).length, 0);
  assert.equal(readyToEvolve([{ id: 'funda', level: MAX_LEVEL }], [{ id: 'aguia' }]).length, 0);
}

// Unlocks: a new profile opens Davi, Sansão, Elá and Mar; everything else has a trophy that opens it;
// every trophy reward names something that exists; a profile with every trophy opens everything.
{
  const fresh = openSet({});
  assert.deepEqual([...fresh].filter((k) => !k.startsWith('relic:')).sort(), ['hero:davi', 'hero:sansao', 'map:ela', 'map:mar']);
  const all = [...Object.keys(HEROES).map((id) => `hero:${id}`), ...Object.keys(BIOMES).map((id) => `map:${id}`), ...Object.keys(RELICS).map((id) => `relic:${id}`)];
  for (const key of all) if (!fresh.has(key)) assert.ok(unlockedBy(key), `${key} is locked with no trophy to open it`);
  for (const [id, t] of Object.entries(TROPHIES)) if (t.unlock) assert.ok(all.includes(t.unlock), `${id} opens unknown ${t.unlock}`);
  const full = openSet({ trophies: Object.fromEntries(Object.keys(TROPHIES).map((id) => [id, 1])) });
  for (const key of all) assert.ok(full.has(key), `${key} never opens`);
}

// Save: a v1 profile keeps its trophies and wins; junk becomes an empty profile;
// the export code round-trips (accents included) and anything else is refused.
{
  const v1 = { trophies: { golias: 5 }, wins: { davi: { ela: true } } };
  const p = migrateProfile(v1);
  assert.equal(p.v, PROFILE_VERSION);
  assert.deepEqual(p.trophies, v1.trophies);
  assert.deepEqual(p.wins, v1.wins);
  assert.equal(p.denarios, 0);
  assert.deepEqual(p.unlocked, []);
  for (const junk of [null, 7, 'x', [], { trophies: [], denarios: 'mil' }]) {
    const q = migrateProfile(junk);
    assert.deepEqual(q.trophies, {});
    assert.equal(q.denarios, 0);
  }
  assert.deepEqual(migrateProfile(p), p); // migrating twice changes nothing
  const rich = migrateProfile({ ...v1, denarios: 340, seen: { 'Mercado': 1 }, owned: ['cos:davi:coroa'] });
  assert.deepEqual(importCode(exportCode(rich)), rich);
  assert.deepEqual(importCode(` ${exportCode(rich).replace(/(.{20})/g, '$1\n')} `), rich); // pasted with line breaks
  for (const bad of ['', 'hello', 'BR2:@@@', 'BR2:' + btoa('[1,2]'), 'BR2:' + btoa('{oops')]) assert.equal(importCode(bad), null);
  assert.ok(openSet(migrateProfile(v1)).has('map:ossos')); // golias opens the Valley of Dry Bones
}

console.log('ok');
