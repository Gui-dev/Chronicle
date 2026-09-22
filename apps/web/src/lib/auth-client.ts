import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333',
  fetchOptions: {
    credentials: 'include',
  },
  sessionOptions: {
    refetchInterval: 30,
    refetchOnWindowFocus: true,
    refetchWhenOffline: false,
  },
})

export const { signIn, signUp, signOut, useSession } = authClient
