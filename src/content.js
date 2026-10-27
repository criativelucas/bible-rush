// Game content as plain data + small pure helpers. No three.js here: checked by check.mjs.

export const MAX_WEAPONS = 4;
export const MAX_LEVEL = 5;

// Rarity follows the metals of the statue in Daniel 2, clay to gold.
export const RARITY = [
  { name: 'Barro', mult: 1, color: '#c2a98a' },
  { name: 'Ferro', mult: 1.3, color: '#a9bccb' },
  { name: 'Bronze', mult: 1.7, color: '#e09a55' },
  { name: 'Prata', mult: 2.2, color: '#eef4fa' },
  { name: 'Ouro', mult: 3, color: '#f2c14e' },
];

// Luck squeezes the roll toward the rare end.
export function rollRarity(luck, rand, min = 0) {
  const r = rand() / (1 + luck);
  const tier = r < 0.01 ? 4 : r < 0.05 ? 3 : r < 0.15 ? 2 : r < 0.4 ? 1 : 0;
  return Math.max(tier, min);
}

export function pickWeighted(weights, rand) {
  let r = rand() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < weights.length - 1; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
}

// ---------- Heroes ----------
// move: [name, text, cooldown s]
export const HEROES = {
  davi: {
    name: 'Davi', role: 'Ágil, à distância', hp: 100, speed: 8.5, weapon: 'funda', color: 0xe8d3a8,
    passive: ['Pedras Lisas', 'Cada 5º projétil causa 5× dano. +50% de dano em gigantes, elites e chefes.'],
    move: ['Rolamento', 'Esquiva rápida e invencível.', 2.5],
    miracle: ['Harpa', 'Por 6 s, inimigos por perto ficam lentos e você se cura.'],
  },
  sansao: {
    name: 'Sansão', role: 'Corpo a corpo', hp: 140, speed: 7.6, weapon: 'queixada', color: 0xc98a5a,
    passive: ['Nazireu', 'Cada abate dá +1% de dano (até +100%). Levar dano perde metade.'],
    move: ['Investida', 'Avança atropelando inimigos.', 4],
    miracle: ['Colunas', 'Dois pilares desabam à frente e esmagam tudo.'],
  },
  moises: {
    name: 'Moisés', role: 'Controle', hp: 95, speed: 8, weapon: 'cajado', color: 0xd9d4c8,
    passive: ['Pragas', 'A cada nível, uma praga cai sobre os inimigos: granizo, trevas ou úlceras.'],
    move: ['Abrir Caminho', 'Avança empurrando inimigos para os lados.', 3.5],
    miracle: ['Abrir o Mar', 'Paredes de água abrem um corredor e depois se fecham esmagando.'],
  },
};

export function baseStats(hero) {
  return {
    dmg: 0, cd: 0, area: 0, dur: 0, amount: 0, speed: 0, maxHp: hero.hp, regen: 0, armor: 0,
    pickup: 0, luck: 0, crit: 0.05, xp: 0, burn: 0, airJumps: 0, revives: 0, rerolls: 1,
    vamp: 0, gold: 0, faith: 0, // life per kill, extra siclos, extra Fé
  };
}

// ---------- Stat entries: scrolls (level-up) and relics (chests) ----------
export const SCROLLS = {
  forca: { name: 'Rolo da Força', stat: 'dmg', base: 0.08, pct: true, label: 'Dano' },
  prontidao: { name: 'Rolo da Prontidão', stat: 'cd', base: 0.05, pct: true, neg: true, label: 'Recarga' },
  amplidao: { name: 'Rolo da Amplidão', stat: 'area', base: 0.08, pct: true, label: 'Área' },
  constancia: { name: 'Rolo da Constância', stat: 'dur', base: 0.1, pct: true, label: 'Duração' },
  corrida: { name: 'Rolo da Corrida', stat: 'speed', base: 0.05, pct: true, label: 'Velocidade' },
  vida: { name: 'Rolo da Vida', stat: 'maxHp', base: 12, label: 'Vida máx.' },
  alcance: { name: 'Rolo do Alcance', stat: 'pickup', base: 0.15, pct: true, label: 'Coleta' },
  sorte: { name: 'Rolo da Sorte', stat: 'luck', base: 0.08, pct: true, label: 'Sorte' },
  precisao: { name: 'Rolo da Precisão', stat: 'crit', base: 0.03, pct: true, label: 'Crítico' },
  sabedoria: { name: 'Rolo da Sabedoria', stat: 'xp', base: 0.08, pct: true, label: 'XP' },
};

