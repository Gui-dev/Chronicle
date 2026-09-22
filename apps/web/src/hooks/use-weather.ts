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
      return api.get<WeatherResponse>(`/api/weather?latitude=${lat}&longitude=${lng}`)
    },
    enabled: !!lat && !!lng,
    staleTime: 5 * 60 * 1000,
  })
}

export type { WeatherData }
