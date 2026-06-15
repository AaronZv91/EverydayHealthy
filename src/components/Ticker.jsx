import { useEffect, useRef, useState } from 'react'
import { formatDateTime, formatNumber } from '../lib/weekUtils'

const AUTO_SCROLL_SPEED = 1.2
const DRAG_THRESHOLD = 6

function RewardDetails({ reward, compact = false }) {
  const sender = reward.sender?.display_name ?? 'Unknown'
  const receiver = reward.receiver?.display_name ?? 'Unknown'
  const parts = []
  if (reward.steps > 0) parts.push(`${formatNumber(reward.steps)} steps`)
  if (reward.mvpa_minutes > 0) parts.push(`${formatNumber(reward.mvpa_minutes)} min`)

  if (compact) {
    return (
      <span className="mx-4 inline-flex shrink-0 items-center gap-3 rounded-full border border-amber-400/50 bg-amber-400/15 px-5 py-2 shadow-lg shadow-amber-900/30 backdrop-blur-sm">
        <span className="text-2xl leading-none" aria-hidden>
          {reward.emoji}
        </span>
        <span className="whitespace-nowrap text-base font-semibold text-white">
          <span className="text-amber-300">{sender}</span>
          <span className="mx-1.5 text-amber-500/80">→</span>
          <span className="text-yellow-200">{receiver}</span>
        </span>
        <span className="whitespace-nowrap rounded-lg bg-amber-400/20 px-2.5 py-0.5 text-sm font-medium text-amber-100">
          &ldquo;{reward.item_name}&rdquo;
        </span>
        {parts.length > 0 && (
          <span className="whitespace-nowrap text-sm font-bold text-amber-400">
            {parts.join(' · ')}
          </span>
        )}
      </span>
    )
  }

  return (
    <li className="flex gap-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-3xl">
        {reward.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">
          <span className="text-amber-300">{sender}</span>
          <span className="mx-1.5 text-amber-500/70">→</span>
          <span className="text-yellow-200">{receiver}</span>
        </p>
        <p className="mt-1 text-sm text-amber-100">&ldquo;{reward.item_name}&rdquo;</p>
        {parts.length > 0 && (
          <p className="mt-1 text-sm font-bold text-amber-400">{parts.join(' · ')}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">{formatDateTime(reward.created_at)}</p>
      </div>
    </li>
  )
}

function RewardsModal({ rewards, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewards-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close rewards feed"
        onClick={onClose}
      />

      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-amber-400/40 bg-slate-900 shadow-2xl shadow-amber-900/30">
        <div className="flex items-center justify-between border-b border-amber-400/20 bg-amber-950/50 px-5 py-4">
          <div>
            <h2 id="rewards-modal-title" className="text-lg font-bold text-white">
              Recent Rewards
            </h2>
            <p className="text-sm text-amber-200/70">{rewards.length} entries</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <ul className="space-y-3 overflow-y-auto p-4">
          {rewards.map((reward) => (
            <RewardDetails key={reward.id} reward={reward} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function ScrollingTicker({ rewards, onOpen }) {
  const scrollRef = useRef(null)
  const dragRef = useRef({ active: false, lastX: 0, startX: 0, moved: false })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let rafId
    const tick = () => {
      el.scrollLeft += AUTO_SCROLL_SPEED
      if (el.scrollWidth > 0 && el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft -= el.scrollWidth / 2
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [rewards])

  function handlePointerDown(e) {
    const el = scrollRef.current
    if (!el) return

    dragRef.current = { active: true, lastX: e.clientX, startX: e.clientX, moved: false }
    el.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e) {
    if (!dragRef.current.active) return

    const el = scrollRef.current
    if (!el) return

    const dx = e.clientX - dragRef.current.lastX
    if (Math.abs(e.clientX - dragRef.current.startX) > DRAG_THRESHOLD) {
      dragRef.current.moved = true
    }

    dragRef.current.lastX = e.clientX
    el.scrollLeft -= dx

    const half = el.scrollWidth / 2
    if (half > 0 && el.scrollLeft >= half) {
      el.scrollLeft -= half
    } else if (el.scrollLeft < 0) {
      el.scrollLeft += half
    }
  }

  function handlePointerUp(e) {
    if (!dragRef.current.active) return

    const { moved } = dragRef.current
    dragRef.current.active = false
    scrollRef.current?.releasePointerCapture(e.pointerId)

    if (!moved) {
      onOpen()
    }
  }

  const tickerContent = [...rewards, ...rewards]

  return (
    <div className="relative min-h-[3.75rem]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-900 to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-900 to-transparent sm:w-16" />

      <div
        ref={scrollRef}
        className="ticker-scroll cursor-grab overflow-x-auto py-3 active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Rewards ticker — scroll horizontally or tap to view all"
      >
        <div className="flex w-max items-center">
          {tickerContent.map((reward, i) => (
            <RewardDetails key={`${reward.id}-${i}`} reward={reward} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

function TickerShell({ children }) {
  return (
    <div className="relative overflow-hidden border-y-2 border-amber-400/60 bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 shadow-[0_4px_24px_rgba(251,191,36,0.15)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12)_0%,_transparent_60%)]" />
      {children}
    </div>
  )
}

export default function Ticker({ rewards, loading }) {
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <TickerShell>
        <p className="flex min-h-[3.75rem] items-center justify-center py-4 text-sm font-medium text-amber-200/70">
          Loading rewards feed…
        </p>
      </TickerShell>
    )
  }

  if (!rewards.length) {
    return (
      <TickerShell>
        <p className="flex min-h-[3.75rem] items-center justify-center py-4 text-sm font-medium text-amber-200/80">
          No rewards yet — be the first to send one! 🎁
        </p>
      </TickerShell>
    )
  }

  return (
    <>
      <TickerShell>
        <ScrollingTicker rewards={rewards} onOpen={() => setOpen(true)} />
      </TickerShell>

      {open && <RewardsModal rewards={rewards} onClose={() => setOpen(false)} />}
    </>
  )
}
