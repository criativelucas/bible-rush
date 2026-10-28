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
  josue: {
    name: 'Josué', role: 'Líder, abre caminho', hp: 120, speed: 8, weapon: 'trombeta', color: 0x3e5f99, noSprite: true,
    passive: ['Conquistador', 'Cada Pedra do Memorial erguida e cada baú aberto dão +8% de dano (até +80%).'],
    move: ['Avançar', 'Investida curta que atordoa quem estiver no caminho.', 3.5],
    miracle: ['O Sol Parou', 'Por 7 s o tempo para para os inimigos (Js 10:13).'],
  },
  debora: {
    name: 'Débora', role: 'Profetisa, à distância', hp: 90, speed: 8.6, weapon: 'flechas', color: 0x6a4a8a, noSprite: true, luck: 0.2,
    passive: ['Profetisa', 'Vê 4 cartas a cada nível e tem +20% de sorte.'],
    move: ['Torrente de Quisom', 'Avança numa onda que arrasta os inimigos para os lados.', 3.5],
    miracle: ['Estrelas na Batalha', 'Estrelas caem do céu sobre os inimigos por perto (Jz 5:20).'],
  },
};

export function baseStats(hero) {
  return {
    dmg: 0, cd: 0, area: 0, dur: 0, amount: 0, speed: 0, maxHp: hero.hp, regen: 0, armor: 0,
    pickup: 0, luck: hero.luck || 0, crit: 0.05, xp: 0, burn: 0, airJumps: 0, revives: 0, rerolls: 1, skips: 1, bans: 1,
    vamp: 0, gold: 0, faith: 0, // life per kill, extra siclos, extra Fé
    critDmg: 0, dodge: 0, // Tábuas da Lei, Escudo de Abraão
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
  // Unlocked by trophies (see TROPHIES).
  tabuas: { name: 'Tábuas da Lei', ref: 'Êx 31:18', stat: 'critDmg', base: 0.25, pct: true, label: 'Dano crítico' },
  escudo: { name: 'Escudo de Abraão', ref: 'Gn 15:1', stat: 'dodge', base: 0.05, pct: true, label: 'Esquiva' },
  candelabro: { name: 'Candelabro de Ouro', ref: 'Êx 25:31', stat: 'pickup', base: 0.2, pct: true, label: 'Coleta' },
  paes: { name: 'Pães da Proposição', ref: 'Êx 25:30', stat: 'maxHp', base: 15, label: 'Vida máx.' },
  arco: { name: 'Arco nas Nuvens', ref: 'Gn 9:13', stat: 'luck', base: 0.1, pct: true, label: 'Sorte' },
  sal: { name: 'Sal da Aliança', ref: 'Lv 2:13', stat: 'armor', base: 0.04, pct: true, label: 'Armadura' },
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

export function rollRelic(luck, rand, min = 0, ids = Object.keys(RELICS)) {
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
// locked: weapons not bought yet (Arsenal); banned: weapons/scrolls the player banished this run.
export function rollOffers({ weapons, luck, locked = new Set(), banned = new Set() }, rand, n = 3) {
  const owned = new Map(weapons.map((w) => [w.id, w.level]));
  const evolved = new Set(weapons.map((w) => WEAPONS[w.id].from).filter(Boolean));
  const pool = [];
  for (const id in WEAPONS) {
    if (WEAPONS[id].evo || evolved.has(id) || locked.has(id) || banned.has(id)) continue; // evolutions come from chests, not cards
    const lv = owned.get(id);
    if (lv === undefined) {
      if (weapons.length < MAX_WEAPONS) pool.push({ kind: 'weapon', id, w: 1.2 });
    } else if (lv < MAX_LEVEL) pool.push({ kind: 'upgrade', id, w: 2.5 });
  }
  for (const id in SCROLLS) if (!banned.has(id)) pool.push({ kind: 'scroll', id, w: 0.5 });
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
// Terraces: flat steps joined by steep rock faces. sharp: the share of each step that is the face
// (the rest is flat). Where the ground rises slowly, a small share still makes a wall you cannot walk up.
export const terrace = (v, step, sharp = 0.26) => {
  const k = Math.floor(v / step);
  return (k + smooth(1 - sharp, 1, v / step - k)) * step;
};
// 1 on the segment a-b (width w), fading to 0 away from it: ramps cut through the terraces.
export function along(x, z, ax, az, bx, bz, w) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.exp(-((x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2) / (w * w));
}
const ramps = (x, z, list, w = 4.2) => list.reduce((m, r) => Math.max(m, along(x, z, ...r, w)), 0);
// A slope you can climb, and the stepped one you cannot: ramps blend back to the smooth slope.
const stepped = (v, step, x, z, list) => {
  const t = terrace(v, step);
  return t + (v - t) * ramps(x, z, list);
};
const brookZ = (x) => 11 * Math.sin(x * 0.028) + 5;
const wadi = (z) => 12 * Math.sin(z * 0.032) - 8;
const CITY = { x: -28, z: -17, r: 17 }; // Jericho: its walls on their mound (a tell)
const OASIS = { x: 34, z: 25 }; // Elisha's spring (2 Rs 2:21)
const jWadis = (x, z) => Math.max(Math.exp(-((z - 30 * Math.sin(x * 0.02) + 62) ** 2) / 22) * smooth(CITY.r + 10, CITY.r + 20, Math.hypot(x - CITY.x, z - CITY.z)),
  Math.exp(-((x - 18 * Math.sin(z * 0.03) - 84) ** 2) / 22)); // Jericho's two dry riverbeds
// Ramps (start x, z → end x, z), from the valley floor up through the steps.
const ELA_RAMPS = [
  [-84, -30, -84, -120], [-18, -24, -26, -122], [44, -26, 52, -120], // up to Israel's camp, north
  [-56, 34, -60, 124], [12, 30, 4, 124], [72, 32, 64, 116], // up to the Philistines, south
  [58, -12, 58, -46], [-62, 24, -62, 58], // the two lookouts in the valley
];
const OSSOS_RAMPS = [[-44, -30, -60, -6], [40, 20, 64, 4], [-70, 40, -90, 62], [70, -44, 92, -62], [8, -62, 24, -84], [-20, 70, -6, 92]];
const JERICO_RAMPS = [[70, -60, 98, -78], [-84, 50, -104, 66], [20, 92, 26, 118], [-40, -88, -48, -114], [88, 40, 112, 46], [52, -36, 66, -48]];
const dune = (x, z) => { // windward slope gentle, slip face steep: dunes you climb from one side and slide down the other
  const u = (x * 0.085 + 1.8 * Math.sin(z * 0.03) + 0.5 * Math.sin(z * 0.09 + x * 0.02)) / Math.PI;
  const f = u - Math.floor(u);
  return (f < 0.86 ? (f / 0.86) ** 1.6 : 1 - smooth(0.86, 1, f)) * (0.65 + 0.35 * Math.sin(z * 0.05 + x * 0.013));
};
export const BIOMES = {
  ela: {
    name: 'Vale de Elá', ref: '1 Sm 17',
    tags: ['Vertical', 'Rio', 'Acampamentos'],
    desc: 'Vale verde entre dois montes, cortado por um ribeiro de pedras lisas. Filisteus de um lado, Israel do outro.',
    radius: 130, water: -50,
    sky: { top: 0x7fb8e6, horizon: 0xf1e2c4, nightTop: 0x0b1230, nightHorizon: 0x2b3158 },
    boss: 'Golias', bossIntro: 'Golias desafia os exércitos de Israel!', summon: 'Filisteus, avante!',
    elite: 'Um campeão anaquim apareceu! Ele guarda um baú.', win: 'Golias caiu no Vale de Elá.',
    verse: ['A batalha é do Senhor.', '1 Sm 17:47'],
    bossModel: 'golias', groundKind: 1, death: [0x9c4a32, 0x7d8a4a, 0x8a5a2b, 0xb98560],
    well: ['Poço de Belém', '2 Sm 23:15'], event: 'Os filisteus avançam em fileira!', carrier: 'Um mercador filisteu foge com ouro!',
    brookZ, ledgeX: 96,
    water2: { shallow: 0x7fd6bf, deep: 0x3a8f9e },
    terrain(x, z) {
      const side = Math.abs(z - brookZ(x));
      // The two armies' hills (1 Sm 17:3) rise in steps north and south of the brook, plus two lookouts
      // in the valley; ramps lead up. The east is a ledge the brook falls from.
      const v = 21 * smooth(24, 118, side) + 9 * smooth(100, 140, Math.abs(x)) * smooth(6, 16, side)
        + 9 * Math.exp(-((x - 58) ** 2 + (z + 46) ** 2) / 240) + 9 * Math.exp(-((x + 62) ** 2 + (z - 58) ** 2) / 240);
      return 1.4 * Math.sin(x * 0.035) * Math.cos(z * 0.032) + 0.7 * Math.sin(x * 0.09 + 1.3) * Math.sin(z * 0.08 + 0.7)
        + stepped(v, 5.2, x, z, ELA_RAMPS)
        + 6 * Math.exp(-((x - 30) ** 2 + (z + 24) ** 2) / 300) // slide hill near spawn
        + 5 * smooth(94, 98, x) // eastern ledge: the brook falls here
        - 1.5 * Math.exp(-(side ** 2) / 10); // the brook (1 Sm 17:40)
    },
    ground(h, ny, n, x, z) {
      if (Math.abs(z - brookZ(x)) < 2.6) return n > 0 ? 0x8a9a7c : 0x7c8b70; // mossy brook bed
      if (ny < 0.72) return Math.floor(h * 1.4) % 2 ? 0x8b8f96 : 0x767b84; // layered slate on the cliff faces
      if (ny < 0.85) return n > 0 ? 0x8b8f96 : 0x7d828c; // slate on steep slopes
      if (h > 17) return n > 0.3 ? 0xb9ad6e : 0xa89f5e; // dry grass on the hilltops
      if (h > 7) return n > 0.5 ? 0x9cab55 : n > -0.2 ? 0x86a04c : 0x789246; // terraces
      return n > 0.6 ? 0xa3ac58 : n > -0.2 ? 0x8aa04e : 0x7a9446;
    },
  },
  mar: {
    name: 'Mar Vermelho', ref: 'Êx 14',
    tags: ['Dunas', 'Ilha', 'Ruínas do Egito'],
    desc: 'Praias e ruínas do Egito à beira do mar. Os carros do Faraó estão chegando.',
    radius: 122, water: -0.3,
    water2: { shallow: 0x5fd3c9, deep: 0x2a7fc0 },
    sky: { top: 0x5fb0e8, horizon: 0xf6e3c0, nightTop: 0x0a1030, nightHorizon: 0x30305a },
    boss: 'Faraó', bossIntro: 'O Faraó persegue o povo até o mar!', summon: 'Carros do Egito, avante!',
    elite: 'Um colosso de pedra despertou! Ele guarda um baú.', win: 'O Faraó foi vencido à beira do Mar Vermelho.',
    verse: ['Cantarei ao Senhor, que triunfou gloriosamente.', 'Êx 15:1'],
    bossModel: 'farao', groundKind: 2, death: [0xf4efe4, 0xf4efe4, 0xe8b84a, 0xd8b98a], summonChariots: true,
    well: ['Fonte de Elim', 'Êx 15:27'], event: 'Os carros do Faraó atravessam a ilha!', carrier: 'Um escriba do Faraó foge com o tesouro!',
    terrain(x, z) {
      const r = Math.hypot(x, z);
      // Dunes fill the middle of the island (not the spawn); an Egyptian rock plateau in steps to the west.
      const dunes = 6.5 * dune(x, z) * smooth(16, 30, r) * smooth(80, 56, r);
      const plateau = terrace(11 * smooth(30, 14, Math.hypot(x + 54, z + 34)), 5.2, 0.2);
      const land = 2.2 + 1.1 * Math.sin(x * 0.045 + z * 0.015) * Math.cos(z * 0.035) + 0.5 * Math.sin(x * 0.12) * Math.sin(z * 0.1)
        + 6 * Math.exp(-((x - 44) ** 2 + (z + 38) ** 2) / 420) + Math.max(dunes, plateau);
      const shelf = -0.75 + 0.3 * Math.sin(x * 0.21) * Math.cos(z * 0.17); // wide turquoise shallows, ankle deep
      const t = smooth(78, 94, r);
      return land * (1 - t) + shelf * t - 7 * smooth(120, 134, r); // then the deep sea
    },
    ground(h, ny, n, x, z) {
      if (h < -0.1) return 0xc9ab7c;
      if (h < 0.35) return 0xf1e6cc;
      if (ny < 0.72 && Math.hypot(x + 54, z + 34) < 32) return Math.floor(h * 1.3) % 2 ? 0xc89462 : 0xb38052; // banded sandstone plateau
      if (ny < 0.8) return n > 0 ? 0xd8b47c : 0xcfaa72; // the steep side of a dune
      if (ny < 0.85) return 0xd0a26c;
      return n > 0.4 ? 0xe9d3a0 : n > -0.4 ? 0xe2c993 : 0xd8bd86;
    },
  },
  ossos: {
    name: 'Vale dos Ossos Secos', ref: 'Ez 37',
    tags: ['Cânion', 'Corredores', 'Mortos que se levantam'],
    desc: 'Um vale de pó e ossos entre paredões de pedra. Quando o vento sopra, os ossos se juntam e se levantam.',
    radius: 124, water: -50,
    sky: { top: 0x9ab0cc, horizon: 0xf0cda2, nightTop: 0x0d0b20, nightHorizon: 0x3b2a44 },
    boss: 'Gogue', bossIntro: 'Gogue, príncipe de Magogue, marcha sobre o vale!', summon: 'Ossos, levantai-vos!',
    elite: 'Um gigante de ossos se ergueu! Ele guarda um baú.', win: 'Gogue caiu no Vale dos Ossos Secos.',
    verse: ['O espírito entrou neles, e viveram: um exército enorme.', 'Ez 37:10'],
    bossModel: 'gogue', groundKind: 3, death: [0xe6dcc2, 0xe6dcc2, 0xc9bc9c, 0xe6dcc2], summonChariots: true,
    well: ['Fonte que dá vida', 'Ez 47:9'], event: 'Vento sobre os ossos: eles se levantam!', carrier: 'O esqueleto do tesoureiro foge com siclos!',
    wadi,
    terrain(x, z) {
      const r = Math.hypot(x, z);
      // A canyon: long rock ridges in steps with gaps to pass through, a dry riverbed cutting a gorge
      // across them, and an open amphitheatre in the middle where the dead rise.
      const ridge = Math.max(0, Math.sin(x * 0.085 + 1.2 * Math.sin(z * 0.028) + 0.6)) ** 2
        * smooth(30, 44, r) * smooth(3, 10, Math.abs(x - wadi(z)))
        * (1 - Math.exp(-((z + 58) ** 2) / 50)) * (1 - Math.exp(-((z - 50) ** 2) / 50));
      const v = 15 * ridge + 26 * smooth(86, 122, r) + 6 * Math.exp(-((x + 30) ** 2 + (z - 26) ** 2) / 260);
      return 1.1 * Math.sin(x * 0.045 + 0.4) * Math.cos(z * 0.035) + 0.6 * Math.sin(x * 0.11) * Math.sin(z * 0.09 + 1.1)
        + stepped(v, 5.5, x, z, OSSOS_RAMPS)
        - 1.6 * Math.exp(-((x - wadi(z)) ** 2) / 14); // a dry riverbed winding through
    },
    ground(h, ny, n, x, z) {
      if (Math.abs(x - wadi(z)) < 2.2) return n > 0 ? 0xcdb894 : 0xc2ad88; // cracked clay
      if (ny < 0.72) return Math.floor(h * 1.2) % 2 ? 0x9a7258 : 0x82604a; // layered red rock walls
      if (ny < 0.82) return n > 0 ? 0x9a7258 : 0x8a6650;
      if (h > 8) return n > 0.3 ? 0xbf9d72 : 0xb08f68;
      return n > 0.5 ? 0xc4a57a : n > -0.3 ? 0xb39470 : 0xa48663; // dust
    },
  },
  jerico: {
    name: 'Muralhas de Jericó', ref: 'Js 6',
    tags: ['Cidade murada', 'Oásis', 'Leitos secos'],
    desc: 'A cidade das palmeiras, murada sobre um monte. Ao som das trombetas, as muralhas vão cair.',
    radius: 127, water: -0.6,
    water2: { shallow: 0x6fd6c0, deep: 0x2f8f9e },
    sky: { top: 0x78b4e4, horizon: 0xf6dcae, nightTop: 0x0b1230, nightHorizon: 0x34305a },
    boss: 'Rei de Jericó', bossIntro: 'O rei de Jericó abre as portas e sai para a batalha!', summon: 'Guardas da muralha, avante!',
    elite: 'Um guardião da muralha avançou! Ele guarda um baú.', win: 'As muralhas de Jericó caíram.',
    verse: ['O povo gritou, e as muralhas caíram.', 'Js 6:20'],
    bossModel: 'rei', groundKind: 2, death: [0x7a3a6a, 0xb8463a, 0x8a5a2b, 0xc08a3e], summonChariots: true,
    well: ['Fonte de Eliseu', '2 Rs 2:21'], event: 'As trombetas soam: guardas saem pelas portas da cidade!', carrier: 'Um mercador de Jericó foge com ouro!',
    city: CITY, oasis: OASIS,
    terrain(x, z) {
      const r = Math.hypot(x, z);
      const dc = Math.hypot(x - CITY.x, z - CITY.z);
      // Limestone hills in steps all round, one more inside the plain; two dry riverbeds (wadis) cut the plain.
      const a = Math.atan2(z, x);
      const v = 18 * smooth(84, 124, r + 9 * Math.sin(3 * a + 1) + 5 * Math.sin(7 * a)) + 10 * Math.exp(-((x - 60) ** 2 + (z + 52) ** 2) / 300);
      return 2.3 + 0.9 * Math.sin(x * 0.035 + 0.3) * Math.cos(z * 0.042) + 0.4 * Math.sin(x * 0.1) * Math.sin(z * 0.085)
        + 3.6 * smooth(CITY.r + 8, CITY.r - 1, dc) // the tell under the city
        + stepped(v, 4.6, x, z, JERICO_RAMPS)
        - 1.3 * jWadis(x, z) // two dry wadis cut the plain
        - 4.6 * Math.exp(-((x - OASIS.x) ** 2 + (z - OASIS.z) ** 2) / 60); // the spring's pool
    },
    ground(h, ny, n, x, z) {
      if (h < -0.4) return 0xb8a27a; // pool bed
      if (jWadis(x, z) > 0.45) return n > 0 ? 0xc2ad88 : 0xb6a07c; // cracked clay in the wadis
      if (Math.hypot(x - OASIS.x, z - OASIS.z) < 13) return n > 0 ? 0x8aa04e : 0x7a9446; // green around the spring
      if (ny < 0.72 && h > 4.5) return Math.floor(h * 1.3) % 2 ? 0xc9b08a : 0xb59a74; // limestone layers on the hills
      if (ny < 0.82 && h > 6) return n > 0 ? 0xb88a5e : 0xa87c52; // rock only on the far hills, not the city's mound
      if (Math.hypot(x - CITY.x, z - CITY.z) < CITY.r + 2) return n > 0 ? 0xcfb48a : 0xc4a87e; // packed earth in the city
      return n > 0.4 ? 0xd9be8a : n > -0.4 ? 0xcfb27c : 0xc4a670;
    },
  },
};
export const BOSS = 4;

// ---------- Trophies and what they open ----------
// Open from the start: two heroes, two maps, and every relic no trophy holds back.
export const START_OPEN = ['hero:davi', 'hero:sansao', 'map:ela', 'map:mar'];
export const TIERS = [{ name: 'Bronze', color: '#e09a55' }, { name: 'Prata', color: '#dfe7ee' }, { name: 'Ouro', color: '#f2c14e' }];
export const TROPHIES = {
  inicio: { name: 'Primeira Jornada', desc: 'Termine uma partida.', tier: 0 },
  memorial: { name: 'Memorial Erguido', desc: 'Erga as 3 Pedras do Memorial numa partida.', tier: 0, unlock: 'hero:moises' },
  golias: { name: 'O Gigante Caiu', desc: 'Vença no Vale de Elá.', tier: 1, unlock: 'map:ossos' },
  farao: { name: 'Cavalo e Cavaleiro', desc: 'Vença no Mar Vermelho.', tier: 1, unlock: 'map:jerico' },
  gogue: { name: 'Ossos que Vivem', desc: 'Vença no Vale dos Ossos Secos.', tier: 2, unlock: 'hero:josue' },
  rei: { name: 'As Muralhas Caíram', desc: 'Vença em Jericó.', tier: 2, unlock: 'relic:arco' },
  perseveranca: { name: 'Perseverança', desc: 'Sobreviva 8 minutos numa partida.', tier: 1, unlock: 'hero:debora' },
  evolucao: { name: 'Transformação', desc: 'Evolua uma arma.', tier: 1, unlock: 'relic:tabuas' },
  pedras: { name: 'Cinco Pedras Lisas', desc: 'Junte as 5 pedras do ribeiro em Elá.', tier: 0, unlock: 'relic:escudo' },
  mil: { name: 'Mil Abates', desc: 'Derrote 1000 inimigos numa partida.', tier: 1, unlock: 'relic:candelabro' },
  tesouro: { name: 'Tesouro Recuperado', desc: 'Alcance um tesouro em fuga.', tier: 0, unlock: 'relic:sal' },
  selo: { name: 'Selo Rompido', desc: 'Resista à emboscada de um baú selado.', tier: 0, unlock: 'relic:paes' },
  poco: { name: 'Água Viva', desc: 'Beba de um poço ou fonte.', tier: 0 },
  ungido: { name: 'Ungido', desc: 'Alcance o nível 20 numa partida.', tier: 1 },
  noite: { name: 'Coluna de Fogo', desc: 'Atravesse uma noite inteira.', tier: 0 },
  salomao: { name: 'Riqueza de Salomão', desc: 'Junte 300 siclos de uma vez.', tier: 1 },
  relicario: { name: 'Relicário', desc: 'Tenha 8 relíquias numa partida.', tier: 1 },
  maos: { name: 'Mãos Levantadas', desc: 'Faça 5 milagres numa partida.', tier: 0 },
  valentes: { name: 'Os Valentes', desc: 'Vença com 3 heróis diferentes.', tier: 2 },
  conquista: { name: 'Terra Prometida', desc: 'Vença nos 4 cenários.', tier: 2 },
};

// Everything a saved profile has opened ('hero:id', 'map:id', 'relic:id').
export function openSet(profile) {
  const open = new Set(START_OPEN);
  const gated = new Set(Object.values(TROPHIES).map((t) => t.unlock).filter(Boolean));
  for (const id in RELICS) if (!gated.has(`relic:${id}`)) open.add(`relic:${id}`);
  for (const id in profile.trophies || {}) if (TROPHIES[id]?.unlock) open.add(TROPHIES[id].unlock);
  return open;
}
// The trophy that opens a hero/map/relic key, if any.
export const unlockedBy = (key) => Object.keys(TROPHIES).find((id) => TROPHIES[id].unlock === key);

// Which enemy types join the horde as the minutes pass.
export function spawnWeights(t) {
  return [1, t > 60 ? 0.12 : 0, t > 120 ? 0.15 : 0, t > 180 ? 0.1 : 0]; // slingers survive longer, so keep them rare
}

// ---------- Save ----------
// v1 kept only trophies and wins; v2 adds what the shop, hero evolution and tasks will fill (see PLANO.md).
export const PROFILE_VERSION = 3; // 3: the Arsenal (players from before keep the weapons they already had)
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function migrateProfile(raw) {
  const p = isObj(raw) ? raw : {};
  const o = (k) => (isObj(p[k]) ? p[k] : {});
  const a = (k) => (Array.isArray(p[k]) ? p[k] : []);
  const unlocked = a('unlocked');
  if ((p.v ?? 1) < 3 && Object.keys(o('trophies')).length) for (const id in ARSENAL) if (!unlocked.includes(`weapon:${id}`)) unlocked.push(`weapon:${id}`);
  return {
    ...p,
    v: PROFILE_VERSION,
    denarios: Number.isFinite(p.denarios) ? Math.max(0, p.denarios) : 0,
    trophies: o('trophies'), claimed: o('claimed'), wins: o('wins'), // wins: hero -> { map: true }
    upgrades: o('upgrades'), tools: o('tools'), bag: o('bag'), heroes: o('heroes'),
    bestiary: o('bestiary'), records: o('records'), seen: o('seen'), tasks: o('tasks'),
    unlocked, owned: a('owned'),
  };
}
// A text code to carry the save to another browser.
export const exportCode = (p) => `BR${PROFILE_VERSION}:${btoa(unescape(encodeURIComponent(JSON.stringify(p))))}`;
export function importCode(code) { // the profile, or null when the text is not a Bible Rush save
  const m = /^BR\d+:([A-Za-z0-9+/=]+)$/.exec(String(code).replace(/\s+/g, ''));
  if (!m) return null;
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    return isObj(p) ? migrateProfile(p) : null;
  } catch { return null; }
}

// ---------- Market: denários earned after each run buy strength, tools, weapons and supplies ----------
export const levelCost = (base, level) => Math.round((base * 1.35 ** level) / 5) * 5; // each level costs more
// Training: permanent, every hero, every run. icon: [ICON group, key].
export const TRAINING = {
  forca: { name: 'Força', stat: 'dmg', per: 0.04, pct: true, label: 'dano', max: 8, cost: 85, icon: ['scrolls', 'forca'] },
  vigor: { name: 'Vigor', stat: 'maxHp', per: 8, label: 'vida máxima', max: 8, cost: 85, icon: ['scrolls', 'vida'] },
  ligeireza: { name: 'Ligeireza', stat: 'speed', per: 0.025, pct: true, label: 'velocidade', max: 6, cost: 100, icon: ['scrolls', 'corrida'] },
  sabedoria: { name: 'Sabedoria', stat: 'xp', per: 0.05, pct: true, label: 'experiência', max: 6, cost: 100, icon: ['scrolls', 'sabedoria'] },
  bencao: { name: 'Bênção', stat: 'luck', per: 0.04, pct: true, label: 'sorte', max: 6, cost: 120, icon: ['scrolls', 'sorte'] },
  colheita: { name: 'Colheita', stat: 'pickup', per: 0.1, pct: true, label: 'alcance de coleta', max: 5, cost: 70, icon: ['scrolls', 'alcance'] },
  mana: { name: 'Fôlego', stat: 'regen', per: 0.2, label: 'vida por segundo', max: 5, cost: 100, icon: ['relic', 'vaso'] },
  couraca: { name: 'Couraça', stat: 'armor', per: 0.02, pct: true, label: 'armadura', max: 6, cost: 100, icon: ['relic', 'couraca'] },
  precisao: { name: 'Precisão', stat: 'crit', per: 0.01, pct: true, label: 'crítico', max: 5, cost: 170, icon: ['scrolls', 'precisao'] },
  prontidao: { name: 'Prontidão', stat: 'cd', per: 0.02, pct: true, label: 'recarga', neg: true, max: 5, cost: 185, icon: ['scrolls', 'prontidao'] },
  amplidao: { name: 'Amplidão', stat: 'area', per: 0.03, pct: true, label: 'área', max: 5, cost: 170, icon: ['scrolls', 'amplidao'] },
};
export const trainingText = (t, levels = 1) => `${t.neg ? '−' : '+'}${t.pct ? `${+(t.per * levels * 100).toFixed(1)}%` : +(t.per * levels).toFixed(1)} de ${t.label}`;
// Tools: change how a run plays. stat: what each level adds to the run's stats.
export const TOOLS = {
  renovar: { name: 'Renovar', desc: '+1 uso de trocar as cartas, por partida.', stat: 'rerolls', max: 5, cost: 100, icon: ['ui', 'die'] },
  pular: { name: 'Pular', desc: '+1 uso de pular uma subida de nível (rende siclos).', stat: 'skips', max: 5, cost: 70, icon: ['ui', 'wing'] },
  banir: { name: 'Banir', desc: '+1 uso de tirar uma opção das cartas até o fim da partida.', stat: 'bans', max: 5, cost: 130, icon: ['ui', 'skull'] },
  quarta: { name: 'Mais uma carta', desc: 'Toda subida de nível mostra uma carta a mais.', stat: 'cards', max: 1, cost: 1000, icon: ['ui', 'book'] },
  cordao: { name: 'Cordão de reserva', desc: 'Começa toda partida com uma ressurreição.', stat: 'revives', max: 1, cost: 900, icon: ['relic', 'cordao'] },
  alforje: { name: 'Alforje maior', desc: 'Leve 3 itens do alforje em vez de 2.', stat: 'pack', max: 1, cost: 600, icon: ['ui', 'scroll'] },
};
// Arsenal: weapons that only show up on cards and in chests after you buy them here.
export const ARSENAL = { machado: 150, carros: 200, gafanhotos: 200, fogo: 250 };
export const lockedWeapons = (profile) => new Set(Object.keys(ARSENAL).filter((id) => !(profile.unlocked || []).includes(`weapon:${id}`)));
// Supplies: bought in stock, packed before a run (2 slots), used up when it starts.
export const SUPPLIES = {
  mana: { name: 'Maná do céu', desc: 'Começa a partida no nível 3.', cost: 60, icon: ['pickup', 'pao'] },
  oleo: { name: 'Óleo da unção', desc: '+25% de experiência na partida.', cost: 50, icon: ['relic', 'oleo'] },
  bolsa: { name: 'Bolsa de siclos', desc: '+50% de siclos na partida.', cost: 40, icon: ['ui', 'coin'] },
  mel: { name: 'Mel silvestre', desc: 'Um carregador de tesouro a mais aparece no primeiro minuto.', cost: 50, icon: ['relic', 'mel'] },
  estrela: { name: 'Estrela de Jacó', desc: 'O primeiro baú dá uma relíquia de Prata ou melhor.', cost: 70, icon: ['ui', 'star'], ref: 'Nm 24:17' },
};
export const packSize = (profile) => 2 + (profile.tools?.alforje || 0);

// Denários earned by a run, line by line. Trophies pay on top when they are won (TROPHY_PAY by tier).
export const TROPHY_PAY = [25, 60, 120];
export function runDenarios({ time, kills, stones, chests, won }) {
  const lines = [
    ['Tempo de jornada', Math.floor(time / 60) * 3],
    ['Inimigos derrotados', Math.floor(kills / 25)],
    ['Pedras do Memorial', stones * 10],
    ['Baús abertos', chests * 5],
    ['Vitória', won ? 60 : 0],
  ].filter(([, v]) => v > 0);
  return { lines, total: lines.reduce((t, [, v]) => t + v, 0) };
}
// Everything a run starts with from the Market: training levels, tools and packed supplies.
export function applyMarket(st, profile, pack = []) {
  for (const [id, t] of Object.entries(TRAINING)) st[t.stat] += t.per * (profile.upgrades?.[id] || 0);
  for (const [id, t] of Object.entries(TOOLS)) st[t.stat] = (st[t.stat] || 0) + (profile.tools?.[id] || 0);
  if (pack.includes('oleo')) st.xp += 0.25;
  if (pack.includes('bolsa')) st.gold += 0.5;
  return st;
}
