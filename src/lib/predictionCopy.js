import { isSupabaseConfigured, requireSupabase } from './supabaseClient'

const AI_COPY_DEBOUNCE_MS = 1000

function fingerprintPayload(predictions) {
  return {
    hasHistory: predictions.hasHistory,
    historyWeekCount: predictions.historyWeekCount,
    historicalWeekSummaries: predictions.historicalWeekSummaries ?? [],
    firstCompleter: predictions.firstCompleter
      ? {
          userId: predictions.firstCompleter.userId,
          confidence: predictions.firstCompleter.confidence,
        }
      : null,
    lastPlace: predictions.lastPlace
      ? {
          userId: predictions.lastPlace.userId,
          confidence: predictions.lastPlace.confidence,
        }
      : null,
    beggar: predictions.beggar
      ? {
          userId: predictions.beggar.userId,
          confidence: predictions.beggar.confidence,
        }
      : null,
    players: (predictions.playerPredictions ?? []).map((player) => ({
      userId: player.userId,
      rank: player.rank,
      statsLine: player.statsLine,
      labels: player.labels.map((tag) => tag.label),
      trend: player.trend,
      historyLine: player.historyLine,
      scores: player.scores,
      logs:
        predictions.playerEventLogs?.find((entry) => entry.userId === player.userId)?.events ?? [],
    })),
  }
}

export async function fingerprintPredictions(predictions) {
  const data = new TextEncoder().encode(JSON.stringify(fingerprintPayload(predictions)))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hashBuffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildGeminiPayload(predictions) {
  return {
    summaryContext: {
      hasHistory: predictions.hasHistory,
      historyWeekCount: predictions.historyWeekCount,
      historicalWeekSummaries: (predictions.historicalWeekSummaries ?? []).map((week) => ({
        week: week.week,
        leader: week.leader,
        leaderGoalPct: week.leaderGoalPct,
        firstCompleter: week.firstCompleter,
        beggar: week.beggar,
        lastPlace: week.lastPlace,
        completions: week.completions,
        activePlayers: week.activePlayers,
      })),
    },
    picks: {
      firstCompleter: predictions.firstCompleter
        ? {
            name: predictions.firstCompleter.displayName,
            confidence: predictions.firstCompleter.confidence,
          }
        : null,
      lastPlace: predictions.lastPlace
        ? {
            name: predictions.lastPlace.displayName,
            confidence: predictions.lastPlace.confidence,
          }
        : null,
      beggar: predictions.beggar
        ? {
            name: predictions.beggar.displayName,
            confidence: predictions.beggar.confidence,
          }
        : null,
    },
    players: (predictions.playerPredictions ?? []).map((player) => ({
      userId: player.userId,
      name: player.displayName,
      rank: player.rank,
      statsLine: player.statsLine,
      labels: player.labels.map((tag) => tag.label),
      trend: player.trend,
      historyLine: player.historyLine,
      scores: player.scores,
      logs:
        predictions.playerEventLogs?.find((entry) => entry.userId === player.userId)?.events ?? [],
    })),
  }
}

export function mergePredictionCopy(predictions, copy) {
  if (!copy?.summary) return predictions

  return {
    ...predictions,
    summary: copy.summary,
    aiGenerated: true,
    firstCompleter: predictions.firstCompleter
      ? {
          ...predictions.firstCompleter,
          reason: copy.firstCompleterReason || predictions.firstCompleter.reason,
        }
      : null,
    lastPlace: predictions.lastPlace
      ? {
          ...predictions.lastPlace,
          reason: copy.lastPlaceReason || predictions.lastPlace.reason,
        }
      : null,
    beggar: predictions.beggar
      ? {
          ...predictions.beggar,
          reason: copy.beggarReason || predictions.beggar.reason,
        }
      : null,
    playerPredictions: (predictions.playerPredictions ?? []).map((player) => {
      const outlookFromArray = copy.players?.find((row) => row.userId === player.userId)?.outlook
      const outlookFromMap = copy.playerOutlooks?.[player.userId]
      return {
        ...player,
        outlook: outlookFromArray ?? outlookFromMap ?? player.outlook,
      }
    }),
  }
}

export async function fetchPredictionCopy(predictions) {
  const client = requireSupabase()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (!session) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '')
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!isSupabaseConfigured || !supabaseUrl || !anonKey) {
    throw new Error('Supabase is not configured')
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-prediction-copy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGeminiPayload(predictions)),
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(data?.error || `Edge Function failed (${response.status})`)
  }

  if (data?.error) throw new Error(data.error)
  return data
}

export function createPredictionCopyScheduler({ onReviewingChange, onCopyReady, onCopyError }) {
  let debounceTimer = null
  let lastAppliedHash = null
  let generation = 0

  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    generation += 1
    onReviewingChange(false)
  }

  async function schedule(predictions) {
    if (debounceTimer) clearTimeout(debounceTimer)

    const requestGeneration = ++generation
    const hash = await fingerprintPredictions(predictions)

    if (hash === lastAppliedHash) {
      onReviewingChange(false)
      return
    }

    onReviewingChange(true)

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      if (requestGeneration !== generation) return

      try {
        const copy = await fetchPredictionCopy(predictions)
        if (requestGeneration !== generation) return

        if (!copy) {
          onCopyError({ ...predictions, aiCopyFallback: true })
          return
        }

        lastAppliedHash = hash
        onCopyReady(mergePredictionCopy(predictions, copy))
      } catch (error) {
        if (requestGeneration !== generation) return
        const message = error instanceof Error ? error.message : String(error)
        console.warn('Gemini prediction copy failed:', message)
        onCopyError({ ...predictions, aiCopyFallback: true })
      } finally {
        if (requestGeneration === generation) {
          onReviewingChange(false)
        }
      }
    }, AI_COPY_DEBOUNCE_MS)
  }

  return { schedule, cancel }
}

export { AI_COPY_DEBOUNCE_MS }
