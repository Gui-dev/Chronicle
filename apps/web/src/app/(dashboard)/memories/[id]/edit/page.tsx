'use client'

import { useMemory } from '@/hooks/use-memory'
import { useUpdateMemory } from '@/hooks/use-update-memory'
import { updateMemorySchema } from '@chronicle/schemas'
import { Button } from '@chronicle/ui'
import { ArrowLeft, Calendar, Cloud, Loader2, MapPin, Music, Save, Tag, Users } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function EditMemoryPage() {
  const params = useParams()
  const id = params.id as string

  const { data: memory, isLoading } = useMemory(id)
  const updateMutation = useUpdateMemory(id)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [memoryDate, setMemoryDate] = useState('')
  const [weatherTemp, setWeatherTemp] = useState('')
  const [weatherDesc, setWeatherDesc] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationLat, setLocationLat] = useState('')
  const [locationLng, setLocationLng] = useState('')
  const [people, setPeople] = useState('')
  const [tags, setTags] = useState('')
  const [musicTrack, setMusicTrack] = useState('')
  const [musicArtist, setMusicArtist] = useState('')
  const [musicUrl, setMusicUrl] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (memory) {
      setTitle(memory.title)
      setContent(memory.content || '')
      setMemoryDate(
        memory.memoryDate
          ? `${new Date(memory.memoryDate).getUTCFullYear()}-${String(new Date(memory.memoryDate).getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(memory.memoryDate).getUTCDate()).padStart(2, '0')}`
          : '',
      )
      setWeatherTemp(memory.weatherTemp?.toString() || '')
      setWeatherDesc(memory.weatherDesc || '')
      setLocationName(memory.locationName || '')
      setLocationLat(memory.locationLat?.toString() || '')
      setLocationLng(memory.locationLng?.toString() || '')
      setPeople(memory.people?.map((p) => p.name).join(', ') || '')
      setTags(memory.tags?.map((t) => t.name).join(', ') || '')
      setMusicTrack(memory.musicTrack || '')
      setMusicArtist(memory.musicArtist || '')
      setMusicUrl(memory.musicUrl || '')
    }
  }, [memory])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const parsed = updateMemorySchema.safeParse({
      title,
      content: content || undefined,
      memoryDate: memoryDate || undefined,
      weatherTemp: weatherTemp ? Number(weatherTemp) : undefined,
      weatherDesc: weatherDesc || undefined,
      locationName: locationName || undefined,
      locationLat: locationLat ? Number(locationLat) : undefined,
      locationLng: locationLng ? Number(locationLng) : undefined,
      people: people
        ? people
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      musicTrack: musicTrack || undefined,
      musicArtist: musicArtist || undefined,
      musicUrl: musicUrl || undefined,
    })

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string
        fieldErrors[field] = issue.message
      }
      setErrors(fieldErrors)
      return
    }

    updateMutation.mutate(parsed.data)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted">Memória não encontrada</p>
        <Link href="/" prefetch={false} className="text-primary hover:underline">
          Voltar ao início
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/memories/${id}`}
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar à memória
        </Link>
      </div>

      <h1 className="mb-8 text-2xl font-bold text-text">Editar Memória</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-text">
            Título *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da memória..."
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
        </div>

        <div>
          <label htmlFor="content" className="mb-1 block text-sm font-medium text-text">
            Conteúdo
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Descreva sua memória..."
            rows={5}
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="memoryDate"
              className="mb-1 flex items-center gap-1 text-sm font-medium text-text"
            >
              <Calendar className="h-4 w-4" /> Data
            </label>
            <input
              id="memoryDate"
              type="date"
              value={memoryDate}
              onChange={(e) => setMemoryDate(e.target.value)}
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="weatherTemp"
              className="mb-1 flex items-center gap-1 text-sm font-medium text-text"
            >
              <Cloud className="h-4 w-4" /> Temperatura (°C)
            </label>
            <input
              id="weatherTemp"
              type="number"
              value={weatherTemp}
              onChange={(e) => setWeatherTemp(e.target.value)}
              placeholder="25"
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="weatherDesc" className="mb-1 block text-sm font-medium text-text">
              Descrição clima
            </label>
            <input
              id="weatherDesc"
              type="text"
              value={weatherDesc}
              onChange={(e) => setWeatherDesc(e.target.value)}
              placeholder="Ensolarado, chuvoso..."
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="locationName"
            className="mb-1 flex items-center gap-1 text-sm font-medium text-text"
          >
            <MapPin className="h-4 w-4" /> Local
          </label>
          <input
            id="locationName"
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Nome do local..."
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="locationLat" className="mb-1 block text-sm font-medium text-text">
              Latitude
            </label>
            <input
              id="locationLat"
              type="number"
              step="any"
              value={locationLat}
              onChange={(e) => setLocationLat(e.target.value)}
              placeholder="-23.55"
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="locationLng" className="mb-1 block text-sm font-medium text-text">
              Longitude
            </label>
            <input
              id="locationLng"
              type="number"
              step="any"
              value={locationLng}
              onChange={(e) => setLocationLng(e.target.value)}
              placeholder="-46.63"
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="people"
            className="mb-1 flex items-center gap-1 text-sm font-medium text-text"
          >
            <Users className="h-4 w-4" /> Pessoas (separar com vírgula)
          </label>
          <input
            id="people"
            type="text"
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            placeholder="João, Maria, Pedro..."
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="tags"
            className="mb-1 flex items-center gap-1 text-sm font-medium text-text"
          >
            <Tag className="h-4 w-4" /> Tags (separar com vírgula)
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="viagem, família, natureza..."
            className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div className="border-t border-card pt-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-text">
            <Music className="h-4 w-4" /> Música
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="musicTrack" className="mb-1 block text-sm font-medium text-text">
                Título da música
              </label>
              <input
                id="musicTrack"
                type="text"
                value={musicTrack}
                onChange={(e) => setMusicTrack(e.target.value)}
                placeholder="Nome da música..."
                className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="musicArtist" className="mb-1 block text-sm font-medium text-text">
                Artista
              </label>
              <input
                id="musicArtist"
                type="text"
                value={musicArtist}
                onChange={(e) => setMusicArtist(e.target.value)}
                placeholder="Nome do artista..."
                className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="musicUrl" className="mb-1 block text-sm font-medium text-text">
              URL da música
            </label>
            <input
              id="musicUrl"
              type="url"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="https://exemplo.com/musica.mp3"
              className="w-full rounded-lg border border-card bg-background px-4 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="save-button"
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-background hover:bg-secondary"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar alterações
          </Button>
          <Link href={`/memories/${id}`} prefetch={false}>
            <Button
              type="button"
              variant="outline"
              className="border-card text-text hover:border-primary hover:text-primary"
            >
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
