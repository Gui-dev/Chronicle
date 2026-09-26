'use client'

import { MemoryCard } from '@/components/memory-card'
import { RequireAuth } from '@/components/require-auth'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function MemoriesPage() {
  const { filters, setPage } = useFilters()
  const { data, isLoading, error, refetch } = useMemories(filters)

  const memories = data?.data || []
  const pagination = data?.pagination

  return (
    <RequireAuth>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text">Memórias</h1>
            <p className="mt-2 text-muted">Todas as suas memórias</p>
          </div>
          <Link href="/memories/new" data-testid="new-memory-button">
            <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
              <Plus className="h-5 w-5" />
              Nova Memória
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded-full bg-card" />
              <div className="h-3 w-20 animate-pulse rounded-full bg-card" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-red-500">Erro ao carregar memórias</p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="rounded-lg border-card text-text hover:border-primary hover:text-primary"
            >
              Tentar novamente
            </Button>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-card py-20">
            <p className="text-lg text-muted">Nenhuma memória encontrada</p>
            <p className="mt-2 text-sm text-muted">Crie sua primeira memória para começar!</p>
            <Link href="/memories/new" className="mt-4">
              <Button className="inline-flex items-center gap-2 rounded-lg bg-primary text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
                <Plus className="h-5 w-5" />
                Nova Memória
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
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
    </RequireAuth>
  )
}
