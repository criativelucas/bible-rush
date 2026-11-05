-- Allow Elias without modifying existing player or run data. Apply in Supabase SQL Editor.
create or replace function public.submit_run(
  p_player uuid, p_name text, p_title text, p_frame text, p_map text, p_mode text, p_diff integer,
  p_hero text, p_kills integer, p_seconds integer, p_won boolean, p_floor integer default 0
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_season text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_name text := btrim(coalesce(p_name, ''));
begin
  if v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{2,16}$' then raise exception 'nome inválido'; end if;
  if not ((p_map in ('ela', 'mar', 'ossos', 'jerico') and p_mode in ('classic', 'surv') and coalesce(p_floor, 0) = 0)
          or (p_map = 'babel' and p_mode = 'babel' and p_floor between 1 and 500))
     or p_diff not between 0 and 2 or p_hero not in ('davi', 'sansao', 'moises', 'josue', 'debora', 'elias') then
    raise exception 'dados inválidos';
  end if;
  -- The tower: no floor is cleared in under 15 seconds.
  if p_mode = 'babel' and p_seconds < (p_floor - 1) * 15 then raise exception 'números impossíveis'; end if;
  -- The horde grows with time (about 1 + t/40 enemies a second): no run kills more than could have come.
  if p_seconds not between 0 and 21600 or p_kills < 0 or p_kills > p_seconds + p_seconds * p_seconds / 70 + 300 then
    raise exception 'números impossíveis';
  end if;
  if p_won and not ((p_mode = 'classic' and p_seconds between 120 and 1500) or (p_mode = 'babel' and p_floor > 10)) then
    raise exception 'vitória impossível';
  end if;
  if exists (select 1 from players where lower(name) = lower(v_name) and id <> p_player) then raise exception 'nome já em uso'; end if;
  if exists (select 1 from players where id = p_player
             and last_run > now() - make_interval(secs => greatest(20, p_seconds * 0.8))) then
    raise exception 'partidas sobrepostas';
  end if;
  insert into players (id, name, title, frame, last_run)
  values (p_player, v_name, left(coalesce(p_title, ''), 40), left(coalesce(p_frame, ''), 24), now())
  on conflict (id) do update set name = excluded.name, title = excluded.title, frame = excluded.frame, last_run = now();
  insert into runs (player, season, map, mode, diff, hero, kills, seconds, won, floor)
  values (p_player, v_season, p_map, p_mode, p_diff, p_hero, p_kills, p_seconds, p_won, coalesce(p_floor, 0));
  return v_season;
end $$;

-- Targeted, repeatable migration: preserve existing runs, players and function grants.
create or replace function public.leaderboard(
  p_board text, p_season text, p_map text default null, p_player uuid default null, p_limit integer default 50
) returns table (pos bigint, me boolean, name text, title text, frame text, hero text, map text, value bigint, runs bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    select r.* from runs r
    where r.season = p_season and (p_map is null or r.map = p_map)
      and case p_board when 'abates' then true when 'relogio' then r.won and r.mode = 'classic' when 'torre' then r.mode = 'babel' else r.mode = 'surv' end
  ), scored as (
    select m.player,
      case p_board when 'abates' then sum(m.kills) when 'relogio' then min(m.seconds) when 'torre' then max(m.floor) else max(m.seconds) end::bigint as value,
      (array_agg(m.seconds order by -m.floor, m.seconds))[1]::bigint as tie, -- the tower: the fastest climb to the best floor
      (array_agg(m.hero order by case p_board when 'relogio' then m.seconds when 'sobrevivencia' then -m.seconds when 'torre' then -m.floor * 100000 + m.seconds else 0 end, m.created_at desc))[1] as hero,
      (array_agg(m.map order by case p_board when 'relogio' then m.seconds when 'sobrevivencia' then -m.seconds when 'torre' then -m.floor * 100000 + m.seconds else 0 end, m.created_at desc))[1] as map,
      count(*) as runs
    from mine m group by m.player
  ), ranked as (
    select rank() over (order by case when p_board = 'relogio' then s.value else -s.value end, case when p_board = 'torre' then s.tie else 0 end) as pos, s.*
    from scored s
  )
  select k.pos, coalesce(k.player = p_player, false), p.name, p.title, p.frame, k.hero, k.map, k.value, k.runs
  from ranked k join players p on p.id = k.player
  where k.pos <= least(greatest(p_limit, 1), 100) or k.player = p_player
  order by k.pos
$$;

