import {
  buildChallengeLeaderboard,
  buildMvpaParasiteStatus,
  findFirstDualGoalAchieverUserId,
  findTopReceiverUserId,
  sortChallengeLeaderboard,
} from './challengeStats'
import {
  formatLogTimestamp,
  buildGoalPaceContext,
  buildGroupGoalContext,
  getWeekProgressContext,
} from './weekUtils'

const EXCUSE_NOTE_PATTERN =
  /\b(tired|lazy|rest day|resting|sick|injured|couldn't|cant|can't|skip|skipped|busy|exhausted|pain|hurt|weather|rain|no time|didn't|didnt|forgot|oops|holiday|travel)\b/i
const COMMITMENT_NOTE_PATTERN =
  /\b(gym|run|walk|push|crush|goal|finish|tomorrow|will|plan|training|workout|hike|cycle|swim|marathon|steps|mvpa|jog|cardio|lift)\b/i

function classifyNote(note) {
  if (!note) return { excuse: false, commitment: false }
  return {
    excuse: EXCUSE_NOTE_PATTERN.test(note),
    commitment: COMMITMENT_NOTE_PATTERN.test(note),
  }
}

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
    sumNoteCount: 0,
    sumExcuseNotes: 0,
    sumCommitmentNotes: 0,
    weeklySnapshots: [],
  }
}

function computeTrendMetrics(snapshots) {
  if (!snapshots.length) {
    return {
      label: 'No history',
      momentum: 0,
      combinedPctDelta: 0,
      rankDelta: 0,
      vsAvgDelta: 0,
      recentWeeks: [],
    }
  }

  const recentWeeks = snapshots.slice(-3).map((week) => ({
    week: week.week,
    rank: week.rank,
    goalPct: Math.round(week.combinedPct * 100),
    completedGoals: week.completedGoals,
    titles: [
      week.wasFirst ? 'first' : null,
      week.wasLast ? 'last' : null,
      week.wasBeggar ? 'beggar' : null,
    ].filter(Boolean),
  }))

  if (snapshots.length === 1) {
    return {
      label: 'One past week',
      momentum: 0,
      combinedPctDelta: 0,
      rankDelta: 0,
      vsAvgDelta: 0,
      recentWeeks,
    }
  }

  const last = snapshots[snapshots.length - 1]
  const prev = snapshots[snapshots.length - 2]
  const avgCombined =
    snapshots.reduce((sum, week) => sum + week.combinedPct, 0) / snapshots.length
  const combinedPctDelta = last.combinedPct - prev.combinedPct
  const rankDelta = prev.rank - last.rank
  const vsAvgDelta = last.combinedPct - avgCombined
  const momentum = Math.max(
    -1,
    Math.min(1, combinedPctDelta * 0.55 + rankDelta * 0.08 + vsAvgDelta * 0.35)
  )

  let label = 'Steady'
  if (momentum > 0.12) label = 'Heating up'
  else if (momentum < -0.12) label = 'Cooling off'
  else if (combinedPctDelta > 0.08) label = 'Improving'
  else if (combinedPctDelta < -0.08) label = 'Slipping'

  return {
    label,
    momentum,
    combinedPctDelta,
    rankDelta,
    vsAvgDelta,
    recentWeeks,
  }
}

function finalizeMetrics(row, weekCount) {
  const weeks = Math.max(weekCount, 1)
  const trend = computeTrendMetrics(row.weeklySnapshots)

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
    avgNoteCount: row.sumNoteCount / weeks,
    avgExcuseNotes: row.sumExcuseNotes / weeks,
    avgCommitmentNotes: row.sumCommitmentNotes / weeks,
    trend,
  }
}

function buildHistoricalWeekSummaries(historyWeeks, profiles, activities, rewards, stepGoal, mvpaGoal) {
  return historyWeeks.map((week) => {
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
    const leader = weekStats[0]
    const completions = weekStats.filter(
      (row) => (row.total_steps ?? 0) >= stepGoal && (row.total_mvpa ?? 0) >= mvpaGoal
    ).length

    return {
      week,
      leader: leader?.display_name ?? null,
      leaderGoalPct: leader
        ? Math.round(combinedGoalPct(leader, stepGoal, mvpaGoal) * 100)
        : 0,
      firstCompleter: weekStats.find((row) => row.user_id === firstCompleterId)?.display_name ?? null,
      beggar: weekStats.find((row) => row.user_id === beggarId)?.display_name ?? null,
      lastPlace: lastUser?.display_name ?? null,
      completions,
      activePlayers: weekStats.filter(
        (row) => (row.total_steps ?? 0) > 0 || (row.total_mvpa ?? 0) > 0
      ).length,
    }
  })
}

