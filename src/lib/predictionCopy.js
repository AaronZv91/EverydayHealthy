import { requireSupabase } from './supabaseClient'

const AI_COPY_DEBOUNCE_MS = 4000

function fingerprintPayload(predictions) {
  return {
    hasHistory: predictions.hasHistory,
    historyWeekCount: predictions.historyWeekCount,
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
      scores: player.scores,
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
      scores: player.scores,
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
          reason: copy.firstCompleterReason ?? predictions.firstCompleter.reason,
        }
      : null,
    lastPlace: predictions.lastPlace
      ? {
          ...predictions.lastPlace,
          reason: copy.lastPlaceReason ?? predictions.lastPlace.reason,
        }
      : null,
    beggar: predictions.beggar
      ? {
          ...predictions.beggar,
          reason: copy.beggarReason ?? predictions.beggar.reason,
        }
      : null,
    playerPredictions: (predictions.playerPredictions ?? []).map((player) => ({
      ...player,
      outlook: copy.playerOutlooks?.[player.userId] ?? player.outlook,
    })),
  }
}

export async function fetchPredictionCopy(predictions) {
  const client = requireSupabase()
  const {
    data: { session },
  } = await client.auth.getSession()

  if (!session) return null

  const { data, error } = await client.functions.invoke('generate-prediction-copy', {
    body: buildGeminiPayload(predictions),
  })

  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

export function createPredictionCopyScheduler({ onLoadingChange, onCopyReady }) {
  let debounceTimer = null
  let lastAppliedHash = null
  let generation = 0

  function cancel() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    generation += 1
    onLoadingChange(false)
  }

  function schedule(predictions) {
    if (debounceTimer) clearTimeout(debounceTimer)

    const requestGeneration = ++generation

    debounceTimer = setTimeout(async () => {
      debounceTimer = null
      if (requestGeneration !== generation) return

      const hash = await fingerprintPredictions(predictions)
      if (hash === lastAppliedHash) return

      onLoadingChange(true)

      try {
        const copy = await fetchPredictionCopy(predictions)
        if (requestGeneration !== generation) return
        if (!copy) return

        lastAppliedHash = hash
        onCopyReady(mergePredictionCopy(predictions, copy))
      } catch (error) {
        console.warn('Gemini prediction copy failed:', error)
      } finally {
        if (requestGeneration === generation) {
          onLoadingChange(false)
        }
      }
    }, AI_COPY_DEBOUNCE_MS)
  }

  return { schedule, cancel }
}

export { AI_COPY_DEBOUNCE_MS }
