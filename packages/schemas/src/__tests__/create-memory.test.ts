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

  it('should accept isPublic as an optional boolean', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      isPublic: false,
    })

    expect(result.success).toBe(true)
  })

  // The wizard's mood select starts on an empty option. Without this the whole
  // form 400s on submit before a single row is written — the failure that made
  // every wizard spec time out waiting for a navigation that never came.
  it('should treat the empty mood option as no mood', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      aiMood: '',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.aiMood).toBeUndefined()
    }
  })

  it('should keep a chosen mood and reject an unknown one', () => {
    const chosen = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      aiMood: 'nostalgic',
    })
    expect(chosen.success).toBe(true)
    if (chosen.success) {
      expect(chosen.data.aiMood).toBe('nostalgic')
    }

    const unknown = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      aiMood: 'grumpy',
    })
    expect(unknown.success).toBe(false)
  })

  it('should reject isPublic when it is not a boolean', () => {
    const result = createMemorySchema.safeParse({
      title: 'Test Memory',
      memoryDate: '2026-03-12',
      isPublic: 'false',
    })

    expect(result.success).toBe(false)
  })
})
