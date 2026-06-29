export const PLAYER_CONTRIBUTION_COLORS = [
  '#06b6d4',
  '#eab308',
  '#a855f7',
  '#22c55e',
  '#f97316',
  '#ec4899',
  '#3b82f6',
  '#14b8a6',
]

export function buildGroupContributionChart({ users, goalPerPlayer, valueKey }) {
  const playerCount = users.length
  const groupGoal = goalPerPlayer * playerCount
  const totalLogged = users.reduce((sum, user) => sum + (Number(user[valueKey]) || 0), 0)
  const groupPct = groupGoal > 0 ? Math.round((totalLogged / groupGoal) * 100) : 0
  const withinGoalPct = Math.min(groupPct, 100)
  const exceededPct = Math.max(0, groupPct - 100)
  const remainingPct = Math.max(0, 100 - groupPct)

  const players = users.map((user, index) => {
    const value = Number(user[valueKey]) || 0
    const goalSharePct = groupGoal > 0 ? (value / groupGoal) * 100 : 0
    return {
      userId: user.user_id,
      name: user.display_name,
      value,
      goalSharePct,
      color: PLAYER_CONTRIBUTION_COLORS[index % PLAYER_CONTRIBUTION_COLORS.length],
    }
  })

  const scale = groupPct > 100 ? 100 / groupPct : 1
  const segments = players.map((player) => ({
    ...player,
    barPct: player.goalSharePct * scale,
  }))

  const exceededSegments =
    exceededPct > 0
      ? players.map((player) => ({
          ...player,
          barPct: (player.goalSharePct / groupPct) * exceededPct,
        }))
      : []

  return {
    groupGoal,
    totalLogged,
    groupPct,
    withinGoalPct,
    exceededPct,
    remainingPct,
    segments,
    exceededSegments,
  }
}
