'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export function useActivity() {
  return useQuery<{ data: { count: number; since: string | null } }>({
    queryKey: ['retro', 'activity'],
    queryFn: () =>
      api.get<{ data: { count: number; since: string | null } }>('/api/retrospectives/activity'),
    staleTime: 0,
  })
}
