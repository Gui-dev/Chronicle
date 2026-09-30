'use client'

import type { Memory } from '@/hooks/use-memories'
import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export function useYearAgo() {
  return useQuery<{ data: Memory[] }>({
    queryKey: ['retro', 'year-ago'],
    queryFn: () => api.get<{ data: Memory[] }>('/api/retrospectives/year-ago'),
    staleTime: 0,
  })
}
