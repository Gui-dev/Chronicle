'use client'

import { api } from '@/lib/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useDeleteMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/memories/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}
