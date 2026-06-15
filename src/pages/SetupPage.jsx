export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-lg space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600 text-2xl">
            ⚙️
          </div>
          <h1 className="text-2xl font-bold text-white">需要設定 Supabase</h1>
          <p className="mt-2 text-sm text-slate-400">
            目前缺少環境變數，應用無法連線到資料庫。
          </p>
        </div>

        <ol className="space-y-3 text-sm text-slate-300">
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">1.</span> 複製{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">.env.example</code>{' '}
            為 <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">.env</code>
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">2.</span> 到 Supabase 專案 → Settings →
            API，填入 URL 與 anon key
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">3.</span> 在 SQL Editor 依序執行{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">
              supabase/schema.sql
            </code>
            ，若已部署過再執行{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">
              supabase/auto-confirm-email.sql
            </code>
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">4.</span>（選用）Supabase → Authentication →
            Email → 關閉 Confirm email
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">5.</span> 重新啟動{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">npm run dev</code>
          </li>
        </ol>

        <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-400">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...`}
        </pre>
      </div>
    </div>
  )
}
