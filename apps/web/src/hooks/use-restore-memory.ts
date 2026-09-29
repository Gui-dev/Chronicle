'use client'

import { api } from '@/lib/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRestoreMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/memories/${id}/restore`)
    },
    onSuccess: () => {
      // Both lists move: the trash empties and the timeline regains the card.
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}
