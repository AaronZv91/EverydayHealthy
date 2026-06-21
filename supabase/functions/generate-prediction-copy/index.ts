import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]

type PickPayload = {
  name: string
  confidence: number
} | null

type PlayerPayload = {
  userId: string
  name: string
  rank: number
  statsLine: string
  labels: string[]
  scores: {
    firstCompleter: number
    lastPlace: number
    beggar: number
  }
}

type RequestBody = {
  summaryContext: {
    hasHistory: boolean
    historyWeekCount: number
  }
  picks: {
    firstCompleter: PickPayload
    lastPlace: PickPayload
    beggar: PickPayload
  }
  players: PlayerPayload[]
}

type PlayerOutlook = {
  userId: string
  outlook: string
}

type CopyResponse = {
  summary: string
  firstCompleterReason: string
  lastPlaceReason: string
  beggarReason: string
  players: PlayerOutlook[]
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getGeminiApiKey() {
  return (
    Deno.env.get('GEMINI_API_KEY')?.trim() ||
    Deno.env.get('GOOGLE_API_KEY')?.trim() ||
    ''
  )
}

function buildPrompt(body: RequestBody) {
  const { summaryContext, picks, players } = body

  return `You write short, spicy prediction copy for a weekly fitness challenge app (70,000 steps + 200 MVPA minutes per week).

Tone: TRASHY sports-banters between close friends — roast their stats, pace, donation habits, and gym excuses hard. Be funny, competitive, and a little savage. Think fantasy-league group chat, not a HR email.

Hard rules (never break these):
- NO personal attacks (人身攻击): no insults about someone's body, appearance, intelligence, worth, race, gender, age, health conditions, or character
- NO cruelty, slurs, bullying, or humiliation — keep it playful
- Roast BEHAVIOUR and NUMBERS only (lazy logging, begging for steps, snail pace, goal-dodging)
- Everyone should still feel like they're in on the joke
- One or two sentences max per field

The stats below are authoritative. Do NOT invent numbers or change who was picked.

Context:
- ${summaryContext.hasHistory ? `${summaryContext.historyWeekCount} past week(s) in the model` : 'Limited history — mostly this week'}

Top picks (confidence = model likelihood %):
- First to complete both goals next week: ${picks.firstCompleter ? `${picks.firstCompleter.name} (${picks.firstCompleter.confidence}%)` : 'none'}
- Likely last place: ${picks.lastPlace ? `${picks.lastPlace.name} (${picks.lastPlace.confidence}%)` : 'none'}
- Likely Beggar (most donated quota received): ${picks.beggar ? `${picks.beggar.name} (${picks.beggar.confidence}%)` : 'none'}

Every player:
${players
  .map(
    (p) =>
      `- userId: ${p.userId} | ${p.name} | rank #${p.rank} | ${p.statsLine} | labels: ${p.labels.join(', ') || 'none'} | first ${p.scores.firstCompleter}% / last ${p.scores.lastPlace}% / beggar ${p.scores.beggar}%`
  )
  .join('\n')}

Return JSON only:
{
  "summary": "2-3 sentences on the group's current state and next-week vibe",
  "firstCompleterReason": "1-2 sentences for the first-to-complete pick",
  "lastPlaceReason": "1-2 sentences for the last-place pick",
  "beggarReason": "1-2 sentences for the beggar pick",
  "players": [
    { "userId": "<exact userId>", "outlook": "1-2 sentence outlook" }
  ]
}

Include every player in the players array with their exact userId.`
}

function normalizeCopyResponse(raw: CopyResponse, players: PlayerPayload[]): CopyResponse {
  const outlookByUser = new Map(
    (raw.players ?? []).map((row) => [row.userId, row.outlook?.trim() ?? ''])
  )

  return {
    summary: raw.summary?.trim() ?? '',
    firstCompleterReason: raw.firstCompleterReason?.trim() ?? '',
    lastPlaceReason: raw.lastPlaceReason?.trim() ?? '',
    beggarReason: raw.beggarReason?.trim() ?? '',
    players: players.map((player) => ({
      userId: player.userId,
      outlook: outlookByUser.get(player.userId) ?? '',
    })),
  }
}

function extractJsonText(result: Record<string, unknown>) {
  const blockReason = (result?.promptFeedback as { blockReason?: string })?.blockReason
  if (blockReason) {
    throw new Error(`Gemini blocked prompt: ${blockReason}`)
  }

  const candidate = (result?.candidates as Array<Record<string, unknown>>)?.[0]
  const finishReason = candidate?.finishReason
  const text = (candidate?.content as { parts?: Array<{ text?: string }> })?.parts?.[0]?.text

  if (!text) {
    throw new Error(`Gemini returned empty content (${finishReason ?? 'unknown finish reason'})`)
  }

  return text
}

async function geminiFetch(
  apiKey: string,
  model: string,
  prompt: string,
  useJsonMime: boolean
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: useJsonMime
      ? { temperature: 1.0, responseMimeType: 'application/json' }
      : { temperature: 1.0 },
  }

  const headerResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (headerResponse.ok) {
    return headerResponse
  }

  if (apiKey.startsWith('AIza')) {
    return fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  return headerResponse
}

async function callGeminiModel(
  apiKey: string,
  model: string,
  prompt: string
): Promise<CopyResponse> {
  let lastError: Error | null = null

  for (const useJsonMime of [true, false]) {
    try {
      const response = await geminiFetch(apiKey, model, prompt, useJsonMime)
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`(${response.status}) ${detail.slice(0, 400)}`)
      }

      const result = await response.json()
      const text = extractJsonText(result)
      const parsed = JSON.parse(text) as CopyResponse

      if (!parsed.summary || !Array.isArray(parsed.players)) {
        throw new Error('invalid JSON shape')
      }

      return parsed
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw new Error(`Gemini ${model}: ${lastError?.message ?? 'request failed'}`)
}

async function callGemini(
  apiKey: string,
  prompt: string,
  players: PlayerPayload[]
): Promise<CopyResponse> {
  const errors: string[] = []

  for (const model of GEMINI_MODELS) {
    try {
      const parsed = await callGeminiModel(apiKey, model, prompt)
      return normalizeCopyResponse(parsed, players)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${model}: ${message}`)
      console.warn(`generate-prediction-copy: ${model} failed — ${message}`)
    }
  }

  throw new Error(errors.join(' | '))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const geminiKey = getGeminiApiKey()
    if (!geminiKey) {
      return jsonResponse(
        { error: 'GEMINI_API_KEY not configured (set via: supabase secrets set GEMINI_API_KEY=...)' },
        503
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Supabase env not configured in Edge Function' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: authError?.message ?? 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as RequestBody
    if (!body?.players?.length) {
      return jsonResponse({ error: 'players array required' }, 400)
    }

    const copy = await callGemini(geminiKey, buildPrompt(body), body.players)
    return jsonResponse(copy)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('generate-prediction-copy:', message)
    return jsonResponse({ error: message }, 500)
  }
})
