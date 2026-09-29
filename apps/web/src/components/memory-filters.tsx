'use client'

import type { MemoryFiltersInput } from '@chronicle/schemas'
import { Button, Input } from '@chronicle/ui'
import { X } from 'lucide-react'

interface MemoryFiltersProps {
  filters: MemoryFiltersInput
  onFilterChange: <K extends keyof MemoryFiltersInput>(key: K, value: MemoryFiltersInput[K]) => void
  onReset: () => void
}

export function MemoryFilters({ filters, onFilterChange, onReset }: MemoryFiltersProps) {
  // UTC, not local: the API reads a month without a year as "that month of the
  // current UTC year", so the option list and the year `onMonthChange` writes
  // below have to come from the same clock. A local clock would put an
  // off-by-one year in the select for the few hours around New Year, and
  // whichever way it fell, the select would show a year the API is not
  // filtering by.
  const currentYear = new Date().getUTCFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i)

  const months = [
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Fev' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Abr' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Ago' },
    { value: 9, label: 'Set' },
    { value: 10, label: 'Out' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dez' },
  ]

  // `search` is deliberately absent: the timeline filter bar no longer edits it.
  // The text query belongs to the navbar's search dialog and the /search page,
  // which build their own query instead of going through this bar.
  const hasActiveFilters =
    filters.year ||
    filters.month ||
    filters.weather ||
    filters.location ||
    filters.tag ||
    filters.hasArtwork !== undefined

  const onMonthChange = (value: string) => {
    onFilterChange('month', value ? Number(value) : undefined)
    // A bare month is resolved server-side against the current year, which
    // silently hides every other year's memories. Sending the year alongside it
    // makes the applied range visible in the year select instead of implied.
    if (value && !filters.year) onFilterChange('year', new Date().getUTCFullYear())
  }

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.year || ''}
          onChange={(e) =>
            onFilterChange('year', e.target.value ? Number(e.target.value) : undefined)
          }
          data-testid="year"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Ano</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={filters.month || ''}
          onChange={(e) => onMonthChange(e.target.value)}
          data-testid="month"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Mês</option>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>

        <Input
          value={filters.weather || ''}
          onChange={(e) => onFilterChange('weather', e.target.value || undefined)}
          placeholder="Clima"
          data-testid="weather"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <Input
          value={filters.location || ''}
          onChange={(e) => onFilterChange('location', e.target.value || undefined)}
          placeholder="Local"
          data-testid="location"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <Input
          value={filters.tag || ''}
          onChange={(e) => onFilterChange('tag', e.target.value || undefined)}
          placeholder="Tag"
          data-testid="tag"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <select
          value={filters.hasArtwork === undefined ? '' : filters.hasArtwork ? 'true' : 'false'}
          onChange={(e) =>
            onFilterChange(
              'hasArtwork',
              e.target.value === '' ? undefined : e.target.value === 'true',
            )
          }
          data-testid="hasArtwork"
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Artwork</option>
          <option value="true">Com artwork</option>
          <option value="false">Sem artwork</option>
        </select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-10 text-muted hover:text-primary"
          >
            <X className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  )
}
