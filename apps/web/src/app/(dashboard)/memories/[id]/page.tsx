'use client'

import { MemoryDetailHeader } from '@/components/memory-detail-header'
import { MemoryMetadata } from '@/components/memory-metadata'
import { MemoryMusicPlayer } from '@/components/memory-music-player'
import { NarrativeSection } from '@/components/narrative-section'
import { PhotoGallery } from '@/components/photo-gallery'
import { useMemory } from '@/hooks/use-memory'
import { Button } from '@chronicle/ui'
import { Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'

export default function MemoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { data: memory, isLoading, error } = useMemory(id)

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar esta memória?')) return

    try {
      const { api } = await import('@/lib/api-client')
      await api.delete(`/api/memories/${id}`)
      router.push('/')
    } catch {
      // Error handled silently
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <MemoryDetailHeader memory={memory} onDelete={handleDelete} />

      {memory.content && (
        <div className="mb-8">
          <p className="whitespace-pre-line text-base leading-relaxed text-muted">
            {memory.content}
          </p>
        </div>
      )}

      <div className="mb-8">
        <MemoryMetadata people={memory.people} tags={memory.tags} />
      </div>

      {memory.photos.length > 0 && (
        <div className="mb-8">
          <PhotoGallery photos={memory.photos} />
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

      <div className="mb-8">
        <NarrativeSection memoryId={memory.id} aiNarrative={memory.aiNarrative} />
      </div>
    </div>
  )
}
