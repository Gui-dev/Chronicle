'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

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
let fetchPromise: Promise<SessionData | null> | null = null

async function fetchSession(): Promise<SessionData | null> {
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const res = await fetch('http://localhost:3333/api/auth/get-session', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      return (await res.json()) as SessionData
    } catch {
      return null
    } finally {
      fetchPromise = null
    }
  })()

  return fetchPromise
}

export function useAuth() {
  const queryClient = useQueryClient()
  const mountedRef = useRef(false)
  const [session, setSession] = useState<SessionData | null | undefined>(cachedSession)
  const [isLoading, setIsLoading] = useState(cachedSession === undefined)

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true

    if (cachedSession !== undefined) {
      setSession(cachedSession)
      setIsLoading(false)
      return
    }

    fetchSession().then((data) => {
      cachedSession = data
      setSession(data)
      setIsLoading(false)
    })
  }, [])

  const invalidateSession = useCallback(async () => {
    cachedSession = undefined
    setSession(undefined)
    setIsLoading(true)

    const data = await fetchSession()
    cachedSession = data
    setSession(data)
    setIsLoading(false)
    queryClient.invalidateQueries({ queryKey: ['memories'] })
  }, [queryClient])

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isAuthenticated: !!session?.user,
    isLoading,
    error: null,
    invalidateSession,
  }
}
