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

