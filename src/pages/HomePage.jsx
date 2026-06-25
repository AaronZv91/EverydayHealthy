import ActivityForm from '../components/ActivityForm'
import Dashboard from '../components/Dashboard'
import Leaderboard from '../components/Leaderboard'
import PredictionBoard from '../components/PredictionBoard'
import RewardForm from '../components/RewardForm'
import Ticker from '../components/Ticker'
import { useEmpathyMode } from '../hooks/useEmpathyMode'
import { useProfiles, useWeeklyStats } from '../hooks/useWeeklyStats'
import { useChallengeLeaderboard } from '../hooks/useChallengeLeaderboard'
import { useLogActivity, useRewards } from '../hooks/useRewards'

export default function HomePage({ user, onSignOut }) {
  const userId = user?.id
  const { empathyMode, toggleEmpathyMode } = useEmpathyMode()
  const { stats, loading: statsLoading, refetch: refetchStats } = useWeeklyStats(userId)
  const { profiles, refetch: refetchProfiles } = useProfiles()
  const { rewards, loading: rewardsLoading, sendReward } = useRewards()
  const {
    weeklyStats,
    allTimeStats,
    weeklySoldierUserId,
    weeklyBeggarUserId,
    weeklyMvpaParasiteUserId,
    predictions,
    loading: leaderboardLoading,
    refreshing: leaderboardRefreshing,
    aiCopyLoading,
    refetch: refetchLeaderboard,
  } = useChallengeLeaderboard(empathyMode)
  const { logActivity } = useLogActivity()

  async function handleRefresh() {
    await Promise.all([refetchStats(), refetchProfiles(), refetchLeaderboard()])
  }

  return (
    <div className="min-h-screen">
      <header className="app-header border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="app-logo flex h-10 w-10 items-center justify-center rounded-xl text-lg">
              {empathyMode ? '☁️' : '🏃'}
            </span>
            <div>
              <h1 className="text-lg font-bold text-white">EverydayHealthy</h1>
              <p className="text-xs text-slate-400">
                {empathyMode ? 'Gentle encouragement · rest is welcome' : 'Health rewards · weekly goals'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="empathy-switch-wrap">
              <span className="empathy-switch-label" id="empathy-mode-label">
                Empathy Mode
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={empathyMode}
                aria-labelledby="empathy-mode-label"
                className={`empathy-switch ${empathyMode ? 'empathy-switch-on' : ''}`}
                onClick={toggleEmpathyMode}
                title={
                  empathyMode
                    ? 'Turn off Empathy Mode — return to competitive view'
                    : 'Turn on Empathy Mode — gentle tone, no labels or backgrounds'
                }
              >
                <span className="empathy-switch-thumb" aria-hidden="true" />
              </button>
            </div>
            <span className="hidden text-sm text-slate-400 sm:inline">
              {user?.email}
            </span>
            <button type="button" className="btn-secondary" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {!empathyMode && <Ticker rewards={rewards} loading={rewardsLoading} />}

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Leaderboard
          weeklyStats={weeklyStats}
          allTimeStats={allTimeStats}
          weeklySoldierUserId={weeklySoldierUserId}
          weeklyBeggarUserId={weeklyBeggarUserId}
          weeklyMvpaParasiteUserId={weeklyMvpaParasiteUserId}
          loading={leaderboardLoading}
          currentUserId={userId}
          empathyMode={empathyMode}
        />

        <PredictionBoard
          predictions={predictions}
          loading={leaderboardLoading}
          aiCopyLoading={aiCopyLoading}
          currentUserId={userId}
          empathyMode={empathyMode}
        />

        <Dashboard stats={stats} loading={statsLoading} />

        <RewardForm
          profiles={profiles}
          currentUserId={userId}
          availableSteps={stats?.available_steps ?? 0}
          availableMvpa={stats?.available_mvpa ?? 0}
          onSubmit={sendReward}
          onSuccess={handleRefresh}
        />

        <ActivityForm onSubmit={logActivity} onSuccess={handleRefresh} />
      </main>
    </div>
  )
}
