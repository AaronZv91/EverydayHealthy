export const WEEK_TIMEZONE = 'Asia/Singapore'

function getSgtYmd(date) {
  return date.toLocaleDateString('en-CA', { timeZone: WEEK_TIMEZONE })
}

function getSgtWeekdayIndex(date) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: WEEK_TIMEZONE,
    weekday: 'short',
  }).format(date)
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return map[short] ?? 0
}

function addDaysInWeekTimezone(date, days) {
  const ymd = getSgtYmd(date)
  const shifted = new Date(`${ymd}T12:00:00+08:00`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted
}

/** Monday 00:00 SGT for the week containing `date`. */
export function getWeekStart(date = new Date()) {
  const weekday = getSgtWeekdayIndex(date)
  const monday = addDaysInWeekTimezone(date, -weekday)
  const ymd = getSgtYmd(monday)
  return new Date(`${ymd}T00:00:00+08:00`)
}

const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

/** Where we are in the Mon–Sun SGT challenge week (for pace vs 70k / 200 MVPA targets). */
export function getWeekProgressContext(date = new Date()) {
  const weekdayIndex = getSgtWeekdayIndex(date)
  const daysElapsed = weekdayIndex + 1
  const daysRemaining = 7 - daysElapsed

  return {
    weekday: WEEKDAY_NAMES[weekdayIndex],
    dayOfWeek: daysElapsed,
    daysElapsed,
    daysRemaining,
    weekProgressPct: Math.round((daysElapsed / 7) * 100),
  }
}

/** Compare logged totals to linear weekly-goal pace for the current day. */
export function buildGoalPaceContext(totals, stepGoal, mvpaGoal, weekProgress) {
  const fraction = weekProgress.daysElapsed / 7
  const expectedSteps = Math.round(stepGoal * fraction)
  const expectedMvpa = Math.round(mvpaGoal * fraction)
  const steps = totals.steps ?? 0
  const mvpa = totals.mvpa ?? 0
  const stepsPct = stepGoal > 0 ? Math.round((steps / stepGoal) * 100) : 0
  const mvpaPct = mvpaGoal > 0 ? Math.round((mvpa / mvpaGoal) * 100) : 0
  const combinedActual = stepGoal > 0 && mvpaGoal > 0 ? (steps / stepGoal + mvpa / mvpaGoal) / 2 : 0
  const paceDeltaPct = Math.round((combinedActual - fraction) * 100)

  let paceLabel = 'on pace'
  if (paceDeltaPct > 10) paceLabel = 'ahead of pace'
  else if (paceDeltaPct < -10) paceLabel = 'behind pace'

  return {
    stepsPct,
    mvpaPct,
    stepsRemaining: Math.max(0, stepGoal - steps),
    mvpaRemaining: Math.max(0, mvpaGoal - mvpa),
    expectedStepsByNow: expectedSteps,
    expectedMvpaByNow: expectedMvpa,
    stepsBehindPace: expectedSteps - steps,
    mvpaBehindPace: expectedMvpa - mvpa,
    paceDeltaPct,
    paceLabel,
    paceLine: `${stepsPct}% of ${stepGoal.toLocaleString()} steps · ${mvpaPct}% of ${mvpaGoal} MVPA vs ~${Math.round(fraction * 100)}% linear week progress (${paceLabel})`,
  }
}

/** Sum of every player's individual weekly goal — for group current-state %. */
export function buildGroupGoalContext(currentStats, playerCount, stepGoal, mvpaGoal, weekProgress) {
  const totalStepGoal = stepGoal * playerCount
  const totalMvpaGoal = mvpaGoal * playerCount
  const totalStepsLogged = currentStats.reduce((sum, row) => sum + (row.total_steps ?? 0), 0)
  const totalMvpaLogged = currentStats.reduce((sum, row) => sum + (row.total_mvpa ?? 0), 0)

  const groupStepsPct = totalStepGoal > 0 ? Math.round((totalStepsLogged / totalStepGoal) * 100) : 0
  const groupMvpaPct = totalMvpaGoal > 0 ? Math.round((totalMvpaLogged / totalMvpaGoal) * 100) : 0
  const groupCombinedPct = Math.round((groupStepsPct + groupMvpaPct) / 2)

  const fraction = weekProgress.daysElapsed / 7
  const expectedGroupStepsByNow = Math.round(totalStepGoal * fraction)
  const expectedGroupMvpaByNow = Math.round(totalMvpaGoal * fraction)
  const groupPace = buildGoalPaceContext(
    { steps: totalStepsLogged, mvpa: totalMvpaLogged },
    totalStepGoal,
    totalMvpaGoal,
    weekProgress
  )

  return {
    playerCount,
    individualStepGoal: stepGoal,
    individualMvpaGoal: mvpaGoal,
    totalStepGoal,
    totalMvpaGoal,
    totalStepsLogged,
    totalMvpaLogged,
    groupStepsPct,
    groupMvpaPct,
    groupCombinedPct,
    expectedGroupStepsByNow,
    expectedGroupMvpaByNow,
    groupPaceLabel: groupPace.paceLabel,
    groupPaceDeltaPct: groupPace.paceDeltaPct,
    groupPaceLine: `${formatNumber(totalStepsLogged)}/${formatNumber(totalStepGoal)} steps (${groupStepsPct}%) · ${formatNumber(totalMvpaLogged)}/${formatNumber(totalMvpaGoal)} MVPA (${groupMvpaPct}%) · group ${groupCombinedPct}% combined (${groupPace.paceLabel})`,
    groupPaceSummary: `Group total (${playerCount} players × ${formatNumber(stepGoal)} steps + ${mvpaGoal} MVPA each): ${formatNumber(totalStepsLogged)}/${formatNumber(totalStepGoal)} steps (${groupStepsPct}%), ${formatNumber(totalMvpaLogged)}/${formatNumber(totalMvpaGoal)} MVPA min (${groupMvpaPct}%) — ${groupCombinedPct}% of combined target; linear pace by now ~${formatNumber(expectedGroupStepsByNow)} steps / ~${expectedGroupMvpaByNow} MVPA (${groupPace.paceLabel}).`,
  }
}

/** Mon–Sun buckets for a challenge week (SGT date keys). */
export function getWeekDayBuckets(weekStart) {
  const mondayYmd = String(weekStart ?? '').slice(0, 10)
  if (!mondayYmd) return []

  const monday = new Date(`${mondayYmd}T12:00:00+08:00`)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return labels.map((label, index) => {
    const date = addDaysInWeekTimezone(monday, index)
    return { label, key: getSgtYmd(date) }
  })
}

export function getSgtDateKey(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: WEEK_TIMEZONE })
}

