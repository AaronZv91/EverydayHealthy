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
      setError('請選擇打賞對象')
      return
    }
    if (!isValidRewardEmoji(emoji)) {
      setError('請輸入一個 Emoji（可用鍵盤 Emoji 選字，例如 Mac：Ctrl + Cmd + Space）')
      return
    }
    if (!itemName.trim()) {
      setError('請輸入物件名稱')
      return
    }
    if (!Number(steps) && !Number(mvpaMinutes)) {
      setError('請至少輸入步數或 MVPA 分鐘')
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
      setError(err.message ?? '打賞失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">打賞</h2>
        <p className="mt-1 text-sm text-slate-400">
          可用額度：{formatNumber(availableSteps)} 步 · {formatNumber(availableMvpa)} 分 MVPA
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-slate-300">打賞對象</label>
          <select
            className="input"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
          >
            <option value="">選擇用戶…</option>
            {recipients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-300">Emoji</label>
          <input
            className="input text-center text-3xl leading-none"
            value={emoji}
            onChange={handleEmojiChange}
            placeholder="🎉"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            aria-label="Reward emoji"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            手動輸入一個鍵盤 Emoji，不支援文字或自訂圖片
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-300">物件名稱</label>
          <input
            className="input"
            placeholder="例如：晨跑加油、週末徒步"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            maxLength={50}
          />
        </div>

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

        {error && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? '處理中…' : emoji ? `${emoji} 送出打賞` : '送出打賞'}
        </button>
      </form>
    </section>
  )
}
