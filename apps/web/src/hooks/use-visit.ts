'use client'

import { api } from '@/lib/api-client'
import { useMutation } from '@tanstack/react-query'

export function useVisit() {
  return useMutation({
    mutationFn: () => api.post('/api/retrospectives/visit'),
  })
}
