'use client'

import { useSpotifySearch } from '@/hooks/use-spotify-search'
import type { SpotifyTrack } from '@/hooks/use-spotify-search'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { Input, Label } from '@chronicle/ui'
import { Music } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

interface StepMusicProps {
  form: UseFormReturn<CreateMemoryInput, any>
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
        <p className="mt-1 text-sm text-muted">Que música estava tocando neste momento?</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text">Buscar música</Label>
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
