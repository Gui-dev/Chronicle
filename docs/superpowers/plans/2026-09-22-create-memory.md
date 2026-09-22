# Task 3.5 — Criar Memória: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5-step wizard form for creating memories with photo upload, Spotify search, geocoding with auto-weather, and people/tags chips.

**Architecture:** React Hook Form + Zod for validation, Tanstack Query for data fetching, 5 step components orchestrated by a parent wizard. Photos stored as File[] in state until submit, then uploaded sequentially.

**Tech Stack:** React Hook Form, @hookform/resolvers, Zod, Tanstack Query, @chronicle/ui, @chronicle/schemas

---

## File Map

| File | Purpose |
|------|---------|
| `apps/web/package.json` | Add react-hook-form + @hookform/resolvers |
| `apps/web/src/hooks/use-create-memory.ts` | Mutation hook: create memory |
| `apps/web/src/hooks/use-geocoding.ts` | Query hook: search locations |
| `apps/web/src/hooks/use-spotify-search.ts` | Query hook: search Spotify |
| `apps/web/src/hooks/use-weather.ts` | Query hook: fetch weather |
| `apps/web/src/components/chip-input.tsx` | Reusable chip/tag input |
| `apps/web/src/components/steps/step-basic-info.tsx` | Step 0: title, date, content |
| `apps/web/src/components/steps/step-location.tsx` | Step 1: geocoding + auto weather |
| `apps/web/src/components/steps/step-music.tsx` | Step 2: Spotify search |
| `apps/web/src/components/steps/step-photos.tsx` | Step 3: drag & drop photos |
| `apps/web/src/components/steps/step-people.tsx` | Step 4: people + tags chips |
| `apps/web/src/components/create-memory-wizard.tsx` | Wizard orchestrator |
| `apps/web/src/app/(dashboard)/memories/new/page.tsx` | Page wrapper |

---

## Task 1: Install Dependencies

- [ ] **Step 1: Install react-hook-form**

```bash
pnpm add react-hook-form @hookform/resolvers --filter web
```

- [ ] **Step 2: Verify installation**

```bash
pnpm ls react-hook-form --filter web
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "deps(web): add react-hook-form and zod resolvers"
```

---

## Task 2: use-create-memory Hook

**Files:**
- Create: `apps/web/src/hooks/use-create-memory.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { api } from '@/lib/api-client'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface CreateMemoryResponse {
  data: {
    id: string
    title: string
    memoryDate: string
  }
}

export function useCreateMemory() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: CreateMemoryInput) => {
      return api.post<CreateMemoryResponse>('/api/memories', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      router.push('/')
    },
  })
}

export type { CreateMemoryResponse }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-create-memory.ts
git commit -m "feat(web): add use-create-memory hook"
```

---

## Task 3: use-weather Hook

**Files:**
- Create: `apps/web/src/hooks/use-weather.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

interface WeatherData {
  temperature: number
  description: string
  icon: string
}

interface WeatherResponse {
  data: WeatherData
}

export function useWeather(lat: number | null, lng: number | null) {
  return useQuery<WeatherResponse>({
    queryKey: ['weather', lat, lng],
    queryFn: async () => {
      return api.get<WeatherResponse>(
        `/api/weather?latitude=${lat}&longitude=${lng}`,
      )
    },
    enabled: !!lat && !!lng,
    staleTime: 5 * 60 * 1000,
  })
}

export type { WeatherData }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-weather.ts
git commit -m "feat(web): add use-weather hook"
```

---

## Task 4: use-geocoding Hook

**Files:**
- Create: `apps/web/src/hooks/use-geocoding.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

interface GeocodingResponse {
  data: GeocodingResult[]
}

export function useGeocoding(searchTerm: string) {
  return useQuery<GeocodingResponse>({
    queryKey: ['geocoding', searchTerm],
    queryFn: async () => {
      return api.get<GeocodingResponse>(
        `/api/geocoding?q=${encodeURIComponent(searchTerm)}`,
      )
    },
    enabled: searchTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  })
}

export type { GeocodingResult }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-geocoding.ts
git commit -m "feat(web): add use-geocoding hook"
```

---

## Task 5: use-spotify-search Hook

**Files:**
- Create: `apps/web/src/hooks/use-spotify-search.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

interface SpotifyTrack {
  name: string
  artist: string
  url: string
  cover: string
  previewUrl: string | null
}

interface SpotifySearchResponse {
  data: SpotifyTrack[]
}

export function useSpotifySearch(searchTerm: string) {
  return useQuery<SpotifySearchResponse>({
    queryKey: ['spotify-search', searchTerm],
    queryFn: async () => {
      return api.get<SpotifySearchResponse>(
        `/api/spotify/search?q=${encodeURIComponent(searchTerm)}`,
      )
    },
    enabled: searchTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  })
}

export type { SpotifyTrack }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-spotify-search.ts
git commit -m "feat(web): add use-spotify-search hook"
```

