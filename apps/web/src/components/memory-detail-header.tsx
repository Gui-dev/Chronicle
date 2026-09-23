'use client'

import type { Memory } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { ArrowLeft, Calendar, Cloud, MapPin, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface MemoryDetailHeaderProps {
  memory: Memory
  onDelete: () => void
}

export function MemoryDetailHeader({ memory, onDelete }: MemoryDetailHeaderProps) {
  const formattedDate = new Date(memory.memoryDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-8">
      <div className="mb-6 flex items-center justify-between">
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

      <h1 className="mb-4 text-3xl font-bold text-text">{memory.title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>{formattedDate}</span>
        </div>

        {memory.weatherDesc && (
          <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-primary">
            <Cloud className="h-4 w-4" />
            <span>
              {memory.weatherTemp}°C — {memory.weatherDesc}
            </span>
          </div>
        )}

        {memory.locationName && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{memory.locationName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