// flat: fixed value and fixed tier, no rarity scaling.
export const RELICS = {
  efode: { name: 'Éfode', ref: 'Êx 28', stat: 'crit', base: 0.05, pct: true, label: 'Crítico' },
  urim: { name: 'Urim e Tumim', ref: 'Êx 28:30', stat: 'luck', base: 0.12, pct: true, label: 'Sorte', extra: { rerolls: 1 } },
  oleo: { name: 'Óleo da Unção', ref: '1 Sm 16:13', stat: 'xp', base: 0.1, pct: true, label: 'XP' },
  sandalias: { name: 'Sandálias que não gastaram', ref: 'Dt 29:5', stat: 'speed', base: 0.05, pct: true, label: 'Velocidade' },
  tunica: { name: 'Túnica de José', ref: 'Gn 37:3', stat: 'burn', base: 0.08, pct: true, label: 'Chance de queimar' },
  vaso: { name: 'Vaso da Viúva', ref: '2 Rs 4:6', stat: 'regen', base: 0.3, label: 'Vida/s' },
  couraca: { name: 'Couraça de Bronze', ref: '1 Sm 17:5', stat: 'armor', base: 0.05, pct: true, label: 'Armadura' },
  shofar: { name: 'Shofar', ref: 'Js 6:20', stat: 'area', base: 0.08, pct: true, label: 'Área' },
  ezequias: { name: 'Sombra de Ezequias', ref: '2 Rs 20:11', stat: 'cd', base: 0.05, pct: true, neg: true, label: 'Recarga' },
  cordao: { name: 'Cordão Escarlate', ref: 'Js 2:18', stat: 'revives', base: 1, flat: true, tier: 4, label: 'Reviver' },
  pedras: { name: 'Cinco Pedras Lisas', ref: '1 Sm 17:40', stat: 'amount', base: 1, flat: true, tier: 3, label: 'Projéteis' },
  aguia: { name: 'Asas de Águia', ref: 'Is 40:31', stat: 'airJumps', base: 1, flat: true, tier: 3, label: 'Pulo no ar' },
  manto: { name: 'Manto de Elias', ref: '2 Rs 2:13', stat: 'dur', base: 0.1, pct: true, label: 'Duração' },
  mel: { name: 'Favo de Mel', ref: 'Jz 14:8', stat: 'vamp', base: 0.4, label: 'Vida por abate' },
  anel: { name: 'Anel de José', ref: 'Gn 41:42', stat: 'gold', base: 0.15, pct: true, label: 'Siclos' },
  cetro: { name: 'Cetro de Judá', ref: 'Gn 49:10', stat: 'dmg', base: 0.06, pct: true, label: 'Dano' },
  harpa: { name: 'Harpa de Davi', ref: '1 Sm 16:23', stat: 'faith', base: 0.15, pct: true, label: 'Fé' },
};

export function entryValue(e, tier) {
  return e.flat ? e.base : e.base * RARITY[tier].mult;
}

export function statText(e, tier) {
  const v = entryValue(e, tier);
  const num = e.pct ? `${Math.round(v * 100)}%` : v >= 5 || e.flat ? `${Math.round(v)}` : v.toFixed(1);
  return `${e.label} ${e.neg ? '−' : '+'}${num}`;
}

export function applyEntry(st, e, tier) {
  st[e.stat] += entryValue(e, tier);
  for (const k in e.extra || {}) st[k] += e.extra[k];
}

