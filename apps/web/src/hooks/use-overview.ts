'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export interface OverviewCount {
  name: string
  count: number
}

export interface OverviewResponse {
  period: { year: number; month: number | null }
  years: number[]
  summary: {
    memories: number
    people: number
    places: number
    topTags: OverviewCount[]
  }
  recurrences: {
    people: OverviewCount[]
    places: OverviewCount[]
    themes: OverviewCount[]
  }
  places: Array<{ name: string; lat: number; lng: number; count: number }>
}

export function useOverview(year: number | undefined, month: number | undefined) {
  return useQuery<{ data: OverviewResponse }>({
    queryKey: ['retro', 'overview', { year, month }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (year !== undefined) params.set('year', String(year))
      if (month !== undefined) params.set('month', String(month))
      const qs = params.toString()
      return api.get<{ data: OverviewResponse }>(
        `/api/retrospectives/overview${qs ? `?${qs}` : ''}`,
      )
    },
    staleTime: 0,
  })
}
