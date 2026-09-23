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
