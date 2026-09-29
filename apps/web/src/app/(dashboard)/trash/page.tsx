'use client'

import { RequireAuth } from '@/components/require-auth'
import { useMemories } from '@/hooks/use-memories'
import { useRestoreMemory } from '@/hooks/use-restore-memory'
import { Button, Card } from '@chronicle/ui'
import { RotateCcw, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

function formatDay(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

export default function TrashPage() {
  return (
    <RequireAuth>
      <TrashContent />
    </RequireAuth>
  )
}

function TrashContent() {
  const { data, isLoading } = useMemories({ page: 1, limit: 100, mine: true, deleted: true })
  const restore = useRestoreMemory()

  const handleRestore = (id: string, title: string) => {
    restore.mutate(id, {
      onSuccess: () => toast.success(`"${title}" restaurada`),
      onError: () => toast.error('Erro ao restaurar memória'),
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Trash2 className="h-6 w-6 text-muted" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">Lixeira</h1>
      </div>
      <p className="mb-8 text-sm text-muted">
        Memórias excluídas ficam aqui até serem restauradas. Restaurar devolve a memória à timeline.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted" data-testid="trash-loading">
          Carregando...
        </p>
      ) : !data || data.data.length === 0 ? (
        <Card className="border-card bg-card p-6">
          <p className="text-sm text-muted" data-testid="trash-empty">
            A lixeira está vazia.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((memory) => (
            <li key={memory.id}>
              <Card className="border-card bg-card p-4" data-testid={`trash-item-${memory.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate font-medium text-text"
                      data-testid={`trash-title-${memory.id}`}
                    >
                      {memory.title}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDay(memory.memoryDate)}
                      {memory.deletedAt &&
                        ` · excluída em ${new Date(memory.deletedAt).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleRestore(memory.id, memory.title)}
                    disabled={restore.isPending}
                    className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
                    data-testid={`trash-restore-${memory.id}`}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {restore.isPending ? 'Restaurando...' : 'Restaurar'}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link
          href="/profile"
          className="text-sm text-muted transition-colors hover:text-primary"
          data-testid="trash-profile-link"
        >
          Voltar ao perfil
        </Link>
      </div>
    </div>
  )
}
