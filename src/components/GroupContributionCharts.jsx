import { buildGroupContributionChart } from '../lib/groupContribution'
import { WEEKLY_GOALS } from '../lib/supabaseClient'
import { formatNumber } from '../lib/weekUtils'

function ContributionBar({ title, unit, data }) {
  const {
    groupPct,
    exceededPct,
    remainingPct,
    segments,
    exceededSegments,
    groupGoal,
    totalLogged,
  } = data

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-300">{title}</h4>
        <span className="text-xs tabular-nums text-slate-500">
          {formatNumber(totalLogged)} / {formatNumber(groupGoal)} {unit} · {groupPct}% of group goal
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Group goal (100%)
        </p>
        <div
          className="relative h-7 overflow-hidden rounded-lg bg-slate-800"
          role="img"
          aria-label={`${title} group contribution ${groupPct}%`}
        >
          <div className="flex h-full min-w-0">
            {segments.map((segment) =>
              segment.barPct > 0 ? (
                <div
                  key={segment.userId}
                  className="h-full min-w-0 transition-[width] duration-300"
                  style={{
                    width: `${segment.barPct}%`,
                    backgroundColor: segment.color,
                  }}
                  title={`${segment.name}: ${segment.goalSharePct.toFixed(1)}% of group goal (${formatNumber(segment.value)} ${unit})`}
                />
              ) : null
            )}
            {remainingPct > 0 && (
              <div
                className="h-full bg-slate-700/45"
                style={{ width: `${remainingPct}%` }}
                title={`${remainingPct.toFixed(1)}% of group goal remaining`}
              />
            )}
          </div>
        </div>
      </div>

      {exceededPct > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400/90">
            Exceeded group goal +{exceededPct}%
          </p>
          <div
            className="relative h-5 overflow-hidden rounded-lg border border-amber-500/25 bg-amber-950/20"
            role="img"
            aria-label={`${title} exceeded group goal by ${exceededPct}%`}
          >
            <div className="flex h-full" style={{ width: `${exceededPct}%` }}>
              {exceededSegments.map((segment) =>
                segment.barPct > 0 ? (
                  <div
                    key={segment.userId}
                    className="h-full min-w-0"
                    style={{
                      width: `${(segment.barPct / exceededPct) * 100}%`,
                      backgroundColor: segment.color,
                      opacity: 0.9,
                    }}
                    title={`${segment.name}: +${segment.barPct.toFixed(1)}% over group goal`}
                  />
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.userId}
            className="flex items-center gap-1.5 text-[11px] text-slate-400"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: segment.color }}
            />
            <span className="truncate">{segment.name}</span>
            <span className="tabular-nums text-slate-500">
              {segment.goalSharePct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function GroupContributionCharts({ users }) {
  if (!users.length) return null

  const stepsData = buildGroupContributionChart({
    users,
    goalPerPlayer: WEEKLY_GOALS.steps,
    valueKey: 'total_steps',
  })

  const mvpaData = buildGroupContributionChart({
    users,
    goalPerPlayer: WEEKLY_GOALS.mvpaMinutes,
    valueKey: 'total_mvpa',
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Weekly group contribution</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Each player&apos;s share of the combined weekly goal ({formatNumber(WEEKLY_GOALS.steps)}{' '}
          steps & {WEEKLY_GOALS.mvpaMinutes} MVPA min per person)
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContributionBar title="Steps" unit="steps" data={stepsData} />
        <ContributionBar title="MVPA" unit="min" data={mvpaData} />
      </div>
    </div>
  )
}
