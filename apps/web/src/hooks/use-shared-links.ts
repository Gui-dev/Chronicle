'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export interface SharedLink {
  id: string
  title: string
  memoryDate: string
  token: string
  expiresAt: string
}

export function useSharedLinks() {
  return useQuery<{ data: SharedLink[] }>({
    queryKey: ['shared-links'],
    queryFn: async () => {
      return api.get<{ data: SharedLink[] }>('/api/memories/shared')
    },
  })
}
