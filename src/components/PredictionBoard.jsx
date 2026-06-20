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

function PlayerTakeCard({ take, isCurrentUser }) {
  return (
    <li
      className={`rounded-xl border px-3 py-3 ${
        isCurrentUser
          ? 'border-brand-500/30 bg-brand-950/15'
          : 'border-slate-800 bg-slate-800/35'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
          {take.rank}
        </span>
        <p className="font-semibold text-slate-100">
          {take.displayName}
          {isCurrentUser && <span className="ml-1.5 text-xs font-normal text-brand-400">(you)</span>}
        </p>
        {take.tags.map((tag) => (
          <span
            key={tag.label}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-400"
          >
            {tag.emoji} {tag.label}
          </span>
        ))}
      </div>
      <p className="mb-2 font-mono text-[11px] leading-relaxed text-slate-500">{take.statsLine}</p>
      <p className="text-sm italic leading-relaxed text-amber-200/85">"{take.roast}"</p>
    </li>
  )
}

export default function PredictionBoard({ predictions, loading, refreshing, currentUserId }) {
  if (loading) {
    return (
      <section className="card">
        <p className="text-center text-slate-400">Loading predictions…</p>
      </section>
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

  const playerTakes = (predictions.playerTakes ?? []).map((take) => ({
    ...take,
    displayName: highlightYou(take.displayName, take.userId),
  }))

  return (
    <section className={`card space-y-4 transition-opacity ${refreshing ? 'opacity-80' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">AI Trash Talk · Next Week</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Stats-backed roasts for every player. Purely fictional bullying.
          </p>
        </div>
        {refreshing ? (
          <span className="shrink-0 rounded-full border border-brand-500/30 bg-brand-950/40 px-2.5 py-1 text-xs font-medium text-brand-400">
            Updating…
          </span>
        ) : predictions.updatedAt ? (
          <span className="shrink-0 text-xs text-slate-500">Live</span>
        ) : null}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">
          Oracle says
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{predictions.summary}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PredictionCard
          icon="🪖"
          title="First to complete"
          prediction={firstCompleter}
          accentClass="border-emerald-500/25"
        />
        <PredictionCard
          icon="🐌"
          title="Likely last place"
          prediction={lastPlace}
          accentClass="border-slate-600"
        />
        <PredictionCard
          icon="♿"
          title="Likely beggar"
          prediction={beggar}
          accentClass="border-reward-500/25"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Player-by-player breakdown</h3>
        {playerTakes.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No players to roast yet</p>
        ) : (
          <ul className="space-y-2.5">
            {playerTakes.map((take) => (
              <PlayerTakeCard
                key={take.userId}
                take={take}
                isCurrentUser={take.userId === currentUserId}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {predictions.hasHistory
          ? `Model uses ${predictions.historyWeekCount} completed week(s) plus this week's live pace.`
          : "Model uses this week's pace until more weekly history is available."}
      </p>
    </section>
  )
}
