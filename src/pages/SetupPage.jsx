export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-lg space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600 text-2xl">
            ⚙️
          </div>
          <h1 className="text-2xl font-bold text-white">Supabase setup required</h1>
          <p className="mt-2 text-sm text-slate-400">
            Environment variables are missing. The app cannot connect to the database.
          </p>
        </div>

        <ol className="space-y-3 text-sm text-slate-300">
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">1.</span> Copy{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">.env.example</code>{' '}
            to <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">.env</code>
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">2.</span> In Supabase → Settings → API, add
            your project URL and anon key
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">3.</span> Run{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">
              supabase/schema.sql
            </code>{' '}
            in the SQL Editor; if already deployed, also run{' '}
            <code className="rounded bg-slate-700 px-1.5 py-0.5 text-brand-100">
              supabase/auto-confirm-email.sql
            </code>
          </li>
          <li className="rounded-xl bg-slate-800/60 px-4 py-3">
            <span className="font-semibold text-white">4.</span> Restart{' '}
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
