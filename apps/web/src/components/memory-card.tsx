'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { PhotoGallery } from '@/components/photo-gallery'
import { useDeleteMemory } from '@/hooks/use-delete-memory'
import type { Memory } from '@/hooks/use-memories'
import { api } from '@/lib/api-client'
import { Button } from '@chronicle/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Lock,
  MapPin,
  Music,
  Pause,
  Pencil,
  Play,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  User,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface MemoryCardFullProps {
  memory: Memory
  /** Whether the signed-in user owns this memory. Computed once per page by `MemoryTimeline`. */
  isOwner: boolean
}

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

function photoGridClass(photoCount: number): string {
  if (photoCount === 1) return 'grid-cols-1 pt-2 sm:grid-cols-1 md:grid-cols-1'
  if (photoCount === 2) return 'grid-cols-1 pt-2 sm:grid-cols-2 md:grid-cols-2'
  return 'grid-cols-1 pt-2 sm:grid-cols-3 md:grid-cols-3'
}

function photoSizes(photoCount: number): string {
  if (photoCount === 1) return '(max-width: 640px) 100vw, 672px'
  if (photoCount === 2) return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 330px'
  return '(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 216px'
}

export function MemoryCardFull({ memory, isOwner }: MemoryCardFullProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isPlaying, setIsPlaying] = useState(false)
  const [narrativeOpen, setNarrativeOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const owner = isOwner
  const deleteMemory = useDeleteMemory()

  const filterByTag = (tag: string) => {
    router.push(`/search?q=${encodeURIComponent(`#${tag}`)}`)
  }

  const filterByPerson = (person: string) => {
    router.push(`/search?q=${encodeURIComponent(`@${person}`)}`)
  }

  const toggleVisibility = useMutation({
    mutationFn: async (isPublic: boolean) => {
      await api.put(`/api/memories/${memory.id}`, { isPublic })
    },
    onSuccess: (_data, newIsPublic) => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      toast.success(`Memória agora é ${newIsPublic ? 'pública' : 'privada'}`)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar a visibilidade')
    },
  })

  const generateNarrative = useMutation({
    mutationFn: async () => {
      return api.post<{ data: { narrative: string } }>(
        `/api/memories/${memory.id}/generate-narrative`,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      setNarrativeOpen(true)
      toast.success('Narrativa gerada!')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar a narrativa')
    },
  })

  const handleDelete = () => {
    deleteMemory.mutate(memory.id, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success('Memória deletada')
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Erro ao deletar a memória')
      },
    })
  }

  const formattedDate = formatUtcDate(memory.memoryDate)
  const relativeDate = formatRelativeDate(memory.memoryDate)

  return (
    <article className="relative group" data-testid={`memory-card-${memory.id}`}>
      <div className="absolute -left-6 sm:-left-8.75 top-6 h-5 w-5 rounded-full border-4 border-background bg-primary shadow-[0_0_8px_rgba(240,192,64,0.5)] z-10" />

      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
          {formattedDate}
        </span>
        {memory.userName && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-card bg-background px-3 py-1 text-xs text-muted"
            data-testid={`memory-author-${memory.id}`}
          >
            <User className="h-3 w-3" />
            {memory.userName}
          </span>
        )}
        <span className="font-mono text-xs text-muted">{relativeDate}</span>
      </div>

      <div
        data-memory-id={memory.id}
        className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 shadow-lg transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(240,192,64,0.1)] sm:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text group-hover:text-primary transition-colors">
              &ldquo;{memory.title}&rdquo;
            </h2>
            {memory.content && (
              <p className="mt-1 font-serif text-sm italic text-muted line-clamp-2">
                &ldquo;{memory.content}&rdquo;
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {memory.musicTrack && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-background p-3 transition-all hover:bg-card group/music shadow-[0_0_8px_rgba(240,192,64,0.15)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary transition-transform group-hover/music:scale-105">
                  <Music className="h-5 w-5" />
                </div>
                <div className="text-left pr-2">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    Trilha Sonora
                  </span>
                  <span className="block text-xs font-bold text-text">
                    {memory.musicArtist ? `${memory.musicArtist} — ` : ''}
                    {memory.musicTrack}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  aria-label={isPlaying ? 'Pausar trilha' : 'Reproduzir trilha'}
                  aria-pressed={isPlaying}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-background" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-background" />
                  )}
                </button>
              </div>
            )}

            {owner && (
              <div className="flex items-center gap-1.5">
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-card text-muted hover:border-primary hover:text-primary"
                >
                  <Link
                    href={`/memories/${memory.id}/edit`}
                    data-testid="card-edit"
                    aria-label="Editar memória"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  data-testid="card-narrative"
                  aria-label={memory.aiNarrative ? 'Ver narrativa' : 'Gerar narrativa'}
                  title={memory.aiNarrative ? 'Ver narrativa' : 'Gerar narrativa'}
                  disabled={generateNarrative.isPending}
                  onClick={() => {
                    if (memory.aiNarrative) {
                      setNarrativeOpen(!narrativeOpen)
                      return
                    }
                    generateNarrative.mutate()
                  }}
                  className="h-9 w-9 border-card text-muted hover:border-primary hover:text-primary"
                >
                  {generateNarrative.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  data-testid="card-privacy"
                  aria-label={memory.isPublic ? 'Tornar memória privada' : 'Tornar memória pública'}
                  title={memory.isPublic ? 'Tornar privada' : 'Tornar pública'}
                  disabled={toggleVisibility.isPending}
                  onClick={() => toggleVisibility.mutate(!memory.isPublic)}
                  className="h-9 w-9 border-card text-muted hover:border-primary hover:text-primary"
                >
                  {toggleVisibility.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : memory.isPublic ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  data-testid="card-delete"
                  aria-label="Deletar memória"
                  title="Deletar"
                  disabled={deleteMemory.isPending}
                  onClick={() => setConfirmOpen(true)}
                  className="h-9 w-9 border-card text-red-500 hover:border-red-500 hover:text-red-600"
                >
                  {deleteMemory.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          {memory.weatherTemp && (
            <span className="flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-amber-300">
              {memory.weatherIcon || '🌤'} {memory.weatherTemp}°C
              {memory.weatherDesc ? ` ${memory.weatherDesc}` : ''}
            </span>
          )}
          {memory.locationName && (
            <span className="flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
              <MapPin className="h-3 w-3" />
              {memory.locationName}
            </span>
          )}
          {memory.people.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
              <Users className="h-3 w-3" />
              {memory.people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => filterByPerson(p.name)}
                  className="cursor-pointer transition-colors hover:text-primary"
                  data-testid={`card-person-${p.name}`}
                >
                  {p.name}
                </button>
              ))}
            </span>
          )}
          {memory.tags.length > 0 &&
            memory.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => filterByTag(tag.name)}
                data-testid={`card-tag-${tag.name}`}
                className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20"
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </button>
            ))}
        </div>

        {memory.photos.length > 0 && (
          <PhotoGallery
            photos={memory.photos}
            heading={null}
            className={photoGridClass(memory.photos.length)}
            itemClassName="h-44 rounded-2xl border border-card aspect-auto"
            sizes={photoSizes(memory.photos.length)}
          />
        )}

        {memory.aiNarrative && (
          <div className="border-t border-card/60 pt-4">
            <button
              type="button"
              data-testid="narrative-toggle"
              aria-expanded={narrativeOpen}
              aria-controls={`narrative-panel-${memory.id}`}
              onClick={() => setNarrativeOpen(!narrativeOpen)}
              className="flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-background/60 p-4 text-left transition-all hover:bg-background"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  ✨
                </div>
                <div>
                  <span className="block text-xs font-bold text-text">
                    Memória Narrativa Gerada por IA
                  </span>
                  <span className="text-[11px] text-muted">
                    Transforme o relato bruto em um conto cinematográfico
                  </span>
                </div>
              </div>
              <span className="flex items-center gap-1 font-mono text-xs font-bold text-primary">
                <span>{narrativeOpen ? 'Recolher' : 'Expandir'}</span>
                <span className={`transition-transform ${narrativeOpen ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </span>
            </button>

            {narrativeOpen && (
              <div
                id={`narrative-panel-${memory.id}`}
                className="mt-4 rounded-2xl border border-card bg-background/40 p-5"
              >
                <p className="font-serif text-sm leading-relaxed italic text-gray-300">
                  {memory.aiNarrative}
                </p>

                {(memory.aiMood || memory.aiThemes?.length) && (
                  <div
                    data-testid="narrative-meta"
                    className="mt-4 flex flex-wrap items-center gap-2 border-t border-card/60 pt-4 not-italic"
                  >
                    {memory.aiMood && (
                      <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-secondary">
                        {memory.aiMood}
                      </span>
                    )}
                    {memory.aiThemes?.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-primary"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                )}

                {owner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="narrative-regenerate"
                    disabled={generateNarrative.isPending}
                    onClick={() => generateNarrative.mutate()}
                    className="mt-4 h-auto px-0 font-mono text-xs not-italic text-muted hover:bg-transparent hover:text-primary"
                  >
                    {generateNarrative.isPending ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Regenerar narrativa
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Deletar memória"
        description="Tem certeza que deseja deletar esta memória? Esta ação não pode ser desfeita."
        confirmLabel="Deletar"
        onConfirm={handleDelete}
        isPending={deleteMemory.isPending}
      />
    </article>
  )
}
