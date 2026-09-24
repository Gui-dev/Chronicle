'use client'

import { MemoryCardFull } from '@/components/memory-card'
import { MemoryFilters } from '@/components/memory-filters'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'

function formatElapsed(dateA: string, dateB: string): string {
  const a = new Date(dateA)
  const b = new Date(dateB)
  const diffMs = b.getTime() - a.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'No mesmo dia'
  if (diffDays === 1) return '1 dia depois'
  if (diffDays < 7) return `${diffDays} dias depois`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} depois`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'} depois`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} ${years === 1 ? 'ano' : 'anos'} depois`
}

export default function DashboardPage() {
  const { filters, setFilter, resetFilters, setPage } = useFilters()
  const { data, isLoading, error } = useMemories(filters)

  const memories = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text">Sua Timeline</h1>
          <p className="mt-2 text-muted">Suas memórias, sua trilha sonora</p>
        </div>
        <Link href="/memories/new">
          <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
            <Plus className="h-5 w-5" />
            Nova Memória
          </Button>
        </Link>
      </div>

      <MemoryFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />

      {isLoading ? (
        <div className="space-y-8">
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
                  <div className="h-4 w-64 animate-pulse rounded bg-card" />
                </div>
                <div className="h-20 w-20 animate-pulse rounded-xl bg-card" />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div className="h-6 w-20 animate-pulse rounded-xl bg-card" />
                <div className="h-6 w-16 animate-pulse rounded-xl bg-card" />
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
                  <div className="h-4 w-64 animate-pulse rounded bg-card" />
                </div>
                <div className="h-20 w-20 animate-pulse rounded-xl bg-card" />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div className="h-6 w-20 animate-pulse rounded-xl bg-card" />
                <div className="h-6 w-16 animate-pulse rounded-xl bg-card" />
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
                  <div className="h-4 w-64 animate-pulse rounded bg-card" />
                </div>
                <div className="h-20 w-20 animate-pulse rounded-xl bg-card" />
              </div>
              <div className="flex flex-wrap gap-2.5">
                <div className="h-6 w-20 animate-pulse rounded-xl bg-card" />
                <div className="h-6 w-16 animate-pulse rounded-xl bg-card" />
              </div>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-red-500">Erro ao carregar memórias</div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-card py-20">
          <p className="text-lg text-muted">Nenhuma memória encontrada</p>
          <p className="mt-2 text-sm text-muted">Comece criando sua primeira memória!</p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-10">
          <div className="absolute left-[7px] sm:left-[11px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-primary opacity-80" />

          <div className="space-y-8">
            {memories.map((memory, index) => (
              <div key={memory.id}>
                {index > 0 && (
                  <div className="my-6 flex items-center gap-3 pl-4">
                    <div className="h-px flex-1 bg-card" />
                    <span className="rounded-full border border-primary/30 bg-card px-3 py-1 font-mono text-xs font-bold text-primary">
                      ⏳ {formatElapsed(memories[index - 1].memoryDate, memory.memoryDate)}
                    </span>
                    <div className="h-px flex-1 bg-card" />
                  </div>
                )}
                <MemoryCardFull memory={memory} />
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded-lg border-card text-text hover:border-primary hover:text-primary"
              >
                Anterior
              </Button>
              <span className="px-4 text-sm text-muted">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="rounded-lg border-card text-text hover:border-primary hover:text-primary"
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
