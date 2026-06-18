function sumBy(items, key) {
  return items.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
}

function normalizeWeekStart(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function filterByWeek(items, weekStart) {
  if (!weekStart) return items
  const key = normalizeWeekStart(weekStart)
  return items.filter((item) => normalizeWeekStart(item.week_start) === key)
}

export function buildUserChallengeStats({
  userId,
  displayName,
  weekStart = null,
  activities,
  rewards,
}) {
  const userActivities = activities.filter((row) => row.user_id === userId)
  const scopedActivities = filterByWeek(userActivities, weekStart)
  const scopedRewards = filterByWeek(rewards, weekStart)

  const sent = scopedRewards.filter((row) => row.sender_id === userId)
  const received = scopedRewards.filter((row) => row.receiver_id === userId)

  const self_steps = sumBy(scopedActivities, 'steps')
  const self_mvpa = sumBy(scopedActivities, 'mvpa_minutes')
  const sent_steps = sumBy(sent, 'steps')
  const sent_mvpa = sumBy(sent, 'mvpa_minutes')
  const received_steps = sumBy(received, 'steps')
  const received_mvpa = sumBy(received, 'mvpa_minutes')
  const net_self_steps = Math.max(0, self_steps - sent_steps)
  const net_self_mvpa = Math.max(0, self_mvpa - sent_mvpa)

  return {
    user_id: userId,
    display_name: displayName,
    week_start: weekStart,
    self_steps,
    self_mvpa,
    sent_steps,
    sent_mvpa,
    received_steps,
    received_mvpa,
    net_self_steps,
    net_self_mvpa,
    total_steps: net_self_steps + received_steps,
    total_mvpa: net_self_mvpa + received_mvpa,
    available_steps: net_self_steps,
    available_mvpa: net_self_mvpa,
    rewards_sent_count: sent.length,
    rewards_received_count: received.length,
  }
}

export function buildChallengeLeaderboard(profiles, activities, rewards, weekStart = null) {
  return profiles.map((profile) =>
    buildUserChallengeStats({
      userId: profile.id,
      displayName: profile.display_name,
      weekStart,
      activities,
      rewards,
    })
  )
}

export function sortChallengeLeaderboard(stats) {
  return [...stats].sort(
    (a, b) =>
      b.total_steps - a.total_steps ||
      b.total_mvpa - a.total_mvpa ||
      a.display_name.localeCompare(b.display_name)
  )
}

export async function fetchChallengeSourceData(client) {
  const [weekStartResult, profilesResult, activitiesResult, rewardsResult] = await Promise.all([
    client.rpc('get_week_start'),
    client.from('profiles').select('id, display_name').order('display_name'),
    client.from('activities').select('user_id, steps, mvpa_minutes, week_start'),
    client.from('rewards').select('sender_id, receiver_id, steps, mvpa_minutes, week_start'),
  ])

  if (profilesResult.error) throw profilesResult.error
  if (activitiesResult.error) throw activitiesResult.error
  if (rewardsResult.error) throw rewardsResult.error

  return {
    weekStart: weekStartResult.data ?? null,
    profiles: profilesResult.data ?? [],
    activities: activitiesResult.data ?? [],
    rewards: rewardsResult.data ?? [],
  }
}
