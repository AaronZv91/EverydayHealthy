import { useState } from 'react'
import { findTopReceiverUserId } from '../lib/challengeStats'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber } from '../lib/weekUtils'

function StackedHorizontalBar({ label, self, received, sent, scaleMax, goal }) {
  const total = self + received
  const barWidthPct = scaleMax > 0 ? Math.min(100, (total / scaleMax) * 100) : 0
  const selfPctOfBar = total > 0 ? (self / total) * 100 : 0
  const receivedPctOfBar = total > 0 ? (received / total) * 100 : 0
  const goalPct = goal && scaleMax > 0 ? Math.min(100, (goal / scaleMax) * 100) : null

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="tabular-nums text-slate-500">
          {formatNumber(total)}
          {sent > 0 ? ` · sent ${formatNumber(sent)}` : ''}
          {goal ? ` / ${formatNumber(goal)}` : ''}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
        {goalPct != null && goalPct <= 100 && (
          <div
            className="absolute inset-y-0 z-10 border-r border-dashed border-slate-500/70"
            style={{ left: `${goalPct}%` }}
            title={`Goal: ${formatNumber(goal)}`}
          />
        )}
        {total > 0 && (
          <div className="flex h-full min-w-0" style={{ width: `${barWidthPct}%` }}>
            {self > 0 && (
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${selfPctOfBar}%` }}
                title={`Self (net): ${formatNumber(self)}`}
              />
            )}
            {received > 0 && (
              <div
                className="h-full bg-reward-500"
                style={{ width: `${receivedPctOfBar}%` }}
                title={`Received: ${formatNumber(received)}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChallengeRow({
  rank,
  user,
  scaleSteps,
  scaleMvpa,
  goalSteps,
  goalMvpa,
  isCurrentUser,
  isTopReceiver,
}) {
  return (
    <li
      className={`rounded-xl border px-3 py-3 ${
        isCurrentUser
          ? 'border-emerald-500/40 bg-emerald-950/20'
          : 'border-slate-800 bg-slate-800/40'
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            rank === 1
              ? 'bg-reward-500 text-slate-900'
              : rank === 2
                ? 'bg-slate-500 text-white'
                : rank === 3
                  ? 'bg-amber-800 text-white'
                  : 'bg-slate-700 text-slate-300'
          }`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 truncate font-medium text-slate-100">
            <span className="truncate">{user.display_name}</span>
            {isTopReceiver && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-reward-500/40 bg-reward-500/15 px-2 py-0.5 text-xs font-semibold text-reward-400"
                title="Most donations received"
              >
                ♿ Beggar
              </span>
            )}
            {isCurrentUser && (
              <span className="shrink-0 text-xs font-normal text-emerald-400">(you)</span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <StackedHorizontalBar
          label="Steps"
          self={user.net_self_steps ?? 0}
          received={user.received_steps ?? 0}
          sent={user.sent_steps ?? 0}
          scaleMax={scaleSteps}
          goal={goalSteps}
        />
        <StackedHorizontalBar
          label="MVPA (min)"
          self={user.net_self_mvpa ?? 0}
          received={user.received_mvpa ?? 0}
          sent={user.sent_mvpa ?? 0}
          scaleMax={scaleMvpa}
          goal={goalMvpa}
        />
      </div>
    </li>
  )
}

function ChallengeList({ users, mode, currentUserId }) {
  if (users.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No data yet</p>
  }

  const maxTotalSteps = Math.max(...users.map((u) => u.total_steps ?? 0), 1)
  const maxTotalMvpa = Math.max(...users.map((u) => u.total_mvpa ?? 0), 1)

  const scaleSteps =
    mode === 'weekly' ? Math.max(WEEKLY_GOALS.steps, maxTotalSteps) : maxTotalSteps
  const scaleMvpa =
    mode === 'weekly' ? Math.max(WEEKLY_GOALS.mvpaMinutes, maxTotalMvpa) : maxTotalMvpa

  const goalSteps = mode === 'weekly' ? WEEKLY_GOALS.steps : null
  const goalMvpa = mode === 'weekly' ? WEEKLY_GOALS.mvpaMinutes : null
  const topReceiverUserId = findTopReceiverUserId(users)

  return (
    <ol className="space-y-3">
      {users.map((user, index) => (
        <ChallengeRow
          key={user.user_id}
          rank={index + 1}
          user={user}
          scaleSteps={scaleSteps}
          scaleMvpa={scaleMvpa}
          goalSteps={goalSteps}
          goalMvpa={goalMvpa}
          isCurrentUser={user.user_id === currentUserId}
          isTopReceiver={user.user_id === topReceiverUserId}
        />
      ))}
    </ol>
  )
}

export default function Leaderboard({
  weeklyStats,
  allTimeStats,
  loading,
  currentUserId,
}) {
  const [mode, setMode] = useState('weekly')
  const users = mode === 'weekly' ? weeklyStats : allTimeStats

  if (loading) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">Loading leaderboard…</p>
      </section>
    )
  }

  return (
    <section className="card flex flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Challenge Leaderboard</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {mode === 'weekly'
              ? 'Resets every Monday · goal 70,000 steps & 200 min MVPA'
              : 'All-time totals across every week'}
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode('weekly')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === 'weekly'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setMode('alltime')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === 'alltime'
                ? 'bg-brand-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All-time
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Self (earned − sent)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-reward-500" />
          Received
        </span>
        {mode === 'weekly' && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 border-r border-dashed border-slate-500 pr-1" />
            Weekly goal
          </span>
        )}
      </div>

      <div className="-mr-1 max-h-[32rem] overflow-y-auto pr-1">
        <ChallengeList users={users} mode={mode} currentUserId={currentUserId} />
      </div>
    </section>
  )
}
