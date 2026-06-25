import { getSgtDateKey, getWeekDayBuckets } from './weekUtils'

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

function buildTimelineSeries(events, dayBuckets, pickValues) {
  const dayIndexByKey = new Map(dayBuckets.map((day, index) => [day.key, index]))
  const snapshots = Array.from({ length: dayBuckets.length }, () => null)

  let state = {
    selfSteps: 0,
    selfMvpa: 0,
    sentSteps: 0,
    sentMvpa: 0,
    receivedSteps: 0,
    receivedMvpa: 0,
  }

  for (const event of events) {
    if (event.kind === 'activity') {
      state.selfSteps += event.steps
      state.selfMvpa += event.mvpa
    } else if (event.kind === 'reward_sent') {
      state.sentSteps += event.steps
      state.sentMvpa += event.mvpa
    } else {
      state.receivedSteps += event.steps
      state.receivedMvpa += event.mvpa
    }

    const dayIndex = dayIndexByKey.get(getSgtDateKey(event.created_at))
    if (dayIndex !== undefined) {
      snapshots[dayIndex] = pickValues(state)
    }
  }

  let last = { Self: 0, Rewarded: 0, Total: 0 }
  return dayBuckets.map((day, index) => {
    if (snapshots[index]) last = snapshots[index]
    return { name: day.label, ...last }
  })
}

