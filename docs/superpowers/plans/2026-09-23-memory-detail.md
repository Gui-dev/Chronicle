# Memory Detail Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar página de detalhe de memória (`/memories/[id]`) com exibição completa, galeria de fotos, player de música inline, narrativa IA e edição via rota separada (`/memories/[id]/edit`).

**Architecture:** Enriquecer `GET /api/memories/:id` para retornar people/tags/photos. Criar hooks `use-memory` e `use-update-memory`. Criar 5 componentes de UI + 2 páginas (detalhe e edição). TDD: testar hooks com mocks, componentes com render.

**Tech Stack:** vitest, @tanstack/react-query, next.js app router, react-hook-form, zod, lucide-react, drizzle-orm

---

## File Structure

```
apps/api/src/modules/memories/
└── memories.service.ts       → MODIFY: enriquecer findById com people/tags/photos

apps/web/src/hooks/
├── use-memory.ts             → CREATE: query single memory
└── use-update-memory.ts      → CREATE: mutation update memory

apps/web/src/components/
├── photo-gallery.tsx         → CREATE: grid responsivo de fotos com lightbox
├── memory-detail-header.tsx  → CREATE: título, data, localização, botões ação
├── memory-music-player.tsx   → CREATE: mini player inline
├── narrative-section.tsx     → CREATE: exibe narrativa IA + botão gerar
└── memory-metadata.tsx       → CREATE: pessoas/tags como chips

apps/web/src/app/(dashboard)/memories/[id]/
├── page.tsx                  → CREATE: página detalhe
└── edit/page.tsx             → CREATE: página edição

apps/web/src/hooks/__tests__/
├── use-memory.test.ts        → CREATE: testes do hook query
└── use-update-memory.test.ts → CREATE: testes do hook mutation
```

---

## Task 1: Enriquecer API `findById` com people/tags/photos

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts`

- [ ] **Step 1: Encontrar a função findById atual**

Linha 132-144 de `apps/api/src/modules/memories/memories.service.ts`:

```typescript
async findById(id: string, userId: string) {
  const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)

  if (!memory) {
    throw AppError.notFound('Memória não encontrada')
  }

  if (memory.userId !== userId) {
    throw AppError.forbidden('Acesso negado')
  }

  return memory
}
```

- [ ] **Step 2: Enriquecer o método para retornar people, tags e photos**

Substituir o método `findById` (linhas 132-144):

```typescript
async findById(id: string, userId: string) {
  const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)

  if (!memory) {
    throw AppError.notFound('Memória não encontrada')
  }

  if (memory.userId !== userId) {
    throw AppError.forbidden('Acesso negado')
  }

  const peopleRows = await db
    .select()
    .from(memoryPeople)
    .where(eq(memoryPeople.memoryId, id))

  const tagRows = await db
    .select()
    .from(memoryTags)
    .where(eq(memoryTags.memoryId, id))

  const photoRows = await db
    .select()
    .from(memoryPhotos)
    .where(eq(memoryPhotos.memoryId, id))
    .orderBy(memoryPhotos.orderIndex)

  return {
    ...memory,
    people: peopleRows,
    tags: tagRows,
    photos: photoRows,
  }
}
```

- [ ] **Step 3: Adicionar import de memoryPhotos**

No topo de `apps/api/src/modules/memories/memories.service.ts`, linha 1, adicionar `memoryPhotos` ao import:

```typescript
import { and, db, desc, eq, ilike, memories, memoryPeople, memoryPhotos, memoryTags, sql } from '@chronicle/db'
```

- [ ] **Step 4: Verificar typecheck**

Run: `pnpm --filter @chronicle/api typecheck`
Expected: OK (sem erros)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/memories/memories.service.ts
git commit -m "feat(api): enrich findById with people, tags and photos"
```

---

## Task 2: Criar hook `use-memory.ts`

**Files:**
- Create: `apps/web/src/hooks/use-memory.ts`
- Test: `apps/web/src/hooks/__tests__/use-memory.test.ts`

- [ ] **Step 1: Criar o hook use-memory.ts**

