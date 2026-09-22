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
      return api.get<GeocodingResponse>(`/api/geocoding?q=${encodeURIComponent(searchTerm)}`)
    },
    enabled: searchTerm.length >= 2,
    staleTime: 10 * 60 * 1000,
  })
}

export type { GeocodingResult }
