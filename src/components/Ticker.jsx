import { formatRewardMessage } from '../lib/weekUtils'

export default function Ticker({ rewards, loading }) {
  if (loading) {
    return (
      <div className="overflow-hidden border-b border-slate-800 bg-slate-900/90 py-2.5">
        <p className="text-center text-sm text-slate-500">載入打賞動態…</p>
      </div>
    )
  }

  if (!rewards.length) {
    return (
      <div className="overflow-hidden border-b border-slate-800 bg-slate-900/90 py-2.5">
        <p className="text-center text-sm text-slate-500">尚無打賞紀錄，成為第一個打賞的人吧！</p>
      </div>
    )
  }

  const messages = rewards.map((r) =>
    formatRewardMessage(r, r.sender?.display_name ?? '未知', r.receiver?.display_name ?? '未知')
  )

  const tickerContent = [...messages, ...messages]

  return (
    <div className="relative overflow-hidden border-b border-brand-700/30 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 py-2.5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-slate-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-slate-900 to-transparent" />

      <div className="flex animate-ticker whitespace-nowrap">
        {tickerContent.map((msg, i) => (
          <span
            key={`${i}-${msg}`}
            className="mx-8 inline-flex items-center text-sm text-slate-200"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
            {msg}
          </span>
        ))}
      </div>
    </div>
  )
}
