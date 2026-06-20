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

export default function PredictionBoard({ predictions, loading, currentUserId }) {
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

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">AI Predictions · Next Week</h2>
        <p className="mt-0.5 text-sm text-slate-400">
          Forecast from weekly history, activity frequency, and donation patterns
        </p>
      </div>

      <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">Current state</p>
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

      <p className="text-xs text-slate-500">
        {predictions.hasHistory
          ? `Model uses ${predictions.historyWeekCount} completed week(s) plus this week's live pace.`
          : "Model uses this week's pace until more weekly history is available."}
      </p>
    </section>
  )
}
