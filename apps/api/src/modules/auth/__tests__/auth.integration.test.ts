import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      signUpEmail: vi.fn(),
      signInEmail: vi.fn(),
      getSession: vi.fn(),
    },
    handler: vi.fn(),
  },
}))

vi.mock('../../../env', () => ({
  env: {
    PORT: 3333,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chronicle_test',
    BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}))

const { auth: mockAuth } = (await import('@chronicle/auth')) as unknown as {
  auth: {
    api: {
      signUpEmail: ReturnType<typeof vi.fn>
      signInEmail: ReturnType<typeof vi.fn>
      getSession: ReturnType<typeof vi.fn>
    }
  }
}

describe('Auth Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const mockResult = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        token: { access_token: 'token-123', refresh_token: 'refresh-123' },
      }
      mockAuth.api.signUpEmail.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `test-${Date.now()}@example.com`,
          password: 'password123',
          name: 'Test User',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.payload)
      expect(body.data).toBeDefined()
      expect(body.data.user).toBeDefined()
    })

    it('should return 400 for invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for short password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: `test-${Date.now()}@example.com`,
          password: '1234567', // 7 chars, min is 8
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: `test-${Date.now()}@example.com`,
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
