import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabaseClient'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import SetupPage from './pages/SetupPage'

export default function App() {
  const { session, user, loading, signIn, signUp, signOut } = useAuth()

  if (!isSupabaseConfigured) {
    return <SetupPage />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-400">載入中…</p>
      </div>
    )
  }

  if (!session) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return <HomePage user={user} onSignOut={signOut} />
}
