'use client'

import { api } from '@/lib/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRevokeShare() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memoryId: string) => {
      return api.delete(`/api/memories/${memoryId}/share`)
    },
    onSuccess: () => {
      // The dialog reads ['memory', id] for its state and the list page reads
      // ['shared-links']; one revoke moves both, which is why the dialog and
      // the /share page share this hook.
      queryClient.invalidateQueries({ queryKey: ['shared-links'] })
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })
}
