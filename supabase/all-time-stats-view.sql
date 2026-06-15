-- Run in Supabase SQL Editor to enable the accumulate leaderboard view.

create or replace view public.all_time_user_stats as
select
  p.id as user_id,
  p.display_name,
  coalesce(a.self_steps, 0) as self_steps,
  coalesce(a.self_mvpa, 0) as self_mvpa,
  coalesce(r.received_steps, 0) as received_steps,
  coalesce(r.received_mvpa, 0) as received_mvpa,
  coalesce(a.self_steps, 0) + coalesce(r.received_steps, 0) as total_steps,
  coalesce(a.self_mvpa, 0) + coalesce(r.received_mvpa, 0) as total_mvpa,
  coalesce(s.sent_steps, 0) as sent_steps,
  coalesce(s.sent_mvpa, 0) as sent_mvpa,
  coalesce(s.reward_count, 0) as rewards_sent_count,
  coalesce(r.reward_count, 0) as rewards_received_count
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
