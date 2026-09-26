'use client'

import { MemoryFilters } from '@/components/memory-filters'
import { MemoryTimeline } from '@/components/memory-timeline'
import { useAuth } from '@/hooks/use-auth'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const { filters, setFilter, resetFilters, setPage } = useFilters()
  const { data, isLoading, error, refetch } = useMemories(filters)

  const memories = data?.data || []
  const pagination = data?.pagination
  const ctaHref = isAuthenticated ? '/memories/new' : '/login'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text">Sua Timeline</h1>
          <p className="mt-2 text-muted">
            {isAuthenticated
              ? 'Suas memórias, sua trilha sonora'
              : 'Memórias públicas compartilhadas pela comunidade'}
          </p>
        </div>
        <Link href={ctaHref}>
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
        emptyTitle={
          isAuthenticated ? 'Nenhuma memória encontrada' : 'Nenhuma memória pública encontrada'
        }
        emptyDescription={
          isAuthenticated
            ? 'Crie sua primeira memória para começar!'
            : 'Entre na sua conta para criar sua primeira memória.'
        }
        emptyAction={
          <Link href={ctaHref} className="mt-4">
            <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
              <Plus className="h-5 w-5" />
              Nova Memória
            </Button>
          </Link>
        }
      />
    </div>
  )
}