export function formatWeekRange(date = new Date()) {
  const start = getWeekStart(date)
  const end = addDaysInWeekTimezone(start, 6)

  const fmt = (d) =>
    d.toLocaleDateString('en-US', {
      timeZone: WEEK_TIMEZONE,
      month: 'short',
      day: 'numeric',
    })

  return `${fmt(start)} – ${fmt(end)} SGT`
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n ?? 0)
}

export function formatPercent(current, goal) {
  if (!goal) return 0
  return Math.min(100, Math.round(((current ?? 0) / goal) * 100))
}

export function formatRewardMessage(reward, senderName, receiverName) {
  const parts = []
  if (reward.steps > 0) parts.push(`${formatNumber(reward.steps)} steps`)
  if (reward.mvpa_minutes > 0) parts.push(`${formatNumber(reward.mvpa_minutes)} min MVPA`)

  const detail = parts.length ? ` (${parts.join(', ')})` : ''
  return `${senderName} ${reward.emoji} rewarded ${receiverName} "${reward.item_name}"${detail}`
}

export function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    timeZone: WEEK_TIMEZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Activity/reward log timestamp for Gemini (weekday + time in SGT). */
export function formatLogTimestamp(iso) {
  if (!iso) return 'unknown time'
  return (
    new Date(iso).toLocaleString('en-US', {
      timeZone: WEEK_TIMEZONE,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' SGT'
  )
}
