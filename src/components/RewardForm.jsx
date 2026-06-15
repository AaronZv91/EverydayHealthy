import { useState } from 'react'
import { isValidRewardEmoji, sanitizeRewardEmojiInput } from '../lib/emojiUtils'
import { formatNumber } from '../lib/weekUtils'

export default function RewardForm({
  profiles,
  currentUserId,
  availableSteps,
  availableMvpa,
  onSubmit,
  onSuccess,
}) {
  const [receiverId, setReceiverId] = useState('')
  const [emoji, setEmoji] = useState('')
  const [itemName, setItemName] = useState('')
  const [steps, setSteps] = useState('')
  const [mvpaMinutes, setMvpaMinutes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const recipients = profiles.filter((p) => p.id !== currentUserId)

  function handleEmojiChange(e) {
    setEmoji(sanitizeRewardEmojiInput(e.target.value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!receiverId) {
      setError('Please select someone to reward')
      return
    }
    if (!isValidRewardEmoji(emoji)) {
      setError('Enter one keyboard emoji (Mac: Ctrl + Cmd + Space)')
      return
    }
    if (!itemName.trim()) {
      setError('Please enter a reward name')
      return
    }
    if (!Number(steps) && !Number(mvpaMinutes)) {
      setError('Enter steps or MVPA minutes')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        receiverId,
        emoji: emoji.trim(),
        itemName: itemName.trim(),
        steps,
        mvpaMinutes,
      })
      setReceiverId('')
      setItemName('')
      setSteps('')
      setMvpaMinutes('')
      setEmoji('')
      onSuccess?.()
    } catch (err) {
      setError(err.message ?? 'Reward failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-amber-400/60 bg-gradient-to-br from-amber-950/80 via-slate-900 to-yellow-950/50 p-6 shadow-2xl shadow-amber-900/30 ring-1 ring-amber-400/20 sm:p-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-yellow-500/10 blur-3xl" />

      <div className="relative mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            <span>🎁</span>
            Send a Reward
          </div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Reward Someone</h2>
          <p className="mt-2 text-sm text-amber-100/70 sm:text-base">
            Share your earned quota with teammates
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">
            Available quota
          </p>
          <p className="text-lg font-bold text-amber-300 sm:text-xl">
            {formatNumber(availableSteps)} steps
          </p>
          <p className="text-lg font-bold text-yellow-300 sm:text-xl">
            {formatNumber(availableMvpa)} min MVPA
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-100">Recipient</label>
            <select
              className="input border-amber-400/30 bg-slate-900/80 py-3 text-base focus:border-amber-400 focus:ring-amber-400/30"
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
            >
              <option value="">Choose a user…</option>
              {recipients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-100">Emoji</label>
            <input
              className="input border-amber-400/30 bg-slate-900/80 py-3 text-center text-4xl leading-none focus:border-amber-400 focus:ring-amber-400/30"
              value={emoji}
              onChange={handleEmojiChange}
              placeholder="🎉"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              aria-label="Reward emoji"
            />
            <p className="mt-1.5 text-xs text-amber-200/50">One keyboard emoji only</p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-amber-100">Reward name</label>
          <input
            className="input border-amber-400/30 bg-slate-900/80 py-3 text-base focus:border-amber-400 focus:ring-amber-400/30"
            placeholder="e.g. Morning run cheer, Weekend hike"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            maxLength={50}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:max-w-xl">
          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-100">Steps</label>
            <input
              className="input border-amber-400/30 bg-slate-900/80 py-3 text-lg font-semibold focus:border-amber-400 focus:ring-amber-400/30"
              type="number"
              min="0"
              placeholder="0"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-amber-100">MVPA (min)</label>
            <input
              className="input border-amber-400/30 bg-slate-900/80 py-3 text-lg font-semibold focus:border-amber-400 focus:ring-amber-400/30"
              type="number"
              min="0"
              placeholder="0"
              value={mvpaMinutes}
              onChange={(e) => setMvpaMinutes(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-950/60 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-6 py-4 text-lg font-bold text-slate-900 shadow-lg shadow-amber-500/30 transition hover:from-amber-300 hover:via-yellow-300 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Sending…' : emoji ? `${emoji} Send Reward` : 'Send Reward'}
        </button>
      </form>
    </section>
  )
}
