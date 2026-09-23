'use client'

import type { Memory } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface MemoryDetailHeaderProps {
  memory: Memory
  onDelete: () => void
}

export function MemoryDetailHeader({ memory, onDelete }: MemoryDetailHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="flex items-center gap-2">
        <Link href={`/memories/${memory.id}/edit`}>
          <Button
            variant="outline"
            size="sm"
            className="inline-flex items-center gap-2 border-card text-text hover:border-primary hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          className="inline-flex items-center gap-2 border-card text-red-500 hover:border-red-500 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          Deletar
        </Button>
      </div>
    </div>
  )
}