---

## Task 6: Chip Input Component

**Files:**
- Create: `apps/web/src/components/chip-input.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Button, Input, Label } from '@chronicle/ui'
import { X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface ChipInputProps {
  label: string
  placeholder: string
  value: string[]
  onChange: (value: string[]) => void
  maxLength?: number
}

export function ChipInput({
  label,
  placeholder,
  value,
  onChange,
  maxLength = 100,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addChip = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed && !value.includes(trimmed) && trimmed.length <= maxLength) {
      onChange([...value, trimmed])
      setInputValue('')
    }
  }, [inputValue, value, onChange, maxLength])

  const removeChip = useCallback(
    (chipToRemove: string) => {
      onChange(value.filter((chip) => chip !== chipToRemove))
    },
    [value, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addChip()
      }
    },
    [addChip],
  )

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-text">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 border-card bg-background text-text placeholder:text-muted"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addChip}
          disabled={!inputValue.trim()}
          className="border-card text-text hover:border-primary hover:text-primary"
        >
          Adicionar
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {value.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="ml-1 hover:text-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/chip-input.tsx
git commit -m "feat(web): add chip-input component"
```

---

## Task 7: Step Basic Info Component

**Files:**
- Create: `apps/web/src/components/steps/step-basic-info.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Input, Label } from '@chronicle/ui'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateMemoryInput } from '@chronicle/schemas'

interface StepBasicInfoProps {
  form: UseFormReturn<CreateMemoryInput>
}

export function StepBasicInfo({ form }: StepBasicInfoProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">
          Informações Básicas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Conte-nos sobre este momento
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium text-text">
            Título *
          </Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Ex: Pôr do sol na praia"
            className="border-card bg-background text-text placeholder:text-muted"
          />
          {errors.title && (
            <p className="text-sm text-red-500">{errors.title.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="memoryDate" className="text-sm font-medium text-text">
            Data *
          </Label>
          <Input
            id="memoryDate"
            type="date"
            {...register('memoryDate')}
            className="border-card bg-background text-text"
          />
          {errors.memoryDate && (
            <p className="text-sm text-red-500">{errors.memoryDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="content" className="text-sm font-medium text-text">
            Texto
          </Label>
          <textarea
            id="content"
            {...register('content')}
            placeholder="Descreva este momento..."
            rows={4}
            className="w-full rounded-lg border-2 border-card bg-background px-3 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/steps/step-basic-info.tsx
git commit -m "feat(web): add step-basic-info component"
```

---

## Task 8: Step Location Component

**Files:**
- Create: `apps/web/src/components/steps/step-location.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useGeocoding } from '@/hooks/use-geocoding'
import { useWeather } from '@/hooks/use-weather'
import { Input, Label } from '@chronicle/ui'
import { Cloud, MapPin } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateMemoryInput } from '@chronicle/schemas'
import type { GeocodingResult } from '@/hooks/use-geocoding'

interface StepLocationProps {
  form: UseFormReturn<CreateMemoryInput>
}

export function StepLocation({ form }: StepLocationProps) {
  const { setValue, watch } = form
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const locationName = watch('locationName')
  const locationLat = watch('locationLat')
  const locationLng = watch('locationLng')

  const { data: geocodingData } = useGeocoding(debouncedSearch)
  const { data: weatherData } = useWeather(locationLat ?? null, locationLng ?? null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const selectLocation = useCallback(
    (result: GeocodingResult) => {
      setValue('locationName', `${result.name}, ${result.country}`)
      setValue('locationLat', result.latitude)
      setValue('locationLng', result.longitude)
      setSearchTerm('')
      setDebouncedSearch('')
    },
    [setValue],
  )

  useEffect(() => {
    if (weatherData?.data) {
      setValue('weatherTemp', weatherData.data.temperature)
      setValue('weatherDesc', weatherData.data.description)
      setValue('weatherIcon', weatherData.data.icon)
    }
  }, [weatherData, setValue])

  const locations = geocodingData?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Localização</h2>
        <p className="mt-1 text-sm text-muted">
          Onde aconteceu este momento?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text">
            Buscar localização
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do local..."
              className="border-card bg-background pl-10 text-text placeholder:text-muted"
            />
          </div>
        </div>

        {locations.length > 0 && (
          <div className="space-y-2">
            {locations.map((loc, index) => (
              <button
                key={`${loc.latitude}-${loc.longitude}-${index}`}
                type="button"
                onClick={() => selectLocation(loc)}
                className="w-full rounded-lg border-2 border-card bg-card p-3 text-left transition-all hover:border-primary/30"
              >
                <p className="font-medium text-text">{loc.name}</p>
                <p className="text-sm text-muted">
                  {loc.admin1 ? `${loc.admin1}, ` : ''}{loc.country}
                </p>
              </button>
            ))}
          </div>
        )}

        {locationName && (
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-sm font-medium text-primary">{locationName}</p>
          </div>
        )}

        {weatherData?.data && (
          <div className="flex items-center gap-3 rounded-lg bg-background p-3">
            <Cloud className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-text">
                {weatherData.data.temperature}° — {weatherData.data.description}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/steps/step-location.tsx
git commit -m "feat(web): add step-location component"
```

