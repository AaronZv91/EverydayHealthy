import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
]

type PickPayload = {
  name: string
  confidence: number
} | null

type PlayerEvent = {
  at: string
  week: string
  type: 'activity' | 'reward_sent' | 'reward_received'
  steps: number
  mvpa: number
  note?: string | null
  to?: string
  from?: string
  item?: string
}

type PlayerReward = {
  at: string
  week: string
  emoji: string
  itemName: string
  item: string
  steps: number
  mvpa: number
  type: 'received' | 'sent'
  from?: string
  to?: string
}

type PlayerPayload = {
  userId: string
  name: string
  rank: number
  statsLine: string
  labels: string[]
  trend: string
  historyLine: string
  lastWeekLine: string
  engagementLine: string
  paceLine: string
  recentNotes: string[]
  rewardLine: string
  recentRewards: PlayerReward[]
  mvpaParasiteLine: string
  isMvpaParasite: boolean
  logs: PlayerEvent[]
  scores: {
    firstCompleter: number
    lastPlace: number
    beggar: number
  }
}

type WeekContext = {
  stepGoal: number
  mvpaGoal: number
  weekday: string
  dayOfWeek: number
  daysElapsed: number
  daysRemaining: number
  weekProgressPct: number
  paceSummary: string
  playerCount: number
  individualStepGoal: number
  individualMvpaGoal: number
  totalStepGoal: number
  totalMvpaGoal: number
  totalStepsLogged: number
  totalMvpaLogged: number
  groupStepsPct: number
  groupMvpaPct: number
  groupCombinedPct: number
  expectedGroupStepsByNow: number
  expectedGroupMvpaByNow: number
  groupPaceLabel: string
  groupPaceDeltaPct: number
  groupPaceLine: string
  groupPaceSummary: string
}

type HistoricalWeekSummary = {
  week: string
  leader: string | null
  leaderGoalPct: number
  firstCompleter: string | null
  beggar: string | null
  lastPlace: string | null
  completions: number
  activePlayers: number
}

type MvpaParasitePayload = {
  name: string | null
  minGapHours: number
  gapLine: string
} | null

