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

export function useAuth() {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<SessionData | null | undefined>(() => cachedSession)
  const [isLoading, setIsLoading] = useState(() => cachedSession === undefined)

  useEffect(() => {
    if (cachedSession !== undefined) {
      setSession(cachedSession)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const fetchSession = async () => {
      try {
        const res = await fetch('http://localhost:3333/api/auth/get-session', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })
        if (cancelled) return
        if (!res.ok) {
          setSession(null)
          cachedSession = null
        } else {
          const data = (await res.json()) as SessionData
          setSession(data)
          cachedSession = data
        }
      } catch {
        if (!cancelled) {
          setSession(null)
          cachedSession = null
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchSession()

    return () => {
      cancelled = true
    }
  }, [])

  const invalidateSession = useCallback(async () => {
    cachedSession = undefined
    setSession(undefined)
    setIsLoading(true)

    try {
      const res = await fetch('http://localhost:3333/api/auth/get-session', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        setSession(null)
        cachedSession = null
      } else {
        const data = (await res.json()) as SessionData
        setSession(data)
        cachedSession = data
      }
    } catch {
      setSession(null)
      cachedSession = null
    } finally {
      setIsLoading(false)
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    }
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
