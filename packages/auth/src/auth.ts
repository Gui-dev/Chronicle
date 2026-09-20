import { db } from '@chronicle/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { env } from './env'
import { plugins } from './plugins'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins,
  baseURL: env.BETTER_AUTH_URL,
})

export type Session = typeof auth.$Infer.Session
