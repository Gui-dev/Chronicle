'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

interface SessionData {
  user?: {
    id: string
    name: string | null
    email: string
    image: string | null
  } | null
  session?: {
    id: string
    userId: string
    expiresAt: string
    token: string
  } | null
}

export function useAuth() {
  const {
    data: session,
    isPending,
    error,
    refetch,
  } = useQuery<SessionData | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const data = await api.get<SessionData>('/api/auth/get-session')
        return data
      } catch {
        return null
      }
    },
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 0,
  })

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error,
    refetch,
  }
}
