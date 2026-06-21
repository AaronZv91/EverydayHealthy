-- EverydayHealthy Supabase Schema
-- Run this in the Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activities (earn quota by logging exercise)
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  steps integer not null check (steps >= 0),
  mvpa_minutes integer not null check (mvpa_minutes >= 0),
  week_start date not null,
  note text,
  created_at timestamptz not null default now(),
  check (steps > 0 or mvpa_minutes > 0)
);

create index activities_user_week_idx on public.activities (user_id, week_start);

-- ---------------------------------------------------------------------------
-- Rewards (transfer quota from sender to receiver)
-- ---------------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  item_name text not null,
  steps integer not null default 0 check (steps >= 0),
  mvpa_minutes integer not null default 0 check (mvpa_minutes >= 0),
  week_start date not null,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id),
  check (steps > 0 or mvpa_minutes > 0)
);

create index rewards_sender_week_idx on public.rewards (sender_id, week_start);
create index rewards_receiver_week_idx on public.rewards (receiver_id, week_start);
create index rewards_created_at_idx on public.rewards (created_at desc);

-- ---------------------------------------------------------------------------
-- Helper: week start = Monday 00:00 Asia/Singapore (SGT)
-- ---------------------------------------------------------------------------
create or replace function public.get_week_start(p_at timestamptz default now())
returns date
language sql
stable
as $$
  select (date_trunc('week', (p_at at time zone 'Asia/Singapore')::timestamp))::date;
$$;

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip email confirmation: mark address confirmed on signup
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id;

  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: send_reward
-- Atomically validates sender quota and records the transfer.
-- Receiver gains steps/MVPA via rewards table aggregation.
-- ---------------------------------------------------------------------------
create or replace function public.send_reward(
  p_receiver_id uuid,
  p_emoji text,
  p_item_name text,
  p_steps integer default 0,
  p_mvpa_minutes integer default 0
)
returns public.rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_week_start date;
  v_earned_steps integer;
  v_earned_mvpa integer;
  v_sent_steps integer;
  v_sent_mvpa integer;
  v_available_steps integer;
  v_available_mvpa integer;
  v_result public.rewards;
begin
  if v_sender_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if p_receiver_id is null then
    raise exception 'RECEIVER_REQUIRED';
  end if;

  if p_receiver_id = v_sender_id then
    raise exception 'CANNOT_REWARD_SELF';
  end if;

  if coalesce(p_steps, 0) <= 0 and coalesce(p_mvpa_minutes, 0) <= 0 then
    raise exception 'REWARD_AMOUNT_REQUIRED';
  end if;

  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'RECEIVER_NOT_FOUND';
  end if;

  v_week_start := public.get_week_start();

  select
    coalesce(sum(steps), 0),
    coalesce(sum(mvpa_minutes), 0)
  into v_earned_steps, v_earned_mvpa
  from public.activities
  where user_id = v_sender_id
    and week_start = v_week_start;

  select
    coalesce(sum(steps), 0),
    coalesce(sum(mvpa_minutes), 0)
  into v_sent_steps, v_sent_mvpa
  from public.rewards
  where sender_id = v_sender_id
    and week_start = v_week_start;

  v_available_steps := v_earned_steps - v_sent_steps;
  v_available_mvpa := v_earned_mvpa - v_sent_mvpa;

  if coalesce(p_steps, 0) > v_available_steps then
    raise exception 'INSUFFICIENT_STEPS_QUOTA:%', v_available_steps;
  end if;

  if coalesce(p_mvpa_minutes, 0) > v_available_mvpa then
    raise exception 'INSUFFICIENT_MVPA_QUOTA:%', v_available_mvpa;
  end if;

  insert into public.rewards (
    sender_id,
    receiver_id,
    emoji,
    item_name,
    steps,
    mvpa_minutes,
    week_start
  )
  values (
    v_sender_id,
    p_receiver_id,
    p_emoji,
    trim(p_item_name),
    coalesce(p_steps, 0),
    coalesce(p_mvpa_minutes, 0),
    v_week_start
  )
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: log_activity
-- ---------------------------------------------------------------------------
create or replace function public.log_activity(
  p_steps integer default 0,
  p_mvpa_minutes integer default 0,
  p_note text default null
)
returns public.activities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.activities;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if coalesce(p_steps, 0) <= 0 and coalesce(p_mvpa_minutes, 0) <= 0 then
    raise exception 'ACTIVITY_AMOUNT_REQUIRED';
  end if;

  insert into public.activities (user_id, steps, mvpa_minutes, week_start, note)
  values (
    v_user_id,
    coalesce(p_steps, 0),
    coalesce(p_mvpa_minutes, 0),
    public.get_week_start(),
    p_note
  )
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- View: weekly stats per user (for dashboard & leaderboard)
-- ---------------------------------------------------------------------------
create or replace view public.weekly_user_stats as
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
  select
    sum(steps) as self_steps,
    sum(mvpa_minutes) as self_mvpa
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

-- ---------------------------------------------------------------------------
-- View: all-time stats per user (accumulate leaderboard)
-- ---------------------------------------------------------------------------
create or replace view public.all_time_user_stats as
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.activities enable row level security;
alter table public.rewards enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Activities viewable by authenticated users"
  on public.activities for select
  to authenticated
  using (true);

create policy "Users insert own activities via RPC only"
  on public.activities for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Rewards viewable by authenticated users"
  on public.rewards for select
  to authenticated
  using (true);

create policy "Rewards insert via RPC only"
  on public.rewards for insert
  to authenticated
  with check (auth.uid() = sender_id);

-- Grant execute on RPCs
grant execute on function public.send_reward(uuid, text, text, integer, integer) to authenticated;
grant execute on function public.log_activity(integer, integer, text) to authenticated;
grant execute on function public.get_week_start(timestamptz) to authenticated, anon;

-- Enable Realtime for ticker and live leaderboard / predictions
alter publication supabase_realtime add table public.rewards;
alter publication supabase_realtime add table public.activities;
