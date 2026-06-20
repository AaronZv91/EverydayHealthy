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

function pickLine(options, seed) {
  if (!options.length) return ''
  return options[Math.abs(seed) % options.length]
}

function buildTrashySummary({
  activeThisWeek,
  profileCount,
  completedThisWeek,
  leader,
  hasHistory,
  historyWeekCount,
  firstCompleter,
  lastPlace,
  beggar,
}) {
  const parts = [
    hasHistory
      ? `Trash oracle scanned ${historyWeekCount} week(s) of receipts and issued verdicts.`
      : `No archive yet — judging everyone purely on this week's fitness crimes.`,
    activeThisWeek === 0
      ? 'Nobody logged anything. Statistically embarrassing for the whole squad.'
      : activeThisWeek === profileCount
        ? 'Full roster showed up. Rare. Suspicious. Respect anyway.'
        : `${profileCount - activeThisWeek} player(s) ghosting the week. Bold.`,
    completedThisWeek > 0
      ? `${completedThisWeek} already cleared both goals. Show-offs among us.`
      : 'Zero double-goal finishers yet. Plenty of shame left to go around.',
    leader
      ? `${leader.display_name} tops the board at ${formatCount(leader.total_steps)} steps. Temporary crown — hate to see it.`
      : null,
    firstCompleter && lastPlace && beggar
      ? `Hot takes: ${firstCompleter.displayName} finishes first, ${lastPlace.displayName} eats last place, ${beggar.displayName} inherits the beggar throne.`
      : null,
  ]
  return parts.filter(Boolean).join(' ')
}

function buildPlayerTake(candidate, ctx) {
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
  } = candidate

  const pct = Math.round(currentCombinedPct * 100)
  const recvPct = Math.round(currentReceivedPct * 100)
  const seed = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  const tags = []
  if (isLeader) tags.push({ emoji: '👑', label: 'Leader' })
  if (isFirstPick) tags.push({ emoji: '🪖', label: 'First pick' })
  if (isLastPick) tags.push({ emoji: '🐌', label: 'Last pick' })
  if (isBeggarPick) tags.push({ emoji: '♿', label: 'Beggar pick' })
  if (pct >= 100) tags.push({ emoji: '✅', label: 'Both goals' })

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
      `avg ${formatCount(history.avgTotalSteps)} st/wk · ${formatCount(history.avgTotalMvpa)} MVPA/wk · ${history.completionWeeks} finish(es) · ${history.beggarWeeks} beggar wk(s)`
    )
  }

  let roastPool = []

  if (!isActiveThisWeek) {
    roastPool = [
      `${displayName} logged nothing this week. The couch sent a thank-you card.`,
      `Zero steps, zero MVPA. ${displayName} is cosplaying as furniture.`,
      `No data, no mercy. Log something before the oracle roasts you harder.`,
    ]
  } else if (isBeggarPick && recvPct >= 10) {
    roastPool = [
      `${displayName} runs on donated quota — ${recvPct}% of goals came from charity. Professional beggar arc.`,
      `Handout king/queen energy: ${formatCount(currentReceivedSteps)} gifted steps. Walk? Optional.`,
      `The group chat feeds ${displayName} steps like pigeons in a park. Dignity sold separately.`,
    ]
  } else if (pct >= 100) {
    roastPool = [
      `Both goals done (${pct}%). ${displayName} is insufferable and we all know it.`,
      `Finished early with ${formatCount(currentTotalSteps)} steps. Save some glory for mortals.`,
      `Completed. Touch grass anyway — victory laps are still cardio.`,
    ]
  } else if (isFirstPick) {
    roastPool = [
      `AI's soldier pick at ${pct}%. ${displayName}, don't choke — the math believes in you.`,
      `Projected first finisher. Pressure is free; so is public humiliation if you slack.`,
      `Front-runner forecast. ${formatCount(currentTotalSteps)} steps says you're trying. Keep being annoying about it.`,
    ]
  } else if (isLastPick) {
    roastPool = [
      `Bottom-feeder forecast at ${pct}%. Mathematics is bullying ${displayName}.`,
      `Likely last place. Revenge-walk or embrace the L — your call.`,
      `Lowest combined output (${formatCount(currentTotalSteps)} steps). Stealth mode or sloth mode?`,
    ]
  } else if (isLeader) {
    roastPool = [
      `#${rank} and leading. ${displayName} wears the crown until someone petty catches up.`,
      `Board leader at ${pct}%. Enjoy the view — the pack is hungry.`,
      `${formatCount(currentTotalSteps)} steps on top. Humble yourself before Monday does it for you.`,
    ]
  } else if (recvPct >= 15) {
    roastPool = [
      `${pct}% self, ${recvPct}% charity. ${displayName}'s business model is 50% hustle, 50% hand-me-downs.`,
      `Decent grind, but donations carry ${recvPct}% of the load. Mixed vibes.`,
    ]
  } else if (pct < 15) {
    roastPool = [
      `${pct}% of goals. ${displayName} moves at government paperwork speed.`,
      `Barely on the board. Scroll faster — maybe the phone will count that.`,
    ]
  } else if (pct < 50) {
    roastPool = [
      `${pct}% — certified mid. Not tragic, not impressive. Peak participation-trophy zone.`,
      `Half-effort hall of fame at ${formatCount(currentTotalSteps)} steps. Pick a lane.`,
    ]
  } else {
    roastPool = [
      `${pct}% and dangerous. ${displayName} is in the fight — don't get cute.`,
      `${formatCount(currentTotalSteps)} steps, ${formatCount(currentTotalMvpa)} MVPA. Respectable grind. Still not safe.`,
    ]
  }

  if (hasHistory && history.lastPlaceWeeks >= 2 && !isLeader) {
    roastPool.push(
      `Finished last ${history.lastPlaceWeeks} time(s) before. Pattern recognition: activated.`
    )
  }

  return {
    userId,
    displayName,
    rank,
    statsLine: statParts.join(' · '),
    roast: pickLine(roastPool, seed),
    tags,
  }
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

  const playerTakes = candidates
    .map((candidate) =>
      buildPlayerTake(candidate, {
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

  const summary = buildTrashySummary({
    activeThisWeek,
    profileCount: profiles.length,
    completedThisWeek,
    leader,
    hasHistory,
    historyWeekCount: historyWeeks.length,
    firstCompleter,
    lastPlace,
    beggar,
  })

  return {
    summary,
    hasHistory,
    historyWeekCount: historyWeeks.length,
    updatedAt: Date.now(),
    playerTakes,
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
