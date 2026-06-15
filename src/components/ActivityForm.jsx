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
      setError('請至少輸入步數或 MVPA 分鐘')
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
      setError(err.message ?? '記錄失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">記錄運動</h2>
        <p className="mt-1 text-sm text-slate-400">記錄後才能獲得打賞額度</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm text-slate-300">步數</label>
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
            <label className="mb-1.5 block text-sm text-slate-300">MVPA 分鐘</label>
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
          <label className="mb-1.5 block text-sm text-slate-300">備註（選填）</label>
          <input
            className="input"
            placeholder="例如：公園慢跑"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? '儲存中…' : '新增 Activity'}
        </button>
      </form>
    </section>
  )
}
