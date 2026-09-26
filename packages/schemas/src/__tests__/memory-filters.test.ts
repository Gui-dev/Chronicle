import { describe, expect, it } from 'vitest'
import { memoryFiltersSchema } from '../memory-filters'

describe('memoryFiltersSchema', () => {
  it('should validate with no filters', () => {
    const result = memoryFiltersSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('should apply default values', () => {
    const result = memoryFiltersSchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('should validate year range', () => {
    const result = memoryFiltersSchema.safeParse({
      year: 1999, // Invalid: min 2000
    })

    expect(result.success).toBe(false)
  })

  it('should validate month range', () => {
    const result = memoryFiltersSchema.safeParse({
      month: 13, // Invalid: max 12
    })

    expect(result.success).toBe(false)
  })

  it('should validate limit', () => {
    const result = memoryFiltersSchema.safeParse({
      limit: 101, // Invalid: max 100
    })

    expect(result.success).toBe(false)
  })

  it('should leave mine undefined when absent', () => {
    const result = memoryFiltersSchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mine).toBeUndefined()
    }
  })

  it('should resolve mine "true" to boolean true', () => {
    const result = memoryFiltersSchema.safeParse({ mine: 'true' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mine).toBe(true)
    }
  })

  it('should resolve mine "false" to boolean false instead of truthy', () => {
    const result = memoryFiltersSchema.safeParse({ mine: 'false' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.mine).toBe(false)
    }
  })

  it('should reject non-boolean mine values that coercion would treat as truthy', () => {
    for (const value of ['0', '1', 'no', 'yes', '', 'TRUE']) {
      const result = memoryFiltersSchema.safeParse({ mine: value })

      expect(result.success, `expected mine=${JSON.stringify(value)} to be rejected`).toBe(false)
    }
  })
})
