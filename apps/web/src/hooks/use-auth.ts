'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'

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

let cachedSession: SessionData | null | undefined = undefined

async function fetchSessionOnce(): Promise<SessionData | null> {
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
}

export function useAuth() {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<SessionData | null | undefined>(cachedSession)

  useEffect(() => {
    if (cachedSession !== undefined) {
      setSession(cachedSession)
      return
    }

    fetchSessionOnce().then((data) => {
      cachedSession = data
      setSession(data)
    })
  }, [])

  const invalidateSession = useCallback(async () => {
    cachedSession = undefined
    setSession(undefined)
    const data = await fetchSessionOnce()
    cachedSession = data
    setSession(data)
    queryClient.invalidateQueries({ queryKey: ['memories'] })
  }, [queryClient])

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isAuthenticated: !!session?.user,
    isLoading: session === undefined,
    error: null,
    invalidateSession,
  }
}
