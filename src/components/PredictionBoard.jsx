function PredictionLoadingState({ title, message, empathyMode = false }) {
  return (
    <section className="card">
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-12">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p
          className={`text-center text-sm font-medium ${empathyMode ? 'text-sky-600' : 'text-brand-400'}`}
        >
          {message}
        </p>
        <div
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label={message}
          aria-busy="true"
        >
          <div
            className={`h-full w-1/3 rounded-full motion-reduce:animate-none motion-reduce:translate-x-0 ${
              empathyMode ? 'bg-sky-400 animate-gemini-bar' : 'bg-brand-500 animate-gemini-bar'
            }`}
          />
        </div>
      </div>
    </section>
  )
}

function PredictionCard({ icon, title, prediction, accentClass }) {
  if (!prediction) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="mt-2 text-sm text-slate-500">Not enough data yet</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border bg-slate-800/30 p-4 ${accentClass}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {icon} {title}
        </p>
        <span className="shrink-0 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
          {prediction.confidence}% likely
        </span>
      </div>
      <p className="text-lg font-bold text-white">{prediction.displayName}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{prediction.reason}</p>
    </div>
  )
}

function PlayerPredictionRow({ player, isCurrentUser, empathyMode = false }) {
  return (
    <li
      className={`rounded-xl border px-3 py-3 ${
        isCurrentUser
          ? empathyMode
            ? 'border-sky-300/50 bg-sky-50/60'
            : 'border-brand-500/30 bg-brand-950/15'
          : 'border-slate-800 bg-slate-800/35'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
          {player.rank}
        </span>
        <p className="font-semibold text-slate-100">{player.displayName}</p>
        {!empathyMode &&
          player.labels.map((tag) => (
            <span
              key={tag.label}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-400"
            >
              {tag.emoji} {tag.label}
            </span>
          ))}
      </div>

      <p className="mb-2 font-mono text-[11px] leading-relaxed text-slate-500">{player.statsLine}</p>

      <div className="space-y-2.5">
        <div>
          <p
            className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
              empathyMode ? 'text-violet-500' : 'text-slate-500'
            }`}
          >
            Last week recap
          </p>
          <p className="text-sm leading-relaxed text-slate-400">{player.recap}</p>
        </div>
        <div>
          <p
            className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
              empathyMode ? 'text-sky-600' : 'text-brand-400/90'
            }`}
          >
            Next week outlook
          </p>
          <p className="text-sm leading-relaxed text-slate-300">{player.outlook}</p>
        </div>
      </div>

      {!empathyMode && (
        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <span>First {player.scores.firstCompleter}%</span>
          <span>·</span>
          <span>Last {player.scores.lastPlace}%</span>
          <span>·</span>
          <span>Beggar {player.scores.beggar}%</span>
        </div>
      )}
    </li>
  )
}

export default function PredictionBoard({
  predictions,
  loading,
  aiCopyLoading,
  currentUserId,
  empathyMode = false,
}) {
  const title = empathyMode ? 'Gentle Outlook · Recap & Next Week' : 'AI Predictions · Recap & Next Week'

  if (loading) {
    return (
      <PredictionLoadingState
        title={title}
        message={empathyMode ? 'Preparing a gentle outlook…' : 'Loading predictions…'}
        empathyMode={empathyMode}
      />
    )
  }

  if (aiCopyLoading) {
    return (
      <PredictionLoadingState
        title={title}
        message={
          empathyMode
            ? 'Crafting warm encouragement… please wait'
            : 'Gemini Reviewing... Please wait'
        }
        empathyMode={empathyMode}
      />
    )
  }

  if (!predictions) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">Predictions unavailable</p>
      </section>
    )
  }

  function highlightYou(name, userId) {
    if (userId !== currentUserId) return name
    return `${name} (you)`
  }

  const firstCompleter = predictions.firstCompleter && {
    ...predictions.firstCompleter,
    displayName: highlightYou(
      predictions.firstCompleter.displayName,
      predictions.firstCompleter.userId
    ),
  }
  const lastPlace = predictions.lastPlace && {
    ...predictions.lastPlace,
    displayName: highlightYou(predictions.lastPlace.displayName, predictions.lastPlace.userId),
  }
  const beggar = predictions.beggar && {
    ...predictions.beggar,
    displayName: highlightYou(predictions.beggar.displayName, predictions.beggar.userId),
  }

  const playerPredictions = (predictions.playerPredictions ?? []).map((player) => ({
    ...player,
    displayName: highlightYou(player.displayName, player.userId),
  }))

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {empathyMode
              ? 'Warm recap of last week · gentle outlook ahead'
              : 'Last week recap · next week picks · copy by Gemini'}
          </p>
        </div>
        {predictions.aiGenerated ? (
          <span className="shrink-0 text-xs text-slate-500">
            {empathyMode ? 'Gemini · Gentle' : 'Gemini · Live'}
          </span>
        ) : predictions.aiCopyFallback ? (
          <span className="shrink-0 text-xs text-slate-500">Offline summary</span>
        ) : null}
      </div>

      <div
        className={`rounded-xl border px-4 py-3 ${
          empathyMode
            ? 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white/80 to-violet-50/70'
            : 'border-brand-500/20 bg-brand-950/20'
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            empathyMode ? 'text-sky-600' : 'text-brand-400'
          }`}
        >
          {empathyMode ? 'Gentle check-in' : 'Current state'}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{predictions.summary}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PredictionCard
          icon={empathyMode ? '✨' : '🪖'}
          title={empathyMode ? 'Likely to finish strong' : 'First to complete'}
          prediction={firstCompleter}
          accentClass={empathyMode ? 'border-sky-200/60' : 'border-emerald-500/25'}
        />
        <PredictionCard
          icon={empathyMode ? '🤍' : '🐌'}
          title={empathyMode ? 'May need extra care' : 'Likely last place'}
          prediction={lastPlace}
          accentClass={empathyMode ? 'border-violet-200/60' : 'border-slate-600'}
        />
        <PredictionCard
          icon={empathyMode ? '🤝' : '♿'}
          title={empathyMode ? 'Receiving community support' : 'Likely beggar'}
          prediction={beggar}
          accentClass={empathyMode ? 'border-amber-200/60' : 'border-reward-500/25'}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">
          {empathyMode ? 'Every player · recap & next week' : 'Every player · recap & next week'}
        </h3>
        {playerPredictions.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No players yet</p>
        ) : (
          <ul className="space-y-2.5">
            {playerPredictions.map((player) => (
              <PlayerPredictionRow
                key={player.userId}
                player={player}
                isCurrentUser={player.userId === currentUserId}
                empathyMode={empathyMode}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {empathyMode
          ? 'Recaps look at last week; outlooks are gentle guidance only — please rest whenever your body needs it.'
          : predictions.hasHistory
            ? `Recaps use last week's results; forecasts blend ${predictions.historyWeekCount} past week(s) with this week's live pace.`
            : "Recaps appear once a week completes; forecasts use this week's pace until more history is available."}
      </p>
    </section>
  )
}
