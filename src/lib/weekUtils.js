export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWeekRange(date = new Date()) {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const fmt = (d) =>
    d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })

  return `${fmt(start)} – ${fmt(end)}`
}

export function formatNumber(n) {
  return new Intl.NumberFormat('zh-TW').format(n ?? 0)
}

export function formatPercent(current, goal) {
  if (!goal) return 0
  return Math.min(100, Math.round(((current ?? 0) / goal) * 100))
}

export function formatRewardMessage(reward, senderName, receiverName) {
  const parts = []
  if (reward.steps > 0) parts.push(`${formatNumber(reward.steps)} 步`)
  if (reward.mvpa_minutes > 0) parts.push(`${formatNumber(reward.mvpa_minutes)} 分 MVPA`)

  return `${senderName} ${reward.emoji} 打賞 ${receiverName}「${reward.item_name}」${parts.length ? `（${parts.join('、')}）` : ''}`
}
