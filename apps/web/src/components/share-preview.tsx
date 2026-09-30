'use client'

import { PhotoGallery } from '@/components/photo-gallery'
import { api } from '@/lib/api-client'
import { getInitials } from '@/lib/get-initials'
import { Button } from '@chronicle/ui'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MapPin, Music, Tag, Users } from 'lucide-react'
import Link from 'next/link'

interface SharePreviewData {
  memory: {
    id: string
    title: string
    content: string | null
    memoryDate: string
    locationName: string | null
    weatherDesc: string | null
    weatherIcon: string | null
    musicTrack: string | null
    musicArtist: string | null
    musicUrl: string | null
    musicCover: string | null
    photos: Array<{ id: string; url: string; width: number | null; height: number | null }>
    people: Array<{ id: string; name: string }>
    tags: Array<{ id: string; name: string }>
    aiNarrative: string | null
  }
  author: { name: string | null; image: string | null }
}

const MONTHS = [
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
] as const

function formatUtcDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getUTCDate()).padStart(2, '0')} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function SharePreview({ token }: { token: string }) {
  const { data, isLoading, error, refetch } = useQuery<SharePreviewData>({
    queryKey: ['share', token],
    queryFn: async () => {
      const { data } = await api.get<{ data: SharePreviewData }>(`/api/share/${token}`)
      return data
    },
    retry: false,
    staleTime: 0,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20" data-testid="share-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Expired, unknown and deleted all arrive here as the same 404 message —
  // one state, never a redirect (spec §4): the visitor must learn the link died.
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center" data-testid="share-invalid">
        <p className="mb-2 text-xl font-bold text-text">Link inválido ou expirado</p>
        <p className="mb-8 text-sm text-muted">
          Este link não existe mais ou o prazo de validade acabou.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
            data-testid="share-retry"
            className="border-card text-text hover:border-primary hover:text-primary"
          >
            Tentar novamente
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="border-card text-text hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ir para a timeline
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const { memory, author } = data

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-primary">
          Memória compartilhada
        </span>
        <Link href="/" className="text-sm text-muted transition-colors hover:text-primary">
          Chronicle
        </Link>
      </div>

      <article data-testid={`share-card-${memory.id}`}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
            {formatUtcDate(memory.memoryDate)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-card bg-background px-3 py-1 text-xs text-muted"
            data-testid="share-author"
          >
            {author.image ? (
              <img
                src={author.image}
                alt={author.name || 'Autor'}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[8px] font-bold text-background">
                {getInitials(author.name, null)}
              </span>
            )}
            {author.name}
          </span>
        </div>

        <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 shadow-lg sm:p-8">
          <div>
            <h1 className="text-2xl font-bold text-text" data-testid="share-title">
              {memory.title}
            </h1>
            {memory.content && (
              <p className="mt-2 font-serif text-sm italic text-muted">{memory.content}</p>
            )}
          </div>

          {memory.musicTrack && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-background p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  Trilha Sonora
                </span>
                <span className="block text-xs font-bold text-text">
                  {memory.musicArtist ? `${memory.musicArtist} — ` : ''}
                  {memory.musicTrack}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            {memory.weatherDesc && (
              <span className="rounded-xl border border-card bg-background px-3 py-1.5 text-amber-300">
                {memory.weatherIcon || '🌤'} {memory.weatherDesc}
              </span>
            )}
            {memory.locationName && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
                <MapPin className="h-3 w-3" />
                {memory.locationName}
              </span>
            )}
            {memory.people.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
                <Users className="h-3 w-3" />
                {memory.people.map((person) => person.name).join(', ')}
              </span>
            )}
            {memory.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary"
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </span>
            ))}
          </div>

          {memory.photos.length > 0 && (
            <PhotoGallery
              photos={memory.photos.map((photo) => ({ ...photo, filename: null }))}
              heading={null}
              className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3"
              itemClassName="h-44 rounded-2xl border border-card aspect-auto"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          )}

          {memory.aiNarrative && (
            <div className="border-t border-card/60 pt-4">
              <p className="font-serif text-sm leading-relaxed italic text-gray-300">
                {memory.aiNarrative}
              </p>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
