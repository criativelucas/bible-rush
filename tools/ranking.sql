-- Bible Rush: online rankings on Supabase (free plan).
-- Run this once in the project's SQL Editor (Supabase > SQL Editor > New query > paste > Run).
--
-- The game only calls two functions with the project's public (anon) key:
--   submit_run   after each run, to record it
--   leaderboard  to read a ranking
-- The tables stay closed to that key (row level security on, no policies), and submit_run checks every
-- value before it counts: names, maps and heroes that exist, numbers a real run could reach, at most one
-- run every 20 seconds per player. Seasons are calendar months (UTC), decided by the server.

create table if not exists public.players (
  id uuid primary key,
  name text not null,
  title text not null default '',
  frame text not null default '',
  last_run timestamptz not null default now()
);

create table if not exists public.runs (
  id bigserial primary key,
  player uuid not null references public.players (id) on delete cascade,
  season text not null,
  map text not null,
  mode text not null,
  diff smallint not null,
  hero text not null,
  kills integer not null,
  seconds integer not null,
  won boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists runs_board_idx on public.runs (season, map, mode);

alter table public.players enable row level security;
alter table public.runs enable row level security;

create or replace function public.submit_run(
  p_player uuid, p_name text, p_title text, p_frame text, p_map text, p_mode text, p_diff integer,
  p_hero text, p_kills integer, p_seconds integer, p_won boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_season text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{2,16}$' then raise exception 'nome inválido'; end if;
  if p_map not in ('ela', 'mar', 'ossos', 'jerico') or p_mode not in ('classic', 'surv') or p_diff not between 0 and 2
     or p_hero not in ('davi', 'sansao', 'moises', 'josue', 'debora') then
    raise exception 'dados inválidos';
  end if;
  if p_seconds not between 0 and 21600 or p_kills not between 0 and 200000 or p_kills > p_seconds * 30 + 100 then
    raise exception 'números impossíveis';
  end if;
  if p_won and (p_mode <> 'classic' or p_seconds < 120) then raise exception 'vitória impossível'; end if;
  if exists (select 1 from players where id = p_player and last_run > now() - interval '20 seconds') then
    raise exception 'espere um pouco';
  end if;
  insert into players (id, name, title, frame, last_run)
  values (p_player, v_name, left(coalesce(p_title, ''), 40), left(coalesce(p_frame, ''), 24), now())
  on conflict (id) do update set name = excluded.name, title = excluded.title, frame = excluded.frame, last_run = now();
  insert into runs (player, season, map, mode, diff, hero, kills, seconds, won)
  values (p_player, v_season, p_map, p_mode, p_diff, p_hero, p_kills, p_seconds, p_won);
  return v_season;
end $$;

-- p_board: 'abates' (kills summed over the season), 'relogio' (fastest win), 'sobrevivencia' (longest survival).
-- p_map: one map, or null for all of them. Returns the top p_limit (100 at most) and, when p_player is
-- given, that player's own row too (me = true). Player ids are never returned.
create or replace function public.leaderboard(
  p_board text, p_season text, p_map text default null, p_player uuid default null, p_limit integer default 50
) returns table (pos bigint, me boolean, name text, title text, frame text, hero text, map text, value bigint, runs bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    select r.* from runs r
    where r.season = p_season and (p_map is null or r.map = p_map)
      and case p_board when 'abates' then true when 'relogio' then r.won else r.mode = 'surv' end
  ), scored as (
    select m.player,
      case p_board when 'abates' then sum(m.kills) when 'relogio' then min(m.seconds) else max(m.seconds) end::bigint as value,
      (array_agg(m.hero order by case p_board when 'relogio' then m.seconds when 'sobrevivencia' then -m.seconds else 0 end, m.created_at desc))[1] as hero,
      (array_agg(m.map order by case p_board when 'relogio' then m.seconds when 'sobrevivencia' then -m.seconds else 0 end, m.created_at desc))[1] as map,
      count(*) as runs
    from mine m group by m.player
  ), ranked as (
    select rank() over (order by case when p_board = 'relogio' then s.value else -s.value end) as pos, s.*
    from scored s
  )
  select k.pos, coalesce(k.player = p_player, false), p.name, p.title, p.frame, k.hero, k.map, k.value, k.runs
  from ranked k join players p on p.id = k.player
  where k.pos <= least(greatest(p_limit, 1), 100) or k.player = p_player
  order by k.pos
$$;

revoke all on function public.submit_run(uuid, text, text, text, text, text, integer, text, integer, integer, boolean) from public;
revoke all on function public.leaderboard(text, text, text, uuid, integer) from public;
grant execute on function public.submit_run(uuid, text, text, text, text, text, integer, text, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leaderboard(text, text, text, uuid, integer) to anon, authenticated;