---

## Task 9: Step Music Component

**Files:**
- Create: `apps/web/src/components/steps/step-music.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useSpotifySearch } from '@/hooks/use-spotify-search'
import { Input, Label } from '@chronicle/ui'
import { Music } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateMemoryInput } from '@chronicle/schemas'
import type { SpotifyTrack } from '@/hooks/use-spotify-search'

interface StepMusicProps {
  form: UseFormReturn<CreateMemoryInput>
}

export function StepMusic({ form }: StepMusicProps) {
  const { setValue, watch } = form
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const musicTrack = watch('musicTrack')
  const musicArtist = watch('musicArtist')

  const { data: spotifyData } = useSpotifySearch(debouncedSearch)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const selectTrack = useCallback(
    (track: SpotifyTrack) => {
      setValue('musicTrack', track.name)
      setValue('musicArtist', track.artist)
      setValue('musicUrl', track.url)
      setValue('musicCover', track.cover)
      setSearchTerm('')
      setDebouncedSearch('')
    },
    [setValue],
  )

  const tracks = spotifyData?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Trilha Sonora</h2>
        <p className="mt-1 text-sm text-muted">
          Que música estava tocando neste momento?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text">
            Buscar música
          </Label>
          <div className="relative">
            <Music className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite nome da música ou artista..."
              className="border-card bg-background pl-10 text-text placeholder:text-muted"
            />
          </div>
        </div>

        {tracks.length > 0 && (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <button
                key={`${track.url}-${index}`}
                type="button"
                onClick={() => selectTrack(track)}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-card bg-card p-3 text-left transition-all hover:border-primary/30"
              >
                {track.cover && (
                  <img
                    src={track.cover}
                    alt={track.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-text">{track.name}</p>
                  <p className="truncate text-sm text-muted">{track.artist}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {musicTrack && (
          <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-3">
            <Music className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-primary">{musicTrack}</p>
              <p className="text-sm text-muted">{musicArtist}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/steps/step-music.tsx
git commit -m "feat(web): add step-music component"
```

---

## Task 10: Step Photos Component

**Files:**
- Create: `apps/web/src/components/steps/step-photos.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { Label } from '@chronicle/ui'
import { ImagePlus, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface StepPhotosProps {
  photos: File[]
  onPhotosChange: (photos: File[]) => void
}

export function StepPhotos({ photos, onPhotosChange }: StepPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newPhotos = Array.from(files).filter((file) =>
        file.type.startsWith('image/'),
      )
      onPhotosChange([...photos, ...newPhotos])
    },
    [photos, onPhotosChange],
  )

  const removePhoto = useCallback(
    (index: number) => {
      onPhotosChange(photos.filter((_, i) => i !== index))
    },
    [photos, onPhotosChange],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
      }
    },
    [addFiles],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Fotos</h2>
        <p className="mt-1 text-sm text-muted">
          Adicione fotos para tornar esta memória mais especial
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-card hover:border-primary/30'
        }`}
      >
        <ImagePlus className="mb-4 h-12 w-12 text-muted" />
        <p className="text-sm font-medium text-text">
          Arraste fotos aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-xs text-muted">JPG, PNG, WebP</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={`${photo.name}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={URL.createObjectURL(photo)}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-text" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/steps/step-photos.tsx
git commit -m "feat(web): add step-photos component"
```

---

## Task 11: Step People Component

**Files:**
- Create: `apps/web/src/components/steps/step-people.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { ChipInput } from '@/components/chip-input'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateMemoryInput } from '@chronicle/schemas'

interface StepPeopleProps {
  form: UseFormReturn<CreateMemoryInput>
  people: string[]
  onPeopleChange: (people: string[]) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
}

