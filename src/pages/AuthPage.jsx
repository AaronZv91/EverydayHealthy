import { useState } from 'react'

export default function AuthPage({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await onSignUp(email, password, displayName || email.split('@')[0])
      } else {
        await onSignIn(email, password)
      }
    } catch (err) {
      setError(err.message ?? '操作失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
            🏃
          </div>
          <h1 className="text-2xl font-bold text-white">EverydayHealthy</h1>
          <p className="mt-1 text-sm text-slate-400">每週 70,000 步 · 200 分鐘 MVPA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1.5 block text-sm text-slate-300">顯示名稱</label>
              <input
                className="input"
                placeholder="你的暱稱"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">Email</label>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-slate-300">密碼</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              placeholder="至少 6 個字元"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          {message && (
            <p className="rounded-lg bg-brand-700/20 px-3 py-2 text-sm text-brand-100">{message}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '處理中…' : mode === 'signup' ? '註冊' : '登入'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          {mode === 'signup' ? '已有帳號？' : '還沒有帳號？'}{' '}
          <button
            type="button"
            className="font-medium text-brand-500 hover:text-brand-400"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup')
              setError('')
              setMessage('')
            }}
          >
            {mode === 'signup' ? '登入' : '註冊'}
          </button>
        </p>
      </div>
    </div>
  )
}
