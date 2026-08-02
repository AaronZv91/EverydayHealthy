import { useEffect, useId, useMemo, useRef, useState } from 'react'
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

/** Seconds to travel one segment (day or week). */
const SEGMENT_SECONDS = 1.15
const ALLTIME_SEGMENT_SECONDS = 0.55

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function sampleSeries(series, playerKey, progress) {
  if (!series.length) return 0
  const maxIndex = series.length - 1
  const clamped = Math.max(0, Math.min(progress, maxIndex))
  const left = Math.floor(clamped)
  const right = Math.min(maxIndex, left + 1)
  const frac = easeInOutCubic(clamped - left)
  const a = Number(series[left]?.[playerKey]) || 0
  const b = Number(series[right]?.[playerKey]) || 0
  return a + (b - a) * frac
}

function computeYMax(series, players) {
  let max = 0
  for (const point of series) {
    for (const player of players) {
      max = Math.max(max, Number(point[player.key]) || 0)
    }
  }
  return Math.max(max, 1)
}

/**
 * HTML5 Canvas multi-player line chart with continuous draw animation.
 * `progress` is a float from 0 .. (n-1) shared across charts.
 */
function SmoothCanvasChart({ title, unit, series, players, colorByKey, progress, yMax }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap || !series.length) return undefined

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssWidth = wrap.clientWidth
      const cssHeight = Math.max(wrap.clientHeight, 240)
      canvas.width = Math.floor(cssWidth * dpr)
      canvas.height = Math.floor(cssHeight * dpr)
      canvas.style.width = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const pad = { top: 18, right: 16, bottom: 36, left: 52 }
      const plotW = cssWidth - pad.left - pad.right
      const plotH = cssHeight - pad.top - pad.bottom
      const maxIndex = Math.max(series.length - 1, 1)
      const yCeiling = Math.max(yMax, 1)

      const xAt = (index) => pad.left + (index / maxIndex) * plotW
      const yAt = (value) => pad.top + plotH - (value / yCeiling) * plotH

      ctx.clearRect(0, 0, cssWidth, cssHeight)

      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)'
      ctx.fillRect(pad.left, pad.top, plotW, plotH)

      ctx.strokeStyle = 'rgba(30, 41, 59, 0.95)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i += 1) {
        const y = pad.top + (plotH * i) / 4
        ctx.beginPath()
        ctx.moveTo(pad.left, y)
        ctx.lineTo(pad.left + plotW, y)
        ctx.stroke()

        const tick = Math.round(yCeiling * (1 - i / 4))
        ctx.fillStyle = '#64748b'
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatNumber(tick), pad.left - 8, y)
      }

      const labelStep = Math.max(1, Math.ceil(series.length / 8))
      ctx.fillStyle = '#64748b'
      ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      series.forEach((point, index) => {
        if (index % labelStep !== 0 && index !== series.length - 1) return
        ctx.fillText(String(point.name), xAt(index), pad.top + plotH + 10)
      })

      const drawProgress = Math.max(0, Math.min(progress, maxIndex))

      for (const player of players) {
        const color = colorByKey.get(player.key)
        ctx.save()
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.18
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        let started = false
        const steps = Math.max(24, Math.ceil(drawProgress * 24))
        for (let s = 0; s <= steps; s += 1) {
          const t = (s / steps) * drawProgress
          const x = xAt(t)
          const y = yAt(sampleSeries(series, player.key, t))
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        ctx.restore()
      }

      for (const player of players) {
        const color = colorByKey.get(player.key)
        ctx.strokeStyle = color
        ctx.lineWidth = 2.6
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        let started = false
        const steps = Math.max(32, Math.ceil(drawProgress * 32))
        for (let s = 0; s <= steps; s += 1) {
          const t = (s / steps) * drawProgress
          const x = xAt(t)
          const y = yAt(sampleSeries(series, player.key, t))
          if (!started) {
            ctx.moveTo(x, y)
            started = true
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()

        const headX = xAt(drawProgress)
        const headY = yAt(sampleSeries(series, player.key, drawProgress))
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.arc(headX, headY, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.arc(headX, headY, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }

      const playX = xAt(drawProgress)
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(playX, pad.top)
      ctx.lineTo(playX, pad.top + plotH)
      ctx.stroke()
      ctx.setLineDash([])
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [series, players, colorByKey, progress, yMax])

  function handlePointer(event) {
    const wrap = wrapRef.current
    if (!wrap || !series.length) return
    const rect = wrap.getBoundingClientRect()
    const padLeft = 52
    const padRight = 16
    const plotW = rect.width - padLeft - padRight
    const x = event.clientX - rect.left - padLeft
    const ratio = Math.max(0, Math.min(1, x / plotW))
    const index = Math.round(ratio * (series.length - 1))
    const point = series[index]
    if (!point) {
      setHover(null)
      return
    }
    const rows = players
      .map((player) => ({
        name: player.displayName,
        value: Number(point[player.key]) || 0,
        color: colorByKey.get(player.key),
      }))
      .sort((a, b) => b.value - a.value)
    setHover({ label: point.name, rows, left: event.clientX - rect.left, top: event.clientY - rect.top })
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100 sm:text-base">{title}</h3>
        <p className="text-xs text-slate-500">{unit}</p>
      </div>
      <div
        ref={wrapRef}
        className="relative min-h-[240px] flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40"
        onMouseMove={handlePointer}
        onMouseLeave={() => setHover(null)}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl"
            style={{
              left: Math.min(hover.left + 12, (wrapRef.current?.clientWidth ?? 320) - 180),
              top: Math.max(8, hover.top - 8),
            }}
          >
            <p className="mb-1 font-medium text-slate-200">{hover.label}</p>
            {hover.rows.map((row) => (
              <p key={row.name} className="tabular-nums" style={{ color: row.color }}>
                {row.name}: {formatNumber(row.value)} {unit}
              </p>
            ))}
          </div>
        )}
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
}

export default function WeekStoryboard({ open, onClose, challengeSource, initialRange = 'week' }) {
  const titleId = useId()
  const [range, setRange] = useState(initialRange)
  const [metric, setMetric] = useState('period')
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const [finished, setFinished] = useState(false)
  const progressRef = useRef(0)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)

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
  const maxProgress = Math.max(storyboard.pointLabels.length - 1, 0)

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

  const stepsYMax = useMemo(() => computeYMax(stepsSource, players), [stepsSource, players])
  const mvpaYMax = useMemo(() => computeYMax(mvpaSource, players), [mvpaSource, players])

  const currentIndex = Math.min(maxProgress, Math.round(progress))
  const currentLabel = storyboard.pointLabels[currentIndex] ?? '—'
  const pctComplete = maxProgress > 0 ? Math.round((progress / maxProgress) * 100) : 0

  const segmentSeconds = range === 'alltime' ? ALLTIME_SEGMENT_SECONDS : SEGMENT_SECONDS

  useEffect(() => {
    if (!open) return
    setRange(initialRange === 'alltime' ? 'alltime' : 'week')
    setMetric('period')
    setPlaying(true)
    setFinished(false)
    progressRef.current = 0
    setProgress(0)
  }, [open, initialRange])

  useEffect(() => {
    progressRef.current = 0
    setProgress(0)
    setFinished(false)
    setPlaying(true)
  }, [range, metric])

  useEffect(() => {
    if (!open) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return undefined
    }

    lastTsRef.current = 0

    const tick = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000)
      lastTsRef.current = ts

      if (playing && maxProgress > 0 && !finished) {
        if (progressRef.current >= maxProgress - 0.0001) {
          progressRef.current = maxProgress
          setProgress(maxProgress)
          setFinished(true)
          setPlaying(false)
        } else {
          progressRef.current = Math.min(maxProgress, progressRef.current + dt / segmentSeconds)
          setProgress(progressRef.current)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [open, playing, maxProgress, range, metric, finished, segmentSeconds])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setFinished(false)
        progressRef.current = Math.min(maxProgress, progressRef.current + 1)
        setProgress(progressRef.current)
        if (progressRef.current >= maxProgress) {
          setFinished(true)
          setPlaying(false)
        }
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setFinished(false)
        progressRef.current = Math.max(0, progressRef.current - 1)
        setProgress(progressRef.current)
      }
      if (event.key === 'p' || event.key === 'P') {
        if (finished) {
          progressRef.current = 0
          setProgress(0)
          setFinished(false)
          setPlaying(true)
        } else {
          setPlaying((value) => !value)
        }
      }
      if (event.key === 'r' || event.key === 'R') {
        progressRef.current = 0
        setProgress(0)
        setFinished(false)
        setPlaying(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, maxProgress, finished])

  if (!open) return null

  const isAllTime = range === 'alltime'
  const periodLabel = 'Daily logged'
  const accumulatedLabel = isAllTime ? 'Career accumulated' : 'Week accumulated'
  const stepsTitle =
    metric === 'period'
      ? 'Steps logged per day'
      : isAllTime
        ? 'Steps career total'
        : 'Steps accumulated'
  const mvpaTitle =
    metric === 'period'
      ? 'MVPA logged per day'
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
            {isAllTime ? 'All-time storyboard' : 'Week storyboard'} · canvas animation
          </h1>
          <p className="text-xs text-slate-500">
            {isAllTime
              ? `${storyboard.pointLabels.length} days · first record → today`
              : formatWeekRange()}{' '}
            · <span className="font-medium text-cyan-300">{currentLabel}</span> · {pctComplete}%
            {finished ? ' · finished' : ''} · ← → · P · R
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
              progressRef.current = 0
              setProgress(0)
              setFinished(false)
              setPlaying(true)
            }}
          >
            Restart
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => {
              if (finished) {
                progressRef.current = 0
                setProgress(0)
                setFinished(false)
                setPlaying(true)
                return
              }
              setPlaying((value) => !value)
            }}
          >
            {finished ? 'Replay' : playing ? 'Pause' : 'Play'}
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
            <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
              <SmoothCanvasChart
                title={stepsTitle}
                unit="steps"
                series={stepsSource}
                players={players}
                colorByKey={colorByKey}
                progress={progress}
                yMax={stepsYMax}
              />
              <SmoothCanvasChart
                title={mvpaTitle}
                unit="min"
                series={mvpaSource}
                players={players}
                colorByKey={colorByKey}
                progress={progress}
                yMax={mvpaYMax}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
              {players.map((player) => {
                const liveSteps = sampleSeries(stepsSource, player.key, progress)
                const liveMvpa = sampleSeries(mvpaSource, player.key, progress)
                return (
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
                      {formatNumber(Math.round(liveSteps))} · {formatNumber(Math.round(liveMvpa))}m
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <footer className="relative z-10 border-t border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <input
            type="range"
            min={0}
            max={maxProgress || 0}
            step={0.01}
            value={progress}
            onChange={(event) => {
              const next = Number(event.target.value)
              progressRef.current = next
              setProgress(next)
              if (next >= maxProgress - 0.0001) {
                setFinished(true)
                setPlaying(false)
              } else {
                setFinished(false)
              }
            }}
            className="storyboard-scrubber w-full"
            aria-label="Scrub storyboard timeline"
          />
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500 sm:text-xs">
            <span>{storyboard.pointLabels[0] ?? '—'}</span>
            <span className="font-medium text-cyan-300/90">{currentLabel}</span>
            <span>{storyboard.pointLabels[storyboard.pointLabels.length - 1] ?? '—'}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
