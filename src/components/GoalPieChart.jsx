import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatNumber, formatPercent } from '../lib/weekUtils'

const PIE_COLORS = {
  self: '#06b6d4',
  received: '#eab308',
  remaining: '#334155',
}

export function buildGoalPieData(self, received, goal) {
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

export default function GoalPieChart({ title, self, received, goal, unit, compact = false }) {
  const selfValue = self ?? 0
  const receivedValue = received ?? 0
  const total = selfValue + receivedValue
  const pct = formatPercent(total, goal)
  const isComplete = total >= goal
  const data = buildGoalPieData(selfValue, receivedValue, goal)

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>
        <div className="relative h-[4.5rem] w-full max-w-[5.5rem]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="48%"
                outerRadius="78%"
                paddingAngle={data.length > 1 ? 1 : 0}
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<GoalPieTooltip unit={unit} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-xs font-bold leading-none ${isComplete ? 'text-emerald-400' : 'text-slate-100'}`}
            >
              {pct}%
            </span>
            {isComplete && (
              <span className="mt-0.5 text-[8px] font-semibold uppercase text-emerald-400">Done</span>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-center text-[10px] tabular-nums text-slate-500">
          {formatNumber(total)}/{formatNumber(goal)}
        </p>
      </div>
    )
  }

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
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
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

export { PIE_COLORS }
