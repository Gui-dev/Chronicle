import { describe, expect, it } from 'vitest'

describe('Auth Environment', () => {
  it('should export env object', async () => {
    const { env } = await import('../env')
    expect(typeof env).toBe('object')
  })
})
