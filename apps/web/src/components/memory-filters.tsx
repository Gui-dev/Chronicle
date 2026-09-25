'use client'

import type { MemoryFiltersInput } from '@chronicle/schemas'
import { Button, Input } from '@chronicle/ui'
import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface MemoryFiltersProps {
  filters: MemoryFiltersInput
  onFilterChange: <K extends keyof MemoryFiltersInput>(key: K, value: MemoryFiltersInput[K]) => void
  onReset: () => void
}

export function MemoryFilters({ filters, onFilterChange, onReset }: MemoryFiltersProps) {
  const currentYear = new Date().getFullYear()
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

  const hasActiveFilters =
    filters.search ||
    filters.year ||
    filters.month ||
    filters.weather ||
    filters.location ||
    filters.tag

  const [searchInput, setSearchInput] = useState(filters.search || '')

  useEffect(() => {
    if (!filters.search && searchInput) {
      setSearchInput('')
      return
    }
    const timer = setTimeout(() => {
      const next = searchInput || undefined
      if (next !== filters.search) {
        onFilterChange('search', next)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.search, onFilterChange])

  return (
    <div className="mb-8 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            type="text"
            placeholder="Buscar memórias..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 rounded-lg border-2 border-card bg-card pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

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
          onChange={(e) =>
            onFilterChange('month', e.target.value ? Number(e.target.value) : undefined)
          }
          className="h-10 rounded-lg border-2 border-card bg-card px-3 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">Mês</option>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              onReset()
            }}
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
