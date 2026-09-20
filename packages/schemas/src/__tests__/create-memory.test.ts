import { describe, expect, it } from 'vitest'
import { createMemorySchema } from '../create-memory'

describe('createMemorySchema', () => {
  it('should validate a valid memory', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      content: 'This is a test memory',
      memoryDate: '2026-03-12',
    })

    expect(result.success).toBe(true)
  })

  it('should require title', () => {
    const result = createMemorySchema.safeParse({
      memoryDate: '2026-03-12',
    })

    expect(result.success).toBe(false)
  })

  it('should require memoryDate', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
    })

    expect(result.success).toBe(false)
  })

  it('should validate location coordinates', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      locationLat: 91, // Invalid: max 90
    })

    expect(result.success).toBe(false)
  })

  it('should validate music URL format', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      musicUrl: 'not-a-url',
    })

    expect(result.success).toBe(false)
  })
})
