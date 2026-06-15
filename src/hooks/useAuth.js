import { useCallback, useEffect, useState } from 'react'
import { formatAuthError, isSupabaseConfigured, supabase } from '../lib/supabaseClient'

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        setSession(s)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('請先設定 Supabase 環境變數')

    const normalizedEmail = normalizeEmail(email)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      throw new Error(formatAuthError(error))
    }

    return data
  }, [])

  const signUp = useCallback(async (email, password, displayName) => {
    if (!supabase) throw new Error('請先設定 Supabase 環境變數')

    const normalizedEmail = normalizeEmail(email)
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { display_name: displayName } },
    })

    if (error) {
      throw new Error(formatAuthError(error))
    }

    if (data.session) {
      return data
    }

    // No session from signUp — sign in immediately (works after DB auto-confirm trigger)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (signInError) {
      throw new Error(formatAuthError(signInError))
    }

    return signInData
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(formatAuthError(error))
  }, [])

  return { session, user: session?.user ?? null, loading, signIn, signUp, signOut }
}