```typescript
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import type { Memory } from './use-memories'

interface MemoryDetail extends Memory {
  people: Array<{ id: string; name: string }>
  tags: Array<{ id: string; name: string }>
  photos: Array<{
    id: string
    url: string
    filename: string | null
    mimetype: string | null
    size: number | null
    orderIndex: number
  }>
}

interface MemoryDetailResponse {
  data: MemoryDetail
}

export function useMemory(id: string) {
  return useQuery<MemoryDetail>({
    queryKey: ['memory', id],
    queryFn: async () => {
      const response = await api.get<MemoryDetailResponse>(`/api/memories/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

export type { MemoryDetail }
```

- [ ] **Step 2: Criar teste do hook use-memory**

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeAll, afterEach, afterAll, describe, expect, it } from 'vitest'
import { server } from '../../../tests/mocks/server'
import { useMemory } from '../use-memory'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useMemory', () => {
  it('fetches a memory by id', async () => {
    const mockMemory = {
      id: 'mem-1',
      userId: 'user-1',
      title: 'Test Memory',
      content: 'Test content',
      memoryDate: '2026-01-01T00:00:00Z',
      locationName: 'São Paulo',
      locationLat: null,
      locationLng: null,
      weatherTemp: null,
      weatherDesc: null,
      weatherIcon: null,
      musicTrack: null,
      musicArtist: null,
      musicUrl: null,
      musicCover: null,
      aiNarrative: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      people: [{ id: 'p1', name: 'Ana' }],
      tags: [{ id: 't1', name: 'viagem' }],
      photos: [],
    }

    server.use(
      http.get('*/api/memories/mem-1', () => {
        return HttpResponse.json({ data: mockMemory })
      }),
    )

    const { result } = renderHook(() => useMemory('mem-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.title).toBe('Test Memory')
    expect(result.current.data?.people).toHaveLength(1)
    expect(result.current.data?.tags).toHaveLength(1)
  })

  it('does not fetch when id is empty', async () => {
    const { result } = renderHook(() => useMemory(''), {
      wrapper: createWrapper(),
    })

    expect(result.current.isPending).toBe(true)
  })
})
```

- [ ] **Step 3: Rodar teste para verificar**

Run: `pnpm --filter web exec vitest run src/hooks/__tests__/use-memory.test.ts`
Expected: PASS (se MSW estiver configurado; se não, ajustar mock)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-memory.ts apps/web/src/hooks/__tests__/use-memory.test.ts
git commit -m "feat(web): add use-memory hook for single memory query"
```

---

## Task 3: Criar hook `use-update-memory.ts`

**Files:**
- Create: `apps/web/src/hooks/use-update-memory.ts`
- Test: `apps/web/src/hooks/__tests__/use-update-memory.test.ts`

- [ ] **Step 1: Criar o hook use-update-memory.ts**

```typescript
'use client'

import { api } from '@/lib/api-client'
import type { UpdateMemoryInput } from '@chronicle/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface UpdateMemoryResponse {
  data: {
    id: string
    title: string
  }
}

