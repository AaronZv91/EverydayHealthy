import { useCallback, useEffect, useState } from 'react'
import {
  buildChallengeLeaderboard,
  fetchChallengeSourceData,
  findFirstDualGoalAchieverUserId,
  findTopReceiverUserId,
  sortChallengeLeaderboard,
} from '../lib/challengeStats'
import { WEEKLY_GOALS, requireSupabase } from '../lib/supabaseClient'

export function useChallengeLeaderboard() {
  const [weeklyStats, setWeeklyStats] = useState([])
  const [allTimeStats, setAllTimeStats] = useState([])
  const [weeklySoldierUserId, setWeeklySoldierUserId] = useState(null)
  const [weeklyBeggarUserId, setWeeklyBeggarUserId] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { weekStart, profiles, activities, rewards } = await fetchChallengeSourceData(
        requireSupabase()
      )

      const weekly = sortChallengeLeaderboard(
        buildChallengeLeaderboard(profiles, activities, rewards, weekStart)
      )

      setWeeklyStats(weekly)
      setAllTimeStats(
        sortChallengeLeaderboard(buildChallengeLeaderboard(profiles, activities, rewards))
      )
      setWeeklySoldierUserId(
        findFirstDualGoalAchieverUserId({
          activities,
          rewards,
          weekStart,
          stepGoal: WEEKLY_GOALS.steps,
          mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
        })
      )
      setWeeklyBeggarUserId(
        findTopReceiverUserId(weekly, {
          stepGoal: WEEKLY_GOALS.steps,
          mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
        })
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

  return {
    weeklyStats,
    allTimeStats,
    weeklySoldierUserId,
    weeklyBeggarUserId,
    loading,
    refetch: fetchLeaderboard,
  }
}
