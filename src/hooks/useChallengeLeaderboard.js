import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildChallengeLeaderboard,
  fetchChallengeSourceData,
  findFirstDualGoalAchieverUserId,
  findTopReceiverUserId,
  sortChallengeLeaderboard,
} from '../lib/challengeStats'
import { buildChallengePredictions } from '../lib/challengePredictions'
import { createPredictionCopyScheduler } from '../lib/predictionCopy'
import { WEEKLY_GOALS, requireSupabase } from '../lib/supabaseClient'

const REFETCH_DEBOUNCE_MS = 350

export function useChallengeLeaderboard() {
  const [weeklyStats, setWeeklyStats] = useState([])
  const [allTimeStats, setAllTimeStats] = useState([])
  const [weeklySoldierUserId, setWeeklySoldierUserId] = useState(null)
  const [weeklyBeggarUserId, setWeeklyBeggarUserId] = useState(null)
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [aiCopyLoading, setAiCopyLoading] = useState(false)
  const isInitialLoad = useRef(true)
  const debounceTimer = useRef(null)
  const copyScheduler = useRef(null)

  if (!copyScheduler.current) {
    copyScheduler.current = createPredictionCopyScheduler({
      onReviewingChange: setAiCopyLoading,
      onCopyReady: (merged) => setPredictions(merged),
      onCopyError: (fallback) => setPredictions(fallback),
    })
  }

  const fetchLeaderboard = useCallback(async () => {
    const isInitial = isInitialLoad.current
    if (!isInitial) setRefreshing(true)

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

      const nextPredictions = buildChallengePredictions({
        profiles,
        activities,
        rewards,
        weekStart,
        stepGoal: WEEKLY_GOALS.steps,
        mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
      })

      copyScheduler.current.schedule(nextPredictions)
    } catch (error) {
      console.error(error)
    } finally {
      if (isInitial) {
        setLoading(false)
        isInitialLoad.current = false
      }
      setRefreshing(false)
    }
  }, [])

  const scheduleRefetch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      fetchLeaderboard()
    }, REFETCH_DEBOUNCE_MS)
  }, [fetchLeaderboard])

  useEffect(() => {
    fetchLeaderboard()

    const client = requireSupabase()
    const channel = client
      .channel('challenge-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards' },
        scheduleRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        scheduleRefetch
      )
      .subscribe()

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      copyScheduler.current?.cancel()
      client.removeChannel(channel)
    }
  }, [fetchLeaderboard, scheduleRefetch])

  return {
    weeklyStats,
    allTimeStats,
    weeklySoldierUserId,
    weeklyBeggarUserId,
    predictions,
    loading,
    refreshing,
    aiCopyLoading,
    refetch: fetchLeaderboard,
  }
}