export function rollRelic(luck, rand, min = 0) {
  const ids = Object.keys(RELICS);
  const id = ids[pickWeighted(ids.map((k) => (RELICS[k].flat ? 0.4 : 1)), rand)];
  const e = RELICS[id];
  return { id, tier: e.flat ? e.tier : rollRarity(luck, rand, min) };
}

// ---------- Weapons ----------
// Each weapon = one behaviour (kind) + numbers. levels[k] are the mods gained at level k + 2.
export const WEAPONS = {
  funda: {
    name: 'Funda', unit: 'pedra', kind: 'shot', desc: 'Pedra no inimigo mais próximo; ricocheteia.',
    dmg: 12, cd: 0.8, count: 1, bounce: 1, speed: 32, life: 1.2, range: 26, size: 0.2, proj: 'stone',
    levels: [{ dmg: 0.3 }, { count: 1 }, { bounce: 1, cd: 0.1 }, { count: 1, dmg: 0.3 }],
  },
  flechas: {
    name: 'Flechas de Jônatas', unit: 'flecha', kind: 'shot', desc: 'Flechas rápidas que atravessam inimigos.',
    dmg: 9, cd: 1.1, count: 2, pierce: 2, speed: 46, life: 0.9, range: 30, size: 0.15, proj: 'arrow',
    levels: [{ count: 1 }, { pierce: 1, dmg: 0.25 }, { cd: 0.15 }, { count: 2 }],
  },
  queixada: {
    name: 'Queixada', kind: 'melee', desc: 'Golpe largo à frente que empurra inimigos.',
    dmg: 24, cd: 1.0, radius: 3.2, arc: 2.4, knock: 9,
    levels: [{ dmg: 0.3 }, { area: 0.25 }, { cd: 0.15 }, { dmg: 0.4, area: 0.2 }],
  },
  cajado: {
    name: 'Cajado-Serpente', unit: 'serpente', kind: 'seeker', desc: 'Serpente que caça e atravessa inimigos.',
    dmg: 14, cd: 1.3, count: 1, pierce: 3, speed: 14, life: 3.5, turn: 5, range: 24, size: 0.24, proj: 'snake',
    levels: [{ count: 1 }, { pierce: 2, dmg: 0.2 }, { cd: 0.15 }, { count: 1, dmg: 0.3 }],
  },
  rodas: {
    name: 'Rodas de Ezequiel', unit: 'roda', kind: 'orbit', desc: 'Rodas cheias de olhos giram ao seu redor.',
    dmg: 9, cd: 0.3, count: 2, radius: 2.6, spin: 2.6, size: 0.6,
    levels: [{ count: 1 }, { dmg: 0.3 }, { area: 0.2, count: 1 }, { dmg: 0.4 }],
  },
  sarca: {
    name: 'Sarça Ardente', kind: 'aura', desc: 'Fogo ao seu redor que não se apaga.',
    dmg: 6, cd: 0.5, radius: 3.2,
    levels: [{ area: 0.2 }, { dmg: 0.4 }, { area: 0.2, cd: 0.1 }, { dmg: 0.5 }],
  },
  granizo: {
    name: 'Granizo', unit: 'granizo', kind: 'sky', desc: 'Pedras de gelo caem sobre inimigos.',
    dmg: 26, cd: 1.6, count: 2, radius: 2, range: 22, delay: 0.5,
    levels: [{ count: 1 }, { area: 0.25, dmg: 0.2 }, { count: 1 }, { cd: 0.2, dmg: 0.3 }],
  },
  trombeta: {
    name: 'Trombeta', kind: 'cone', desc: 'Onda de som em cone que fere e empurra.',
    dmg: 16, cd: 1.8, radius: 9, arc: 1.1, knock: 14,
    levels: [{ dmg: 0.3 }, { area: 0.2 }, { cd: 0.15 }, { dmg: 0.4, area: 0.2 }],
  },
  machado: {
    name: 'Machado de Eliseu', unit: 'machado', kind: 'boomerang', desc: 'Lâmina que voa longe e volta flutuando, cortando na ida e na volta.',
    dmg: 16, cd: 1.6, count: 1, speed: 20, range: 14, life: 1.4, size: 0.5, proj: 'axe',
    levels: [{ count: 1 }, { dmg: 0.3 }, { cd: 0.15, area: 0.2 }, { count: 1, dmg: 0.3 }],
  },
  carros: {
    name: 'Carros de Fogo', unit: 'carro', kind: 'sweep', desc: 'Um carro de fogo atravessa o campo e atropela tudo no caminho.',
    dmg: 28, cd: 4.5, count: 1, radius: 2.2, speed: 30, knock: 12,
    levels: [{ dmg: 0.3 }, { count: 1 }, { cd: 0.2 }, { count: 1, dmg: 0.3 }],
  },
  gafanhotos: {
    name: 'Gafanhotos', unit: 'enxame', kind: 'swarm', desc: 'Uma nuvem de gafanhotos persegue os inimigos e os devora.',
    dmg: 4, cd: 0.3, count: 1, radius: 2.2, speed: 7,
    levels: [{ area: 0.25 }, { dmg: 0.4 }, { count: 1 }, { dmg: 0.4, area: 0.2 }],
  },
  fogo: {
    name: 'Fogo do Céu', unit: 'raio', kind: 'sky', target: 'strong', fire: true, desc: 'Fogo cai do céu sobre o inimigo mais forte por perto.',
    dmg: 80, cd: 3.5, count: 1, radius: 2.8, range: 26, delay: 0.9, burn: 3,
    levels: [{ dmg: 0.3 }, { area: 0.25 }, { cd: 0.15 }, { count: 1, dmg: 0.3 }],
  },

  // Evolutions: a weapon at its last level, plus its relic, becomes one of these at the next chest.
  funda_evo: {
    name: 'Pedra do Gigante', evo: true, from: 'funda', needs: 'pedras', unit: 'pedra', kind: 'shot', ref: '1 Sm 17:49',
    desc: 'Pedras enormes que ricocheteiam três vezes e atravessam.',
    dmg: 34, cd: 0.6, count: 3, bounce: 3, pierce: 1, speed: 38, life: 1.4, range: 30, size: 0.34, proj: 'stone', levels: [],
  },
  flechas_evo: {
    name: 'Flecha da Vitória', evo: true, from: 'flechas', needs: 'aguia', unit: 'flecha', kind: 'shot', ref: '2 Rs 13:17',
    desc: 'Rajadas de seis flechas que atravessam fileiras inteiras.',
    dmg: 18, cd: 0.7, count: 6, pierce: 6, speed: 54, life: 1.0, range: 32, size: 0.2, proj: 'arrow', levels: [],
  },
  queixada_evo: {
    name: 'Mil Golpes', evo: true, from: 'queixada', needs: 'couraca', kind: 'melee', ref: 'Jz 15:16',
    desc: 'O golpe gira em volta de você e arremessa a multidão.',
    dmg: 48, cd: 0.8, radius: 4.6, arc: 6.28, knock: 14, levels: [],
  },
  cajado_evo: {
    name: 'Vara que Floresceu', evo: true, from: 'cajado', needs: 'oleo', unit: 'serpente', kind: 'seeker', ref: 'Nm 17:8',
    desc: 'Quatro serpentes caçam sem descanso e atravessam sete inimigos.',
    dmg: 24, cd: 0.9, count: 4, pierce: 7, speed: 16, life: 4.5, turn: 7, range: 26, size: 0.3, proj: 'snake', levels: [],
  },
  rodas_evo: {
    name: 'Rodas dos Querubins', evo: true, from: 'rodas', needs: 'efode', unit: 'roda', kind: 'orbit', ref: 'Ez 10:9',
    desc: 'Seis rodas em brasa giram largas e queimam o que tocam.',
    dmg: 20, cd: 0.22, count: 6, radius: 3.4, spin: 3.2, size: 0.75, burn: 2, levels: [],
  },
  sarca_evo: {
    name: 'Fogo que não Consome', evo: true, from: 'sarca', needs: 'tunica', kind: 'aura', ref: 'Êx 3:2',
    desc: 'Um círculo de fogo amplo que incendeia quem entra.',
    dmg: 14, cd: 0.35, radius: 5.2, burn: 3, levels: [],
  },
  granizo_evo: {
    name: 'Granizo e Fogo', evo: true, from: 'granizo', needs: 'ezequias', unit: 'granizo', kind: 'sky', fire: true, ref: 'Êx 9:24',
    desc: 'Seis pedras de gelo envoltas em fogo caem de uma vez.',
    dmg: 44, cd: 1.0, count: 6, radius: 2.8, range: 26, delay: 0.45, burn: 3, levels: [],
  },
  trombeta_evo: {
    name: 'Muralhas de Jericó', evo: true, from: 'trombeta', needs: 'shofar', kind: 'cone', ref: 'Js 6:20',
    desc: 'Um brado em todas as direções que derruba e atordoa.',
    dmg: 42, cd: 1.6, radius: 12, arc: 6.28, knock: 22, stun: 1.2, levels: [],
  },
  machado_evo: {
    name: 'Ferro que Flutua', evo: true, from: 'machado', needs: 'cetro', unit: 'machado', kind: 'boomerang', ref: '2 Rs 6:6',
    desc: 'Três machados enormes cortam longe e voltam.',
    dmg: 34, cd: 1.1, count: 3, speed: 24, range: 18, life: 1.6, size: 0.75, proj: 'axe', levels: [],
  },
  carros_evo: {
    name: 'Redemoinho de Elias', evo: true, from: 'carros', needs: 'manto', unit: 'carro', kind: 'sweep', ref: '2 Rs 2:11',
    desc: 'Três carros de fogo cruzam o campo e deixam tudo em chamas.',
    dmg: 50, cd: 2.6, count: 3, radius: 3, speed: 34, knock: 16, burn: 2, levels: [],
  },
  gafanhotos_evo: {
    name: 'Vento Oriental', evo: true, from: 'gafanhotos', needs: 'mel', unit: 'enxame', kind: 'swarm', ref: 'Êx 10:13',
    desc: 'Três nuvens imensas de gafanhotos varrem o campo.',
    dmg: 9, cd: 0.22, count: 3, radius: 3.2, speed: 9, levels: [],
  },
  fogo_evo: {
    name: 'Fogo de Elias', evo: true, from: 'fogo', needs: 'harpa', unit: 'raio', kind: 'sky', target: 'strong', fire: true, ref: '1 Rs 18:38',
    desc: 'Três colunas de fogo consomem os mais fortes, até a pedra.',
    dmg: 220, cd: 2.4, count: 3, radius: 4, range: 30, delay: 0.7, burn: 4, levels: [],
  },
};

