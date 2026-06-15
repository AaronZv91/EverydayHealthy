import { useCallback, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabaseClient'

export function useProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchProfiles = useCallback(async () => {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('id, display_name, avatar_url')
      .order('display_name')

    if (error) {
      console.error(error)
      return
    }
    setProfiles(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  return { profiles, loading, refetch: fetchProfiles }
}

export function useWeeklyStats(userId) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(null)
      setLoading(false)
      return
    }

    const { data, error } = await requireSupabase()
      .from('weekly_user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setStats(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, refetch: fetchStats }
}

export function useAllWeeklyStats() {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    const { data, error } = await requireSupabase()
      .from('weekly_user_stats')
      .select('*')
      .order('total_steps', { ascending: false })

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    setStats(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, refetch: fetchStats }
}
