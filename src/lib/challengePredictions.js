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

function formatCount(n) {
  return Math.round(n ?? 0).toLocaleString('en-US')
}

function buildFirstCompleterReason(candidate, hasHistory) {
  const { history, currentCombinedPct, currentTotalSteps, currentTotalMvpa, isActiveThisWeek } =
    candidate

  if (!hasHistory || history.weeksSeen === 0) {
    return buildReason([
      isActiveThisWeek
        ? `Leading pace this week with ${formatCount(currentTotalSteps)} steps and ${formatCount(currentTotalMvpa)} MVPA min.`
        : 'No clear front-runner from history yet.',
      currentCombinedPct > 0
        ? `${Math.round(currentCombinedPct * 100)}% toward both goals this week.`
        : null,
    ])
  }

  return buildReason([
    history.firstCompleterWeeks > 0
      ? `Finished first ${history.firstCompleterWeeks} time(s) before.`
      : 'Strong weekly pace and completion history.',
    history.completionWeeks > 0
      ? `Hit both goals in ${history.completionWeeks} past week(s).`
      : null,
    isActiveThisWeek
      ? `This week: ${formatCount(currentTotalSteps)} steps, ${formatCount(currentTotalMvpa)} MVPA min (${Math.round(currentCombinedPct * 100)}%).`
      : null,
  ])
}

function buildLastPlaceReason(candidate, hasHistory) {
  const { history, currentCombinedPct, currentTotalSteps, currentTotalMvpa, isActiveThisWeek } =
    candidate

  if (!hasHistory || history.weeksSeen === 0) {
    return buildReason([
      isActiveThisWeek
        ? `Lowest combined progress this week (${Math.round(currentCombinedPct * 100)}% of goals).`
        : 'No activity logged this week yet.',
      isActiveThisWeek
        ? `This week: ${formatCount(currentTotalSteps)} steps and ${formatCount(currentTotalMvpa)} MVPA min.`
        : null,
    ])
  }

  return buildReason([
    history.lastPlaceWeeks > 0
      ? `Finished last ${history.lastPlaceWeeks} time(s) before.`
      : 'Lowest typical weekly output in past weeks.',
    `Historically averages ${formatCount(history.avgTotalSteps)} steps and ${formatCount(history.avgTotalMvpa)} MVPA min per week.`,
    isActiveThisWeek
      ? `This week so far: ${formatCount(currentTotalSteps)} steps, ${formatCount(currentTotalMvpa)} MVPA min.`
      : 'No activity yet this week.',
    history.avgActivityCount < 1 ? 'Logs activity less often than others.' : null,
  ])
}

function buildBeggarReason(candidate, hasHistory) {
  const { history, currentReceivedPct, isActiveThisWeek } = candidate

  if (!hasHistory || history.weeksSeen === 0) {
    return buildReason([
      currentReceivedPct > 0
        ? `Receiving the most donations this week (${Math.round(currentReceivedPct * 100)}% of goals).`
        : 'Most likely to receive the highest share of donated quota.',
      isActiveThisWeek ? null : 'Has not logged self activity this week.',
    ])
  }

  return buildReason([
    history.beggarWeeks > 0
      ? `Was Beggar ${history.beggarWeeks} time(s) before.`
      : 'Receives the highest share of donated quota.',
    history.avgRewardsReceived > 0
      ? `Averages ${history.avgRewardsReceived.toFixed(1)} rewards received per week.`
      : null,
    currentReceivedPct > 0
      ? `${Math.round(currentReceivedPct * 100)}% of weekly goals received as donations this week.`
      : null,
  ])
}

