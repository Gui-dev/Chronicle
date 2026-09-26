'use client'

import { api } from '@/lib/api-client'
import type { UpdateMemoryInput } from '@chronicle/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface UpdateMemoryResponse {
  data: {
    id: string
    title: string
  }
}

export function useUpdateMemory(id: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: UpdateMemoryInput) => {
      return api.put<UpdateMemoryResponse>(`/api/memories/${id}`, data)
    },
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ['memories'] })
      await queryClient.cancelQueries({ queryKey: ['memory', id] })
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', id] })
      router.push('/')
    },
  })
}
