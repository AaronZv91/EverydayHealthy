import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.0-flash'

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

type CopyResponse = {
  summary: string
  firstCompleterReason: string | null
  lastPlaceReason: string | null
  beggarReason: string | null
  playerOutlooks: Record<string, string>
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildPrompt(body: RequestBody) {
  const { summaryContext, picks, players } = body

  return `You write short, fun prediction copy for a weekly fitness challenge app (70,000 steps + 200 MVPA minutes per week).

Tone: playful and witty between workout buddies — light teasing is OK, but NO insults, cruelty, body-shaming, or mean trash talk. Stay encouraging. One or two sentences max per field.

The stats below are authoritative. Do NOT invent numbers or change who was picked.

Context:
- ${summaryContext.hasHistory ? `${summaryContext.historyWeekCount} past week(s) in the model` : 'Limited history — mostly this week'}

Top picks (confidence = model likelihood %):
- First to complete both goals next week: ${picks.firstCompleter ? `${picks.firstCompleter.name} (${picks.firstCompleter.confidence}%)` : 'none'}
- Likely last place: ${picks.lastPlace ? `${picks.lastPlace.name} (${picks.lastPlace.confidence}%)` : 'none'}
- Likely Beggar (most donated quota received): ${picks.beggar ? `${picks.beggar.name} (${picks.beggar.confidence}%)` : 'none'}

Every player (use exact userId keys in playerOutlooks):
${players
  .map(
    (p) =>
      `- userId: ${p.userId} | ${p.name} | rank #${p.rank} | ${p.statsLine} | labels: ${p.labels.join(', ') || 'none'} | first ${p.scores.firstCompleter}% / last ${p.scores.lastPlace}% / beggar ${p.scores.beggar}%`
  )
  .join('\n')}

Return JSON only with this shape:
{
  "summary": "2-3 sentences on the group's current state and next-week vibe",
  "firstCompleterReason": "1-2 sentences or null if no pick",
  "lastPlaceReason": "1-2 sentences or null if no pick",
  "beggarReason": "1-2 sentences or null if no pick",
  "playerOutlooks": { "<userId>": "1-2 sentence outlook for that player", ... }
}

Include every player userId in playerOutlooks.`
}

async function callGemini(apiKey: string, prompt: string): Promise<CopyResponse> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              firstCompleterReason: { type: 'string', nullable: true },
              lastPlaceReason: { type: 'string', nullable: true },
              beggarReason: { type: 'string', nullable: true },
              playerOutlooks: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['summary', 'playerOutlooks'],
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${detail.slice(0, 300)}`)
  }

  const result = await response.json()
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty content')
  }

  const parsed = JSON.parse(text) as CopyResponse
  if (!parsed.summary || typeof parsed.playerOutlooks !== 'object') {
    throw new Error('Gemini returned invalid JSON shape')
  }

  return parsed
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 503)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as RequestBody
    if (!body?.players?.length) {
      return jsonResponse({ error: 'players array required' }, 400)
    }

    const copy = await callGemini(geminiKey, buildPrompt(body))
    return jsonResponse(copy)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('generate-prediction-copy:', message)
    return jsonResponse({ error: message }, 500)
  }
})
