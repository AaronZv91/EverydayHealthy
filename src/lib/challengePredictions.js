import {
  buildChallengeLeaderboard,
  findFirstDualGoalAchieverUserId,
  findTopReceiverUserId,
  sortChallengeLeaderboard,
} from './challengeStats'

function normalizeWeekStart(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function getDistinctWeeks(activities, rewards) {
  const weeks = new Set()
  for (const row of activities) {
    const week = normalizeWeekStart(row.week_start)
    if (week) weeks.add(week)
  }
  for (const row of rewards) {
    const week = normalizeWeekStart(row.week_start)
    if (week) weeks.add(week)
  }
  return [...weeks].sort()
}

function combinedGoalPct(stats, stepGoal, mvpaGoal) {
  const stepsPct = stepGoal > 0 ? (stats.total_steps ?? 0) / stepGoal : 0
  const mvpaPct = mvpaGoal > 0 ? (stats.total_mvpa ?? 0) / mvpaGoal : 0
  return (stepsPct + mvpaPct) / 2
}

function receivedGoalPct(stats, stepGoal, mvpaGoal) {
  const stepsPct = stepGoal > 0 ? (stats.received_steps ?? 0) / stepGoal : 0
  const mvpaPct = mvpaGoal > 0 ? (stats.received_mvpa ?? 0) / mvpaGoal : 0
  return (stepsPct + mvpaPct) / 2
}

function createEmptyMetrics(profile) {
  return {
    userId: profile.id,
    displayName: profile.display_name,
    weeksSeen: 0,
    sumTotalSteps: 0,
    sumTotalMvpa: 0,
    sumCombinedPct: 0,
    completionWeeks: 0,
    firstCompleterWeeks: 0,
    lastPlaceWeeks: 0,
    beggarWeeks: 0,
    sumReceivedSteps: 0,
    sumReceivedMvpa: 0,
    sumReceivedPct: 0,
    sumActivityCount: 0,
    sumRewardsReceived: 0,
  }
}

function finalizeMetrics(row, weekCount) {
  const weeks = Math.max(weekCount, 1)
  return {
    ...row,
    avgTotalSteps: row.sumTotalSteps / weeks,
    avgTotalMvpa: row.sumTotalMvpa / weeks,
    avgCombinedPct: row.sumCombinedPct / weeks,
    completionRate: row.completionWeeks / weeks,
    firstCompleterRate: row.firstCompleterWeeks / weeks,
    lastPlaceRate: row.lastPlaceWeeks / weeks,
    beggarRate: row.beggarWeeks / weeks,
    avgReceivedSteps: row.sumReceivedSteps / weeks,
    avgReceivedMvpa: row.sumReceivedMvpa / weeks,
    avgReceivedPct: row.sumReceivedPct / weeks,
    avgActivityCount: row.sumActivityCount / weeks,
    avgRewardsReceived: row.sumRewardsReceived / weeks,
  }
}

function pickTopScore(candidates, scoreKey) {
  let best = null
  let bestScore = -Infinity

  for (const candidate of candidates) {
    const score = candidate[scoreKey]
    if (
      score > bestScore ||
      (score === bestScore && best && candidate.displayName.localeCompare(best.displayName) < 0)
    ) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

function pickBottomScore(candidates, scoreKey) {
  let best = null
  let bestScore = Infinity

  for (const candidate of candidates) {
    const score = candidate[scoreKey]
    if (
      score < bestScore ||
      (score === bestScore && best && candidate.displayName.localeCompare(best.displayName) < 0)
    ) {
      bestScore = score
      best = candidate
    }
  }

  return best
}

function buildReason(parts) {
  return parts.filter(Boolean).join(' ')
}

export function buildChallengePredictions({
  profiles,
  activities,
  rewards,
  weekStart,
  stepGoal,
  mvpaGoal,
}) {
  const currentWeek = normalizeWeekStart(weekStart)
  const allWeeks = getDistinctWeeks(activities, rewards)
  const historyWeeks = allWeeks.filter((week) => week !== currentWeek)
  const hasHistory = historyWeeks.length > 0

  const metricsMap = new Map(profiles.map((profile) => [profile.id, createEmptyMetrics(profile)]))

  for (const week of historyWeeks) {
    const weekStats = sortChallengeLeaderboard(
      buildChallengeLeaderboard(profiles, activities, rewards, week)
    )
    const firstCompleterId = findFirstDualGoalAchieverUserId({
      activities,
      rewards,
      weekStart: week,
      stepGoal,
      mvpaGoal,
    })
    const beggarId = findTopReceiverUserId(weekStats, { stepGoal, mvpaGoal })
    const lastUser = weekStats[weekStats.length - 1]

    const weekActivities = activities.filter((row) => normalizeWeekStart(row.week_start) === week)
    const weekRewards = rewards.filter((row) => normalizeWeekStart(row.week_start) === week)

    for (const stats of weekStats) {
      const row = metricsMap.get(stats.user_id)
      if (!row) continue

      row.weeksSeen += 1
      row.sumTotalSteps += stats.total_steps ?? 0
      row.sumTotalMvpa += stats.total_mvpa ?? 0
      row.sumCombinedPct += combinedGoalPct(stats, stepGoal, mvpaGoal)
      row.sumReceivedSteps += stats.received_steps ?? 0
      row.sumReceivedMvpa += stats.received_mvpa ?? 0
      row.sumReceivedPct += receivedGoalPct(stats, stepGoal, mvpaGoal)

      if ((stats.total_steps ?? 0) >= stepGoal && (stats.total_mvpa ?? 0) >= mvpaGoal) {
        row.completionWeeks += 1
      }
      if (stats.user_id === firstCompleterId) row.firstCompleterWeeks += 1
      if (stats.user_id === beggarId) row.beggarWeeks += 1
      if (stats.user_id === lastUser?.user_id) row.lastPlaceWeeks += 1

      row.sumActivityCount += weekActivities.filter((a) => a.user_id === stats.user_id).length
      row.sumRewardsReceived += weekRewards.filter((r) => r.receiver_id === stats.user_id).length
    }
  }

  const currentStats = sortChallengeLeaderboard(
    buildChallengeLeaderboard(profiles, activities, rewards, weekStart)
  )
  const currentByUser = new Map(currentStats.map((row) => [row.user_id, row]))

  const historyWeight = hasHistory ? 0.72 : 0.35
  const currentWeight = 1 - historyWeight

  const candidates = profiles.map((profile) => {
    const history = finalizeMetrics(
      metricsMap.get(profile.id) ?? createEmptyMetrics(profile),
      historyWeeks.length || 1
    )
    const current = currentByUser.get(profile.id) ?? {
      total_steps: 0,
      total_mvpa: 0,
      received_steps: 0,
      received_mvpa: 0,
    }

    const currentCombinedPct = combinedGoalPct(current, stepGoal, mvpaGoal)
    const currentReceivedPct = receivedGoalPct(current, stepGoal, mvpaGoal)
    const activityScore = history.avgActivityCount + (current.total_steps > 0 || current.total_mvpa > 0 ? 0.5 : 0)

    const firstCompleterScore =
      history.firstCompleterRate * historyWeight * 100 +
      history.completionRate * historyWeight * 60 +
      history.avgCombinedPct * historyWeight * 40 +
      currentCombinedPct * currentWeight * 30 +
      activityScore * 5

    const lastPlaceScore =
      history.avgTotalSteps * historyWeight +
      history.avgTotalMvpa * historyWeight * 350 +
      history.avgCombinedPct * historyWeight * stepGoal * 0.15 +
      (current.total_steps + current.total_mvpa * 350) * currentWeight * 0.2 +
      activityScore * 800

    const beggarScore =
      history.beggarRate * historyWeight * 100 +
      history.avgReceivedPct * historyWeight * 80 +
      history.avgRewardsReceived * historyWeight * 8 +
      currentReceivedPct * currentWeight * 40

    return {
      userId: profile.id,
      displayName: profile.display_name,
      history,
      currentCombinedPct,
      currentReceivedPct,
      firstCompleterScore,
      lastPlaceScore,
      beggarScore,
    }
  })

  const firstCompleter = pickTopScore(candidates, 'firstCompleterScore')
  const lastPlace = pickBottomScore(candidates, 'lastPlaceScore')
  const beggar = pickTopScore(candidates, 'beggarScore')

  const activeThisWeek = currentStats.filter(
    (row) => (row.total_steps ?? 0) > 0 || (row.total_mvpa ?? 0) > 0
  ).length
  const completedThisWeek = currentStats.filter(
    (row) => (row.total_steps ?? 0) >= stepGoal && (row.total_mvpa ?? 0) >= mvpaGoal
  ).length

  const leader = currentStats[0]
  const summaryParts = [
    `${activeThisWeek}/${profiles.length} players active this week.`,
    completedThisWeek > 0
      ? `${completedThisWeek} already completed both goals.`
      : 'No one has finished both goals yet.',
    leader
      ? `${leader.display_name} leads the current board with ${Math.round((leader.total_steps ?? 0) / 1000)}k steps.`
      : null,
    hasHistory
      ? `Forecasts blend ${historyWeeks.length} past week(s) with this week's pace.`
      : 'Forecasts rely mostly on this week because history is limited.',
  ]

  return {
    summary: summaryParts.filter(Boolean).join(' '),
    hasHistory,
    historyWeekCount: historyWeeks.length,
    updatedAt: Date.now(),
    firstCompleter: firstCompleter
      ? {
          userId: firstCompleter.userId,
          displayName: firstCompleter.displayName,
          confidence: Math.min(
            95,
            Math.round(
              40 +
                firstCompleter.history.firstCompleterRate * 30 +
                firstCompleter.history.completionRate * 20 +
                firstCompleter.currentCombinedPct * 10
            )
          ),
          reason: buildReason([
            firstCompleter.history.firstCompleterWeeks > 0
              ? `Finished first ${firstCompleter.history.firstCompleterWeeks} time(s) before.`
              : 'Strong weekly pace and completion history.',
            firstCompleter.history.completionWeeks > 0
              ? `Hit both goals in ${firstCompleter.history.completionWeeks} past week(s).`
              : null,
            firstCompleter.currentCombinedPct > 0.5
              ? `Already ${Math.round(firstCompleter.currentCombinedPct * 100)}% toward goals this week.`
              : null,
          ]),
        }
      : null,
    lastPlace: lastPlace
      ? {
          userId: lastPlace.userId,
          displayName: lastPlace.displayName,
          confidence: Math.min(
            95,
            Math.round(
              40 +
                lastPlace.history.lastPlaceRate * 35 +
                (1 - lastPlace.history.avgCombinedPct) * 15 +
                (lastPlace.currentCombinedPct < 0.25 ? 10 : 0)
            )
          ),
          reason: buildReason([
            lastPlace.history.lastPlaceWeeks > 0
              ? `Finished last ${lastPlace.history.lastPlaceWeeks} time(s) before.`
              : 'Lowest historical weekly output.',
            `Averages ${Math.round(lastPlace.history.avgTotalSteps).toLocaleString()} steps and ${Math.round(lastPlace.history.avgTotalMvpa)} MVPA min per week.`,
            lastPlace.history.avgActivityCount < 1
              ? 'Logs activity less often than others.'
              : null,
          ]),
        }
      : null,
    beggar: beggar
      ? {
          userId: beggar.userId,
          displayName: beggar.displayName,
          confidence: Math.min(
            95,
            Math.round(
              35 +
                beggar.history.beggarRate * 40 +
                beggar.history.avgReceivedPct * 25 +
                beggar.currentReceivedPct * 10
            )
          ),
          reason: buildReason([
            beggar.history.beggarWeeks > 0
              ? `Was Beggar ${beggar.history.beggarWeeks} time(s) before.`
              : 'Receives the highest share of donated quota.',
            beggar.history.avgRewardsReceived > 0
              ? `Averages ${beggar.history.avgRewardsReceived.toFixed(1)} rewards received per week.`
              : null,
            beggar.currentReceivedPct > 0
              ? `${Math.round(beggar.currentReceivedPct * 100)}% of weekly goals received as donations this week.`
              : null,
          ]),
        }
      : null,
  }
}
