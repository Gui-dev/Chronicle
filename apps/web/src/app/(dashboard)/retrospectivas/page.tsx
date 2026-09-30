'use client'

import { RequireAuth } from '@/components/require-auth'
import { type OverviewCount, type OverviewResponse, useOverview } from '@/hooks/use-overview'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const RetrospectMap = dynamic(() => import('@/components/retrospect-map'), { ssr: false })

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

const selectClass =
  'rounded-lg border border-card bg-card px-3 py-2 text-sm text-text focus:border-primary focus:outline-none'

export default function RetrospectivasPage() {
  return (
    <RequireAuth>
      <RetrospectivasContent />
    </RequireAuth>
  )
}

function RetrospectivasContent() {
  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)
  const { data, isLoading, isError, refetch } = useOverview(year, month)
  const overview = data?.data

  const servedYear = overview?.period.year ?? new Date().getUTCFullYear()
  const yearOptions = overview
    ? [...new Set([servedYear, ...overview.years])].sort((a, b) => b - a)
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-text">Retrospectivas</h1>
        {overview && (
          <div className="flex gap-2">
            <select
              data-testid="retro-year"
              aria-label="Ano"
              className={selectClass}
              value={String(year ?? servedYear)}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              data-testid="retro-month"
              aria-label="Mês"
              className={selectClass}
              value={month !== undefined ? String(month) : ''}
              onChange={(event) =>
                setMonth(event.target.value === '' ? undefined : Number(event.target.value))
              }
            >
              <option value="">Todos os meses</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && (
        <div
          data-testid="retro-loading"
          className="h-40 animate-pulse rounded-xl border border-card bg-card"
        />
      )}

      {isError && !isLoading && (
        <div
          data-testid="retro-error"
          className="flex flex-col items-center gap-3 rounded-xl border border-card bg-card py-10"
        >
          <p className="text-sm text-muted">Erro ao carregar as retrospectivas.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-primary underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {overview && !isLoading && !isError && <OverviewBody overview={overview} />}
    </div>
  )
}

function OverviewBody({ overview }: { overview: OverviewResponse }) {
  const empty = overview.summary.memories === 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {empty ? (
          <div
            data-testid="retro-empty"
            className="rounded-xl border-2 border-dashed border-card py-12 text-center text-sm text-muted"
          >
            Nenhuma memória no período.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                testid="retro-stat-memories"
                label="Memórias"
                value={overview.summary.memories}
              />
              <StatCard
                testid="retro-stat-people"
                label="Pessoas"
                value={overview.summary.people}
              />
              <StatCard
                testid="retro-stat-places"
                label="Lugares"
                value={overview.summary.places}
              />
              <div
                data-testid="retro-stat-top-tags"
                className="rounded-xl border border-card bg-card p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                  Top tags
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {overview.summary.topTags.length === 0 ? (
                    <span className="text-sm text-muted">—</span>
                  ) : (
                    overview.summary.topTags.map((tag) => (
                      <span
                        key={tag.name}
                        className="rounded-full bg-background px-2 py-0.5 text-xs text-primary"
                      >
                        #{tag.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <RecurrenceCard
                testid="retro-rec-people"
                title="Pessoas"
                items={overview.recurrences.people}
              />
              <RecurrenceCard
                testid="retro-rec-places"
                title="Lugares"
                items={overview.recurrences.places}
              />
              <RecurrenceCard
                testid="retro-rec-themes"
                title="Temas"
                items={overview.recurrences.themes}
                note="contagem só de memórias com narrativa gerada"
              />
            </div>
          </>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        {overview.places.length > 0 ? (
          <RetrospectMap places={overview.places} />
        ) : (
          <div
            data-testid="retro-map-empty"
            className="rounded-xl border border-card bg-card p-6 text-sm text-muted"
          >
            Nenhum lugar com localização registrada.
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ testid, label, value }: { testid: string; label: string; value: number }) {
  return (
    <div data-testid={testid} className="rounded-xl border border-card bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  )
}

function RecurrenceCard({
  testid,
  title,
  items,
  note,
}: {
  testid: string
  title: string
  items: OverviewCount[]
  note?: string
}) {
  return (
    <div data-testid={testid} className="rounded-xl border border-card bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem dados no período</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.name} className="truncate text-sm text-text">
              {item.name} ×{item.count}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  )
}