function formatTrendHistory(trend) {
  if (!trend.recentWeeks.length) return 'no past weeks'
  return trend.recentWeeks
    .map((week) => {
      const titles = week.titles.length ? ` · ${week.titles.join('/')}` : ''
      const goals = week.completedGoals ? ' · goals met' : ''
      return `${week.week.slice(5)}: rank #${week.rank} · ${week.goalPct}%${goals}${titles}`
    })
    .join(' | ')
}

function buildPlayerEventLogs(profiles, activities, rewards) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const eventsByUser = new Map(profiles.map((profile) => [profile.id, []]))

  for (const row of activities) {
    const list = eventsByUser.get(row.user_id)
    if (!list) continue

    list.push({
      at: formatLogTimestamp(row.created_at),
      week: normalizeWeekStart(row.week_start),
      type: 'activity',
      steps: row.steps ?? 0,
      mvpa: row.mvpa_minutes ?? 0,
      note: row.note?.trim() || null,
      sortKey: new Date(row.created_at).getTime(),
    })
  }

  for (const row of rewards) {
    const senderList = eventsByUser.get(row.sender_id)
    if (senderList) {
      senderList.push({
        at: formatLogTimestamp(row.created_at),
        week: normalizeWeekStart(row.week_start),
        type: 'reward_sent',
        to: profileById.get(row.receiver_id)?.display_name ?? 'unknown',
        steps: row.steps ?? 0,
        mvpa: row.mvpa_minutes ?? 0,
        emoji: row.emoji ?? '',
        itemName: row.item_name ?? '',
        item: `${row.emoji} ${row.item_name}`,
        sortKey: new Date(row.created_at).getTime(),
      })
    }

    const receiverList = eventsByUser.get(row.receiver_id)
    if (receiverList) {
      receiverList.push({
        at: formatLogTimestamp(row.created_at),
        week: normalizeWeekStart(row.week_start),
        type: 'reward_received',
        from: profileById.get(row.sender_id)?.display_name ?? 'unknown',
        steps: row.steps ?? 0,
        mvpa: row.mvpa_minutes ?? 0,
        emoji: row.emoji ?? '',
        itemName: row.item_name ?? '',
        item: `${row.emoji} ${row.item_name}`,
        sortKey: new Date(row.created_at).getTime(),
      })
    }
  }

  return profiles.map((profile) => ({
    userId: profile.id,
    name: profile.display_name,
    events: (eventsByUser.get(profile.id) ?? [])
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...event }) => event),
  }))
}

function buildPlayerNoteMetrics(userId, activities, currentWeek) {
  const currentActivities = activities.filter(
    (row) => row.user_id === userId && normalizeWeekStart(row.week_start) === currentWeek
  )
  const allNotes = currentActivities
    .map((row) => row.note?.trim())
    .filter(Boolean)
  const recentNotes = allNotes.slice(-5)

  let excuseCount = 0
  let commitmentCount = 0
  for (const note of allNotes) {
    const classified = classifyNote(note)
    if (classified.excuse) excuseCount += 1
    if (classified.commitment) commitmentCount += 1
  }

  return {
    noteCountThisWeek: allNotes.length,
    recentNotes,
    excuseCount,
    commitmentCount,
  }
}

function buildPlayerRewardDetails(profiles, rewards, currentWeek) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const byUser = new Map(
    profiles.map((profile) => [profile.id, { receivedThisWeek: [], sentThisWeek: [], recent: [] }])
  )

  const sortedRewards = [...rewards].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  for (const row of sortedRewards) {
    const itemLabel = `${row.emoji ?? ''} ${row.item_name ?? ''}`.trim()
    const at = formatLogTimestamp(row.created_at)
    const week = normalizeWeekStart(row.week_start)
    const isCurrentWeek = week === currentWeek

    const receiverBucket = byUser.get(row.receiver_id)
    if (receiverBucket) {
      const detail = {
        at,
        week,
        emoji: row.emoji ?? '',
        itemName: row.item_name ?? '',
        item: itemLabel,
        from: profileById.get(row.sender_id)?.display_name ?? 'unknown',
        steps: row.steps ?? 0,
        mvpa: row.mvpa_minutes ?? 0,
        type: 'received',
      }
      receiverBucket.recent.push(detail)
      if (isCurrentWeek) receiverBucket.receivedThisWeek.push(detail)
    }

    const senderBucket = byUser.get(row.sender_id)
    if (senderBucket) {
      const detail = {
        at,
        week,
        emoji: row.emoji ?? '',
        itemName: row.item_name ?? '',
        item: itemLabel,
        to: profileById.get(row.receiver_id)?.display_name ?? 'unknown',
        steps: row.steps ?? 0,
        mvpa: row.mvpa_minutes ?? 0,
        type: 'sent',
      }
      senderBucket.recent.push(detail)
      if (isCurrentWeek) senderBucket.sentThisWeek.push(detail)
    }
  }

  return profiles.map((profile) => {
    const bucket = byUser.get(profile.id) ?? { receivedThisWeek: [], sentThisWeek: [], recent: [] }
    const recentRewards = bucket.recent.slice(-8)
    const rewardLine = recentRewards.length
      ? recentRewards
          .map((reward) =>
            reward.type === 'received'
              ? `received "${reward.itemName}" ${reward.emoji} from ${reward.from}`
              : `sent ${reward.to} "${reward.itemName}" ${reward.emoji}`
          )
          .join('; ')
      : ''

    return {
      userId: profile.id,
      receivedThisWeek: bucket.receivedThisWeek,
      sentThisWeek: bucket.sentThisWeek,
      recentRewards,
      rewardLine,
      receivedCountThisWeek: bucket.receivedThisWeek.length,
      sentCountThisWeek: bucket.sentThisWeek.length,
    }
  })
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

