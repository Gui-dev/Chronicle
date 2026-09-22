'use client'

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
  } = useQuery<SessionData | null>({
    queryKey: ['session'],
    queryFn: async (): Promise<SessionData | null> => {
      const res = await fetch('/api/auth/get-session', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      return (await res.json()) as SessionData
    },
    retry: false,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error,
  }
}
