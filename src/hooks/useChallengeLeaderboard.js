import { useCallback, useEffect, useState } from 'react'
import {
  buildChallengeLeaderboard,
  fetchChallengeSourceData,
  sortChallengeLeaderboard,
} from '../lib/challengeStats'
import { requireSupabase } from '../lib/supabaseClient'

export function useChallengeLeaderboard() {
  const [weeklyStats, setWeeklyStats] = useState([])
  const [allTimeStats, setAllTimeStats] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { weekStart, profiles, activities, rewards } = await fetchChallengeSourceData(
        requireSupabase()
      )

      setWeeklyStats(
        sortChallengeLeaderboard(
          buildChallengeLeaderboard(profiles, activities, rewards, weekStart)
        )
      )
      setAllTimeStats(
        sortChallengeLeaderboard(buildChallengeLeaderboard(profiles, activities, rewards))
      )
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()

    const client = requireSupabase()
    const channel = client
      .channel('challenge-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards' },
        () => fetchLeaderboard()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities' },
        () => fetchLeaderboard()
      )
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [fetchLeaderboard])

  return { weeklyStats, allTimeStats, loading, refetch: fetchLeaderboard }
}
