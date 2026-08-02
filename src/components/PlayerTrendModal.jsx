import { useEffect, useId, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildPlayerTrendProfile } from '../lib/challengeStats'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber, formatWeekRange } from '../lib/weekUtils'

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-sm shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium text-slate-200">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
          {unit ? ` ${unit}` : ''}
          {entry.payload?.stepsPct != null && entry.dataKey === 'Steps'
            ? ` (${entry.payload.stepsPct}%)`
            : ''}
          {entry.payload?.mvpaPct != null && entry.dataKey === 'MVPA'
            ? ` (${entry.payload.mvpaPct}%)`
            : ''}
        </p>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function AccumulatedChart({ title, data, goal, unit, color }) {
  const peak = data.reduce((max, row) => Math.max(max, row.Total ?? 0), 0)
  const yMax = Math.max(goal, peak, 1)

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        <p className="text-xs text-slate-500">
          Goal {formatNumber(goal)} {unit}
        </p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`trend-fill-${unit}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, yMax]}
              stroke="#64748b"
              fontSize={11}
              width={44}
              tickFormatter={formatNumber}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <ReferenceLine
              y={goal}
              stroke="#475569"
              strokeDasharray="4 4"
              label={{ value: 'Goal', fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }}
            />
            <Area
              type="monotone"
              dataKey="Total"
              name="Total"
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#trend-fill-${unit})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Self"
              name="Self"
              stroke="#34d399"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Rewarded"
              name="Received"
              stroke="#fbbf24"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DailyLoggedChart({ title, data, unit, color }) {
  const peak = data.reduce((max, row) => Math.max(max, row.Total ?? 0), 0)

  return (
    <div className="min-w-0 flex-1">
      <h4 className="mb-2 text-sm font-semibold text-slate-200">{title}</h4>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, Math.max(peak, 1)]}
              stroke="#64748b"
              fontSize={11}
              width={44}
              tickFormatter={formatNumber}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Bar dataKey="Self" name="Self" stackId="day" fill="#34d399" radius={[0, 0, 0, 0]} />
            <Bar
              dataKey="Rewarded"
              name="Received"
              stackId="day"
              fill="#fbbf24"
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="Total"
              name="Total"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function WeeklyHistoryChart({ history, stepGoal, mvpaGoal }) {
  const stepPeak = history.reduce((max, row) => Math.max(max, row.Steps ?? 0), 0)
  const mvpaPeak = history.reduce((max, row) => Math.max(max, row.MVPA ?? 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-200">Steps by week</h4>
          <p className="text-xs text-slate-500">Goal {formatNumber(stepGoal)}</p>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, Math.max(stepGoal, stepPeak, 1)]}
                stroke="#64748b"
                fontSize={11}
                width={48}
                tickFormatter={formatNumber}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip unit="steps" />} />
              <ReferenceLine y={stepGoal} stroke="#475569" strokeDasharray="4 4" />
              <Bar dataKey="Steps" name="Steps" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Line
                type="monotone"
                dataKey="Steps"
                name="Trend"
                stroke="#e2e8f0"
                strokeWidth={2}
                dot={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-200">MVPA by week</h4>
          <p className="text-xs text-slate-500">Goal {formatNumber(mvpaGoal)} min</p>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, Math.max(mvpaGoal, mvpaPeak, 1)]}
                stroke="#64748b"
                fontSize={11}
                width={44}
                tickFormatter={formatNumber}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip unit="min" />} />
              <ReferenceLine y={mvpaGoal} stroke="#475569" strokeDasharray="4 4" />
              <Bar dataKey="MVPA" name="MVPA" fill="#a78bfa" radius={[6, 6, 0, 0]} maxBarSize={36} />
              <Line
                type="monotone"
                dataKey="MVPA"
                name="Trend"
                stroke="#e2e8f0"
                strokeWidth={2}
                dot={false}
                legendType="none"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export default function PlayerTrendModal({
  open,
  onClose,
  user,
  weekStart,
  activities,
  rewards,
}) {
  const titleId = useId()
  const [view, setView] = useState('week')

  useEffect(() => {
    if (!open) return
    setView('week')

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const trend = useMemo(() => {
    if (!open || !user?.user_id || !weekStart) return null
    return buildPlayerTrendProfile({
      userId: user.user_id,
      displayName: user.display_name,
      weekStart,
      activities: activities ?? [],
      rewards: rewards ?? [],
      stepGoal: WEEKLY_GOALS.steps,
      mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
    })
  }, [open, user, weekStart, activities, rewards])

  if (!open || !user || !trend) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400/90">
              Performance trend
            </p>
            <h2 id={titleId} className="mt-1 truncate text-xl font-bold text-white">
              {trend.displayName}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">{formatWeekRange()}</p>
          </div>
          <button type="button" className="btn-secondary shrink-0 px-3 py-1.5 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard
              label="Steps"
              value={`${formatNumber(trend.stats.total_steps)}`}
              sub={`${trend.stepsPct}% of ${formatNumber(WEEKLY_GOALS.steps)}`}
            />
            <StatCard
              label="MVPA"
              value={`${formatNumber(trend.stats.total_mvpa)} min`}
              sub={`${trend.mvpaPct}% of ${WEEKLY_GOALS.mvpaMinutes}`}
            />
            <StatCard label="Combined" value={`${trend.combinedPct}%`} sub="Avg of both goals" />
            <StatCard
              label="Self / received"
              value={`${formatNumber(trend.stats.net_self_steps)} st`}
              sub={`${formatNumber(trend.stats.received_steps)} received · ${formatNumber(trend.stats.net_self_mvpa)}/${formatNumber(trend.stats.received_mvpa)} MVPA`}
            />
          </div>

          <div className="mb-4 flex rounded-xl bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setView('week')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === 'week' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === 'history' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly trend
            </button>
          </div>

          {view === 'week' ? (
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Accumulated progress · Mon–Sun SGT
                </p>
                <div className="flex flex-col gap-6 lg:flex-row">
                  <AccumulatedChart
                    title="Steps"
                    data={trend.accumulated.steps}
                    goal={WEEKLY_GOALS.steps}
                    unit="steps"
                    color="#22d3ee"
                  />
                  <AccumulatedChart
                    title="MVPA"
                    data={trend.accumulated.mvpa}
                    goal={WEEKLY_GOALS.mvpaMinutes}
                    unit="min"
                    color="#a78bfa"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Daily logged volume
                </p>
                <div className="flex flex-col gap-6 lg:flex-row">
                  <DailyLoggedChart
                    title="Steps logged per day"
                    data={trend.daily.steps}
                    unit="steps"
                    color="#22d3ee"
                  />
                  <DailyLoggedChart
                    title="MVPA logged per day"
                    data={trend.daily.mvpa}
                    unit="min"
                    color="#a78bfa"
                  />
                </div>
              </div>
            </div>
          ) : trend.history.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No weekly history yet</p>
          ) : (
            <WeeklyHistoryChart
              history={trend.history}
              stepGoal={WEEKLY_GOALS.steps}
              mvpaGoal={WEEKLY_GOALS.mvpaMinutes}
            />
          )}
        </div>
      </div>
    </div>
  )
}
