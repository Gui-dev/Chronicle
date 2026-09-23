'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

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
  const queryClient = useQueryClient()
  const {
    data: session,
    isPending,
    error,
    refetch: refreshSession,
  } = useQuery<SessionData | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:3333/api/auth/get-session', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) return null
        return (await res.json()) as SessionData
      } catch {
        return null
      }
    },
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 5 * 60 * 1000,
  })

  const invalidateSession = async () => {
    await queryClient.invalidateQueries({ queryKey: ['session'] })
  }

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error,
    invalidateSession,
    refreshSession,
  }
}