function buildFallbackRecap(lastWeek, empathyMode = false) {
  if (!lastWeek) {
    return empathyMode
      ? 'No last week to recap yet — your journey begins whenever you are ready.'
      : 'No last week on the board yet — clean slate.'
  }

  const pct = Math.round(lastWeek.combinedPct * 100)
  const titles = [
    lastWeek.wasFirst ? 'first finisher' : null,
    lastWeek.wasBeggar ? 'top receiver' : null,
    lastWeek.wasLast ? 'last place' : null,
  ].filter(Boolean)
  const titleBit = titles.length ? ` · ${titles.join(', ')}` : ''

  if (empathyMode) {
    return `Last week (${lastWeek.week.slice(5)}): rank #${lastWeek.rank} at ${pct}%${lastWeek.completedGoals ? ' — both goals completed, wonderfully done' : ''}.`
  }

  return `Last week (${lastWeek.week.slice(5)}): rank #${lastWeek.rank} · ${pct}% of goals${lastWeek.completedGoals ? ' · goals cleared' : ''}${titleBit}.`
}

function formatLastWeekLine(lastWeek) {
  if (!lastWeek) return 'no last week'
  const pct = Math.round(lastWeek.combinedPct * 100)
  const titles = [
    lastWeek.wasFirst ? 'first' : null,
    lastWeek.wasBeggar ? 'beggar' : null,
    lastWeek.wasLast ? 'last' : null,
  ].filter(Boolean)
  return `${lastWeek.week}: rank #${lastWeek.rank} · ${pct}% goals${lastWeek.completedGoals ? ' · completed both' : ''}${titles.length ? ` · ${titles.join('/')}` : ''} · ${formatCount(lastWeek.totalSteps)} steps · ${formatCount(lastWeek.totalMvpa)} MVPA`
}

function buildPlayerEngagementMetrics({
  history,
  currentTotalSteps,
  currentTotalMvpa,
  currentCombinedPct,
  currentRank,
  stepGoal,
  mvpaGoal,
}) {
  const snapshots = history.weeklySnapshots ?? []

  let completionStreak = 0
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index].completedGoals) completionStreak += 1
    else break
  }

  let activeStreak = 0
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    const snap = snapshots[index]
    if ((snap.totalSteps ?? 0) > 0 || (snap.totalMvpa ?? 0) > 0) activeStreak += 1
    else break
  }

  const historicalBestSteps = snapshots.reduce(
    (max, week) => Math.max(max, week.totalSteps ?? 0),
    0
  )
  const historicalBestMvpa = snapshots.reduce(
    (max, week) => Math.max(max, week.totalMvpa ?? 0),
    0
  )
  const historicalBestGoalPct = snapshots.reduce(
    (max, week) => Math.max(max, week.combinedPct ?? 0),
    0
  )
  const historicalBestRank =
    snapshots.length > 0
      ? snapshots.reduce(
          (best, week) => (best == null ? week.rank : Math.min(best, week.rank)),
          null
        )
      : null

  const badges = []
  if (completionStreak >= 2) {
    badges.push({ emoji: '🔥', label: `${completionStreak}-wk goal streak` })
  } else if (completionStreak === 1) {
    badges.push({ emoji: '✅', label: 'Goals met last week' })
  }

  if (activeStreak >= 2) {
    badges.push({ emoji: '📅', label: `${activeStreak}-wk active streak` })
  }

  if (
    currentTotalSteps > historicalBestSteps &&
    currentTotalSteps > 0 &&
    snapshots.length > 0
  ) {
    badges.push({ emoji: '👟', label: `Steps PB · ${formatCount(currentTotalSteps)}` })
  } else if (historicalBestSteps > 0) {
    badges.push({ emoji: '👟', label: `Steps PB · ${formatCount(historicalBestSteps)}` })
  }

  if (currentTotalMvpa > historicalBestMvpa && currentTotalMvpa > 0 && snapshots.length > 0) {
    badges.push({ emoji: '💪', label: `MVPA PB · ${formatCount(currentTotalMvpa)} min` })
  } else if (historicalBestMvpa > 0) {
    badges.push({ emoji: '💪', label: `MVPA PB · ${formatCount(historicalBestMvpa)} min` })
  }

  if (
    currentCombinedPct > historicalBestGoalPct &&
    currentCombinedPct > 0 &&
    snapshots.length > 0
  ) {
    badges.push({ emoji: '🎯', label: `Goal % PB · ${Math.round(currentCombinedPct * 100)}%` })
  }

  if (
    currentRank != null &&
    historicalBestRank != null &&
    currentRank <= historicalBestRank &&
    snapshots.length > 0
  ) {
    badges.push({ emoji: '🏆', label: `Best rank #${currentRank}` })
  }

  if (history.firstCompleterWeeks >= 1) {
    badges.push({
      emoji: '🪖',
      label: `${history.firstCompleterWeeks}× first finisher`,
    })
  }

  const seen = new Set()
  const uniqueBadges = badges.filter((badge) => {
    if (seen.has(badge.label)) return false
    seen.add(badge.label)
    return true
  })

  return {
    completionStreak,
    activeStreak,
    badges: uniqueBadges.slice(0, 5),
    engagementLine: uniqueBadges.map((badge) => badge.label).join(' · '),
    lastWeek: snapshots[snapshots.length - 1] ?? null,
  }
}

