'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import type { Memory } from './use-memories'

interface MemoryDetailResponse {
  data: Memory
}

export function useMemory(id: string) {
  return useQuery<Memory>({
    queryKey: ['memory', id],
    queryFn: async () => {
      const { data } = await api.get<MemoryDetailResponse>(`/api/memories/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export type { Memory as MemoryDetail }