export function StepPeople({
  form,
  people,
  onPeopleChange,
  tags,
  onTagsChange,
}: StepPeopleProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Pessoas e Tags</h2>
        <p className="mt-1 text-sm text-muted">
          Quem estava presente e como categorizar esta memória?
        </p>
      </div>

      <div className="space-y-6">
        <ChipInput
          label="Pessoas"
          placeholder="Digite o nome e pressione Enter"
          value={people}
          onChange={onPeopleChange}
          maxLength={255}
        />

        <ChipInput
          label="Tags"
          placeholder="Ex: viagem, família, festa"
          value={tags}
          onChange={onTagsChange}
          maxLength={100}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/steps/step-people.tsx
git commit -m "feat(web): add step-people component"
```

---

## Task 12: Create Memory Wizard Component

**Files:**
- Create: `apps/web/src/components/create-memory-wizard.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useCreateMemory } from '@/hooks/use-create-memory'
import { createMemorySchema } from '@chronicle/schemas'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Card } from '@chronicle/ui'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { StepBasicInfo } from './steps/step-basic-info'
import { StepLocation } from './steps/step-location'
import { StepMusic } from './steps/step-music'
import { StepPhotos } from './steps/step-photos'
import { StepPeople } from './steps/step-people'

const STEPS = [
  { id: 0, label: 'Básico' },
  { id: 1, label: 'Local' },
  { id: 2, label: 'Música' },
  { id: 3, label: 'Fotos' },
  { id: 4, label: 'Pessoas' },
]

export function CreateMemoryWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [photos, setPhotos] = useState<File[]>([])
  const [people, setPeople] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])

  const createMemory = useCreateMemory()

  const form = useForm<CreateMemoryInput>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      title: '',
      content: '',
      memoryDate: new Date().toISOString().split('T')[0],
    },
  })

  const { handleSubmit, trigger, getValues } = form

  const validateStep = async () => {
    if (currentStep === 0) {
      return await trigger(['title', 'memoryDate'])
    }
    return true
  }

  const handleNext = async () => {
    const isValid = await validateStep()
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const onSubmit = async (data: CreateMemoryInput) => {
    const memoryData = {
      ...data,
      people: people.length > 0 ? people : undefined,
      tags: tags.length > 0 ? tags : undefined,
    }

    const result = await createMemory.mutateAsync(memoryData)

    if (photos.length > 0 && result?.data?.id) {
      for (const photo of photos) {
        const formData = new FormData()
        formData.append('file', photo)

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/memories/${result.data.id}/photos`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          },
        )
      }
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepBasicInfo form={form} />
      case 1:
        return <StepLocation form={form} />
      case 2:
        return <StepMusic form={form} />
      case 3:
        return (
          <StepPhotos photos={photos} onPhotosChange={setPhotos} />
        )
      case 4:
        return (
          <StepPeople
            form={form}
            people={people}
            onPeopleChange={setPeople}
            tags={tags}
            onTagsChange={setTags}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card className="mx-auto max-w-2xl border-card bg-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  index === currentStep
                    ? 'bg-primary text-background'
                    : index < currentStep
                      ? 'bg-primary/20 text-primary'
                      : 'bg-background text-muted'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`ml-2 h-0.5 w-8 ${
                    index < currentStep ? 'bg-primary' : 'bg-background'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderStep()}

        <div className="mt-8 flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="gap-2 border-card text-text hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="gap-2 bg-primary text-background hover:bg-secondary"
            >
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={createMemory.isPending}
              className="gap-2 bg-primary text-background hover:bg-secondary"
            >
              {createMemory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Memória'
              )}
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/create-memory-wizard.tsx
git commit -m "feat(web): add create-memory-wizard component"
```

---

## Task 13: Create Memory Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/memories/new/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { CreateMemoryWizard } from '@/components/create-memory-wizard'

export default function NewMemoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Nova Memória</h1>
        <p className="mt-2 text-muted">
          Registre um novo momento na sua timeline
        </p>
      </div>
      <CreateMemoryWizard />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/memories/new/page.tsx
git commit -m "feat(web): add create memory page"
```

---

## Task 14: Integration Test

- [ ] **Step 1: Start dev server and verify**

```bash
pnpm dev:web
```

Navigate to `http://localhost:3000/memories/new` and verify:
- Wizard renders with 5 steps
- Step 1 (Básico) shows title, date, content fields
- "Próximo" button advances to step 2
- "Anterior" button goes back
- Step 2 shows geocoding search
- Step 3 shows Spotify search
- Step 4 shows drag & drop area
- Step 5 shows chip inputs for people and tags

- [ ] **Step 2: Test form submission**

Fill in title and date, skip optional steps, submit:
- Memory is created via POST /api/memories
- Redirects to /

- [ ] **Step 3: Run lint and typecheck**

```bash
pnpm lint
pnpm typecheck
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(web): lint and typecheck fixes for create memory"
```
