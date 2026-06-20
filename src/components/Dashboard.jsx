import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber, formatPercent, formatWeekRange } from '../lib/weekUtils'

const PIE_COLORS = {
  self: '#06b6d4',
  received: '#eab308',
  remaining: '#334155',
}

function buildGoalPieData(self, received, goal) {
  const selfValue = self ?? 0
  const receivedValue = received ?? 0
  const total = selfValue + receivedValue

  if (total >= goal) {
    return [
      { name: 'Self', value: selfValue, color: PIE_COLORS.self },
      { name: 'Received', value: receivedValue, color: PIE_COLORS.received },
    ]
  }

  return [
    { name: 'Self', value: selfValue, color: PIE_COLORS.self },
    { name: 'Received', value: receivedValue, color: PIE_COLORS.received },
    { name: 'Remaining', value: goal - total, color: PIE_COLORS.remaining },
  ]
}

function GoalPieTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.payload.color }}>
          {entry.name}: {formatNumber(entry.value)} {unit}
        </p>
      ))}
    </div>
  )
}

function GoalPieChart({ title, self, received, goal, unit }) {
  const selfValue = self ?? 0
  const receivedValue = received ?? 0
  const total = selfValue + receivedValue
  const pct = formatPercent(total, goal)
  const isComplete = total >= goal
  const data = buildGoalPieData(selfValue, receivedValue, goal)

  return (
    <div className="flex min-w-[10rem] flex-1 flex-col items-center">
      <h4 className="mb-1 text-sm font-semibold text-slate-300">{title}</h4>
      <p className="mb-2 text-xs text-slate-500">
        Goal {formatNumber(goal)} {unit}
      </p>
      <div className="relative h-44 w-full max-w-[11rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<GoalPieTooltip unit={unit} />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              formatter={(value) => <span className="text-slate-400">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
          <span
            className={`text-xl font-bold ${isComplete ? 'text-emerald-400' : 'text-slate-100'}`}
          >
            {pct}%
          </span>
          {isComplete && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
              Complete
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-center text-xs text-slate-500">
        {formatNumber(total)} / {formatNumber(goal)} {unit}
      </p>
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

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Weekly goals</h3>
        <div className="flex flex-wrap justify-around gap-4">
          <GoalPieChart
            title="Steps"
            self={stats.net_self_steps ?? 0}
            received={stats.received_steps ?? 0}
            goal={WEEKLY_GOALS.steps}
            unit="steps"
          />
          <GoalPieChart
            title="MVPA"
            self={stats.net_self_mvpa ?? 0}
            received={stats.received_mvpa ?? 0}
            goal={WEEKLY_GOALS.mvpaMinutes}
            unit="min"
          />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />
            Cyan: net self (earned − sent)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-reward-500" />
            Yellow: received rewards
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-600" />
            Gray: remaining to goal
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Breakdown (stacked bar charts)</h3>
        <div className="flex flex-col gap-6 md:flex-row">
          <MetricBarChart
            title="Steps"
            self={stats.net_self_steps ?? 0}
            rewarded={stats.received_steps ?? 0}
            goal={WEEKLY_GOALS.steps}
            unit="steps"
          />
          <MetricBarChart
            title="MVPA"
            self={stats.net_self_mvpa ?? 0}
            rewarded={stats.received_mvpa ?? 0}
            goal={WEEKLY_GOALS.mvpaMinutes}
            unit="min"
          />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />
            Cyan: net self (earned − sent)
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
