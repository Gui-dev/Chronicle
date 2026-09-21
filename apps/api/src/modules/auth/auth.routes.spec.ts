import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../server'

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

vi.mock('../../env', () => ({
  env: {
    PORT: 3333,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chronicle_test',
    BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}))

const { auth: mockAuth } = (await import('@chronicle/auth')) as any

describe('Auth Routes', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockResult = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        token: { access_token: 'token-123', refresh_token: 'refresh-123' },
      }
      mockAuth.api.signUpEmail.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.payload)
      expect(body.data.user.email).toBe('test@example.com')
      expect(body.data.token).toBeDefined()
    })

    it('should return 400 for invalid email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for short password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: '1234567',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      const mockResult = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        token: { access_token: 'token-123', refresh_token: 'refresh-123' },
      }
      mockAuth.api.signInEmail.mockResolvedValue(mockResult)

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.user.email).toBe('test@example.com')
      expect(body.data.token).toBeDefined()
    })

    it('should return 400 for invalid credentials', async () => {
      mockAuth.api.signInEmail.mockRejectedValue(new Error('Invalid credentials'))

      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      })

      expect(response.statusCode).toBe(500)
    })

    it('should return 400 for missing email', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'password123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing password', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      const mockSession = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      }
      mockAuth.api.getSession.mockResolvedValue(mockSession)

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer token-123',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.data.user.email).toBe('test@example.com')
    })

    it('should return 401 when not authenticated', async () => {
      mockAuth.api.getSession.mockResolvedValue(null)

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
      })

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('should return 401 with invalid token', async () => {
      mockAuth.api.getSession.mockResolvedValue(null)

      const response = await server.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
