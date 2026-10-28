// Run: node check.mjs — checks the pure logic in src/sim.js and src/content.js.
import assert from 'node:assert/strict';
import { FlowField, SpatialHash, rng } from './src/sim.js';
import { HEROES, WEAPONS, BIOMES, RELICS, EVOLUTIONS, TROPHIES, MAX_WEAPONS, MAX_LEVEL, baseStats, rollOffers, weaponStats, rollRarity, readyToEvolve, openSet, unlockedBy, migrateProfile, exportCode, importCode, PROFILE_VERSION,
  TRAINING, TOOLS, ARSENAL, SUPPLIES, levelCost, runDenarios, applyMarket, lockedWeapons, packSize,
  STAGES, STAGE_XP, heroStage, runXp, stageBonus, COSMETICS, MASTERY, masteryOf, TROPHY_CATS, DIFFS, diffOpen, PACTS, TASKS, rollTasks, taskDef, addRunToTasks, dayKey, weekKey, researchOf, BEAST_KINDS, RESEARCH } from './src/content.js';

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
// The maps are twice the old area; every one has rock faces to climb round and ramps that are walkable.
{
  for (const [id, b] of Object.entries(BIOMES)) {
    assert.ok(b.radius >= 120, `${id}: map should be twice the old area`);
    const sl = (x, z) => Math.hypot(b.terrain(x + 0.25, z) - b.terrain(x - 0.25, z), b.terrain(x, z + 0.25) - b.terrain(x, z - 0.25)) / 0.5;
    let cliffs = 0;
    for (let x = -b.radius; x < b.radius; x += 3) for (let z = -b.radius; z < b.radius; z += 3) if (Math.hypot(x, z) < b.radius - 4 && sl(x, z) > 1) cliffs++;
    assert.ok(cliffs > 50, `${id}: no rock faces (${cliffs})`);
    for (let r = 0; r < 12; r += 1) assert.ok(sl(r, 0) < 0.7, `${id}: spawn should be walkable`);
  }
  for (const [id, b] of Object.entries(BIOMES)) {
    assert.ok(b.terrain(0, 0) > b.water + 0.5, `${id}: spawn under water`);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      for (const r of [38, 52].map((r) => (r * b.radius) / 90)) assert.ok(b.terrain(Math.cos(a) * r, Math.sin(a) * r) > b.water + 0.5, `${id}: stone ring under water`);
      assert.equal(typeof b.ground(1, 1, 0, Math.cos(a) * 30, Math.sin(a) * 30), 'number');
    }
  }
  assert.ok(BIOMES.mar.terrain(BIOMES.mar.radius, 0) < BIOMES.mar.water, 'island edge should be sea');
  for (let a = 0; a < Math.PI * 2; a += 0.2) { // shallows: wadeable ring around the island
    const h = BIOMES.mar.terrain(Math.cos(a) * 100, Math.sin(a) * 100);
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
  assert.deepEqual(p.unlocked, Object.keys(ARSENAL).map((id) => `weapon:${id}`)); // old players keep the newer weapons
  assert.deepEqual(migrateProfile({}).unlocked, []); // new players buy them
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

// Market: costs climb; a run's pay follows the formula; training, tools and supplies reach the run's stats;
// locked (Arsenal) and banned weapons never show up on cards.
{
  for (const t of [...Object.values(TRAINING), ...Object.values(TOOLS)]) {
    for (let k = 1; k < t.max; k++) assert.ok(levelCost(t.cost, k) > levelCost(t.cost, k - 1));
    assert.equal(levelCost(t.cost, 0) % 5, 0);
  }
  assert.equal(runDenarios({ time: 0, kills: 0, stones: 0, chests: 0, won: false }).total, 0);
  const lost = runDenarios({ time: 5 * 60 + 30, kills: 200, stones: 1, chests: 2, won: false });
  assert.equal(lost.total, 15 + 8 + 10 + 10);
  const won = runDenarios({ time: 9 * 60, kills: 1000, stones: 3, chests: 5, won: true });
  assert.equal(won.total, 27 + 40 + 30 + 25 + 60);
  assert.equal(won.lines.reduce((t, [, v]) => t + v, 0), won.total);
  const prof = migrateProfile({ upgrades: { forca: 3, vigor: 2 }, tools: { renovar: 2, quarta: 1, cordao: 1 } });
  const st = applyMarket(baseStats(HEROES.davi), prof, ['oleo', 'bolsa']);
  assert.ok(Math.abs(st.dmg - 0.12) < 1e-9);
  assert.equal(st.maxHp, HEROES.davi.hp + 16);
  assert.equal(st.rerolls, 3);
  assert.equal(st.cards, 1);
  assert.equal(st.revives, 1);
  assert.equal(st.xp, 0.25);
  assert.equal(st.gold, 0.5);
  assert.equal(packSize(prof), 2);
  assert.equal(packSize(migrateProfile({ tools: { alforje: 1 } })), 3);
  const locked = lockedWeapons(migrateProfile({}));
  assert.deepEqual([...locked].sort(), Object.keys(ARSENAL).sort());
  assert.equal(lockedWeapons(migrateProfile({ unlocked: ['weapon:fogo'] })).has('fogo'), false);
  const banned = new Set(['granizo', 'forca']);
  for (let k = 0; k < 300; k++) {
    for (const o of rollOffers({ weapons: [{ id: 'funda', level: 1 }], luck: 0, locked, banned }, Math.random, 4)) {
      assert.ok(!locked.has(o.id) && !banned.has(o.id), `${o.id} should not be offered`);
    }
  }
  for (const it of Object.values(SUPPLIES)) assert.ok(it.cost > 0 && it.name && it.desc);
}

// Hero evolution: stages by time played; bonuses grow with the stage; every hero has three named stages
// whose gear exists in gear.js (checked by name here: gear.js needs a browser).
{
  assert.equal(heroStage(0), 0);
  assert.equal(heroStage(STAGE_XP[1]), 1);
  assert.equal(heroStage(STAGE_XP[2] + 1), 2);
  assert.equal(runXp(600, true), 900);
  const gearSrc = (await import('node:fs')).readFileSync(new URL('./src/gear.js', import.meta.url), 'utf8');
  for (const [id, st] of Object.entries(STAGES)) {
    assert.ok(HEROES[id], `${id}: no such hero`);
    assert.equal(st.names.length, 3);
    for (const g of st.gear.flat()) assert.ok(gearSrc.includes(`  ${g}: [`), `${id}: gear ${g} missing in gear.js`);
    const a = stageBonus(baseStats(HEROES[id]), id, 0);
    const c = stageBonus(baseStats(HEROES[id]), id, 2);
    assert.ok(c[st.stat[0]] > a[st.stat[0]] && c.faith > a.faith, `${id}: stage 3 should be stronger`);
  }
  for (const [cid, c] of Object.entries(COSMETICS)) {
    assert.ok(c.cost > 0 || c.unlock, `${cid}: neither sold nor earned`);
    if (c.slot === 'head' || c.slot === 'back') assert.ok(gearSrc.includes(`  ${cid}: [`), `${cid}: no model in gear.js`);
  }
}

// Weapon mastery: kept by the evolution; every Arsenal weapon exists; trophies are sorted into known tabs.
{
  const prof = migrateProfile({ mastery: { funda: 3 } });
  assert.equal(masteryOf(prof, 'funda'), 3);
  assert.equal(masteryOf(prof, 'funda_evo'), 3);
  assert.equal(masteryOf(prof, 'lanca'), 0);
  for (const id in ARSENAL) assert.ok(WEAPONS[id] && !WEAPONS[id].evo, `${id}: not a base weapon`);
  for (const [id, t] of Object.entries(TROPHIES)) assert.ok(TROPHY_CATS[t.cat], `${id}: unknown tab ${t.cat}`);
}

// Difficulty opens one win at a time; old wins count as Normal wins.
{
  const fresh = migrateProfile({});
  assert.ok(diffOpen(fresh, 'ela', 0) && !diffOpen(fresh, 'ela', 1));
  const won = migrateProfile({ wins: { davi: { ela: true } } });
  assert.ok(diffOpen(won, 'ela', 1) && !diffOpen(won, 'ela', 2) && !diffOpen(won, 'mar', 1));
  assert.ok(DIFFS[2].hp > DIFFS[1].hp && DIFFS[2].pay > DIFFS[1].pay);
  for (const pc of PACTS) assert.ok(pc.good[2] && pc.bad[2] && pc.ref);
}

// Tasks: the same list for the same day; one of each kind; progress adds up (or keeps the best run) and stops at the goal.
{
  const a = rollTasks('2026-10-27', 'day');
  assert.deepEqual(a, rollTasks('2026-10-27', 'day'));
  assert.deepEqual(a.map((t) => t.tier), ['facil', 'media', 'dificil']);
  const w = rollTasks(weekKey(new Date(2026, 9, 29)), 'week');
  assert.equal(new Set(w.map((t) => t.id)).size, 3);
  assert.equal(weekKey(new Date(2026, 9, 26)), weekKey(new Date(2026, 10, 1))); // Monday to Sunday
  assert.notEqual(weekKey(new Date(2026, 10, 1)), weekKey(new Date(2026, 10, 2)));
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
  const list = [{ tier: 'facil', id: 'k300', prog: 0 }, { tier: 'dificil', id: 'b1000', prog: 0 }];
  addRunToTasks(list, { kills: 200 });
  addRunToTasks(list, { kills: 500 });
  assert.equal(list[0].prog, 300); // capped
  assert.equal(list[1].prog, 500); // the best single run
  for (const tier of Object.keys(TASKS)) for (const t of TASKS[tier]) assert.ok(taskDef({ tier, id: t.id }) && t.goal > 0);
}

// Bestiary: research needs every kind of a map.
{
  const kills = Object.fromEntries(BEAST_KINDS.map((k) => [`ela:${k}`, RESEARCH[k]]));
  assert.ok(researchOf({ bestiary: { kills } }, 'ela'));
  assert.ok(!researchOf({ bestiary: { kills: { ...kills, 'ela:chefe': 0 } } }, 'ela'));
  assert.ok(!researchOf({ bestiary: { kills } }, 'mar'));
}

console.log('ok');