// Base weapon -> its evolution (and the relic it needs).
export const EVOLUTIONS = Object.fromEntries(Object.entries(WEAPONS).filter(([, w]) => w.evo).map(([id, w]) => [w.from, { into: id, needs: w.needs }]));

// Owned weapons ready to evolve: at the last level and holding the relic.
export function readyToEvolve(weapons, relics) {
  return weapons.filter((w) => {
    const e = EVOLUTIONS[w.id];
    return e && w.level >= MAX_LEVEL && relics.some((r) => r.id === e.needs);
  });
}

// Pickups that drop from jars, elites and treasure carriers (drawn as items.glb pick_<id>).
export const PICKUPS = [
  { id: 'pao', name: 'Pão', ref: '1 Rs 19:6', text: 'Cura 30% da vida' },
  { id: 'codornizes', name: 'Codornizes', ref: 'Êx 16:13', text: 'Todo o maná voa até você' },
  { id: 'botija', name: 'Botija de Óleo', ref: '1 Rs 17:16', text: 'Fé +50' },
  { id: 'tocha', name: 'Tocha de Gideão', ref: 'Jz 7:20', text: 'Atordoa e empurra os inimigos por perto' },
];

// Weapon numbers at a level, with the player's stats folded in (global damage is applied on hit).
export function weaponStats(id, level, st) {
  const w = WEAPONS[id];
  const s = { ...w };
  let dmg = 0;
  let cd = 0;
  let area = 0;
  for (const m of w.levels.slice(0, level - 1)) {
    dmg += m.dmg || 0;
    cd += m.cd || 0;
    area += m.area || 0;
    s.count = (s.count || 0) + (m.count || 0);
    s.bounce = (s.bounce || 0) + (m.bounce || 0);
    s.pierce = (s.pierce || 0) + (m.pierce || 0);
  }
  const areaMul = (1 + area) * (1 + st.area);
  s.dmg = w.dmg * (1 + dmg);
  s.cd = w.cd * (1 - cd) * Math.max(0.4, 1 - st.cd);
  if (w.radius) s.radius = w.radius * areaMul;
  if (w.kind === 'orbit') s.size = w.size * Math.sqrt(areaMul);
  if (w.count) s.count = (s.count || 0) + st.amount;
  if (w.life) s.life = w.life * (1 + st.dur);
  return s;
}