function buildPlayerPrediction(candidate, ctx) {
  const {
    stepGoal,
    mvpaGoal,
    hasHistory,
    rank,
    flags: { isLeader, isFirstPick, isLastPick, isBeggarPick },
  } = ctx

  const {
    userId,
    displayName,
    history,
    currentTotalSteps,
    currentTotalMvpa,
    currentReceivedSteps,
    currentReceivedMvpa,
    currentCombinedPct,
    currentReceivedPct,
    isActiveThisWeek,
    firstCompleterScore,
    lastPlaceScore,
    beggarScore,
  } = candidate

  const pct = Math.round(currentCombinedPct * 100)
  const recvPct = Math.round(currentReceivedPct * 100)

  const statParts = [
    `${formatCount(currentTotalSteps)}/${formatCount(stepGoal)} steps`,
    `${formatCount(currentTotalMvpa)}/${mvpaGoal} MVPA`,
    `${pct}% goals`,
  ]
  if (currentReceivedSteps > 0 || currentReceivedMvpa > 0) {
    statParts.push(
      `${formatCount(currentReceivedSteps)} recv steps · ${formatCount(currentReceivedMvpa)} recv MVPA (${recvPct}%)`
    )
  }
  if (hasHistory && history.weeksSeen > 0) {
    statParts.push(
      `avg ${formatCount(history.avgTotalSteps)} st/wk · ${formatCount(history.avgTotalMvpa)} MVPA/wk · ${history.completionWeeks} goal week(s)`
    )
  }

  const labels = []
  if (isLeader) labels.push({ emoji: '👑', label: 'Leader' })
  if (isFirstPick) labels.push({ emoji: '🪖', label: 'First pick' })
  if (isLastPick) labels.push({ emoji: '🐌', label: 'Last pick' })
  if (isBeggarPick) labels.push({ emoji: '♿', label: 'Beggar pick' })
  if (pct >= 100) labels.push({ emoji: '✅', label: 'Goals met' })

  let outlook
  if (!isActiveThisWeek) {
    outlook =
      'No activity this week. Next week outlook depends on showing up — currently projected to trail the group.'
  } else if (isFirstPick && pct >= 100) {
    outlook = `Already at ${pct}% of both goals. Top forecast to finish first next week if this pace continues.`
  } else if (isFirstPick) {
    outlook = `Leading the first-to-finish forecast at ${pct}% progress. Strong candidate to complete both goals earliest next week.`
  } else if (isLastPick && pct >= 100) {
    outlook = `Goals met this week (${pct}%) but lowest relative output score — watch for a slower start next week.`
  } else if (isLastPick) {
    outlook = `Lowest combined progress at ${pct}%. Most at risk of finishing last next week without a pace increase.`
  } else if (isBeggarPick) {
    outlook = `Highest donation-receipt forecast (${recvPct}% of goals from rewards). Likely Beggar next week if handouts continue.`
  } else if (isLeader && pct >= 100) {
    outlook = `#${rank} on the board with both goals done. Favourite to stay competitive next week.`
  } else if (isLeader) {
    outlook = `#${rank} this week at ${pct}% of goals. Momentum favours a strong finish next week.`
  } else if (pct >= 100) {
    outlook = `Both goals cleared (${pct}%). Reliable finisher — expect another solid week if habits hold.`
  } else if (pct >= 50) {
    outlook = `${pct}% toward goals. Mid-to-strong tier — could push for an early finish next week with consistent logging.`
  } else if (pct > 0) {
    outlook = `${pct}% progress so far. Needs a step-up next week to avoid falling behind the pack.`
  } else {
    outlook = 'Minimal progress recorded. Next week is an open reset.'
  }

  const firstCompleterLikelihood = Math.min(
    95,
    Math.round(
      20 +
        history.firstCompleterRate * 30 +
        history.completionRate * 20 +
        currentCombinedPct * 35 +
        (isActiveThisWeek ? 5 : 0)
    )
  )
  const lastPlaceLikelihood = Math.min(
    95,
    Math.round(
      20 +
        history.lastPlaceRate * 35 +
        (hasHistory ? (1 - history.avgCombinedPct) * 15 : 0) +
        (1 - currentCombinedPct) * 25
    )
  )
  const beggarLikelihood = Math.min(
    95,
    Math.round(
      15 + history.beggarRate * 40 + history.avgReceivedPct * 25 + currentReceivedPct * 30
    )
  )

  return {
    userId,
    displayName,
    rank,
    statsLine: statParts.join(' · '),
    outlook,
    labels,
    scores: {
      firstCompleter: firstCompleterLikelihood,
      lastPlace: lastPlaceLikelihood,
      beggar: beggarLikelihood,
    },
  }
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

  const historyWeight = hasHistory ? 0.72 : 0
  const currentWeight = hasHistory ? 0.28 : 1

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

    const currentTotalSteps = current.total_steps ?? 0
    const currentTotalMvpa = current.total_mvpa ?? 0
    const currentReceivedSteps = current.received_steps ?? 0
    const currentReceivedMvpa = current.received_mvpa ?? 0
    const currentOutput = currentTotalSteps + currentTotalMvpa * 350
    const currentCombinedPct = combinedGoalPct(current, stepGoal, mvpaGoal)
    const currentReceivedPct = receivedGoalPct(current, stepGoal, mvpaGoal)
    const isActiveThisWeek = currentTotalSteps > 0 || currentTotalMvpa > 0

    const firstCompleterScore =
      history.firstCompleterRate * historyWeight * 100 +
      history.completionRate * historyWeight * 60 +
      history.avgCombinedPct * historyWeight * 40 +
      currentCombinedPct * currentWeight * 100 +
      (isActiveThisWeek ? 5 : 0)

    const lastPlaceScore =
      history.avgTotalSteps * historyWeight +
      history.avgTotalMvpa * historyWeight * 350 +
      currentOutput * currentWeight

    const beggarScore =
      history.beggarRate * historyWeight * 100 +
      history.avgReceivedPct * historyWeight * 80 +
      history.avgRewardsReceived * historyWeight * 8 +
      currentReceivedPct * currentWeight * 100

    return {
      userId: profile.id,
      displayName: profile.display_name,
      history,
      currentTotalSteps,
      currentTotalMvpa,
      currentReceivedSteps,
      currentReceivedMvpa,
      currentCombinedPct,
      currentReceivedPct,
      isActiveThisWeek,
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
  const rankByUser = new Map(currentStats.map((row, index) => [row.user_id, index + 1]))

  const playerPredictions = candidates
    .map((candidate) =>
      buildPlayerPrediction(candidate, {
        stepGoal,
        mvpaGoal,
        hasHistory,
        rank: rankByUser.get(candidate.userId) ?? profiles.length,
        flags: {
          isLeader: leader?.user_id === candidate.userId,
          isFirstPick: firstCompleter?.userId === candidate.userId,
          isLastPick: lastPlace?.userId === candidate.userId,
          isBeggarPick: beggar?.userId === candidate.userId,
        },
      })
    )
    .sort((a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName))

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
    playerPredictions,
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
          reason: buildFirstCompleterReason(firstCompleter, hasHistory),
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
                (hasHistory ? (1 - lastPlace.history.avgCombinedPct) * 15 : 0) +
                (lastPlace.currentCombinedPct < 0.25 ? 10 : 0)
            )
          ),
          reason: buildLastPlaceReason(lastPlace, hasHistory),
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
          reason: buildBeggarReason(beggar, hasHistory),
        }
      : null,
  }
}
