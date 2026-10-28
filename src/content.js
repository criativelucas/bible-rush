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

  // Bought in the Market's Arsenal (models in src/forge.js).
  lanca: {
    name: 'Lança de Saul', unit: 'lança', kind: 'shot', ref: '1 Sm 18:11', desc: 'Uma lança pesada que atravessa a fileira inteira.',
    dmg: 30, cd: 1.7, count: 1, pierce: 6, speed: 26, life: 1.3, range: 28, size: 0.3, proj: 'lanca',
    levels: [{ dmg: 0.3 }, { count: 1 }, { pierce: 3, cd: 0.1 }, { count: 1, dmg: 0.3 }],
  },
  estaca: {
    name: 'Estaca de Jael', kind: 'melee', ref: 'Jz 4:21', desc: 'Martelada curta e certeira que atordoa quem é atingido.',
    dmg: 40, cd: 1.3, radius: 2.6, arc: 1.6, knock: 4, stun: 1,
    levels: [{ dmg: 0.3 }, { cd: 0.15 }, { area: 0.25 }, { dmg: 0.5 }],
  },
  corvos: {
    name: 'Corvos de Elias', unit: 'bando', kind: 'swarm', bird: true, ref: '1 Rs 17:6', desc: 'Corvos voam até os inimigos e bicam sem parar.',
    dmg: 5, cd: 0.35, count: 2, radius: 1.8, speed: 10,
    levels: [{ dmg: 0.3 }, { count: 1 }, { area: 0.25 }, { count: 1, dmg: 0.3 }],
  },
  mo: {
    name: 'Mó de Abimeleque', unit: 'mó', kind: 'sky', target: 'strong', mill: true, ref: 'Jz 9:53', desc: 'Uma mó de moinho cai do alto, esmaga e atordoa.',
    dmg: 110, cd: 4.2, count: 1, radius: 3.2, range: 24, delay: 1.0,
    levels: [{ dmg: 0.3 }, { area: 0.2 }, { cd: 0.2 }, { count: 1, dmg: 0.3 }],
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
  lanca_evo: {
    name: 'Lança de Golias', evo: true, from: 'lanca', needs: 'escudo', unit: 'lança', kind: 'shot', ref: '1 Sm 17:7',
    desc: 'Lanças como cilindro de tecelão: três por vez, atravessam tudo.',
    dmg: 60, cd: 1.3, count: 3, pierce: 12, speed: 30, life: 1.5, range: 30, size: 0.42, proj: 'lanca', levels: [],
  },
  estaca_evo: {
    name: 'Golpe de Jael', evo: true, from: 'estaca', needs: 'vaso', kind: 'melee', ref: 'Jz 5:26',
    desc: 'A martelada gira em volta e atordoa toda a roda.',
    dmg: 80, cd: 1.0, radius: 3.6, arc: 6.28, knock: 6, stun: 1.6, levels: [],
  },
  corvos_evo: {
    name: 'Corvos de Querite', evo: true, from: 'corvos', needs: 'paes', unit: 'bando', kind: 'swarm', bird: true, ref: '1 Rs 17:4',
    desc: 'Cinco bandos de corvos; como levavam pão a Elias, cada bicada cura um pouco.',
    dmg: 9, cd: 0.3, count: 5, radius: 2.4, speed: 12, heal: 0.25, levels: [],
  },
  mo_evo: {
    name: 'Pedra da Torre', evo: true, from: 'mo', needs: 'arco', unit: 'mó', kind: 'sky', target: 'strong', mill: true, ref: 'Jz 9:53',
    desc: 'Três mós caem de uma vez sobre os mais fortes.',
    dmg: 180, cd: 3.5, count: 3, radius: 4, range: 26, delay: 1.0, levels: [],
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
  { id: 'batedor', hp: 9, speed: 5.4, speedVar: 0.8, dmg: 6, r: 0.36, h: 1.3, xp: 1, mass: 1.2, pack: 4 }, // runners: in packs
  { id: 'escudeiro', hp: 75, speed: 2.2, speedVar: 0.3, dmg: 14, r: 0.62, h: 1.9, xp: 4, mass: 0.3, shield: 0.4 }, // shield-bearers: take 40% less
];
export const MOB_TYPES = [0, 1, 2, 3, 5, 6]; // every kind but the boss (4), drawn from mobs.glb as mob_<type>_<map>

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
const stepped = (v0, step, x, z, list) => {
  const v = Math.max(0, v0); // noise must not dig a whole step into the ground
  const t = terrace(v, step);
  return t + (v - t) * ramps(x, z, list);
};
// Smooth value noise in [-1, 1], its sums (fbm), sharp-crested ridges in [0, 1], and domain warping: the
// shapes bend and break up instead of following neat circles and sine waves.
const hash2 = (i, j) => {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export function noise(x, z) {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fx = x - i;
  const fz = z - j;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j);
  const b = hash2(i + 1, j);
  const c = hash2(i, j + 1);
  const d = hash2(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, oct = 3) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let k = 0; k < oct; k++) { s += a * noise(x * f + k * 17.3, z * f - k * 9.1); f *= 2.03; a *= 0.5; }
  return s;
}
export function ridged(x, z, oct = 3) {
  let s = 0;
  let a = 0.55;
  let f = 1;
  for (let k = 0; k < oct; k++) { const n = 1 - Math.abs(noise(x * f - k * 7.7, z * f + k * 3.1)); s += a * n * n; f *= 2.1; a *= 0.45; }
  return s;
}
const warp = (x, z, scale, amp) => [x + amp * fbm(x * scale, z * scale, 2), z + amp * fbm(x * scale + 31.4, z * scale + 57.2, 2)];
// Rock pinnacles: [x, z, height]; terraced, they become sheer towers you climb or walk round.
const pinnacles = (x, z, list) => list.reduce((m, [px, pz, h]) => Math.max(m, h * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / 16)), 0);
const ELA_SPIRES = [[-40, 32, 15], [-34, 40, 11], [78, -30, 16], [-96, -14, 13], [24, 52, 12], [104, 30, 14], [-70, -52, 12]];
const MAR_STACKS = [[96, 64, 11], [-30, 110, 9], [-104, -48, 12], [70, -92, 10], [112, -12, 9], [-84, 74, 10]]; // sea stacks off the cliffs
const OSSOS_HOODOOS = [[22, 24, 13], [-26, -20, 12], [10, -32, 10], [-30, 14, 11], [40, -6, 14], [-12, 38, 9]]; // round the amphitheatre
const COAST_RAMPS = [0.4, 1.9, 3.3, 4.6, 5.8].map((a) => [Math.cos(a) * 64, Math.sin(a) * 64, Math.cos(a) * 92, Math.sin(a) * 92]); // paths down to the beach
const brookZ = (x) => 11 * Math.sin(x * 0.028) + 5;
const wadi = (z) => 12 * Math.sin(z * 0.032) - 8;
const CITY = { x: -40, z: -30, r: 32 }; // Jericho: its walls on their mound (a tell), a real city now
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
const JERICO_RAMPS = [[70, -60, 98, -78], [-84, 50, -104, 66], [20, 92, 26, 118], [-40, -88, -48, -114], [88, 40, 112, 46], [52, -36, 66, -48],
  [CITY.x + CITY.r + 16, CITY.z, CITY.x + CITY.r - 4, CITY.z], [CITY.x - CITY.r - 16, CITY.z, CITY.x - CITY.r + 4, CITY.z]]; // up the tell to the two gates
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
      // The two armies' hills (1 Sm 17:3) rise in broken, crooked steps north and south of the brook, with
      // craggy tops, two lookouts and rock pinnacles in the valley; ramps lead up (or climb the rock).
      // The east is a ledge the brook falls from.
      const [wx, wz] = warp(x, z, 0.012, 22);
      const wside = Math.abs(wz - brookZ(wx));
      const v = 21 * smooth(24, 116, Math.max(wside, side * 0.8)) + 9 * smooth(100, 140, Math.abs(x)) * smooth(6, 16, side)
        + 8 * ridged(wx * 0.024, wz * 0.024) * smooth(34, 70, side) + 2.4 * fbm(x * 0.035, z * 0.035) * smooth(10, 24, side)
        + 9 * Math.exp(-((x - 58) ** 2 + (z + 46) ** 2) / 240) + 9 * Math.exp(-((x + 62) ** 2 + (z - 58) ** 2) / 240)
        + pinnacles(x, z, ELA_SPIRES);
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
      // The island stands on sandstone cliffs (paths lead down to the beach); sea stacks rise from the shallows.
      const [wx, wz] = warp(x, z, 0.016, 12);
      const rw = Math.hypot(wx, wz);
      const cliff = terrace(4.6 * smooth(84, 72, rw), 4.6, 0.3);
      const coast = cliff + (4.6 * smooth(84, 72, rw) - cliff) * ramps(x, z, COAST_RAMPS, 4.5);
      const land = 1.4 + coast + 1.0 * fbm(x * 0.03, z * 0.03) + 0.4 * Math.sin(x * 0.12) * Math.sin(z * 0.1)
        + 6 * Math.exp(-((x - 44) ** 2 + (z + 38) ** 2) / 420) * smooth(84, 70, rw) + Math.max(dunes, plateau);
      const shelf = -0.75 + 0.3 * Math.sin(x * 0.21) * Math.cos(z * 0.17); // wide turquoise shallows, ankle deep
      const t = smooth(80, 94, r);
      return land * (1 - t) + shelf * t - 7 * smooth(120, 134, r) + terrace(pinnacles(x, z, MAR_STACKS), 3.5, 0.3);
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
      const [wx, wz] = warp(x, z, 0.014, 16); // crooked ridges, broken crests, stone towers round the middle
      const ridge = Math.max(0, Math.sin(wx * 0.085 + 1.2 * Math.sin(wz * 0.028) + 0.6)) ** 2
        * smooth(30, 44, r) * smooth(3, 10, Math.abs(x - wadi(z)))
        * (1 - Math.exp(-((z + 58) ** 2) / 50)) * (1 - Math.exp(-((z - 50) ** 2) / 50));
      const v = 15 * ridge * (0.7 + 0.6 * ridged(wx * 0.03, wz * 0.03)) + 26 * smooth(86, 122, r + 9 * fbm(x * 0.02, z * 0.02))
        + 6 * Math.exp(-((x + 30) ** 2 + (z - 26) ** 2) / 260) + pinnacles(x, z, OSSOS_HOODOOS);
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
      const v = 18 * smooth(84, 124, r + 9 * Math.sin(3 * a + 1) + 5 * Math.sin(7 * a) + 8 * fbm(x * 0.025, z * 0.025)) + 10 * Math.exp(-((x - 60) ** 2 + (z + 52) ** 2) / 300)
        + 7 * ridged(x * 0.03, z * 0.03) * smooth(96, 116, r);
      return 2.3 + 0.9 * Math.sin(x * 0.035 + 0.3) * Math.cos(z * 0.042) + 0.4 * Math.sin(x * 0.1) * Math.sin(z * 0.085)
        + stepped(v + 5 * smooth(CITY.r + 7, CITY.r + 2, dc) + 1.6 * fbm(x * 0.03, z * 0.03) * smooth(CITY.r, CITY.r + 14, dc), 4.6, x, z, JERICO_RAMPS) // the tell: a walled hill
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
// cat: the tab it shows under; title: a title to wear once won. Every trophy pays denários (TROPHY_PAY by
// tier), collected on the Troféus screen.
export const TROPHY_CATS = { progresso: 'Progresso', mapas: 'Cenários', desafios: 'Desafios', colecao: 'Coleção', dificuldade: 'Dificuldade', sobrevivencia: 'Sobrevivência' };
export const TROPHIES = {
  inicio: { name: 'Primeira Jornada', desc: 'Termine uma partida.', tier: 0, cat: 'progresso' },
  memorial: { name: 'Memorial Erguido', desc: 'Erga as 3 Pedras do Memorial numa partida.', tier: 0, unlock: 'hero:moises', cat: 'mapas' },
  golias: { name: 'O Gigante Caiu', desc: 'Vença no Vale de Elá.', tier: 1, unlock: 'map:ossos', cat: 'mapas', title: 'Matador de gigantes' },
  farao: { name: 'Cavalo e Cavaleiro', desc: 'Vença no Mar Vermelho.', tier: 1, unlock: 'map:jerico', cat: 'mapas' },
  gogue: { name: 'Ossos que Vivem', desc: 'Vença no Vale dos Ossos Secos.', tier: 2, unlock: 'hero:josue', cat: 'mapas' },
  rei: { name: 'As Muralhas Caíram', desc: 'Vença em Jericó.', tier: 2, unlock: 'relic:arco', cat: 'mapas' },
  perseveranca: { name: 'Perseverança', desc: 'Sobreviva 8 minutos numa partida.', tier: 1, unlock: 'hero:debora', cat: 'progresso' },
  evolucao: { name: 'Transformação', desc: 'Evolua uma arma.', tier: 1, unlock: 'relic:tabuas', cat: 'colecao' },
  pedras: { name: 'Cinco Pedras Lisas', desc: 'Junte as 5 pedras do ribeiro em Elá.', tier: 0, unlock: 'relic:escudo', cat: 'mapas' },
  mil: { name: 'Mil Abates', desc: 'Derrote 1000 inimigos numa partida.', tier: 1, unlock: 'relic:candelabro', cat: 'progresso' },
  tesouro: { name: 'Tesouro Recuperado', desc: 'Alcance um tesouro em fuga.', tier: 0, unlock: 'relic:sal', cat: 'mapas' },
  selo: { name: 'Selo Rompido', desc: 'Resista à emboscada de um baú selado.', tier: 0, unlock: 'relic:paes', cat: 'mapas' },
  poco: { name: 'Água Viva', desc: 'Beba de um poço ou fonte.', tier: 0, cat: 'mapas' },
  ungido: { name: 'Ungido', desc: 'Alcance o nível 20 numa partida.', tier: 1, cat: 'progresso' },
  noite: { name: 'Coluna de Fogo', desc: 'Atravesse uma noite inteira.', tier: 0, cat: 'progresso' },
  salomao: { name: 'Riqueza de Salomão', desc: 'Junte 300 siclos de uma vez.', tier: 1, cat: 'colecao' },
  relicario: { name: 'Relicário', desc: 'Tenha 8 relíquias numa partida.', tier: 1, cat: 'colecao' },
  maos: { name: 'Mãos Levantadas', desc: 'Faça 5 milagres numa partida.', tier: 0, cat: 'progresso' },
  valentes: { name: 'Os Valentes', desc: 'Vença com 3 heróis diferentes.', tier: 2, cat: 'progresso' },
  conquista: { name: 'Terra Prometida', desc: 'Vença nos 4 cenários.', tier: 2, cat: 'mapas', title: 'Conquistador de Canaã' },
  veterano: { name: 'Veterano', desc: 'Derrote 5.000 inimigos, somando as partidas.', tier: 1, cat: 'progresso', goal: ['kills', 5000] },
  lenda: { name: 'Lenda de Israel', desc: 'Derrote 25.000 inimigos, somando as partidas.', tier: 2, cat: 'progresso', goal: ['kills', 25000], title: 'Lenda de Israel' },
  constancia: { name: 'Constância', desc: 'Jogue 10 partidas.', tier: 0, cat: 'progresso', goal: ['runs', 10] },
  peregrino: { name: 'Peregrino', desc: 'Some 2 horas de jornada.', tier: 1, cat: 'progresso', goal: ['seconds', 7200], title: 'Peregrino' },
  crescimento: { name: 'Crescimento', desc: 'Leve um herói ao estágio 2.', tier: 1, cat: 'colecao' },
  plenitude: { name: 'Plenitude', desc: 'Leve um herói ao estágio 3.', tier: 2, cat: 'colecao', title: 'Ungido do Senhor' },
  vestes: { name: 'Vestes Novas', desc: 'Tenha 5 itens no guarda-roupa.', tier: 0, cat: 'colecao' },
  pesquisador: { name: 'Pesquisador', desc: 'Complete a pesquisa de um cenário no Bestiário.', tier: 1, cat: 'colecao' },
  sabio: { name: 'Sábio como Salomão', desc: 'Complete a pesquisa dos 4 cenários.', tier: 2, cat: 'colecao', title: 'Sábio' },
  contente: { name: 'Contentamento', desc: 'Vença com 3 relíquias ou menos.', tier: 2, cat: 'desafios', title: 'Contente com pouco' },
  intocavel: { name: 'Intocável', desc: 'Vença levando no máximo 15 golpes.', tier: 2, cat: 'desafios', title: 'Intocável' },
  porumfio: { name: 'Por um Fio', desc: 'Vença com menos de 10% da vida.', tier: 1, cat: 'desafios' },
  recruta: { name: 'Com os Valentes', desc: 'Um valente de Davi se junta a você.', tier: 1, cat: 'desafios' },
  coragem: { name: 'Coragem', desc: 'Vença no Difícil.', tier: 1, cat: 'dificuldade' },
  destemido: { name: 'Destemido', desc: 'Vença no Pesadelo.', tier: 2, cat: 'dificuldade', title: 'Destemido' },
  resistente: { name: 'Resistente', desc: 'Resista 10 minutos na Sobrevivência.', tier: 0, cat: 'sobrevivencia' },
  incansavel: { name: 'Incansável', desc: 'Resista 20 minutos na Sobrevivência.', tier: 1, cat: 'sobrevivencia' },
  eterno: { name: 'Sobrevivente Eterno', desc: 'Resista 45 minutos na Sobrevivência.', tier: 2, cat: 'sobrevivencia', title: 'Sobrevivente eterno' },
  alianca: { name: 'Aliança', desc: 'Faça uma aliança depois de um guardião na Sobrevivência.', tier: 0, cat: 'sobrevivencia' },
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
export function spawnWeights(t) { // by type; slingers survive longer, so keep them rare; runner packs count four
  return [1, t > 60 ? 0.12 : 0, t > 120 ? 0.15 : 0, t > 180 ? 0.1 : 0, 0, t > 45 ? 0.09 : 0, t > 150 ? 0.08 : 0];
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
    upgrades: o('upgrades'), tools: o('tools'), bag: o('bag'), heroes: o('heroes'), mastery: o('mastery'),
    stats: o('stats'), // kills, runs and seconds, summed over every run
    mapWins: isObj(p.mapWins) ? p.mapWins : Object.fromEntries(Object.values(o('wins')).flatMap((w) => Object.keys(w)).map((m) => [m, 0])), // best difficulty won
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
export const ARSENAL = { machado: 150, carros: 200, gafanhotos: 200, fogo: 250, estaca: 180, lanca: 220, corvos: 260, mo: 320 };
// Mastery: every weapon can be strengthened for good, +10% damage a level (its evolution keeps it).
export const MASTERY = { per: 0.1, max: 5, cost: 80 };
export const masteryOf = (profile, id) => profile.mastery?.[WEAPONS[id].from ?? id] || 0;
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

// ---------- Hero evolution: time played with a hero (a win counts 5 minutes more) ----------
export const STAGE_XP = [0, 3600, 10800]; // seconds: stage 2 after 1 h, stage 3 after 3 h
export const heroStage = (xp = 0) => (xp >= STAGE_XP[2] ? 2 : xp >= STAGE_XP[1] ? 1 : 0);
export const runXp = (seconds, won) => Math.floor(seconds) + (won ? 300 : 0);
// names: the three stages; stat: what each stage adds; gear: pieces worn at each stage (see gear.js).
export const STAGES = {
  davi: { names: ['Pastor', 'Guerreiro de Saul', 'Rei Davi'], stat: ['dmg', 0.05, 'de dano'], ref: '2 Sm 5:3',
    gear: [[], ['cuirass', 'swordBack'], ['crown', 'capeRoyal', 'harp']] },
  sansao: { names: ['Nazireu', 'Juiz de Israel', 'Sansão de Gaza'], stat: ['maxHp', 12, 'de vida máxima'], ref: 'Jz 16:3',
    gear: [[], ['braids', 'bracelets'], ['braids', 'bracelets', 'gates', 'fireEyes']] },
  moises: { names: ['Pastor de Midiã', 'Profeta', 'Legislador'], stat: ['area', 0.05, 'de área'], ref: 'Êx 34:29',
    gear: [[], ['capeBlue'], ['capeBlue', 'tablets', 'halo']] },
  josue: { names: ['Servo de Moisés', 'Espião de Canaã', 'Comandante'], stat: ['armor', 0.03, 'de armadura'], ref: 'Js 5:14',
    gear: [[], ['capeTravel', 'grapes'], ['armor', 'banner']] },
  debora: { names: ['Profetisa', 'Juíza de Israel', 'Mãe em Israel'], stat: ['luck', 0.05, 'de sorte'], ref: 'Jz 5:7',
    gear: [[], ['veil'], ['veil', 'leafCrown', 'quiverGold']] },
};
// Stage 2 and 3 add the stat once and twice; stage 3 also fills Fé 25% faster (the miracle comes sooner).
export function stageBonus(st, hero, stage) {
  const [stat, v] = STAGES[hero].stat;
  st[stat] += v * stage;
  if (stage >= 2) st.faith += 0.25;
  return st;
}
export const stageText = (hero, stage) => {
  const [, v, label] = STAGES[hero].stat;
  const n = v * stage;
  return stage ? `+${v < 1 ? `${Math.round(n * 100)}%` : n} ${label}${stage >= 2 ? ' · milagre mais frequente' : ''}` : 'Sem bônus ainda';
};

// ---------- Wardrobe: worn by any hero. slot: head, back (both hide the stage piece in that slot),
// trail (a wake of sparks while running) or frame (around the portrait). unlock: earned, not bought.
export const COSMETICS = {
  louros: { name: 'Coroa de louros', slot: 'head', cost: 300 },
  turbante: { name: 'Turbante', slot: 'head', cost: 200 },
  capuz: { name: 'Capuz de viagem', slot: 'head', cost: 250 },
  mantoRubro: { name: 'Manto escarlate', slot: 'back', cost: 350 },
  mantoCores: { name: 'Túnica de muitas cores', slot: 'back', cost: 500, ref: 'Gn 37:3' },
  aljava: { name: 'Aljava de cedro', slot: 'back', cost: 300 },
  rastroOuro: { name: 'Rastro de pó dourado', slot: 'trail', cost: 250, color: 0xffd66b },
  rastroPetalas: { name: 'Rastro de pétalas', slot: 'trail', cost: 250, color: 0xff9ab8 },
  rastroBrasas: { name: 'Rastro de brasas', slot: 'trail', cost: 300, color: 0xff8a3d },
  molduraReal: { name: 'Moldura real', slot: 'frame', cost: 600 },
  molduraEla: { name: 'Moldura de Elá', slot: 'frame', unlock: 'research:ela' },
  molduraMar: { name: 'Moldura do Mar', slot: 'frame', unlock: 'research:mar' },
  molduraOssos: { name: 'Moldura dos Ossos', slot: 'frame', unlock: 'research:ossos' },
  molduraJerico: { name: 'Moldura de Jericó', slot: 'frame', unlock: 'research:jerico' },
  molduraCampeao: { name: 'Moldura de campeão', slot: 'frame', unlock: 'season' }, // top 50 of a season's ranking
};
export const SLOT_NAME = { head: 'Cabeça', back: 'Costas', trail: 'Rastro', frame: 'Moldura' };

// ---------- Bestiary: kills by map and kind; enough of each completes the map's research (a frame) ----------
export const BEAST_KINDS = ['soldado', 'fundeiro', 'carro', 'gigante', 'batedor', 'escudeiro', 'elite', 'chefe'];
export const BEAST_TYPE = { soldado: 0, fundeiro: 1, carro: 2, gigante: 3, batedor: 5, escudeiro: 6, elite: 3 }; // the model each kind shows
export const RESEARCH = { soldado: 100, fundeiro: 50, carro: 40, gigante: 25, batedor: 80, escudeiro: 30, elite: 2, chefe: 1 };
export const researchOf = (profile, biome) => BEAST_KINDS.every((k) => (profile.bestiary?.kills?.[`${biome}:${k}`] || 0) >= RESEARCH[k]);

// ---------- Difficulty: opens map by map, one win at a time ----------
export const DIFFS = [
  { name: 'Normal', hp: 1, dmg: 1, pay: 1, text: 'como sempre' },
  { name: 'Difícil', hp: 1.7, dmg: 1.35, pay: 1.75, text: 'inimigos +70% de vida, +35% de dano' },
  { name: 'Pesadelo', hp: 2.6, dmg: 1.7, pay: 2.5, text: 'inimigos +160% de vida, +70% de dano' },
];
export const diffOpen = (profile, map, d) => d === 0 || (profile.mapWins?.[map] ?? -1) >= d - 1;

// ---------- Survival: a guardian every 5 minutes; after each one, an alliance: a power and its price ----------
export const GUARDIAN_EVERY = 300;
export const ENDLESS_NIGHT = 2700; // 45:00
export const PACTS = [
  { name: 'Voto de nazireu', ref: 'Nm 6:5', good: ['dmg', 0.4, '+40% de dano'], bad: ['hpMul', 0.8, '−20% de vida máxima'] },
  { name: 'Aliança com Gibeão', ref: 'Js 9:15', good: ['amount', 1, '+1 projétil'], bad: ['espd', 1.2, 'inimigos 20% mais rápidos'] },
  { name: 'Voto de Jefté', ref: 'Jz 11:30', good: ['luck', 0.4, '+40% de sorte'], bad: ['chest', 2, 'baús custam o dobro'] },
  { name: 'Pão da aflição', ref: 'Dt 16:3', good: ['regen', 3, '+3 de vida por segundo'], bad: ['speed', -0.15, '−15% de velocidade'] },
  { name: 'Trombetas de Gideão', ref: 'Jz 7:20', good: ['area', 0.3, '+30% de área'], bad: ['spawn', 1.3, '+30% de inimigos'] },
  { name: 'Oferta apressada', ref: '1 Sm 13:9', good: ['cd', 0.2, '−20% de recarga'], bad: ['armor', -0.15, '−15% de armadura'] },
];

// ---------- Tasks: three a day (easy, medium, hard) and three a week, the same for everyone that day ----------
// stat: what a run adds (best: the best single run counts, not the sum).
export const TASKS = {
  facil: [
    { id: 'k300', text: 'Derrote 300 inimigos', stat: 'kills', goal: 300 },
    { id: 'c3', text: 'Abra 3 baús', stat: 'chests', goal: 3 },
    { id: 'r2', text: 'Jogue 2 partidas', stat: 'runs', goal: 2 },
    { id: 'p2', text: 'Erga 2 Pedras do Memorial', stat: 'stones', goal: 2 },
    { id: 'v2', text: 'Mine 2 veios de prata', stat: 'veins', goal: 2 },
  ],
  media: [
    { id: 'k1500', text: 'Derrote 1.500 inimigos', stat: 'kills', goal: 1500 },
    { id: 'm15', text: 'Jogue 15 minutos', stat: 'minutes', goal: 15 },
    { id: 'g4', text: 'Quebre 4 jarros de Gideão', stat: 'jars', goal: 4 },
    { id: 's400', text: 'Junte 400 siclos', stat: 'gold', goal: 400 },
    { id: 'e2', text: 'Derrote 2 campeões ou tesoureiros', stat: 'elites', goal: 2 },
  ],
  dificil: [
    { id: 'w1', text: 'Vença um cenário', stat: 'wins', goal: 1 },
    { id: 'b1000', text: 'Derrote 1.000 inimigos numa só partida', stat: 'kills', goal: 1000, best: true },
    { id: 'l20', text: 'Chegue ao nível 20 numa partida', stat: 'level', goal: 20, best: true },
    { id: 'sv10', text: 'Resista 10 minutos na Sobrevivência', stat: 'survMinutes', goal: 10, best: true },
  ],
  semana: [
    { id: 'wk8k', text: 'Derrote 8.000 inimigos', stat: 'kills', goal: 8000 },
    { id: 'wkw3', text: 'Vença 3 vezes', stat: 'wins', goal: 3 },
    { id: 'wkc30', text: 'Abra 30 baús', stat: 'chests', goal: 30 },
    { id: 'wkm90', text: 'Jogue 90 minutos', stat: 'minutes', goal: 90 },
    { id: 'wkh1', text: 'Vença no Difícil ou no Pesadelo', stat: 'hardWins', goal: 1 },
    { id: 'wkg2', text: 'Derrote 2 guardiões na Sobrevivência', stat: 'guardians', goal: 2 },
  ],
};
export const TASK_PAY = { facil: 40, media: 80, dificil: 140, semana: [200, 300, 500] };
export const TASK_BONUS = { day: 60, week: 400 }; // all three done: extra denários and supplies
export const hashStr = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function weekKey(d = new Date()) { // Monday-first weeks
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `S${dayKey(m)}`;
}
// The day's (or week's) tasks; swap: how many times the player traded one in, so the trade is stable too.
export function rollTasks(key, kind, swaps = 0) {
  if (kind === 'day') return ['facil', 'media', 'dificil'].map((tier, k) => { const l = TASKS[tier]; return { tier, id: l[hashStr(`${key}${k}${swaps}`) % l.length].id, prog: 0, claimed: false }; });
  const l = TASKS.semana;
  const start = hashStr(`${key}${swaps}`) % l.length;
  return [0, 1, 2].map((k) => ({ tier: 'semana', id: l[(start + k * 2) % l.length].id, prog: 0, claimed: false }));
}
export const taskDef = (t) => TASKS[t.tier].find((x) => x.id === t.id);
export function addRunToTasks(list, run) {
  for (const t of list) {
    const d = taskDef(t);
    const v = run[d.stat] || 0;
    t.prog = Math.min(d.goal, d.best ? Math.max(t.prog, v) : t.prog + v);
  }
}

// ---------- Bestiary names, by map and kind ----------
export const BEAST_NAMES = {
  ela: ['Soldado filisteu', 'Fundeiro filisteu', 'Carro filisteu', 'Gigante anaquim', 'Batedor filisteu', 'Escudeiro filisteu'],
  mar: ['Soldado egípcio', 'Arqueiro egípcio', 'Carro do Faraó', 'Colosso de pedra', 'Corredor egípcio', 'Guarda do Faraó'],
  ossos: ['Esqueleto', 'Esqueleto atirador', 'Carro de ossos', 'Gigante de ossos', 'Esqueleto ligeiro', 'Muralha de ossos'],
  jerico: ['Guarda de Jericó', 'Fundeiro cananeu', 'Carro cananeu', 'Guardião da muralha', 'Espião cananeu', 'Porta-escudo de Jericó'],
};
