import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '../auth'

describe('registerSchema', () => {
  it('should validate a valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    })

    expect(result.success).toBe(true)
  })

  it('should require email', () => {
    const result = registerSchema.safeParse({
      password: 'password123',
    })

    expect(result.success).toBe(false)
  })

  it('should require valid email format', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    })

    expect(result.success).toBe(false)
  })

  it('should require password min length', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: '1234567', // 7 chars, min is 8
    })

    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('should validate a valid login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(result.success).toBe(true)
  })

  it('should require email', () => {
    const result = loginSchema.safeParse({
      password: 'password123',
    })

    expect(result.success).toBe(false)
  })

  it('should require password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
    })

    expect(result.success).toBe(false)
  })
})