export function useUpdateMemory(id: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: UpdateMemoryInput) => {
      return api.put<UpdateMemoryResponse>(`/api/memories/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', id] })
      router.push(`/memories/${id}`)
    },
  })
}
```

- [ ] **Step 2: Criar teste do hook use-update-memory**

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { beforeAll, afterEach, afterAll, describe, expect, it, vi } from 'vitest'
import { server } from '../../../tests/mocks/server'
import { useUpdateMemory } from '../use-update-memory'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdateMemory', () => {
  it('calls PUT endpoint on mutation', async () => {
    let putCalled = false

    server.use(
      http.put('*/api/memories/mem-1', async () => {
        putCalled = true
        return HttpResponse.json({ data: { id: 'mem-1', title: 'Updated' } })
      }),
    )

    const { result } = renderHook(() => useUpdateMemory('mem-1'), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ title: 'Updated' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(putCalled).toBe(true)
  })
})
```

- [ ] **Step 3: Rodar teste para verificar**

Run: `pnpm --filter web exec vitest run src/hooks/__tests__/use-update-memory.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-update-memory.ts apps/web/src/hooks/__tests__/use-update-memory.test.ts
git commit -m "feat(web): add use-update-memory hook for memory mutation"
```

---

## Task 4: Criar componente `memory-metadata.tsx`

**Files:**
- Create: `apps/web/src/components/memory-metadata.tsx`

- [ ] **Step 1: Criar memory-metadata.tsx**

```typescript
'use client'

import { Tag, Users } from 'lucide-react'

interface Person {
  id: string
  name: string
}

interface Tag_ {
  id: string
  name: string
}

interface MemoryMetadataProps {
  people: Person[]
  tags: Tag_[]
}

export function MemoryMetadata({ people, tags }: MemoryMetadataProps) {
  if (people.length === 0 && tags.length === 0) return null

  return (
    <div className="space-y-4">
      {people.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <Users className="h-4 w-4" />
            <span>Pessoas</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <span
                key={person.id}
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
              >
                {person.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <Tag className="h-4 w-4" />
            <span>Tags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
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
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/memory-metadata.tsx
git commit -m "feat(web): add memory-metadata component for people and tags"
```

---

## Task 5: Criar componente `memory-detail-header.tsx`

**Files:**
- Create: `apps/web/src/components/memory-detail-header.tsx`

- [ ] **Step 1: Criar memory-detail-header.tsx**

```typescript
'use client'

import { Button } from '@chronicle/ui'
import { ArrowLeft, Calendar, Cloud, MapPin, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { Memory } from '@/hooks/use-memories'

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
            <span>{memory.weatherTemp}°C — {memory.weatherDesc}</span>
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/memory-detail-header.tsx
git commit -m "feat(web): add memory-detail-header component"
```

---

## Task 6: Criar componente `memory-music-player.tsx`

**Files:**
- Create: `apps/web/src/components/memory-music-player.tsx`

- [ ] **Step 1: Criar memory-music-player.tsx**

```typescript
'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MemoryMusicPlayerProps {
  track: string
  artist: string
  url: string
  cover?: string | null
}

export function MemoryMusicPlayer({ track, artist, url, cover }: MemoryMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
      setDuration(audioRef.current.duration || 0)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number.parseFloat(e.target.value)
    setProgress(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-xl bg-background p-4">
      <audio ref={audioRef} src={url} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)}>
        <track kind="captions" />
      </audio>

      <div className="flex items-center gap-4">
        {cover && (
          <img src={cover} alt={track} className="h-14 w-14 rounded-lg object-cover" />
        )}

        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-text">{track}</p>
          <p className="truncate text-xs text-muted">{artist}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-background transition-colors hover:bg-secondary"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-card accent-primary"
        />
        <span className="text-xs text-muted">{formatTime(duration)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/memory-music-player.tsx
git commit -m "feat(web): add memory-music-player inline player component"
```

---

## Task 7: Criar componente `photo-gallery.tsx`

**Files:**
- Create: `apps/web/src/components/photo-gallery.tsx`

- [ ] **Step 1: Criar photo-gallery.tsx**

```typescript
'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

interface Photo {
  id: string
  url: string
  filename: string | null
}

interface PhotoGalleryProps {
  photos: Photo[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-text">Fotos</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg"
          >
            <img
              src={photo.url}
              alt={photo.filename || 'Foto da memória'}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 cursor-pointer rounded-full bg-background/80 p-2 text-text"
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].filename || 'Foto da memória'}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <div className="absolute bottom-4 flex gap-2">
              {photos.map((_, index) => (
                <button
                  key={photos[index].id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxIndex(index)
                  }}
                  className={`h-2 w-2 rounded-full ${
                    index === lightboxIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/photo-gallery.tsx
git commit -m "feat(web): add photo-gallery component with lightbox"
```

---

## Task 8: Criar componente `narrative-section.tsx`

**Files:**
- Create: `apps/web/src/components/narrative-section.tsx`

- [ ] **Step 1: Criar narrative-section.tsx**

```typescript
'use client'

import { api } from '@/lib/api-client'
import { Button } from '@chronicle/ui'
import { Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface NarrativeSectionProps {
  memoryId: string
  aiNarrative: string | null
}

interface NarrativeResult {
  narrative: string
  mood: string
  themes: string[]
}

export function NarrativeSection({ memoryId, aiNarrative }: NarrativeSectionProps) {
  const [narrative, setNarrative] = useState<string | null>(aiNarrative)
  const [mood, setMood] = useState<string | null>(null)
  const [themes, setThemes] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await api.post<{ data: NarrativeResult }>(
        `/api/memories/${memoryId}/generate-narrative`,
      )
      setNarrative(response.data.narrative)
      setMood(response.data.mood)
      setThemes(response.data.themes)
    } catch {
      // Error handled silently
    } finally {
      setIsGenerating(false)
    }
  }

  if (!narrative && !isGenerating) {
    return (
      <div className="rounded-xl border-2 border-dashed border-card p-8 text-center">
        <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted" />
        <p className="mb-4 text-sm text-muted">
          Gere uma narrativa cinematográfica para esta memória
        </p>
        <Button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4" />
          Gerar narrativa
        </Button>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-card p-8">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted">Gerando narrativa...</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-text">Narrativa IA</h2>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{narrative}</p>

      {(mood || themes.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-card pt-4 text-xs text-muted">
          {mood && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
              Mood: {mood}
            </span>
          )}
          {themes.map((theme) => (
            <span key={theme} className="rounded-full bg-background px-3 py-1">
              {theme}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        className="mt-4 cursor-pointer text-xs text-muted transition-colors hover:text-primary"
      >
        Regenerar narrativa
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/narrative-section.tsx
git commit -m "feat(web): add narrative-section component for AI narrative"
```

---

## Task 9: Criar página de detalhe `/memories/[id]/page.tsx`

**Files:**
- Create: `apps/web/src/app/(dashboard)/memories/[id]/page.tsx`

- [ ] **Step 1: Criar página de detalhe**

```typescript
'use client'

import { useMemory } from '@/hooks/use-memory'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { MemoryDetailHeader } from '@/components/memory-detail-header'
import { MemoryMetadata } from '@/components/memory-metadata'
import { MemoryMusicPlayer } from '@/components/memory-music-player'
import { PhotoGallery } from '@/components/photo-gallery'
import { NarrativeSection } from '@/components/narrative-section'

export default function MemoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: memory, isLoading, error } = useMemory(id)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-card" />
          <div className="h-12 w-3/4 rounded bg-card" />
          <div className="h-4 w-1/2 rounded bg-card" />
          <div className="h-64 rounded-xl bg-card" />
        </div>
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-center">
        <p className="mb-4 text-lg text-muted">Memória não encontrada</p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="cursor-pointer text-sm text-primary hover:underline"
        >
          Voltar para a timeline
        </button>
      </div>
    )
  }

  const handleDelete = async () => {
    try {
      const { api } = await import('@/lib/api-client')
      await api.delete(`/api/memories/${id}`)
      router.push('/')
    } catch {
      // Error handled silently
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <MemoryDetailHeader
        memory={memory}
        onDelete={() => setShowDeleteConfirm(true)}
      />

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

      {memory.photos.length > 0 && (
        <div className="mb-8">
          <PhotoGallery photos={memory.photos} />
        </div>
      )}

      <div className="mb-8">
        <MemoryMetadata people={memory.people} tags={memory.tags} />
      </div>

      <div className="mb-8">
        <NarrativeSection memoryId={id} aiNarrative={memory.aiNarrative} />
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-card bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-text">Deletar memória?</h3>
            <p className="mb-6 text-sm text-muted">
              Esta ação não pode ser desfeita. A memória e todas as suas fotos serão removidas permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="cursor-pointer rounded-lg border border-card px-4 py-2 text-sm text-text transition-colors hover:border-primary hover:text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="cursor-pointer rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:bg-red-600"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/memories/\[id\]/page.tsx
git commit -m "feat(web): add memory detail page at /memories/[id]"
```

---

## Task 10: Criar página de edição `/memories/[id]/edit/page.tsx`

**Files:**
- Create: `apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx`

- [ ] **Step 1: Criar página de edição**

```typescript
'use client'

import { useMemory } from '@/hooks/use-memory'
import { useUpdateMemory } from '@/hooks/use-update-memory'
import { updateMemorySchema } from '@chronicle/schemas'
import type { UpdateMemoryInput } from '@chronicle/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@chronicle/ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'

export default function EditMemoryPage() {
  const params = useParams()
  const id = params.id as string
  const { data: memory, isLoading } = useMemory(id)
  const updateMemory = useUpdateMemory(id)

  const form = useForm<UpdateMemoryInput>({
    resolver: zodResolver(updateMemorySchema),
    values: memory
      ? {
          title: memory.title,
          content: memory.content || undefined,
          memoryDate: new Date(memory.memoryDate),
          locationName: memory.locationName || undefined,
          musicTrack: memory.musicTrack || undefined,
          musicArtist: memory.musicArtist || undefined,
          musicUrl: memory.musicUrl || undefined,
          musicCover: memory.musicCover || undefined,
        }
      : undefined,
  })

  const { handleSubmit, register, formState: { errors } } = form

  const onSubmit = (data: UpdateMemoryInput) => {
    updateMemory.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-card" />
          <div className="h-10 rounded bg-card" />
          <div className="h-32 rounded bg-card" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href={`/memories/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <h1 className="mb-8 text-3xl font-bold text-text">Editar Memória</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-text">
            Título *
          </label>
          <input
            id="title"
            {...register('title')}
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="content" className="mb-1 block text-sm font-medium text-text">
            Conteúdo
          </label>
          <textarea
            id="content"
            {...register('content')}
            rows={4}
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="memoryDate" className="mb-1 block text-sm font-medium text-text">
            Data *
          </label>
          <input
            id="memoryDate"
            type="date"
            {...register('memoryDate')}
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
          />
          {errors.memoryDate && (
            <p className="mt-1 text-xs text-red-500">{errors.memoryDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="locationName" className="mb-1 block text-sm font-medium text-text">
            Localização
          </label>
          <input
            id="locationName"
            {...register('locationName')}
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="musicTrack" className="mb-1 block text-sm font-medium text-text">
              Música
            </label>
            <input
              id="musicTrack"
              {...register('musicTrack')}
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="musicArtist" className="mb-1 block text-sm font-medium text-text">
              Artista
            </label>
            <input
              id="musicArtist"
              {...register('musicArtist')}
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Link href={`/memories/${id}`}>
            <Button
              type="button"
              variant="outline"
              className="border-card text-text hover:border-primary hover:text-primary"
            >
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={updateMemory.isPending}
            className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
          >
            {updateMemory.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/memories/\[id\]/edit/page.tsx
git commit -m "feat(web): add memory edit page at /memories/[id]/edit"
```

---

## Task 11: Verificar typecheck + biome + testes

**Files:** (nenhum novo — verificação)

- [ ] **Step 1: Rodar typecheck completo**

Run: `pnpm typecheck`
Expected: Tasks: X successful (sem erros)

- [ ] **Step 2: Rodar biome**

Run: `pnpm lint`
Expected: Sem erros (warnings aceitos)

- [ ] **Step 3: Rodar testes**

Run: `pnpm test`
Expected: Todos passando

- [ ] **Step 4: Fixar qualquer problema encontrado**

- [ ] **Step 5: Commit final (se houver fixes)**

```bash
git add -A
git commit -m "fix(web): address typecheck and lint issues for memory detail"
```

---

## Self-Review

1. **Spec coverage:** ✅
   - Exibição completa da memória → Task 9 (página detalhe)
   - Galeria de fotos → Task 7 (photo-gallery) + Task 9
   - Player de música associada → Task 6 (memory-music-player) + Task 9
   - Narrativa IA (gerar/exibir) → Task 8 (narrative-section) + Task 9
   - Edição de memória → Task 10 (página edição)
   - Hook use-update-memory → Task 3
   - Enriquecer API → Task 1

2. **Placeholder scan:** ✅ Sem TBD/TODO — todo código está completo em cada step

3. **Type consistency:** ✅
   - `MemoryDetail` tipo exportado de `use-memory.ts` usado em `page.tsx`
   - `UpdateMemoryInput` de `@chronicle/schemas` usado em `use-update-memory.ts` e `edit/page.tsx`
   - `memory.photos`, `memory.people`, `memory.tags` tipos consistentes entre API response e hooks
