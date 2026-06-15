import { useCallback, useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabaseClient'

function sortByChallenge(a, b) {
  return (
    b.total_steps - a.total_steps ||
    b.total_mvpa - a.total_mvpa ||
    a.display_name.localeCompare(b.display_name)
  )
}

export function useChallengeLeaderboard() {
  const [weeklyStats, setWeeklyStats] = useState([])
  const [allTimeStats, setAllTimeStats] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    const client = requireSupabase()

    const [weeklyResult, allTimeResult] = await Promise.all([
      client.from('weekly_user_stats').select('*'),
      client.from('all_time_user_stats').select('*'),
    ])

    if (weeklyResult.error) {
      console.error(weeklyResult.error)
    } else {
      setWeeklyStats([...(weeklyResult.data ?? [])].sort(sortByChallenge))
    }

    if (allTimeResult.error) {
      console.error(allTimeResult.error)
    } else {
      setAllTimeStats([...(allTimeResult.data ?? [])].sort(sortByChallenge))
    }

    setLoading(false)
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