function formatCount(n) {
  return Math.round(n ?? 0).toLocaleString('en-US')
}

function buildFirstCompleterReason(candidate, hasHistory, empathyMode = false) {
  const { history, currentCombinedPct, currentTotalSteps, currentTotalMvpa, isActiveThisWeek } =
    candidate

  if (empathyMode) {
    return buildReason([
      isActiveThisWeek
        ? `Your steady effort this week — ${formatCount(currentTotalSteps)} steps and ${formatCount(currentTotalMvpa)} MVPA minutes — is genuinely inspiring.`
        : 'Whenever you return, you will be welcomed exactly as you are.',
      currentCombinedPct > 0
        ? `${Math.round(currentCombinedPct * 100)}% toward both goals already — please celebrate yourself and rest when your body asks.`
        : 'There is no rush; your wellbeing matters more than any number.',
    ])
  }

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
    history.trend?.label ? `Trend: ${history.trend.label}.` : null,
    isActiveThisWeek
      ? `This week: ${formatCount(currentTotalSteps)} steps, ${formatCount(currentTotalMvpa)} MVPA min (${Math.round(currentCombinedPct * 100)}%).`
      : null,
  ])
}

function buildLastPlaceReason(candidate, hasHistory, empathyMode = false) {
  const { history, currentCombinedPct, currentTotalSteps, currentTotalMvpa, isActiveThisWeek } =
    candidate

  if (empathyMode) {
    return buildReason([
      isActiveThisWeek
        ? `You are at ${Math.round(currentCombinedPct * 100)}% of your goals — every step you have taken matters deeply.`
        : 'If this week has been heavy, please be gentle with yourself. Rest is a valid and loving choice.',
      'There is no shame in moving at your own pace. You deserve kindness, not comparison.',
      isActiveThisWeek
        ? `${formatCount(currentTotalSteps)} steps and ${formatCount(currentTotalMvpa)} MVPA minutes show up as care for yourself.`
        : null,
    ])
  }

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
    history.trend?.label ? `Trend: ${history.trend.label}.` : null,
    isActiveThisWeek
      ? `This week so far: ${formatCount(currentTotalSteps)} steps, ${formatCount(currentTotalMvpa)} MVPA min.`
      : 'No activity yet this week.',
    history.avgActivityCount < 1 ? 'Logs activity less often than others.' : null,
  ])
}

function buildBeggarReason(candidate, hasHistory, empathyMode = false) {
  const { history, currentReceivedPct, isActiveThisWeek } = candidate

  if (empathyMode) {
    return buildReason([
      currentReceivedPct > 0
        ? `Friends have shared ${Math.round(currentReceivedPct * 100)}% of your weekly goals with you — what a beautiful act of community support.`
        : 'Receiving help from friends is a sign of trust and connection, not weakness.',
      isActiveThisWeek
        ? 'Your own effort and the kindness around you both deserve gratitude.'
        : 'Please rest if you need to — you are held by this group either way.',
    ])
  }

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
    history.trend?.label ? `Trend: ${history.trend.label}.` : null,
    currentReceivedPct > 0
      ? `${Math.round(currentReceivedPct * 100)}% of weekly goals received as donations this week.`
      : null,
  ])
}

