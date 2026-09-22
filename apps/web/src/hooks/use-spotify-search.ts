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
