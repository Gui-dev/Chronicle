'use client'

import { useActivity } from '@/hooks/use-activity'
import { useVisit } from '@/hooks/use-visit'
import { useYearAgo } from '@/hooks/use-year-ago'
import { useEffect } from 'react'

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

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function formatUtcMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function HomeRetrospectStrip() {
  const yearAgo = useYearAgo()
  const activity = useActivity()
  const visit = useVisit()
  const { mutate: bumpVisit } = visit

  useEffect(() => {
    if (activity.isSuccess) {
      bumpVisit()
    }
  }, [activity.isSuccess, bumpVisit])

  const count = activity.data?.data.count ?? 0
  const since = activity.data?.data.since
  const items = yearAgo.data?.data ?? []
  const isLoading = yearAgo.isLoading || activity.isLoading
  const hasError = yearAgo.isError || activity.isError

  if (isLoading) {
    return (
      <div
        data-testid="retro-strip-loading"
        className="mb-6 h-20 animate-pulse rounded-xl border border-card bg-card"
      />
    )
  }

  if (hasError) {
    return (
      <p data-testid="retro-strip-error" className="mb-6 text-sm text-muted">
        Não foi possível carregar a retrospectiva.
      </p>
    )
  }

  const showNew = count > 0 && since !== null
  const showYearAgo = items.length > 0

  if (!showNew && !showYearAgo) {
    return null
  }

  const weekday = since ? WEEKDAYS[new Date(since).getUTCDay()] : ''
  const newLabel =
    count === 1 ? `1 memória nova desde ${weekday}` : `${count} memórias novas desde ${weekday}`

  return (
    <div
      data-testid="retro-strip"
      aria-live="polite"
      className="mb-6 flex items-stretch gap-4 rounded-xl border border-card bg-card p-4"
    >
      {showNew && (
        <button
          type="button"
          data-testid="retro-new"
          onClick={() =>
            document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' })
          }
          className="flex shrink-0 flex-col justify-center rounded-lg border border-primary/40 px-3 py-2 text-left transition-colors hover:bg-primary/10"
        >
          <span data-testid="retro-new-count" className="text-sm font-semibold text-primary">
            {newLabel}
          </span>
          <span data-testid="retro-new-go" className="mt-0.5 text-xs text-muted">
            Ver na timeline →
          </span>
        </button>
      )}

      {showNew && showYearAgo && <div className="w-px shrink-0 bg-card" aria-hidden="true" />}

      {showYearAgo && (
        <section
          aria-label="Memórias de um ano atrás"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be focusable for keyboard scrolling
          tabIndex={0}
          className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto"
        >
          {items.map((memory) => (
            <div
              key={memory.id}
              data-testid={`retro-year-ago-${memory.id}`}
              className="shrink-0 rounded-lg border border-card/60 bg-background px-3 py-2"
            >
              <p data-testid="retro-year-ago-title" className="max-w-40 truncate text-sm text-text">
                {memory.title}
              </p>
              <p data-testid="retro-year-ago-date" className="mt-0.5 text-xs text-muted">
                {formatUtcMonthYear(memory.memoryDate)}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
