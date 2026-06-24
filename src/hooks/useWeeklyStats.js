import { useCallback, useEffect, useState } from 'react'
import { buildUserChallengeStats, buildUserWeeklyTimeline, fetchChallengeSourceData } from '../lib/challengeStats'
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

    try {
      const client = requireSupabase()
      const { weekStart, profiles, activities, rewards } = await fetchChallengeSourceData(client)
      const profile = profiles.find((row) => row.id === userId)

      if (!profile) {
        setStats(null)
        return
      }

      setStats({
        ...buildUserChallengeStats({
          userId,
          displayName: profile.display_name,
          weekStart,
          activities,
          rewards,
        }),
        timeline: buildUserWeeklyTimeline({
          userId,
          weekStart,
          activities,
          rewards,
        }),
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStats()

    const client = requireSupabase()
    const channel = client
      .channel('weekly-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards' },
        () => fetchStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => fetchStats()
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [fetchStats])

  return { stats, loading, refetch: fetchStats }
}