/** Daily accumulated self vs rewarded totals (Mon–Sun SGT) for dashboard line charts. */
export function buildUserWeeklyTimeline({ userId, weekStart, activities, rewards }) {
  const dayBuckets = getWeekDayBuckets(weekStart)
  if (!dayBuckets.length) {
    return { steps: [], mvpa: [] }
  }

  const weekKey = normalizeWeekStart(weekStart)
  const userActivities = filterByWeek(
    activities.filter((row) => row.user_id === userId),
    weekKey
  )
  const scopedRewards = filterByWeek(rewards, weekKey)

  const events = [
    ...userActivities.map((row) => ({
      kind: 'activity',
      steps: Number(row.steps) || 0,
      mvpa: Number(row.mvpa_minutes) || 0,
      created_at: row.created_at,
      tieBreak: row.id ?? '',
    })),
    ...scopedRewards.flatMap((row) => {
      const entries = []
      if (row.sender_id === userId) {
        entries.push({
          kind: 'reward_sent',
          steps: Number(row.steps) || 0,
          mvpa: Number(row.mvpa_minutes) || 0,
          created_at: row.created_at,
          tieBreak: `${row.id}-sent`,
        })
      }
      if (row.receiver_id === userId) {
        entries.push({
          kind: 'reward_received',
          steps: Number(row.steps) || 0,
          mvpa: Number(row.mvpa_minutes) || 0,
          created_at: row.created_at,
          tieBreak: `${row.id}-recv`,
        })
      }
      return entries
    }),
  ].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
      String(a.tieBreak).localeCompare(String(b.tieBreak))
  )

  const pickSteps = (state) => {
    const self = Math.max(0, state.selfSteps - state.sentSteps)
    const rewarded = state.receivedSteps
    return { Self: self, Rewarded: rewarded, Total: self + rewarded }
  }

  const pickMvpa = (state) => {
    const self = Math.max(0, state.selfMvpa - state.sentMvpa)
    const rewarded = state.receivedMvpa
    return { Self: self, Rewarded: rewarded, Total: self + rewarded }
  }

  return {
    steps: buildTimelineSeries(events, dayBuckets, pickSteps),
    mvpa: buildTimelineSeries(events, dayBuckets, pickMvpa),
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

function userWeeklyTotals(state) {
  return {
    steps: Math.max(0, state.selfSteps - state.sentSteps) + state.receivedSteps,
    mvpa: Math.max(0, state.selfMvpa - state.sentMvpa) + state.receivedMvpa,
  }
}

function emptyUserState() {
  return {
    selfSteps: 0,
    selfMvpa: 0,
    sentSteps: 0,
    sentMvpa: 0,
    receivedSteps: 0,
    receivedMvpa: 0,
  }
}

/** First user to reach 100% on both weekly step and MVPA bars (by event time). */
export function findFirstDualGoalAchieverUserId({
  activities,
  rewards,
  weekStart,
  stepGoal,
  mvpaGoal,
}) {
  const scopedActivities = filterByWeek(activities, weekStart)
  const scopedRewards = filterByWeek(rewards, weekStart)

  const events = [
    ...scopedActivities.map((row) => ({
      kind: 'activity',
      userId: row.user_id,
      steps: Number(row.steps) || 0,
      mvpa: Number(row.mvpa_minutes) || 0,
      at: new Date(row.created_at).getTime(),
      tieBreak: row.id ?? '',
    })),
    ...scopedRewards.map((row) => ({
      kind: 'reward',
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      steps: Number(row.steps) || 0,
      mvpa: Number(row.mvpa_minutes) || 0,
      at: new Date(row.created_at).getTime(),
      tieBreak: row.id ?? '',
    })),
  ].sort((a, b) => a.at - b.at || String(a.tieBreak).localeCompare(String(b.tieBreak)))

  const state = new Map()

  const getState = (userId) => {
    if (!state.has(userId)) state.set(userId, emptyUserState())
    return state.get(userId)
  }

  for (const event of events) {
    const affectedUserIds = []

    if (event.kind === 'activity') {
      const userState = getState(event.userId)
      userState.selfSteps += event.steps
      userState.selfMvpa += event.mvpa
      affectedUserIds.push(event.userId)
    } else {
      const senderState = getState(event.senderId)
      senderState.sentSteps += event.steps
      senderState.sentMvpa += event.mvpa
      const receiverState = getState(event.receiverId)
      receiverState.receivedSteps += event.steps
      receiverState.receivedMvpa += event.mvpa
      affectedUserIds.push(event.senderId, event.receiverId)
    }

    for (const userId of affectedUserIds) {
      const totals = userWeeklyTotals(getState(userId))
      if (totals.steps >= stepGoal && totals.mvpa >= mvpaGoal) {
        return userId
      }
    }
  }

  return null
}

/** User who received the most donations, by average % of weekly step & MVPA goals. */
export function findTopReceiverUserId(users, { stepGoal, mvpaGoal }) {
  let topUserId = null
  let topScore = -1
  let topStepsPct = -1
  let topMvpaPct = -1

  for (const user of users) {
    const receivedSteps = Number(user.received_steps) || 0
    const receivedMvpa = Number(user.received_mvpa) || 0

    if (receivedSteps === 0 && receivedMvpa === 0) continue

    const stepsPct = stepGoal > 0 ? receivedSteps / stepGoal : 0
    const mvpaPct = mvpaGoal > 0 ? receivedMvpa / mvpaGoal : 0
    const score = (stepsPct + mvpaPct) / 2

    if (
      score > topScore ||
      (score === topScore &&
        (stepsPct > topStepsPct ||
          (stepsPct === topStepsPct && mvpaPct > topMvpaPct)))
    ) {
      topScore = score
      topStepsPct = stepsPct
      topMvpaPct = mvpaPct
      topUserId = user.user_id
    }
  }

  return topUserId
}

function getWeekStartMs(weekStart) {
  const ymd = normalizeWeekStart(weekStart)
  if (!ymd) return Date.now()
  return new Date(`${ymd}T00:00:00+08:00`).getTime()
}

/** Player with the longest gap without self-logging MVPA minutes this week. */
export function findMvpaParasiteUserId({ activities, profiles, weekStart }) {
  const weekKey = normalizeWeekStart(weekStart)
  if (!weekKey || !profiles.length) return null

  const weekStartMs = getWeekStartMs(weekStart)
  const nowMs = Date.now()
  const scopedActivities = filterByWeek(activities, weekKey)

  let parasiteUserId = null
  let longestGapMs = -1
  let tieBreakName = ''

  for (const profile of profiles) {
    const mvpaLogs = scopedActivities
      .filter((row) => row.user_id === profile.id && (Number(row.mvpa_minutes) || 0) > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    let maxGapMs = 0
    if (mvpaLogs.length === 0) {
      maxGapMs = nowMs - weekStartMs
    } else {
      const firstMs = new Date(mvpaLogs[0].created_at).getTime()
      maxGapMs = Math.max(maxGapMs, firstMs - weekStartMs)

      for (let index = 1; index < mvpaLogs.length; index += 1) {
        const prevMs = new Date(mvpaLogs[index - 1].created_at).getTime()
        const currMs = new Date(mvpaLogs[index].created_at).getTime()
        maxGapMs = Math.max(maxGapMs, currMs - prevMs)
      }

      const lastMs = new Date(mvpaLogs[mvpaLogs.length - 1].created_at).getTime()
      maxGapMs = Math.max(maxGapMs, nowMs - lastMs)
    }

    if (
      maxGapMs > longestGapMs ||
      (maxGapMs === longestGapMs && profile.display_name.localeCompare(tieBreakName) < 0)
    ) {
      longestGapMs = maxGapMs
      parasiteUserId = profile.id
      tieBreakName = profile.display_name
    }
  }

  return parasiteUserId
}

export async function fetchChallengeSourceData(client) {
  const [weekStartResult, profilesResult, activitiesResult, rewardsResult] = await Promise.all([
    client.rpc('get_week_start'),
    client.from('profiles').select('id, display_name').order('display_name'),
    client.from('activities').select('id, user_id, steps, mvpa_minutes, week_start, created_at'),
    client.from('rewards').select(
      'id, sender_id, receiver_id, steps, mvpa_minutes, week_start, created_at'
    ),
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
