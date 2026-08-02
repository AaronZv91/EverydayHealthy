import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { buildWeekStoryboard } from '../lib/challengeStats'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber, formatWeekRange } from '../lib/weekUtils'

const PLAYER_COLORS = [
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#60a5fa',
  '#fb923c',
  '#e879f9',
  '#4ade80',
  '#f87171',
  '#38bdf8',
  '#c084fc',
]

const DAY_REVEAL_MS = 1100
const LOOP_PAUSE_MS = 1800

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null

  const rows = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-sm shadow-xl backdrop-blur">
      <p className="mb-1.5 font-medium text-slate-200">{label}</p>
      {rows.map((entry) => (
        <p key={entry.dataKey} className="tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {formatNumber(entry.value)}
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  )
}

function MultiPlayerLineChart({ title, data, players, unit, colorByKey, yMax }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100 sm:text-base">{title}</h3>
        <p className="text-xs text-slate-500">{unit}</p>
      </div>
      <div className="min-h-[220px] flex-1 rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 sm:min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, Math.max(yMax, 1)]}
              stroke="#64748b"
              fontSize={11}
              width={48}
              tickFormatter={formatNumber}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip unit={unit} />} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
              iconType="circle"
            />
            {players.map((player) => (
              <Line
                key={player.key}
                type="monotone"
                dataKey={player.key}
                name={player.displayName}
                stroke={colorByKey.get(player.key)}
                strokeWidth={2.5}
                dot={{ r: 3.5, strokeWidth: 0, fill: colorByKey.get(player.key) }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={850}
                animationEasing="ease-out"
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function WeekStoryboard({ open, onClose, challengeSource }) {
  const titleId = useId()
  const [metric, setMetric] = useState('daily')
  const [visibleDays, setVisibleDays] = useState(1)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef(null)

  const storyboard = useMemo(() => {
    if (!open || !challengeSource?.weekStart) {
      return {
        players: [],
        dayLabels: [],
        dailySteps: [],
        dailyMvpa: [],
        accumulatedSteps: [],
        accumulatedMvpa: [],
      }
    }
    return buildWeekStoryboard({
      profiles: challengeSource.profiles ?? [],
      activities: challengeSource.activities ?? [],
      rewards: challengeSource.rewards ?? [],
      weekStart: challengeSource.weekStart,
      stepGoal: WEEKLY_GOALS.steps,
      mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
    })
  }, [open, challengeSource])

  const players = storyboard.players
  const totalDays = storyboard.dayLabels.length

  const colorByKey = useMemo(() => {
    const map = new Map()
    players.forEach((player, index) => {
      map.set(player.key, PLAYER_COLORS[index % PLAYER_COLORS.length])
    })
    return map
  }, [players])

  const stepsSource =
    metric === 'daily' ? storyboard.dailySteps : storyboard.accumulatedSteps
  const mvpaSource = metric === 'daily' ? storyboard.dailyMvpa : storyboard.accumulatedMvpa

  const visibleSteps = useMemo(
    () => stepsSource.slice(0, Math.max(1, visibleDays)),
    [stepsSource, visibleDays]
  )
  const visibleMvpa = useMemo(
    () => mvpaSource.slice(0, Math.max(1, visibleDays)),
    [mvpaSource, visibleDays]
  )

  const stepsYMax = useMemo(() => {
    let max = 0
    for (const point of stepsSource) {
      for (const player of players) {
        max = Math.max(max, Number(point[player.key]) || 0)
      }
    }
    if (metric === 'accumulated') max = Math.max(max, WEEKLY_GOALS.steps * 0.25)
    return Math.max(max, 1)
  }, [stepsSource, players, metric])

  const mvpaYMax = useMemo(() => {
    let max = 0
    for (const point of mvpaSource) {
      for (const player of players) {
        max = Math.max(max, Number(point[player.key]) || 0)
      }
    }
    if (metric === 'accumulated') max = Math.max(max, WEEKLY_GOALS.mvpaMinutes * 0.25)
    return Math.max(max, 1)
  }, [mvpaSource, players, metric])

  const currentDayLabel = storyboard.dayLabels[Math.max(0, visibleDays - 1)] ?? '—'

  useEffect(() => {
    if (!open) return
    setVisibleDays(1)
    setPlaying(true)
    setMetric('daily')
  }, [open])

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!open || !playing || totalDays === 0) return undefined

    const delay = visibleDays >= totalDays ? LOOP_PAUSE_MS : DAY_REVEAL_MS
    timerRef.current = window.setTimeout(() => {
      setVisibleDays((current) => (current >= totalDays ? 1 : current + 1))
    }, delay)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [open, playing, visibleDays, totalDays])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setVisibleDays((current) => Math.min(totalDays, current + 1))
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setVisibleDays((current) => Math.max(1, current - 1))
      }
      if (event.key === 'p' || event.key === 'P') {
        setPlaying((value) => !value)
      }
      if (event.key === 'r' || event.key === 'R') {
        setVisibleDays(1)
        setPlaying(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, totalDays])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(167,139,250,0.1),_transparent_50%)]" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 id={titleId} className="truncate text-sm font-semibold text-white sm:text-base">
            Week storyboard · all players
          </h1>
          <p className="text-xs text-slate-500">
            {formatWeekRange()} · animating through{' '}
            <span className="font-medium text-cyan-300">{currentDayLabel}</span> ({visibleDays}/
            {Math.max(totalDays, 1)}) · ← → · P · R restart
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setMetric('daily')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                metric === 'daily' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily logged
            </button>
            <button
              type="button"
              onClick={() => setMetric('accumulated')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                metric === 'accumulated'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Accumulated
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => {
              setVisibleDays(1)
              setPlaying(true)
            }}
          >
            Restart
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={onClose}>
            Exit
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden px-3 py-4 sm:px-6">
        {players.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-slate-500">No player data yet</p>
        ) : (
          <>
            <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row">
              <MultiPlayerLineChart
                key={`steps-${metric}-${visibleDays}`}
                title={metric === 'daily' ? 'Steps logged per day' : 'Steps accumulated'}
                data={visibleSteps}
                players={players}
                unit="steps"
                colorByKey={colorByKey}
                yMax={stepsYMax}
              />
              <MultiPlayerLineChart
                key={`mvpa-${metric}-${visibleDays}`}
                title={metric === 'daily' ? 'MVPA logged per day' : 'MVPA accumulated'}
                data={visibleMvpa}
                players={players}
                unit="min"
                colorByKey={colorByKey}
                yMax={mvpaYMax}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
              {players.map((player) => (
                <div
                  key={player.userId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/70 px-2.5 py-1 text-xs"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colorByKey.get(player.key) }}
                  />
                  <span className="font-medium text-slate-200">{player.displayName}</span>
                  <span className="tabular-nums text-slate-500">
                    {formatNumber(player.totalSteps)} · {formatNumber(player.totalMvpa)}m
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="relative z-10 border-t border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          {storyboard.dayLabels.map((label, dayIndex) => {
            const dayNumber = dayIndex + 1
            const active = dayNumber === visibleDays
            const revealed = dayNumber <= visibleDays
            return (
              <button
                key={label}
                type="button"
                className={`min-w-0 flex-1 rounded-lg px-1 py-2 text-center text-xs font-medium transition ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
                    : revealed
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-900 text-slate-600'
                }`}
                onClick={() => setVisibleDays(dayNumber)}
              >
                {label}
              </button>
            )
          })}
        </div>
        {playing && totalDays > 0 && (
          <div className="mx-auto mt-2 h-0.5 max-w-6xl overflow-hidden rounded-full bg-slate-800">
            <div
              key={`${visibleDays}-${playing}`}
              className="storyboard-progress h-full bg-cyan-400"
              style={{ animationDuration: `${visibleDays >= totalDays ? LOOP_PAUSE_MS : DAY_REVEAL_MS}ms` }}
            />
          </div>
        )}
      </footer>
    </div>
  )
}
