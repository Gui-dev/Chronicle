'use client'

import { api } from '@/lib/api-client'
import type { MemoryFiltersInput } from '@chronicle/schemas'
import { useQuery } from '@tanstack/react-query'

interface Memory {
  id: string
  userId: string
  title: string
  content: string | null
  memoryDate: string
  locationName: string | null
  locationLat: string | null
  locationLng: string | null
  weatherTemp: string | null
  weatherDesc: string | null
  weatherIcon: string | null
  musicTrack: string | null
  musicArtist: string | null
  musicUrl: string | null
  musicCover: string | null
  aiNarrative: string | null
  createdAt: string
  updatedAt: string
  photos: Array<{
    id: string
    url: string
    filename: string | null
    mimetype: string | null
    size: number | null
    orderIndex: number
  }>
}

interface PaginatedResponse {
  data: Memory[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

function buildQueryString(filters: MemoryFiltersInput): string {
  const params = new URLSearchParams()

  if (filters.year) params.set('year', filters.year.toString())
  if (filters.month) params.set('month', filters.month.toString())
  if (filters.weather) params.set('weather', filters.weather)
  if (filters.location) params.set('location', filters.location)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.search) params.set('search', filters.search)
  if (filters.page) params.set('page', filters.page.toString())
  if (filters.limit) params.set('limit', filters.limit.toString())

  return params.toString()
}

export function useMemories(filters: MemoryFiltersInput) {
  return useQuery<PaginatedResponse>({
    queryKey: ['memories', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters)
      const endpoint = `/api/memories${queryString ? `?${queryString}` : ''}`
      return api.get<PaginatedResponse>(endpoint)
    },
  })
}

export type { Memory, PaginatedResponse }
