import { useEffect, useId, useMemo, useState } from 'react'
import { buildWeekStoryboard } from '../lib/challengeStats'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber, formatWeekRange } from '../lib/weekUtils'

const SLIDE_MS = 4500

function PlayerDayRow({ row, maxSteps, maxMvpa, index }) {
  const stepsWidth = Math.max(2, Math.round((row.steps / maxSteps) * 100))
  const mvpaWidth = Math.max(2, Math.round((row.mvpa / maxMvpa) * 100))

  return (
    <div
      className="storyboard-row rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-3 sm:px-4"
      style={{ animationDelay: `${120 + index * 90}ms` }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="truncate text-base font-semibold text-white sm:text-lg">{row.displayName}</p>
        <p className="shrink-0 text-xs tabular-nums text-slate-400 sm:text-sm">
          {row.active ? (
            <>
              <span className="text-cyan-300">{formatNumber(row.steps)}</span>
              <span className="text-slate-600"> · </span>
              <span className="text-violet-300">{formatNumber(row.mvpa)} min</span>
            </>
          ) : (
            <span className="text-slate-600">No log</span>
          )}
        </p>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
            <span>Steps</span>
            <span>{formatNumber(row.steps)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="storyboard-bar h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300"
              style={{
                width: row.steps > 0 ? `${stepsWidth}%` : '0%',
                animationDelay: `${180 + index * 90}ms`,
              }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-slate-500">
            <span>MVPA</span>
            <span>{formatNumber(row.mvpa)} min</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="storyboard-bar h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-300"
              style={{
                width: row.mvpa > 0 ? `${mvpaWidth}%` : '0%',
                animationDelay: `${240 + index * 90}ms`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function IntroSlide({ slide }) {
  return (
    <div className="storyboard-slide flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/90">
        EverydayHealthy
      </p>
      <h2 className="text-3xl font-bold text-white sm:text-5xl">{slide.title}</h2>
      <p className="mt-3 text-base text-slate-300 sm:text-xl">{slide.subtitle}</p>
      <p className="mt-6 text-sm text-slate-500">{formatWeekRange()}</p>
      <p className="mt-2 text-sm text-slate-400">{slide.playerCount} players · Mon–Sun SGT</p>
    </div>
  )
}

function DaySlide({ slide }) {
  return (
    <div className="storyboard-slide flex h-full flex-col px-4 py-2 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Daily logs
          </p>
          <h2 className="text-3xl font-bold text-white sm:text-4xl">{slide.dayLabel}</h2>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>
            Group:{' '}
            <span className="tabular-nums text-cyan-300">{formatNumber(slide.totalSteps)}</span> steps
            · <span className="tabular-nums text-violet-300">{formatNumber(slide.totalMvpa)}</span> MVPA
          </p>
          <p className="text-xs text-slate-500">
            {slide.activeCount}/{slide.rows.length} logged
          </p>
        </div>
      </div>
      <div className="storyboard-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {slide.rows.map((row, index) => (
          <PlayerDayRow
            key={row.userId}
            row={row}
            maxSteps={slide.maxDailySteps}
            maxMvpa={slide.maxDailyMvpa}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

function FinaleSlide({ slide }) {
  return (
    <div className="storyboard-slide flex h-full flex-col px-4 py-2 sm:px-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Finale</p>
        <h2 className="text-3xl font-bold text-white sm:text-4xl">{slide.title}</h2>
        <p className="mt-1 text-sm text-slate-400">Combined goal progress ranking</p>
      </div>
      <div className="storyboard-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {slide.players.map((player, index) => (
          <div
            key={player.userId}
            className="storyboard-row flex items-center gap-3 rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-3 sm:px-4"
            style={{ animationDelay: `${100 + index * 80}ms` }}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                player.rank === 1
                  ? 'bg-amber-400 text-slate-900'
                  : player.rank === 2
                    ? 'bg-slate-400 text-slate-900'
                    : player.rank === 3
                      ? 'bg-amber-800 text-white'
                      : 'bg-slate-800 text-slate-300'
              }`}
            >
              {player.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{player.displayName}</p>
              <p className="text-xs tabular-nums text-slate-400">
                {formatNumber(player.totalSteps)} steps · {formatNumber(player.totalMvpa)} MVPA
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-cyan-300">{player.combinedPct}%</p>
              <p className="text-[10px] text-slate-500">combined</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function WeekStoryboard({ open, onClose, challengeSource }) {
  const titleId = useId()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)

  const storyboard = useMemo(() => {
    if (!open || !challengeSource?.weekStart) {
      return { slides: [] }
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

  const slides = storyboard.slides
  const slide = slides[index] ?? null
  const total = slides.length

  useEffect(() => {
    if (!open) return
    setIndex(0)
    setPlaying(true)
  }, [open])

  useEffect(() => {
    if (!open || !playing || total === 0) return undefined
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % total)
    }, SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [open, playing, index, total])

  useEffect(() => {
    if (!open) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setIndex((current) => (current + 1) % Math.max(total, 1))
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setIndex((current) => (current - 1 + total) % Math.max(total, 1))
      }
      if (event.key === 'p' || event.key === 'P') {
        setPlaying((value) => !value)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, total])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(167,139,250,0.1),_transparent_50%)]" />

      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 id={titleId} className="truncate text-sm font-semibold text-white sm:text-base">
            Presentation storyboard
          </h1>
          <p className="text-xs text-slate-500">
            {total > 0 ? `Slide ${index + 1} / ${total}` : 'No data'} · ← → · Space · P pause
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden px-2 py-4 sm:px-4">
        {slide?.type === 'intro' && <IntroSlide key={slide.id} slide={slide} />}
        {slide?.type === 'day' && <DaySlide key={slide.id} slide={slide} />}
        {slide?.type === 'finale' && <FinaleSlide key={slide.id} slide={slide} />}
        {!slide && (
          <p className="flex flex-1 items-center justify-center text-slate-500">
            No storyboard data yet
          </p>
        )}
      </div>

      <footer className="relative z-10 border-t border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setIndex((current) => (current - 1 + total) % Math.max(total, 1))}
            disabled={total === 0}
          >
            Prev
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
            {slides.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Go to slide ${slideIndex + 1}`}
                className={`h-1.5 w-6 shrink-0 rounded-full transition ${
                  slideIndex === index ? 'bg-cyan-400' : 'bg-slate-700 hover:bg-slate-500'
                }`}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setIndex((current) => (current + 1) % Math.max(total, 1))}
            disabled={total === 0}
          >
            Next
          </button>
        </div>
        {playing && total > 0 && (
          <div className="mx-auto mt-2 h-0.5 max-w-5xl overflow-hidden rounded-full bg-slate-800">
            <div key={`${index}-${playing}`} className="storyboard-progress h-full bg-cyan-400" />
          </div>
        )}
      </footer>
    </div>
  )
}
