import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber, formatPercent, formatWeekRange } from '../lib/weekUtils'

function ProgressRing({ label, current, goal, unit }) {
  const pct = formatPercent(current, goal)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-slate-800"
          />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${pct} 100`}
            className="text-brand-500 transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold">{pct}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-slate-300">{label}</p>
        <p className="text-xs text-slate-500">
          {formatNumber(current)} / {formatNumber(goal)} {unit}
        </p>
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)} {unit}
        </p>
      ))}
    </div>
  )
}

function MetricBarChart({ title, self, rewarded, goal, unit }) {
  const selfValue = self ?? 0
  const rewardedValue = rewarded ?? 0
  const total = selfValue + rewardedValue
  const yMax = Math.max(goal, total, 1)

  const data = [{ name: title, Self: selfValue, Rewarded: rewardedValue }]

  return (
    <div className="min-w-0 flex-1">
      <h4 className="mb-2 text-xs font-medium text-slate-400">
        {title} · goal {formatNumber(goal)} {unit}
      </h4>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis
              domain={[0, yMax]}
              stroke="#94a3b8"
              fontSize={12}
              tickFormatter={formatNumber}
              width={48}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
            <ReferenceLine
              y={goal}
              stroke="#64748b"
              strokeDasharray="4 4"
              label={{ value: 'Goal', fill: '#94a3b8', fontSize: 11, position: 'insideTopRight' }}
            />
            <Bar dataKey="Self" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Rewarded" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function Dashboard({ stats, loading }) {
  if (loading) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">Loading progress…</p>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">No data yet</p>
      </section>
    )
  }


  return (
    <section className="card space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">This Week&apos;s Progress</h2>
          <p className="text-sm text-slate-400">{formatWeekRange()}</p>
        </div>
        <div className="rounded-xl bg-slate-800/80 px-4 py-2 text-right text-sm">
          <p className="text-slate-400">Available quota</p>
          <p className="font-semibold text-brand-500">
            {formatNumber(stats.available_steps)} steps · {formatNumber(stats.available_mvpa)} min MVPA
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-around gap-6">
        <ProgressRing
          label="Steps goal"
          current={stats.total_steps}
          goal={WEEKLY_GOALS.steps}
          unit="steps"
        />
        <ProgressRing
          label="MVPA goal"
          current={stats.total_mvpa}
          goal={WEEKLY_GOALS.mvpaMinutes}
          unit="min"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Breakdown (stacked bar charts)</h3>
        <div className="flex flex-col gap-6 md:flex-row">
          <MetricBarChart
            title="Steps"
            self={stats.self_steps}
            rewarded={stats.received_steps}
            goal={WEEKLY_GOALS.steps}
            unit="steps"
          />
          <MetricBarChart
            title="MVPA"
            self={stats.self_mvpa}
            rewarded={stats.received_mvpa}
            goal={WEEKLY_GOALS.mvpaMinutes}
            unit="min"
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />
            Cyan: self earned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-reward-500" />
            Yellow: received rewards
          </span>
        </div>
      </div>
    </section>
  )
}
