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

type SessionListener = (data: SessionData | null | undefined) => void

const sessionListeners = new Set<SessionListener>()

function broadcastSession(data: SessionData | null | undefined) {
  for (const listener of sessionListeners) {
    listener(data)
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

async function fetchSessionOnce(): Promise<SessionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
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

  useEffect(() => {
    sessionListeners.add(setSession)
    return () => {
      sessionListeners.delete(setSession)
    }
  }, [])

  const invalidateSession = useCallback(async () => {
    cachedSession = undefined
    const data = await fetchSessionOnce()
    cachedSession = data
    broadcastSession(data)
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