export function describeLevel(id, level) {
  const w = WEAPONS[id];
  const m = w.levels[level - 2];
  const parts = [];
  if (m.count) parts.push(`+${m.count} ${w.unit}${m.count > 1 ? 's' : ''}`);
  if (m.dmg) parts.push(`Dano +${Math.round(m.dmg * 100)}%`);
  if (m.cd) parts.push(`Recarga −${Math.round(m.cd * 100)}%`);
  if (m.area) parts.push(`Área +${Math.round(m.area * 100)}%`);
  if (m.bounce) parts.push(`+${m.bounce} ricochete`);
  if (m.pierce) parts.push(`+${m.pierce} perfuração`);
  return parts.join(' · ');
}

// Level-up cards: new weapons (if a slot is free), upgrades for owned weapons, scrolls. No duplicates.
export function rollOffers({ weapons, luck }, rand, n = 3) {
  const owned = new Map(weapons.map((w) => [w.id, w.level]));
  const evolved = new Set(weapons.map((w) => WEAPONS[w.id].from).filter(Boolean));
  const pool = [];
  for (const id in WEAPONS) {
    if (WEAPONS[id].evo || evolved.has(id)) continue; // evolutions come from chests, not cards
    const lv = owned.get(id);
    if (lv === undefined) {
      if (weapons.length < MAX_WEAPONS) pool.push({ kind: 'weapon', id, w: 1.2 });
    } else if (lv < MAX_LEVEL) pool.push({ kind: 'upgrade', id, w: 2.5 });
  }
  for (const id in SCROLLS) pool.push({ kind: 'scroll', id, w: 0.5 });
  const out = [];
  while (out.length < n && pool.length) {
    const o = pool.splice(pickWeighted(pool.map((p) => p.w), rand), 1)[0];
    if (o.kind === 'scroll') o.tier = rollRarity(luck, rand);
    out.push(o);
  }
  return out;
}

