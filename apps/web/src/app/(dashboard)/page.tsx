'use client'

import { MemoryCard } from '@/components/memory-card'
import { MemoryFilters } from '@/components/memory-filters'
import { TimelineMarker } from '@/components/timeline-marker'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { filters, setFilter, resetFilters, setPage } = useFilters()
  const { data, isLoading, error } = useMemories(filters)

  const memories = data?.data || []
  const pagination = data?.pagination

  // Group memories by month/year for timeline markers
  const groupedMemories = memories.reduce(
    (acc, memory) => {
      const date = new Date(memory.memoryDate)
      const key = `${date.getFullYear()}-${date.getMonth()}`
      if (!acc[key]) {
        acc[key] = {
          date: memory.memoryDate,
          memories: [],
        }
      }
      acc[key].memories.push(memory)
      return acc
    },
    {} as Record<string, { date: string; memories: typeof memories }>,
  )

  const groups = Object.values(groupedMemories)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
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
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">Carregando memórias...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-red-500">Erro ao carregar memórias</div>
        </div>
      ) : memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-card py-20">
          <p className="text-lg text-muted">Nenhuma memória encontrada</p>
          <p className="mt-2 text-sm text-muted">Comece criando sua primeira memória!</p>
          <Link href="/memories/new" className="mt-4">
            <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary">
              <Plus className="h-5 w-5" />
              Criar Memória
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group, groupIndex) => (
            <div key={group.date} className="flex gap-6">
              <div className="hidden w-24 shrink-0 md:block">
                <TimelineMarker date={group.date} isLast={groupIndex === groups.length - 1} />
              </div>
              <div className="flex-1 space-y-4">
                {group.memories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} />
                ))}
              </div>
            </div>
          ))}

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
