-- One-time migration: week boundaries = Monday 00:00 Asia/Singapore (SGT).
-- Run in Supabase SQL Editor on existing projects.

-- Drop views first (they depend on get_week_start)
drop view if exists public.all_time_user_stats;
drop view if exists public.weekly_user_stats;

drop function if exists public.get_week_start(date);

create or replace function public.get_week_start(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select (date_trunc('week', (p_at at time zone 'Asia/Singapore')::timestamp))::date;
$$;

grant execute on function public.get_week_start(timestamptz) to authenticated, anon;

-- Recreate stats views
create view public.weekly_user_stats as
select
  p.id as user_id,
  p.display_name,
  public.get_week_start() as week_start,
  coalesce(a.self_steps, 0) as self_steps,
  coalesce(a.self_mvpa, 0) as self_mvpa,
  coalesce(r.received_steps, 0) as received_steps,
  coalesce(r.received_mvpa, 0) as received_mvpa,
  greatest(0, coalesce(a.self_steps, 0) - coalesce(s.sent_steps, 0))
    + coalesce(r.received_steps, 0) as total_steps,
  greatest(0, coalesce(a.self_mvpa, 0) - coalesce(s.sent_mvpa, 0))
    + coalesce(r.received_mvpa, 0) as total_mvpa,
  coalesce(s.sent_steps, 0) as sent_steps,
  coalesce(s.sent_mvpa, 0) as sent_mvpa,
  greatest(0, coalesce(a.self_steps, 0) - coalesce(s.sent_steps, 0)) as available_steps,
  greatest(0, coalesce(a.self_mvpa, 0) - coalesce(s.sent_mvpa, 0)) as available_mvpa,
  coalesce(s.reward_count, 0) as rewards_sent_count,
  coalesce(r.reward_count, 0) as rewards_received_count,
  greatest(0, coalesce(a.self_steps, 0) - coalesce(s.sent_steps, 0)) as net_self_steps,
  greatest(0, coalesce(a.self_mvpa, 0) - coalesce(s.sent_mvpa, 0)) as net_self_mvpa
from public.profiles p
left join lateral (
  select sum(steps) as self_steps, sum(mvpa_minutes) as self_mvpa
  from public.activities
  where user_id = p.id
    and week_start = public.get_week_start()
) a on true
left join lateral (
  select
    sum(steps) as received_steps,
    sum(mvpa_minutes) as received_mvpa,
    count(*) as reward_count
  from public.rewards
  where receiver_id = p.id
    and week_start = public.get_week_start()
) r on true
left join lateral (
  select
    sum(steps) as sent_steps,
    sum(mvpa_minutes) as sent_mvpa,
    count(*) as reward_count
  from public.rewards
  where sender_id = p.id
    and week_start = public.get_week_start()
) s on true;

create view public.all_time_user_stats as
select
  p.id as user_id,
  p.display_name,
  coalesce(a.self_steps, 0) as self_steps,
  coalesce(a.self_mvpa, 0) as self_mvpa,
  coalesce(r.received_steps, 0) as received_steps,
  coalesce(r.received_mvpa, 0) as received_mvpa,
  greatest(0, coalesce(a.self_steps, 0) - coalesce(s.sent_steps, 0))
    + coalesce(r.received_steps, 0) as total_steps,
  greatest(0, coalesce(a.self_mvpa, 0) - coalesce(s.sent_mvpa, 0))
    + coalesce(r.received_mvpa, 0) as total_mvpa,
  coalesce(s.sent_steps, 0) as sent_steps,
  coalesce(s.sent_mvpa, 0) as sent_mvpa,
  coalesce(s.reward_count, 0) as rewards_sent_count,
  coalesce(r.reward_count, 0) as rewards_received_count,
  greatest(0, coalesce(a.self_steps, 0) - coalesce(s.sent_steps, 0)) as net_self_steps,
  greatest(0, coalesce(a.self_mvpa, 0) - coalesce(s.sent_mvpa, 0)) as net_self_mvpa
from public.profiles p
left join lateral (
  select sum(steps) as self_steps, sum(mvpa_minutes) as self_mvpa
  from public.activities
  where user_id = p.id
) a on true
left join lateral (
  select
    sum(steps) as received_steps,
    sum(mvpa_minutes) as received_mvpa,
    count(*) as reward_count
  from public.rewards
  where receiver_id = p.id
) r on true
left join lateral (
  select
    sum(steps) as sent_steps,
    sum(mvpa_minutes) as sent_mvpa,
    count(*) as reward_count
  from public.rewards
  where sender_id = p.id
) s on true;

grant select on public.weekly_user_stats to authenticated, anon;
grant select on public.all_time_user_stats to authenticated, anon;
