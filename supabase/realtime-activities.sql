-- Run in Supabase SQL Editor if activities realtime was not enabled yet.
-- Required for live leaderboard and AI prediction updates when users log activity.

alter publication supabase_realtime add table public.activities;
