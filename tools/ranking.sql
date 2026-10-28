-- Bible Rush: online rankings on Supabase (free plan).
-- Run this once in the project's SQL Editor (Supabase > SQL Editor > New query > paste > Run).
--
-- The game only calls three functions with the project's public (anon) key:
--   claim_name   when the player picks a name (each name belongs to one player)
--   submit_run   after each run, to record it
--   leaderboard  to read a ranking
-- The tables stay closed to that key (row level security on, no policies), and submit_run checks every
-- value before it counts: names, maps and heroes that exist, no more kills than the horde could have
-- brought in that time, and runs that cannot overlap (a 10-minute run needs 10 minutes since the last one).
-- Seasons are calendar months (UTC), decided by the server. Safe to run again after changes.

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

-- One player per name (any case). A save in another browser (or another address, like a local test) is
-- another player; before names were unique, such saves could take a name already in use. Those are merged
-- into the one with the most runs: their runs move over and they are removed. Nothing to do once the
-- unique index exists. To play as the same player in another browser, carry the save over with its
-- code (Configurações > Progresso): the code keeps the player id.
update public.runs r set player = d.keep
from (select p.id, first_value(p.id) over (partition by lower(btrim(p.name))
        order by (select count(*) from public.runs x where x.player = p.id) desc, p.last_run desc) as keep
      from public.players p) d
where r.player = d.id and d.id <> d.keep;
delete from public.players p
using (select p2.id, first_value(p2.id) over (partition by lower(btrim(p2.name))
         order by (select count(*) from public.runs x where x.player = p2.id) desc, p2.last_run desc) as keep
       from public.players p2) d
where p.id = d.id and d.id <> d.keep;
create unique index if not exists players_name_key on public.players (lower(name));

-- Picking (or changing) a name: refused when another player has it.
create or replace function public.claim_name(p_player uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{2,16}$' then raise exception 'nome inválido'; end if;
  if exists (select 1 from players where lower(name) = lower(v_name) and id <> p_player) then raise exception 'nome já em uso'; end if;
  insert into players (id, name, last_run) values (p_player, v_name, '-infinity') -- no run yet: nothing overlaps
  on conflict (id) do update set name = excluded.name;
  return v_name;
end $$;

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
  -- The horde grows with time (about 1 + t/40 enemies a second): no run kills more than could have come.
  if p_seconds not between 0 and 21600 or p_kills < 0 or p_kills > p_seconds + p_seconds * p_seconds / 70 + 300 then
    raise exception 'números impossíveis';
  end if;
  if p_won and (p_mode <> 'classic' or p_seconds < 120 or p_seconds > 1500) then raise exception 'vitória impossível'; end if;
  if exists (select 1 from players where lower(name) = lower(v_name) and id <> p_player) then raise exception 'nome já em uso'; end if;
  if exists (select 1 from players where id = p_player
             and last_run > now() - make_interval(secs => greatest(20, p_seconds * 0.8))) then
    raise exception 'partidas sobrepostas';
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
revoke all on function public.claim_name(uuid, text) from public;
grant execute on function public.claim_name(uuid, text) to anon, authenticated;
grant execute on function public.submit_run(uuid, text, text, text, text, text, integer, text, integer, integer, boolean) to anon, authenticated;
grant execute on function public.leaderboard(text, text, text, uuid, integer) to anon, authenticated;