type RequestBody = {
  empathyMode?: boolean
  weekContext: WeekContext | null
  mvpaParasite: MvpaParasitePayload
  summaryContext: {
    hasHistory: boolean
    historyWeekCount: number
    historicalWeekSummaries: HistoricalWeekSummary[]
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
  recap: string
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

function formatRewardForPrompt(reward: PlayerReward) {
  if (reward.type === 'received') {
    return `[${reward.at}] received ${reward.emoji} "${reward.itemName}" from ${reward.from} (${reward.steps} steps, ${reward.mvpa} MVPA)`
  }
  return `[${reward.at}] sent ${reward.to} ${reward.emoji} "${reward.itemName}" (${reward.steps} steps, ${reward.mvpa} MVPA)`
}

function formatEventForPrompt(event: PlayerEvent) {
  if (event.type === 'activity') {
    const note = event.note ? ` · note: ${event.note}` : ''
    return `[${event.at}] activity +${event.steps} steps, +${event.mvpa} MVPA (week ${event.week})${note}`
  }
  if (event.type === 'reward_sent') {
    return `[${event.at}] sent ${event.to} ${event.item}: ${event.steps} steps, ${event.mvpa} MVPA (week ${event.week})`
  }
  return `[${event.at}] received from ${event.from} ${event.item}: ${event.steps} steps, ${event.mvpa} MVPA (week ${event.week})`
}

function formatPlayerBlockForPrompt(p: PlayerPayload) {
  const logLines =
    p.logs.length > 0
      ? p.logs.map((event) => `    · ${formatEventForPrompt(event)}`).join('\n')
      : '    · no logs yet'
  const rewardLines =
    p.recentRewards.length > 0
      ? p.recentRewards.map((reward) => `    · ${formatRewardForPrompt(reward)}`).join('\n')
      : '    · no named rewards yet'

  return `- userId: ${p.userId} | ${p.name} | rank #${p.rank} | trend: ${p.trend} | history: ${p.historyLine || 'none'} | last week: ${p.lastWeekLine || 'none'} | streaks/PBs: ${p.engagementLine || 'none'} | pace: ${p.paceLine || 'n/a'} | ${p.statsLine} | labels: ${p.labels.join(', ') || 'none'} | first ${p.scores.firstCompleter}% / last ${p.scores.lastPlace}% / beggar ${p.scores.beggar}%
  MVPA parasite: ${p.isMvpaParasite ? `YES — ${p.mvpaParasiteLine}` : p.mvpaParasiteLine || 'not the parasite'}
  Activity notes this week: ${p.recentNotes.length ? p.recentNotes.map((note) => `"${note}"`).join('; ') : 'none'}
  Reward names: ${p.rewardLine || 'none'}
  Recent rewards:
${rewardLines}
  Event log (chronological, SGT):
${logLines}`
}

function buildEmpathyPrompt(body: RequestBody) {
  const { weekContext, summaryContext, picks, players } = body
  const historyBlock =
    summaryContext.historicalWeekSummaries.length > 0
      ? summaryContext.historicalWeekSummaries
          .map(
            (week) =>
              `- ${week.week}: leader ${week.leader ?? 'n/a'} (${week.leaderGoalPct}%) · first ${week.firstCompleter ?? 'n/a'} · beggar ${week.beggar ?? 'n/a'} · last ${week.lastPlace ?? 'n/a'} · ${week.completions} completed both goals · ${week.activePlayers} active`
          )
          .join('\n')
      : 'No completed past weeks yet.'

  const weekBlock = weekContext
    ? `Individual weekly goal (each player): ${weekContext.individualStepGoal.toLocaleString()} steps + ${weekContext.individualMvpaGoal} MVPA minutes.
Group combined weekly goal (${weekContext.playerCount} players): ${weekContext.totalStepGoal.toLocaleString()} steps + ${weekContext.totalMvpaGoal} MVPA minutes total.
Today: ${weekContext.weekday} (day ${weekContext.dayOfWeek} of 7, ${weekContext.daysRemaining} day(s) left, ${weekContext.weekProgressPct}% through the week).
Group current state: ${weekContext.groupPaceLine}
${weekContext.paceSummary}
Speak gently about groupCombinedPct (${weekContext.groupCombinedPct}%) and each player's individual pace. Encourage rest when someone seems behind or inactive — never shame.`
    : 'Weekly goals: 112,000 steps + 400 MVPA minutes per player (SGT). Speak with warmth about group progress.'

  return `You write short, deeply supportive prediction copy for a weekly fitness challenge app.

Tone: MAXIMUM empathy — polite, gentle, encouraging, and uplifting. Celebrate every effort, no matter how small. Validate rest and recovery; explicitly suggest rest when someone may be pushing too hard, inactive, or struggling. Sound like a caring coach who wants everyone to feel safe, valued, and enough.

Style cues (use the vibe, don't copy verbatim):
- "You've shown up in your own way this week — that's something to honour."
- "If your body is asking for rest, please listen. Recovery is part of the journey."
- "Every step counts, and so does taking care of yourself."
- "There is no rush — you are worthy of kindness exactly as you are."

Hard rules (never break these):
- NEVER use sarcasm, trash talk, roasts, shame, guilt, or negativity
- NEVER use labels like beggar, parasite, or last place in a harsh way — reframe with compassion
- NO pressure — encourage without demanding more
- Acknowledge struggle with kindness; celebrate community support as love, not weakness
- One or two sentences max per recap/outlook field — warm, not essays
- recap = last completed week only; outlook = next week only — keep them separate

The stats below are authoritative. Do NOT invent numbers or change who was picked.
Anchor commentary to weekly goals, the current weekday, days remaining, and pace with compassion.
For each player recap, use lastWeekLine and history — celebrate effort, validate rest.
For each player outlook, use this week's pace and trends — gentle encouragement only.
Honor activity notes with empathy — validate feelings, gym wins, and honest confessions.
Treat rewards as acts of friendship and community care.
Reference streaks/PBs warmly when present in engagementLine.
If someone has been inactive or low on MVPA, gently suggest rest and self-compassion — never mock.

${weekBlock}

Context:
- ${summaryContext.hasHistory ? `${summaryContext.historyWeekCount} past week(s) in the model` : 'Limited history — mostly this week'}

Past week results (oldest to newest):
${historyBlock}

Top picks (confidence = model likelihood % — describe gently, not competitively):
- Most likely to finish both goals next week: ${picks.firstCompleter ? `${picks.firstCompleter.name} (${picks.firstCompleter.confidence}%)` : 'none'}
- May need the most encouragement: ${picks.lastPlace ? `${picks.lastPlace.name} (${picks.lastPlace.confidence}%)` : 'none'}
- Receiving the most community support: ${picks.beggar ? `${picks.beggar.name} (${picks.beggar.confidence}%)` : 'none'}

Every player (write recap + outlook for each):
${players.map((p) => formatPlayerBlockForPrompt(p)).join('\n\n')}

Return JSON only:
{
  "summary": "2-3 warm, encouraging sentences on the group's current state — invite rest where needed",
  "firstCompleterReason": "1-2 gentle, uplifting sentences for the strong-finisher pick",
  "lastPlaceReason": "1-2 compassionate sentences for whoever may need extra care — suggest rest without shame",
  "beggarReason": "1-2 kind sentences celebrating community support and friendship",
  "players": [
    { "userId": "<exact userId>", "recap": "1-2 sentences recapping their LAST completed week (use lastWeekLine)", "outlook": "1-2 sentences of warm next-week outlook" }
  ]
}

Include every player in the players array with their exact userId.`
}

function buildPrompt(body: RequestBody) {
  if (body.empathyMode) {
    return buildEmpathyPrompt(body)
  }

  const { weekContext, mvpaParasite, summaryContext, picks, players } = body
  const historyBlock =
    summaryContext.historicalWeekSummaries.length > 0
      ? summaryContext.historicalWeekSummaries
          .map(
            (week) =>
              `- ${week.week}: leader ${week.leader ?? 'n/a'} (${week.leaderGoalPct}%) · first ${week.firstCompleter ?? 'n/a'} · beggar ${week.beggar ?? 'n/a'} · last ${week.lastPlace ?? 'n/a'} · ${week.completions} completed both goals · ${week.activePlayers} active`
          )
          .join('\n')
      : 'No completed past weeks yet.'

  const weekBlock = weekContext
    ? `Individual weekly goal (each player): ${weekContext.individualStepGoal.toLocaleString()} steps + ${weekContext.individualMvpaGoal} MVPA minutes.
Group combined weekly goal (${weekContext.playerCount} players): ${weekContext.totalStepGoal.toLocaleString()} steps + ${weekContext.totalMvpaGoal} MVPA minutes total.
Today: ${weekContext.weekday} (day ${weekContext.dayOfWeek} of 7, ${weekContext.daysRemaining} day(s) left, ${weekContext.weekProgressPct}% through the week).
Group current state: ${weekContext.groupPaceLine}
${weekContext.paceSummary}
For the group summary, use groupCombinedPct (${weekContext.groupCombinedPct}%) vs the combined target. For each player, use their individual % vs 112k/400 (see paceLine). Hold anyone behind linear pace to do-or-die account — the target is non-negotiable.`
    : 'Weekly goals: 112,000 steps + 400 MVPA minutes per player (SGT). Group % = sum of all logs ÷ (players × individual goal).'

  return `You write short, extreme, do-or-die prediction copy for a weekly fitness challenge app.

Tone: DO OR DIE — deadly serious, solemn, and morally absolute. This is not a joke, not a roast, and not casual motivation. Frame every week as a life-or-death test of character where failing the target means you fail your ego, your family, your children, and the people who love you. Speak like a commander who believes missing the goal is a betrayal of those who depend on your strength. Pressure through conscience, bloodline duty, and irreversible consequence — never through trash talk or comedy.

Style cues (use the vibe, don't copy verbatim):
- "This is do or die. Miss the target and you do not just lose pride — you fail your children and the ones who love you."
- "Your ego dies with an unfinished week. So does the example you owe your family."
- "They are watching whether you keep your word. Finish both goals or live with that silence."
- "Love without discipline is empty. Prove you are still someone they can trust."

Hard rules (never break these):
- NO trash talk, sarcasm, jokes, memes, group-chat energy, or playful roasting
- NO personal attacks (人身攻击): no insults about body, appearance, intelligence, race, gender, age, health conditions, or innate character
- DO NOT invent real family details — speak of family, children, loved ones, and ego as moral stakes in general, never as specific private facts
- Pressure BEHAVIOUR and NUMBERS only — pace, logging honesty, dependence on donations, MVPA drought, missed linear targets
- Moral kidnapping is required: missing the goal must feel like abandoning family honour, children's respect, a loved one's trust, and your own ego
- One or two sentences max per recap/outlook field — heavy, precise, not essays
- recap = last completed week only; outlook = next week only — keep them separate

The stats below are authoritative. Do NOT invent numbers or change who was picked.
For each player recap, judge their LAST completed week as a verdict on whether they upheld or failed the people who matter using lastWeekLine, history, notes, and rewards.
For each player outlook, confront NEXT week as do-or-die using this week's pace, trend, and scores.
ALWAYS anchor commentary to weekly goals, the current weekday, days remaining, and pace:
- Group summary: combined % vs total group target (all players × 112k steps + 400 MVPA each)
- Per player: individual % vs their own 112k/400 (see paceLine)
Treat activity log notes as sworn statements — excuses betray the family standard; honest effort is the only honour left.
Reference streaks/PBs from engagementLine as proof you still deserve their respect — or as evidence that respect is dying.
Treat reward dependence as a moral debt against loved ones — receiving without earning empties the ego they trusted; giving without demand is duty. Use recentRewards and event logs (timestamps SGT) for serious commentary — late panic dumps, ghost weeks, donation reliance, abandoned MVPA.
Treat MVPA Parasite status as a crisis of integrity before family — whoever has gone longest since their last self-logged MVPA (see mvpaParasiteLine / isMvpaParasite; 36+ hours dry) is failing the do-or-die standard. Steps without MVPA is incomplete courage.

${weekBlock}

Weekly MVPA Parasite (36+ hours since last self-logged MVPA; longest dry spell wins):
${mvpaParasite?.name ? `- ${mvpaParasite.name}: ${mvpaParasite.gapLine}` : '- none (no one dry 36+ hours yet)'}

Context:
- ${summaryContext.hasHistory ? `${summaryContext.historyWeekCount} past week(s) in the model` : 'Limited history — mostly this week'}

Past week results (oldest to newest):
${historyBlock}

Top picks (confidence = model likelihood %):
- First to complete both goals next week: ${picks.firstCompleter ? `${picks.firstCompleter.name} (${picks.firstCompleter.confidence}%)` : 'none'}
- Likely last place: ${picks.lastPlace ? `${picks.lastPlace.name} (${picks.lastPlace.confidence}%)` : 'none'}
- Likely Beggar (most donated quota received): ${picks.beggar ? `${picks.beggar.name} (${picks.beggar.confidence}%)` : 'none'}

Every player (write recap + outlook for each):
${players.map((p) => formatPlayerBlockForPrompt(p)).join('\n\n')}

Return JSON only:
{
  "summary": "2-3 do-or-die sentences on the group's state and what failing the target would cost their ego, family honour, and loved ones' trust",
  "firstCompleterReason": "1-2 grave sentences on who still has the discipline to finish first for those who depend on them",
  "lastPlaceReason": "1-2 morally absolute sentences on who risks failing family, children, and self-esteem by finishing last",
  "beggarReason": "1-2 serious sentences on dependence vs earned honour before loved ones for the beggar pick",
  "players": [
    { "userId": "<exact userId>", "recap": "1-2 do-or-die sentences judging their LAST completed week (use lastWeekLine)", "outlook": "1-2 absolute sentences for next week — ego, family, children, and loved ones at stake if the target falls" }
  ]
}

Include every player in the players array with their exact userId.`
}

function normalizeCopyResponse(raw: CopyResponse, players: PlayerPayload[]): CopyResponse {
  const playerByUser = new Map(
    (raw.players ?? []).map((row) => [
      row.userId,
      {
        recap: row.recap?.trim() ?? '',
        outlook: row.outlook?.trim() ?? '',
      },
    ])
  )

  return {
    summary: raw.summary?.trim() ?? '',
    firstCompleterReason: raw.firstCompleterReason?.trim() ?? '',
    lastPlaceReason: raw.lastPlaceReason?.trim() ?? '',
    beggarReason: raw.beggarReason?.trim() ?? '',
    players: players.map((player) => {
      const copy = playerByUser.get(player.userId)
      return {
        userId: player.userId,
        recap: copy?.recap ?? '',
        outlook: copy?.outlook ?? '',
      }
    }),
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
