'use client'

import { MemoryCardFull } from '@/components/memory-card'
import type { Memory, PaginatedResponse } from '@/hooks/use-memories'
import { formatElapsed } from '@/lib/format-elapsed'
import { Button } from '@chronicle/ui'
import type { ReactNode } from 'react'

interface MemoryTimelineProps {
  memories: Memory[]
  pagination?: PaginatedResponse['pagination']
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  onPageChange: (page: number) => void
  emptyTitle: string
  emptyDescription: string
  emptyAction?: ReactNode
}

function TimelineSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((slot) => (
        <div key={slot} className="relative">
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
      ))}
    </div>
  )
}

export function MemoryTimeline({
  memories,
  pagination,
  isLoading,
  error,
  onRetry,
  onPageChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: MemoryTimelineProps) {
  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-red-500">Erro ao carregar memórias</p>
        <Button
          variant="outline"
          onClick={onRetry}
          className="rounded-lg border-card text-text hover:border-primary hover:text-primary"
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-card py-20">
        <p className="text-lg text-muted">{emptyTitle}</p>
        <p className="mt-2 text-sm text-muted">{emptyDescription}</p>
        {emptyAction}
      </div>
    )
  }

  return (
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
            onClick={() => onPageChange(pagination.page - 1)}
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
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="rounded-lg border-card text-text hover:border-primary hover:text-primary"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