function buildRankByUser(currentStats, candidates, profilesCount, weekIsEmpty) {
  if (!weekIsEmpty) {
    return new Map(currentStats.map((row, index) => [row.user_id, index + 1]))
  }

  const ranked = [...candidates]
    .map((candidate) => ({
      userId: candidate.userId,
      lastRank: candidate.history.trend?.recentWeeks?.slice(-1)[0]?.rank ?? profilesCount,
      displayName: candidate.displayName,
    }))
    .sort(
      (a, b) => a.lastRank - b.lastRank || a.displayName.localeCompare(b.displayName)
    )

  return new Map(ranked.map((row, index) => [row.userId, index + 1]))
}

function resolveLeader(currentStats) {
  const top = currentStats[0]
  if (!top) return null
  if ((top.total_steps ?? 0) <= 0 && (top.total_mvpa ?? 0) <= 0) return null
  return top
}

function buildPlayerPrediction(candidate, ctx) {
  const {
    stepGoal,
    mvpaGoal,
    hasHistory,
    rank,
    empathyMode = false,
    flags: { isLeader, isFirstPick, isLastPick, isBeggarPick, isMvpaParasite },
    parasiteByUser,
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
    noteMetrics,
    pace,
    rewardMetrics,
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
    pace.paceLine,
  ]
  if (noteMetrics.recentNotes.length > 0) {
    statParts.push(`notes: ${noteMetrics.recentNotes.map((note) => `"${note}"`).join('; ')}`)
  }
  if (rewardMetrics.rewardLine) {
    statParts.push(`rewards: ${rewardMetrics.rewardLine}`)
  }
  if (currentReceivedSteps > 0 || currentReceivedMvpa > 0) {
    statParts.push(
      `${formatCount(currentReceivedSteps)} recv steps · ${formatCount(currentReceivedMvpa)} recv MVPA (${recvPct}%)`
    )
  }
  if (hasHistory && history.weeksSeen > 0) {
    statParts.push(
      `avg ${formatCount(history.avgTotalSteps)} st/wk · ${formatCount(history.avgTotalMvpa)} MVPA/wk · ${history.completionWeeks} goal week(s)`
    )
    statParts.push(`trend ${history.trend?.label ?? 'steady'}`)
    const historyLine = formatTrendHistory(history.trend)
    if (historyLine !== 'no past weeks') {
      statParts.push(`history ${historyLine}`)
    }
  }

  const labels = []
  if (!empathyMode) {
    if (isLeader) labels.push({ emoji: '👑', label: 'Leader' })
    if (isFirstPick) labels.push({ emoji: '🪖', label: 'First pick' })
    if (isLastPick) labels.push({ emoji: '🐌', label: 'Last pick' })
    if (isBeggarPick) labels.push({ emoji: '♿', label: 'Beggar pick' })
    if (isMvpaParasite) labels.push({ emoji: '🪱', label: 'MVPA Parasite' })
    if (pct >= 100) labels.push({ emoji: '✅', label: 'Goals met' })
  }

  let outlook
  const trendNote = history.trend?.label ? ` Trend: ${history.trend.label}.` : ''
  if (empathyMode) {
    if (!isActiveThisWeek) {
      outlook =
        'You have not logged activity this week yet, and that is completely okay. Please listen to your body — rest, reset, and return whenever feels right for you.'
    } else if (pct >= 100) {
      outlook = `You have reached ${pct}% of both goals — what a meaningful effort. Please celebrate yourself, and remember that rest is part of staying healthy.${trendNote}`
    } else if (pct >= 50) {
      outlook = `You are at ${pct}% toward your goals — a genuine step forward. Keep honoring your body; slow and steady is perfectly wonderful.${trendNote}`
    } else if (pct > 0) {
      outlook = `You are at ${pct}% so far, and every bit counts. If you feel tired, please give yourself permission to rest — you deserve care, not pressure.${trendNote}`
    } else {
      outlook = `This week is still open, and you are enough exactly as you are. Please take rest whenever you need it — your wellbeing comes first.${trendNote}`
    }
  } else if (!isActiveThisWeek) {
    outlook = `No activity this week.${trendNote} Next week outlook depends on showing up — currently projected to trail the group.`
  } else if (isFirstPick && pct >= 100) {
    outlook = `Already at ${pct}% of both goals.${trendNote} Top forecast to finish first next week if this pace continues.`
  } else if (isFirstPick) {
    outlook = `Leading the first-to-finish forecast at ${pct}% progress.${trendNote} Strong candidate to complete both goals earliest next week.`
  } else if (isLastPick && pct >= 100) {
    outlook = `Goals met this week (${pct}%) but lowest relative output score.${trendNote} Watch for a slower start next week.`
  } else if (isLastPick) {
    outlook = `Lowest combined progress at ${pct}%.${trendNote} Most at risk of finishing last next week without a pace increase.`
  } else if (isBeggarPick) {
    outlook = `Highest donation-receipt forecast (${recvPct}% of goals from rewards).${trendNote} Likely Beggar next week if handouts continue.`
  } else if (isLeader && pct >= 100) {
    outlook = `#${rank} on the board with both goals done.${trendNote} Favourite to stay competitive next week.`
  } else if (isLeader) {
    outlook = `#${rank} this week at ${pct}% of goals.${trendNote} Momentum favours a strong finish next week.`
  } else if (pct >= 100) {
    outlook = `Both goals cleared (${pct}%).${trendNote} Reliable finisher — expect another solid week if habits hold.`
  } else if (pct >= 50) {
    outlook = `${pct}% toward goals.${trendNote} Mid-to-strong tier — could push for an early finish next week with consistent logging.`
  } else if (pct > 0) {
    outlook = `${pct}% progress so far.${trendNote} Needs a step-up next week to avoid falling behind the pack.`
  } else {
    outlook = `Minimal progress recorded.${trendNote} Next week is an open reset.`
  }

  const trendMomentum = history.trend?.momentum ?? 0
  const firstCompleterLikelihood = Math.min(
    95,
    Math.round(
      20 +
        history.firstCompleterRate * 30 +
        history.completionRate * 20 +
        currentCombinedPct * 35 +
        trendMomentum * 12 +
        Math.max(0, pace.paceDeltaPct) * 0.15 +
        noteMetrics.commitmentCount * 4 -
        noteMetrics.excuseCount * 3 +
        (isActiveThisWeek ? 5 : 0)
    )
  )
  const lastPlaceLikelihood = Math.min(
    95,
    Math.round(
      20 +
        history.lastPlaceRate * 35 +
        (hasHistory ? (1 - history.avgCombinedPct) * 15 : 0) +
        (1 - currentCombinedPct) * 25 +
        Math.max(0, -pace.paceDeltaPct) * 0.2 +
        noteMetrics.excuseCount * 5 -
        trendMomentum * 10
    )
  )
  const beggarLikelihood = Math.min(
    95,
    Math.round(
      15 +
        history.beggarRate * 40 +
        history.avgReceivedPct * 25 +
        currentReceivedPct * 30 +
        rewardMetrics.receivedCountThisWeek * 6 +
        Math.max(0, -(history.trend?.combinedPctDelta ?? 0)) * 8
    )
  )

  const engagement = buildPlayerEngagementMetrics({
    history,
    currentTotalSteps,
    currentTotalMvpa,
    currentCombinedPct,
    currentRank: rank,
    stepGoal,
    mvpaGoal,
  })
  const recap = buildFallbackRecap(engagement.lastWeek, empathyMode)

  return {
    userId,
    displayName,
    rank,
    statsLine: statParts.join(' · '),
    recap,
    outlook,
    labels,
    trend: history.trend?.label ?? 'No history',
    historyLine: formatTrendHistory(history.trend),
    lastWeekLine: formatLastWeekLine(engagement.lastWeek),
    engagementLine: engagement.engagementLine,
    engagementBadges: engagement.badges,
    paceLine: pace.paceLine,
    recentNotes: noteMetrics.recentNotes,
    rewardLine: rewardMetrics.rewardLine,
    recentRewards: rewardMetrics.recentRewards,
    mvpaParasiteLine: parasiteByUser.get(userId)?.gapLine ?? '',
    isMvpaParasite: Boolean(parasiteByUser.get(userId)?.isParasite),
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
  empathyMode = false,
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

      const rank = weekStats.findIndex((entry) => entry.user_id === stats.user_id) + 1
      const combinedPct = combinedGoalPct(stats, stepGoal, mvpaGoal)
      const completedGoals =
        (stats.total_steps ?? 0) >= stepGoal && (stats.total_mvpa ?? 0) >= mvpaGoal

      row.weeksSeen += 1
      row.sumTotalSteps += stats.total_steps ?? 0
      row.sumTotalMvpa += stats.total_mvpa ?? 0
      row.sumCombinedPct += combinedPct
      row.sumReceivedSteps += stats.received_steps ?? 0
      row.sumReceivedMvpa += stats.received_mvpa ?? 0
      row.sumReceivedPct += receivedGoalPct(stats, stepGoal, mvpaGoal)

      if (completedGoals) row.completionWeeks += 1
      if (stats.user_id === firstCompleterId) row.firstCompleterWeeks += 1
      if (stats.user_id === beggarId) row.beggarWeeks += 1
      if (stats.user_id === lastUser?.user_id) row.lastPlaceWeeks += 1

      row.sumActivityCount += weekActivities.filter((a) => a.user_id === stats.user_id).length
      row.sumRewardsReceived += weekRewards.filter((r) => r.receiver_id === stats.user_id).length

      for (const act of weekActivities.filter((a) => a.user_id === stats.user_id)) {
        const note = act.note?.trim()
        if (!note) continue
        row.sumNoteCount += 1
        const classified = classifyNote(note)
        if (classified.excuse) row.sumExcuseNotes += 1
        if (classified.commitment) row.sumCommitmentNotes += 1
      }

      row.weeklySnapshots.push({
        week,
        rank,
        combinedPct,
        completedGoals,
        totalSteps: stats.total_steps ?? 0,
        totalMvpa: stats.total_mvpa ?? 0,
        wasFirst: stats.user_id === firstCompleterId,
        wasLast: stats.user_id === lastUser?.user_id,
        wasBeggar: stats.user_id === beggarId,
      })
    }
  }

  const historicalWeekSummaries = buildHistoricalWeekSummaries(
    historyWeeks,
    profiles,
    activities,
    rewards,
    stepGoal,
    mvpaGoal
  )
  const playerEventLogs = buildPlayerEventLogs(profiles, activities, rewards)
  const playerRewardDetails = buildPlayerRewardDetails(profiles, rewards, currentWeek)
  const rewardDetailsByUser = new Map(playerRewardDetails.map((entry) => [entry.userId, entry]))
  const weekProgress = getWeekProgressContext()

  const currentStats = sortChallengeLeaderboard(
    buildChallengeLeaderboard(profiles, activities, rewards, weekStart)
  )
  const groupGoal = buildGroupGoalContext(
    currentStats,
    profiles.length,
    stepGoal,
    mvpaGoal,
    weekProgress
  )
  const currentByUser = new Map(currentStats.map((row) => [row.user_id, row]))

  const historyWeight = hasHistory ? 0.3 : 0
  const currentWeight = hasHistory ? 0.7 : 1

  const candidates = profiles.map((profile) => {
    const history = finalizeMetrics(
      metricsMap.get(profile.id) ?? createEmptyMetrics(profile),
      historyWeeks.length || 1
    )
    const momentum = history.trend?.momentum ?? 0
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
    const noteMetrics = buildPlayerNoteMetrics(profile.id, activities, currentWeek)
    const rewardMetrics = rewardDetailsByUser.get(profile.id) ?? {
      receivedThisWeek: [],
      sentThisWeek: [],
      recentRewards: [],
      rewardLine: '',
      receivedCountThisWeek: 0,
      sentCountThisWeek: 0,
    }
    const pace = buildGoalPaceContext(
      { steps: currentTotalSteps, mvpa: currentTotalMvpa },
      stepGoal,
      mvpaGoal,
      weekProgress
    )
    const paceAhead = Math.max(0, pace.paceDeltaPct / 100)
    const paceBehind = Math.max(0, -pace.paceDeltaPct / 100)

    const firstCompleterScore =
      history.firstCompleterRate * historyWeight * 100 +
      history.completionRate * historyWeight * 60 +
      history.avgCombinedPct * historyWeight * 40 +
      currentCombinedPct * currentWeight * 100 +
      momentum * historyWeight * 25 +
      paceAhead * currentWeight * 60 +
      noteMetrics.commitmentCount * currentWeight * 12 +
      noteMetrics.noteCountThisWeek * currentWeight * 3 +
      history.avgCommitmentNotes * historyWeight * 8 +
      (isActiveThisWeek ? 5 : 0) -
      noteMetrics.excuseCount * currentWeight * 10 -
      history.avgExcuseNotes * historyWeight * 6

    const lastPlaceScore =
      history.avgTotalSteps * historyWeight +
      history.avgTotalMvpa * historyWeight * 350 +
      currentOutput * currentWeight -
      momentum * historyWeight * 8000 +
      paceBehind * currentWeight * 80000 +
      noteMetrics.excuseCount * currentWeight * 25 +
      history.avgExcuseNotes * historyWeight * 20 -
      noteMetrics.commitmentCount * currentWeight * 15

    const beggarScore =
      history.beggarRate * historyWeight * 100 +
      history.avgReceivedPct * historyWeight * 80 +
      history.avgRewardsReceived * historyWeight * 8 +
      currentReceivedPct * currentWeight * 100 +
      rewardMetrics.receivedCountThisWeek * currentWeight * 8 +
      rewardMetrics.receivedThisWeek.length * currentWeight * 4 +
      Math.max(0, -(history.trend?.combinedPctDelta ?? 0)) * historyWeight * 40

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
      noteMetrics,
      pace,
      rewardMetrics,
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
  const weekIsEmpty = activeThisWeek === 0
  const completedThisWeek = currentStats.filter(
    (row) => (row.total_steps ?? 0) >= stepGoal && (row.total_mvpa ?? 0) >= mvpaGoal
  ).length

  const leader = resolveLeader(currentStats)
  const rankByUser = buildRankByUser(currentStats, candidates, profiles.length, weekIsEmpty)
  const mvpaParasite = buildMvpaParasiteStatus({ activities, profiles, weekStart })
  const parasiteByUser = new Map(mvpaParasite.players.map((player) => [player.userId, player]))

  const playerPredictions = candidates
    .map((candidate) =>
      buildPlayerPrediction(candidate, {
        stepGoal,
        mvpaGoal,
        hasHistory,
        empathyMode,
        rank: rankByUser.get(candidate.userId) ?? profiles.length,
        parasiteByUser,
        flags: {
          isLeader: leader?.user_id === candidate.userId,
          isFirstPick: firstCompleter?.userId === candidate.userId,
          isLastPick: lastPlace?.userId === candidate.userId,
          isBeggarPick: beggar?.userId === candidate.userId,
          isMvpaParasite: mvpaParasite.userId === candidate.userId,
        },
      })
    )
    .sort((a, b) => a.rank - b.rank || a.displayName.localeCompare(b.displayName))

  const summaryParts = empathyMode
    ? [
        `${activeThisWeek}/${profiles.length} friends are moving together this week — every pace is valid and worthy of respect.`,
        `The group is at ${groupGoal.groupCombinedPct}% of our shared goal. Please be proud of whatever you have contributed, and rest whenever you need to.`,
        completedThisWeek > 0
          ? `${completedThisWeek} have already reached both goals — wonderful progress. Remember that recovery is part of caring for yourself.`
          : 'There is still time this week. Please listen to your body and take rest without guilt.',
        leader && (leader.total_steps ?? 0) > 0
          ? `${leader.display_name} is leading the board with ${Math.round((leader.total_steps ?? 0) / 1000)}k steps — celebrate the group's collective effort.`
          : weekIsEmpty && hasHistory
            ? 'A quiet week so far — that is okay. You are welcome to show up gently, or simply rest.'
            : null,
        hasHistory
          ? "Forecasts blend past weeks with this week's pace — please treat them as gentle guidance, not pressure."
          : 'Forecasts are based on this week only — please move at the pace that feels right for you.',
      ]
    : [
        `${activeThisWeek}/${profiles.length} players active this week.`,
        `Group at ${groupGoal.groupCombinedPct}% of combined target (${formatCount(groupGoal.totalStepsLogged)}/${formatCount(groupGoal.totalStepGoal)} steps, ${groupGoal.groupMvpaPct}% MVPA).`,
        completedThisWeek > 0
          ? `${completedThisWeek} already completed both goals.`
          : 'No one has finished both goals yet.',
        leader && (leader.total_steps ?? 0) > 0
          ? `${leader.display_name} leads the current board with ${Math.round((leader.total_steps ?? 0) / 1000)}k steps.`
          : weekIsEmpty && hasHistory
            ? 'No activity this week yet — board ranks follow last week until someone logs.'
            : null,
        hasHistory
          ? `Forecasts blend ${historyWeeks.length} past week(s) (30%) with this week's pace (70%).`
          : 'Forecasts rely mostly on this week because history is limited.',
      ]

  return {
    summary: summaryParts.filter(Boolean).join(' '),
    hasHistory,
    historyWeekCount: historyWeeks.length,
    historicalWeekSummaries,
    playerEventLogs,
    mvpaParasite,
    weekContext: {
      stepGoal,
      mvpaGoal,
      ...weekProgress,
      ...groupGoal,
      paceSummary: `Per player (${formatCount(stepGoal)} steps + ${mvpaGoal} MVPA each): linear target by now ~${Math.round((weekProgress.daysElapsed / 7) * stepGoal).toLocaleString()} steps / ~${Math.round((weekProgress.daysElapsed / 7) * mvpaGoal)} MVPA min. ${groupGoal.groupPaceSummary}`,
    },
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
                firstCompleter.currentCombinedPct * 10 +
                (firstCompleter.history.trend?.momentum ?? 0) * 8
            )
          ),
          reason: buildFirstCompleterReason(firstCompleter, hasHistory, empathyMode),
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
                (lastPlace.currentCombinedPct < 0.25 ? 10 : 0) -
                (lastPlace.history.trend?.momentum ?? 0) * 8
            )
          ),
          reason: buildLastPlaceReason(lastPlace, hasHistory, empathyMode),
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
          reason: buildBeggarReason(beggar, hasHistory, empathyMode),
        }
      : null,
  }
}
