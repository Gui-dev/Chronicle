'use client'

import { MemoryDetailHeader } from '@/components/memory-detail-header'
import { MemoryMusicPlayer } from '@/components/memory-music-player'
import { NarrativeSection } from '@/components/narrative-section'
import { PhotoGallery } from '@/components/photo-gallery'
import { useMemory } from '@/hooks/use-memory'
import { Button } from '@chronicle/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Cloud, Loader2, MapPin, Tag, Users } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'

function formatUtcDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const monthNames = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ]
  const month = monthNames[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} de ${month} de ${year}`
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} ${years === 1 ? 'ano' : 'anos'} atrás`
}

export default function MemoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const { data: memory, isLoading, error } = useMemory(id)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const { api } = await import('@/lib/api-client')
      await api.delete(`/api/memories/${id}`)
      await queryClient.invalidateQueries({ queryKey: ['memories'] })
      router.push('/')
    } catch (err) {
      console.error('Failed to delete memory:', err)
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted">Memória não encontrada</p>
        <Button onClick={() => router.push('/')} className="bg-primary text-background">
          Voltar ao início
        </Button>
      </div>
    )
  }

  const formattedDate = formatUtcDate(memory.memoryDate)

  const relativeDate = formatRelativeDate(memory.memoryDate)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <MemoryDetailHeader memory={memory} onDelete={handleDelete} isDeleting={isDeleting} />

      <div className="mb-2 text-sm text-muted">
        {formattedDate} há {relativeDate}
      </div>

      <h1 className="mb-6 text-3xl font-bold text-text">{memory.title}</h1>

      {memory.content && (
        <div className="mb-8">
          <p className="whitespace-pre-line text-base leading-relaxed text-muted">
            {memory.content}
          </p>
        </div>
      )}

      {memory.musicTrack && memory.musicUrl && (
        <div className="mb-8">
          <MemoryMusicPlayer
            track={memory.musicTrack}
            artist={memory.musicArtist || 'Desconhecido'}
            url={memory.musicUrl}
            cover={memory.musicCover}
          />
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-muted">
        {memory.weatherTemp && (
          <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-primary">
            <Cloud className="h-4 w-4" />
            <span>{memory.weatherTemp}°C</span>
            {memory.weatherDesc && <span>— {memory.weatherDesc}</span>}
          </div>
        )}

        {memory.locationName && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>{memory.locationName}</span>
          </div>
        )}

        {memory.people.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{memory.people.map((p) => p.name).join(', ')}</span>
          </div>
        )}
      </div>

      {memory.tags.length > 0 && (
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <Tag className="h-4 w-4" />
          </div>
          <div className="flex flex-wrap gap-2">
            {memory.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-background px-3 py-1 text-sm text-muted"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {memory.photos.length > 0 && (
        <div className="mb-8">
          <PhotoGallery photos={memory.photos} />
        </div>
      )}

      <div className="mb-8">
        <NarrativeSection memoryId={memory.id} aiNarrative={memory.aiNarrative} />
      </div>
    </div>
  )
}
