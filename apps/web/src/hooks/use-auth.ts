'use client'

import { useSession } from '@/lib/auth-client'

export function useAuth() {
  const { data: session, isPending, error } = useSession()

  return {
    user: session?.user,
    session: session?.session,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error,
  }
}
