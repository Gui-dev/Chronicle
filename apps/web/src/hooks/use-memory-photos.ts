'use client'

import { api } from '@/lib/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

export function useUploadMemoryPhoto(memoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/api/memories/${memoryId}/photos`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Não foi possível enviar a foto')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory', memoryId] })
    },
  })
}

export function useDeleteMemoryPhoto(memoryId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (photoId: string) => api.delete(`/api/memories/${memoryId}/photos/${photoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory', memoryId] })
    },
  })
}
