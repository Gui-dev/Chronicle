'use client'

import { api } from '@/lib/api-client'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreateMemoryResponse {
  data: {
    id: string
    title: string
    memoryDate: string
  }
}

export function useCreateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateMemoryInput) => {
      return api.post<CreateMemoryResponse>('/api/memories', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}

export type { CreateMemoryResponse }
