import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-xl">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}：{formatNumber(entry.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard({ stats, loading }) {
  if (loading) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">載入進度中…</p>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">尚無數據</p>
      </section>
    )
  }

  const chartData = [
    {
      name: '步數',
      自己跑的: stats.self_steps ?? 0,
      被打賞的: stats.received_steps ?? 0,
    },
    {
      name: 'MVPA',
      自己跑的: stats.self_mvpa ?? 0,
      被打賞的: stats.received_mvpa ?? 0,
    },
  ]

  return (
    <section className="card space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">本週進度</h2>
          <p className="text-sm text-slate-400">{formatWeekRange()}</p>
        </div>
        <div className="rounded-xl bg-slate-800/80 px-4 py-2 text-right text-sm">
          <p className="text-slate-400">可用額度</p>
          <p className="font-semibold text-brand-500">
            {formatNumber(stats.available_steps)} 步 · {formatNumber(stats.available_mvpa)} 分 MVPA
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-around gap-6">
        <ProgressRing
          label="步數目標"
          current={stats.total_steps}
          goal={WEEKLY_GOALS.steps}
          unit="步"
        />
        <ProgressRing
          label="MVPA 目標"
          current={stats.total_mvpa}
          goal={WEEKLY_GOALS.mvpaMinutes}
          unit="分"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">數據組成（堆疊長條圖）</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              <Bar dataKey="自己跑的" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
              <Bar dataKey="被打賞的" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-500" />
            青色：自己跑的
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-reward-500" />
            黃色：被打賞的
          </span>
        </div>
      </div>
    </section>
  )
}
