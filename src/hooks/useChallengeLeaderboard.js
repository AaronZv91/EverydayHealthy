import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildChallengeLeaderboard,
  fetchChallengeSourceData,
  findFirstDualGoalAchieverUserId,
  findMvpaParasiteUserId,
  findTopReceiverUserId,
  sortChallengeLeaderboard,
} from '../lib/challengeStats'
import { buildChallengePredictions } from '../lib/challengePredictions'
import { createPredictionCopyScheduler } from '../lib/predictionCopy'
import { WEEKLY_GOALS, requireSupabase } from '../lib/supabaseClient'

const REFETCH_DEBOUNCE_MS = 350

export function useChallengeLeaderboard(empathyMode = false) {
  const [weeklyStats, setWeeklyStats] = useState([])
  const [allTimeStats, setAllTimeStats] = useState([])
  const [weeklySoldierUserId, setWeeklySoldierUserId] = useState(null)
  const [weeklyBeggarUserId, setWeeklyBeggarUserId] = useState(null)
  const [weeklyMvpaParasiteUserId, setWeeklyMvpaParasiteUserId] = useState(null)
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [aiCopyLoading, setAiCopyLoading] = useState(false)
  const isInitialLoad = useRef(true)
  const debounceTimer = useRef(null)
  const copyScheduler = useRef(null)
  const sourceRef = useRef(null)
  const empathyModeRef = useRef(empathyMode)

  if (!copyScheduler.current) {
    copyScheduler.current = createPredictionCopyScheduler({
      onReviewingChange: setAiCopyLoading,
      onCopyReady: (merged) => setPredictions(merged),
      onCopyError: (fallback) => setPredictions(fallback),
    })
  }

  const schedulePredictions = useCallback((source, mode) => {
    const nextPredictions = buildChallengePredictions({
      profiles: source.profiles,
      activities: source.activities,
      rewards: source.rewards,
      weekStart: source.weekStart,
      stepGoal: WEEKLY_GOALS.steps,
      mvpaGoal: WEEKLY_GOALS.mvpaMinutes,
      empathyMode: mode,
    })
    setPredictions(nextPredictions)
    copyScheduler.current.schedule(nextPredictions, mode)
  }, [])

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
      setWeeklyMvpaParasiteUserId(
        findMvpaParasiteUserId({
          activities,
          profiles,
          weekStart,
        })
      )

      const source = { profiles, activities, rewards, weekStart }
      sourceRef.current = source
      schedulePredictions(source, empathyModeRef.current)
    } catch (error) {
      console.error(error)
    } finally {
      if (isInitial) {
        setLoading(false)
        isInitialLoad.current = false
      }
      setRefreshing(false)
    }
  }, [schedulePredictions])

  useEffect(() => {
    empathyModeRef.current = empathyMode
    if (sourceRef.current) {
      schedulePredictions(sourceRef.current, empathyMode)
    }
  }, [empathyMode, schedulePredictions])

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
    weeklyMvpaParasiteUserId,
    predictions,
    loading,
    refreshing,
    aiCopyLoading,
    refetch: fetchLeaderboard,
  }
}