// ---------- Enemies (same stats in every biome; models and names change) ----------
export const ENEMIES = [
  { id: 'soldado', hp: 18, speed: 3, speedVar: 1.5, dmg: 10, r: 0.45, h: 1.6, xp: 1, mass: 1 },
  { id: 'fundeiro', hp: 14, speed: 3.4, speedVar: 0.6, dmg: 8, r: 0.4, h: 1.5, xp: 2, mass: 1, ranged: true },
  { id: 'carro', hp: 45, speed: 3.6, speedVar: 0.6, dmg: 18, r: 0.8, h: 1.7, xp: 3, mass: 0.6, charger: true },
  { id: 'gigante', hp: 120, speed: 2, speedVar: 0.4, dmg: 22, r: 0.9, h: 2.7, xp: 6, mass: 0.25, big: true },
  { id: 'chefe', hp: 7000, speed: 2.6, speedVar: 0, dmg: 25, r: 1.4, h: 4.6, xp: 0, mass: 0, big: true, boss: true },
];

// ---------- Biomes ----------
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const brookZ = (x) => 8 * Math.sin(x * 0.04) + 4;
const wadi = (z) => 9 * Math.sin(z * 0.045) - 6;
export const BIOMES = {
  ela: {
    name: 'Vale de Elá', ref: '1 Sm 17',
    desc: 'Vale verde entre dois montes, cortado por um ribeiro de pedras lisas. Filisteus de um lado, Israel do outro.',
    radius: 92, water: -50,
    sky: { top: 0x7fb8e6, horizon: 0xf1e2c4, nightTop: 0x0b1230, nightHorizon: 0x2b3158 },
    boss: 'Golias', bossIntro: 'Golias desafia os exércitos de Israel!', summon: 'Filisteus, avante!',
    elite: 'Um campeão anaquim apareceu! Ele guarda um baú.', win: 'Golias caiu no Vale de Elá.',
    bossModel: 'golias', groundKind: 1, death: [0x9c4a32, 0x7d8a4a, 0x8a5a2b, 0xb98560],
    well: ['Poço de Belém', '2 Sm 23:15'], event: 'Os filisteus avançam em fileira!', carrier: 'Um mercador filisteu foge com ouro!',
    brookZ, ledgeX: 68,
    water2: { shallow: 0x7fd6bf, deep: 0x3a8f9e },
    terrain(x, z) {
      return 1.6 * Math.sin(x * 0.05) * Math.cos(z * 0.045)
        + 0.8 * Math.sin(x * 0.13 + 1.3) * Math.sin(z * 0.11 + 0.7)
        + 7 * Math.exp(-((x - 30) ** 2 + (z + 28) ** 2) / 300) // slide hill near spawn
        + 16 * smooth(50, 95, Math.abs(z)) + 8 * smooth(72, 100, Math.abs(x)) // the two armies' hills
        + 5 * smooth(66, 70, x) // eastern ledge: the brook falls here
        - 1.5 * Math.exp(-((z - brookZ(x)) ** 2) / 10); // the brook (1 Sm 17:40)
    },
    ground(h, ny, n, x, z) {
      if (Math.abs(z - brookZ(x)) < 2.6) return n > 0 ? 0x8a9a7c : 0x7c8b70; // mossy brook bed
      if (ny < 0.8) return n > 0 ? 0x8b8f96 : 0x7d828c; // slate on steep slopes
      if (h > 10) return n > 0.3 ? 0xb9ad6e : 0xa89f5e;
      return n > 0.6 ? 0xa3ac58 : n > -0.2 ? 0x8aa04e : 0x7a9446;
    },
  },
  mar: {
    name: 'Mar Vermelho', ref: 'Êx 14',
    desc: 'Praias e ruínas do Egito à beira do mar. Os carros do Faraó estão chegando.',
    radius: 86, water: -0.3,
    water2: { shallow: 0x5fd3c9, deep: 0x2a7fc0 },
    sky: { top: 0x5fb0e8, horizon: 0xf6e3c0, nightTop: 0x0a1030, nightHorizon: 0x30305a },
    boss: 'Faraó', bossIntro: 'O Faraó persegue o povo até o mar!', summon: 'Carros do Egito, avante!',
    elite: 'Um colosso de pedra despertou! Ele guarda um baú.', win: 'O Faraó foi vencido à beira do Mar Vermelho.',
    bossModel: 'farao', groundKind: 2, death: [0xf4efe4, 0xf4efe4, 0xe8b84a, 0xd8b98a], summonChariots: true,
    well: ['Fonte de Elim', 'Êx 15:27'], event: 'Os carros do Faraó atravessam a ilha!', carrier: 'Um escriba do Faraó foge com o tesouro!',
    terrain(x, z) {
      const land = 2.2 + 1.2 * Math.sin(x * 0.06 + z * 0.02) * Math.cos(z * 0.05) + 0.5 * Math.sin(x * 0.15) * Math.sin(z * 0.13)
        + 7 * Math.exp(-((x - 32) ** 2 + (z + 28) ** 2) / 300) + 5 * Math.exp(-((x + 35) ** 2 + (z - 25) ** 2) / 350);
      const shelf = -0.75 + 0.3 * Math.sin(x * 0.21) * Math.cos(z * 0.17); // wide turquoise shallows, ankle deep
      const r = Math.hypot(x, z);
      const t = smooth(50, 64, r);
      return land * (1 - t) + shelf * t - 7 * smooth(86, 100, r); // then the deep sea
    },
    ground(h, ny, n) {
      if (h < -0.1) return 0xc9ab7c;
      if (h < 0.35) return 0xf1e6cc;
      if (ny < 0.85) return 0xd0a26c;
      return n > 0.4 ? 0xe9d3a0 : n > -0.4 ? 0xe2c993 : 0xd8bd86;
    },
  },
  ossos: {
    name: 'Vale dos Ossos Secos', ref: 'Ez 37',
    desc: 'Um vale de pó e ossos entre paredões de pedra. Quando o vento sopra, os ossos se juntam e se levantam.',
    radius: 88, water: -50,
    sky: { top: 0x9ab0cc, horizon: 0xf0cda2, nightTop: 0x0d0b20, nightHorizon: 0x3b2a44 },
    boss: 'Gogue', bossIntro: 'Gogue, príncipe de Magogue, marcha sobre o vale!', summon: 'Ossos, levantai-vos!',
    elite: 'Um gigante de ossos se ergueu! Ele guarda um baú.', win: 'Gogue caiu no Vale dos Ossos Secos.',
    bossModel: 'gogue', groundKind: 3, death: [0xe6dcc2, 0xe6dcc2, 0xc9bc9c, 0xe6dcc2], summonChariots: true,
    well: ['Fonte que dá vida', 'Ez 47:9'], event: 'Vento sobre os ossos: eles se levantam!', carrier: 'O esqueleto do tesoureiro foge com siclos!',
    wadi,
    terrain(x, z) {
      const r = Math.hypot(x, z);
      return 1.1 * Math.sin(x * 0.06 + 0.4) * Math.cos(z * 0.05)
        + 0.6 * Math.sin(x * 0.15) * Math.sin(z * 0.13 + 1.1)
        + 6 * Math.exp(-((x + 30) ** 2 + (z - 26) ** 2) / 260) // a knoll to slide down
        + 4.5 * Math.exp(-((x - 42) ** 2 + (z + 12) ** 2) / 110) // a low mesa
        + 22 * smooth(60, 96, r) // the valley walls
        - 1.6 * Math.exp(-((x - wadi(z)) ** 2) / 14); // a dry riverbed winding through
    },
    ground(h, ny, n, x, z) {
      if (Math.abs(x - wadi(z)) < 2.2) return n > 0 ? 0xcdb894 : 0xc2ad88; // cracked clay
      if (ny < 0.78) return n > 0 ? 0x9a7258 : 0x8a6650; // red rock walls
      if (h > 8) return n > 0.3 ? 0xbf9d72 : 0xb08f68;
      return n > 0.5 ? 0xc4a57a : n > -0.3 ? 0xb39470 : 0xa48663; // dust
    },
  },
};
export const BOSS = 4;

// Which enemy types join the horde as the minutes pass.
export function spawnWeights(t) {
  return [1, t > 60 ? 0.12 : 0, t > 120 ? 0.15 : 0, t > 180 ? 0.1 : 0]; // slingers survive longer, so keep them rare
}
