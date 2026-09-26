import { describe, expect, it } from 'vitest'
import { updateMemorySchema } from '../update-memory'

describe('updateMemorySchema', () => {
  it('should allow partial updates', () => {
    const result = updateMemorySchema.safeParse({
      title: 'Updated Title',
    })

    expect(result.success).toBe(true)
  })

  it('should allow empty update', () => {
    const result = updateMemorySchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('should still validate types on provided fields', () => {
    const result = updateMemorySchema.safeParse({
      locationLat: 91, // Invalid
    })

    expect(result.success).toBe(false)
  })

  it('should allow isPublic partial update', () => {
    const result = updateMemorySchema.safeParse({
      isPublic: false,
    })

    expect(result.success).toBe(true)
  })

  it('should reject isPublic when it is not a boolean', () => {
    const result = updateMemorySchema.safeParse({
      isPublic: 'false',
    })

    expect(result.success).toBe(false)
  })
})
