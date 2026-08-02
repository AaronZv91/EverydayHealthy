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
import { buildAllTimeStoryboard, buildWeekStoryboard } from '../lib/challengeStats'
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

const POINT_REVEAL_MS = 1100
const LOOP_PAUSE_MS = 1800
const ALLTIME_REVEAL_MS = 900

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
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
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
                dot={{ r: 3, strokeWidth: 0, fill: colorByKey.get(player.key) }}
                activeDot={{ r: 6 }}
                isAnimationActive
                animationDuration={750}
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

const EMPTY_BOARD = {
  players: [],
  pointLabels: [],
  periodSteps: [],
  periodMvpa: [],
  accumulatedSteps: [],
  accumulatedMvpa: [],
  firstWeek: null,
  lastWeek: null,
}

export default function WeekStoryboard({ open, onClose, challengeSource, initialRange = 'week' }) {
  const titleId = useId()
  const [range, setRange] = useState(initialRange)
  const [metric, setMetric] = useState('period')
  const [visiblePoints, setVisiblePoints] = useState(1)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef(null)

  const storyboard = useMemo(() => {
    if (!open || !challengeSource?.weekStart) return EMPTY_BOARD

    const args = {
      profiles: challengeSource.profiles ?? [],
      activities: challengeSource.activities ?? [],
      rewards: challengeSource.rewards ?? [],
      weekStart: challengeSource.weekStart,
      stepGoal: WEEKLY_GOALS.steps,
      mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
    }

    return range === 'alltime' ? buildAllTimeStoryboard(args) : buildWeekStoryboard(args)
  }, [open, challengeSource, range])

  const players = storyboard.players
  const totalPoints = storyboard.pointLabels.length
  const revealMs = range === 'alltime' ? ALLTIME_REVEAL_MS : POINT_REVEAL_MS

  const colorByKey = useMemo(() => {
    const map = new Map()
    players.forEach((player, index) => {
      map.set(player.key, PLAYER_COLORS[index % PLAYER_COLORS.length])
    })
    return map
  }, [players])

  const stepsSource =
    metric === 'period' ? storyboard.periodSteps : storyboard.accumulatedSteps
  const mvpaSource =
    metric === 'period' ? storyboard.periodMvpa : storyboard.accumulatedMvpa

  const visibleSteps = useMemo(
    () => stepsSource.slice(0, Math.max(1, visiblePoints)),
    [stepsSource, visiblePoints]
  )
  const visibleMvpa = useMemo(
    () => mvpaSource.slice(0, Math.max(1, visiblePoints)),
    [mvpaSource, visiblePoints]
  )

  const stepsYMax = useMemo(() => {
    let max = 0
    for (const point of stepsSource) {
      for (const player of players) {
        max = Math.max(max, Number(point[player.key]) || 0)
      }
    }
    return Math.max(max, 1)
  }, [stepsSource, players])

  const mvpaYMax = useMemo(() => {
    let max = 0
    for (const point of mvpaSource) {
      for (const player of players) {
        max = Math.max(max, Number(point[player.key]) || 0)
      }
    }
    return Math.max(max, 1)
  }, [mvpaSource, players])

  const currentLabel = storyboard.pointLabels[Math.max(0, visiblePoints - 1)] ?? '—'

  useEffect(() => {
    if (!open) return
    setRange(initialRange === 'alltime' ? 'alltime' : 'week')
    setVisiblePoints(1)
    setPlaying(true)
    setMetric('period')
  }, [open, initialRange])

  useEffect(() => {
    setVisiblePoints(1)
    setPlaying(true)
  }, [range])

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!open || !playing || totalPoints === 0) return undefined

    const delay = visiblePoints >= totalPoints ? LOOP_PAUSE_MS : revealMs
    timerRef.current = window.setTimeout(() => {
      setVisiblePoints((current) => (current >= totalPoints ? 1 : current + 1))
    }, delay)

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [open, playing, visiblePoints, totalPoints, revealMs])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setVisiblePoints((current) => Math.min(totalPoints, current + 1))
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setVisiblePoints((current) => Math.max(1, current - 1))
      }
      if (event.key === 'p' || event.key === 'P') {
        setPlaying((value) => !value)
      }
      if (event.key === 'r' || event.key === 'R') {
        setVisiblePoints(1)
        setPlaying(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, totalPoints])

  if (!open) return null

  const isAllTime = range === 'alltime'
  const periodLabel = isAllTime ? 'Weekly totals' : 'Daily logged'
  const accumulatedLabel = isAllTime ? 'Career accumulated' : 'Week accumulated'
  const stepsTitle =
    metric === 'period'
      ? isAllTime
        ? 'Steps per week'
        : 'Steps logged per day'
      : isAllTime
        ? 'Steps career total'
        : 'Steps accumulated'
  const mvpaTitle =
    metric === 'period'
      ? isAllTime
        ? 'MVPA per week'
        : 'MVPA logged per day'
      : isAllTime
        ? 'MVPA career total'
        : 'MVPA accumulated'

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
            {isAllTime ? 'All-time storyboard' : 'Week storyboard'} · all players
          </h1>
          <p className="text-xs text-slate-500">
            {isAllTime
              ? `${storyboard.pointLabels.length} weeks · first record → now`
              : formatWeekRange()}{' '}
            · animating{' '}
            <span className="font-medium text-cyan-300">{currentLabel}</span> ({visiblePoints}/
            {Math.max(totalPoints, 1)}) · ← → · P · R
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setRange('week')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                range === 'week' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setRange('alltime')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                range === 'alltime'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All-time
            </button>
          </div>
          <div className="flex rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setMetric('period')}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                metric === 'period'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {periodLabel}
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
              {accumulatedLabel}
            </button>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => {
              setVisiblePoints(1)
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
                key={`steps-${range}-${metric}-${visiblePoints}`}
                title={stepsTitle}
                data={visibleSteps}
                players={players}
                unit="steps"
                colorByKey={colorByKey}
                yMax={stepsYMax}
              />
              <MultiPlayerLineChart
                key={`mvpa-${range}-${metric}-${visiblePoints}`}
                title={mvpaTitle}
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
        <div className="mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto pb-1">
          {storyboard.pointLabels.map((label, pointIndex) => {
            const pointNumber = pointIndex + 1
            const active = pointNumber === visiblePoints
            const revealed = pointNumber <= visiblePoints
            return (
              <button
                key={`${label}-${pointIndex}`}
                type="button"
                className={`shrink-0 rounded-lg px-2 py-2 text-center text-[10px] font-medium transition sm:text-xs ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50'
                    : revealed
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-900 text-slate-600'
                }`}
                onClick={() => setVisiblePoints(pointNumber)}
              >
                {label}
              </button>
            )
          })}
        </div>
        {playing && totalPoints > 0 && (
          <div className="mx-auto mt-2 h-0.5 max-w-6xl overflow-hidden rounded-full bg-slate-800">
            <div
              key={`${range}-${visiblePoints}-${playing}`}
              className="storyboard-progress h-full bg-cyan-400"
              style={{
                animationDuration: `${visiblePoints >= totalPoints ? LOOP_PAUSE_MS : revealMs}ms`,
              }}
            />
          </div>
        )}
      </footer>
    </div>
  )
}
