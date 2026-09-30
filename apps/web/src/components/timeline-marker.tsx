const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

interface TimelineMarkerProps {
  date: string
}

// Month header for the timeline: `setembro de 2026`, UTC (spec §4, decision
// 11). Deliberately not toLocaleDateString — a local timezone would move a
// card across the month boundary near midnight, disagreeing with the UTC
// windows the API filters on. This component was dead code before 7.5; the
// old `set. 2026` local format and the isLast rule/vertical-line visuals are
// gone with the rewrite.
export function TimelineMarker({ date }: TimelineMarkerProps) {
  const d = new Date(date)
  const label = `${MONTH_NAMES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`

  return (
    <div
      data-testid="timeline-marker"
      className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted"
    >
      {label}
    </div>
  )
}

export { MONTH_NAMES }
