'use client'

import { MemoryFilters } from '@/components/memory-filters'
import { MemoryTimeline } from '@/components/memory-timeline'
import { RequireAuth } from '@/components/require-auth'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function MyMemoriesPage() {
  const { filters, setFilter, resetFilters, setPage } = useFilters()
  const { data, isLoading, error, refetch } = useMemories({ ...filters, mine: true })

  const memories = data?.data || []
  const pagination = data?.pagination

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text">Minhas Memórias</h1>
            <p className="mt-2 text-muted">Tudo o que você já registrou</p>
          </div>
          <Link href="/memories/new">
            <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
              <Plus className="h-5 w-5" />
              Nova Memória
            </Button>
          </Link>
        </div>

        <MemoryFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />

        <MemoryTimeline
          memories={memories}
          pagination={pagination}
          isLoading={isLoading}
          error={error}
          onRetry={() => {
            refetch()
          }}
          onPageChange={setPage}
          emptyTitle="Nenhuma memória encontrada"
          emptyDescription="Crie sua primeira memória para começar!"
          emptyAction={
            <Link href="/memories/new" className="mt-4">
              <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
                <Plus className="h-5 w-5" />
                Nova Memória
              </Button>
            </Link>
          }
        />
      </div>
    </RequireAuth>
  )
}
