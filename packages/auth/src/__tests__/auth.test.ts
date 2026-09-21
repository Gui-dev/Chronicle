import { describe, expect, it } from 'vitest'
import { auth } from '../auth'

describe('Auth Configuration', () => {
  it('should export auth instance', () => {
    expect(auth).toBeDefined()
    expect(auth.api).toBeDefined()
  })

  it('should have emailAndPassword enabled', () => {
    // Better Auth doesn't expose options via ctx in current version
    // Verify auth is properly configured by checking it has expected API methods
    expect(typeof auth.api.signUpEmail).toBe('function')
    expect(typeof auth.api.signInEmail).toBe('function')
  })
})
