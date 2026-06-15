import { useState } from 'react'

export default function ActivityForm({ onSubmit, onSuccess }) {
  const [steps, setSteps] = useState('')
  const [mvpaMinutes, setMvpaMinutes] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!Number(steps) && !Number(mvpaMinutes)) {
      setError('Enter steps or MVPA minutes')
      return
    }

    setLoading(true)
    try {
      await onSubmit({ steps, mvpaMinutes, note: note.trim() || null })
      setSteps('')
      setMvpaMinutes('')
      setNote('')
      onSuccess?.()
    } catch (err) {
      setError(err.message ?? 'Failed to log activity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">Log Activity</h2>
        <p className="mt-1 text-sm text-slate-400">Log exercise to earn reward quota</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Steps</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">MVPA (min)</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={mvpaMinutes}
              onChange={(e) => setMvpaMinutes(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-300">Note (optional)</label>
          <input
            className="input"
            placeholder="e.g. Park jog"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Saving…' : 'Log Activity'}
        </button>
      </form>
    </section>
  )
}
