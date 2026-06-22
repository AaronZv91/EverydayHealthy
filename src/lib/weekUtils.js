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
