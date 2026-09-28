'use client'

import { api } from '@/lib/api-client'
import type { MemoryFiltersInput, ParsedSearchQuery } from '@chronicle/schemas'
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
  aiMood: string | null
  aiThemes: string[] | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  people: Array<{ id: string; memoryId: string; name: string }>
  tags: Array<{ id: string; memoryId: string; name: string }>
  photos: Array<{
    id: string
    url: string
    filename: string | null
    mimetype: string | null
    size: number | null
    width: number | null
    height: number | null
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
  /** The parsed form of the `search` filter, echoed back by the API. Null when no search was sent. */
  searchMeta: ParsedSearchQuery | null
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
  if (filters.mine) params.set('mine', 'true')

  return params.toString()
}

export function useMemories(filters: MemoryFiltersInput, options?: { enabled?: boolean }) {
  return useQuery<PaginatedResponse>({
    queryKey: ['memories', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters)
      const endpoint = `/api/memories${queryString ? `?${queryString}` : ''}`
      return api.get<PaginatedResponse>(endpoint)
    },
    enabled: options?.enabled ?? true,
  })
}

export type { Memory, PaginatedResponse }
