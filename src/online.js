// Online rankings on Supabase (free plan): the database and its two functions are in tools/ranking.sql,
// the setup steps in README.md. With the address and key empty the game plays offline, as before.
// The key is the project's "anon public" key: made to be in a web page; it can only call those functions.
export const SUPABASE_URL = 'https://ymoqqhkgyzlyjvjymsxv.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_89xlN5gbZy2CU4ZFIdI7bw_VPGInfOB'; // publishable: never put the secret key here

// For testing against another server without editing this file: localStorage 'bible-rush-online' = {"url", "key"}.
const cfg = (() => {
  try { return { url: SUPABASE_URL, key: SUPABASE_KEY, ...JSON.parse(localStorage.getItem('bible-rush-online') || '{}') }; } catch { return { url: SUPABASE_URL, key: SUPABASE_KEY }; }
})();
export const onlineOn = () => !!(cfg.url && cfg.key);

async function rpc(name, body) {
  const r = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.message || `erro ${r.status}`);
  return data;
}

// Seasons are calendar months (UTC), as on the server.
export const seasonKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
export const prevSeason = (d = new Date()) => seasonKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
export const seasonEnd = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const seasonName = (key) => { const [y, m] = key.split('-'); return `${MONTHS[Number(m) - 1]} de ${y}`; };
export const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{2,16}$/; // the same rule as the server's

// One finished run. Sent when the run ends; kept in profile.pending and sent later if the network fails.
export async function submitRun(profile, run) {
  if (!onlineOn()) return 'offline';
  const body = { p_player: profile.pid, p_name: profile.name || '', p_title: run.title || '', p_frame: run.frame || '', p_map: run.map, p_mode: run.mode,
    p_diff: run.diff, p_hero: run.hero, p_kills: run.kills, p_seconds: run.seconds, p_won: run.won };
  if (!profile.name) {
    (profile.pending ??= []).push(body);
    return 'sem_nome';
  }
  try {
    await rpc('submit_run', body);
    return 'sent';
  } catch (e) {
    if (/Failed to fetch|NetworkError|erro 5/.test(e.message)) (profile.pending ??= []).push(body); // try again later
    return e.message;
  }
}
export async function flushPending(profile) {
  if (!onlineOn() || !profile.name || !profile.pending?.length) return;
  const left = [];
  for (const body of profile.pending.splice(0, 10)) {
    body.p_name = profile.name;
    body.p_player = profile.pid;
    try { await rpc('submit_run', body); } catch (e) { if (/Failed to fetch|NetworkError|erro 5/.test(e.message)) left.push(body); }
  }
  profile.pending.push(...left);
}

// board: 'abates' | 'relogio' | 'sobrevivencia'; map: a map id or null for all. Rows: pos, me, name, title,
// frame, hero, map, value, runs. Cached for a minute.
const cache = new Map();
export async function leaderboard(board, season, map, profile, limit = 50) {
  if (!onlineOn()) return null;
  const k = `${board}|${season}|${map}|${limit}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < 60000) return hit.rows;
  const rows = await rpc('leaderboard', { p_board: board, p_season: season, p_map: map || null, p_player: profile.pid, p_limit: limit });
  cache.set(k, { t: Date.now(), rows });
  return rows;
}
export const clearBoards = () => cache.clear();
