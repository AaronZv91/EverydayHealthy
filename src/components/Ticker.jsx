import { formatNumber } from '../lib/weekUtils'

function TickerItem({ reward }) {
  const sender = reward.sender?.display_name ?? 'Unknown'
  const receiver = reward.receiver?.display_name ?? 'Unknown'
  const parts = []
  if (reward.steps > 0) parts.push(`${formatNumber(reward.steps)} steps`)
  if (reward.mvpa_minutes > 0) parts.push(`${formatNumber(reward.mvpa_minutes)} min`)

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
        <span className="whitespace-nowrap text-sm font-bold text-amber-400">{parts.join(' · ')}</span>
      )}
    </span>
  )
}

function TickerShell({ children }) {
  return (
    <div className="relative overflow-hidden border-y-2 border-amber-400/60 bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 shadow-[0_4px_24px_rgba(251,191,36,0.15)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.12)_0%,_transparent_60%)]" />
      <div className="relative flex min-h-[3.75rem] items-stretch">
        <div className="z-20 flex shrink-0 items-center gap-2.5 border-r border-amber-400/40 bg-slate-950/95 px-4 sm:px-5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-400 sm:text-sm">
            Live Rewards
          </span>
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

export default function Ticker({ rewards, loading }) {
  if (loading) {
    return (
      <TickerShell>
        <p className="flex h-full items-center justify-center py-4 text-sm font-medium text-amber-200/70">
          Loading rewards feed…
        </p>
      </TickerShell>
    )
  }

  if (!rewards.length) {
    return (
      <TickerShell>
        <p className="flex h-full items-center justify-center py-4 text-sm font-medium text-amber-200/80">
          No rewards yet — be the first to send one! 🎁
        </p>
      </TickerShell>
    )
  }

  const tickerContent = [...rewards, ...rewards]

  return (
    <TickerShell>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-900 to-transparent" />

      <div className="flex animate-ticker items-center py-3">
        {tickerContent.map((reward, i) => (
          <TickerItem key={`${reward.id}-${i}`} reward={reward} />
        ))}
      </div>
    </TickerShell>
  )
}
