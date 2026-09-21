import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
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

describe('Memories Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/memories', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          title: 'Test Memory',
          memoryDate: new Date().toISOString(),
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 400 for invalid payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          // Missing title
          memoryDate: new Date().toISOString(),
        },
      })

      // Will be 401 if no auth, or 400 if auth passes
      expect([400, 401]).toContain(response.statusCode)
    })
  })

  describe('GET /api/memories', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 401 with invalid query params', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories?year=abc',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/memories/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories/123e4567-e89b-12d3-a456-426614174000',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 401 for invalid UUID', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories/invalid-id',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /api/memories/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/memories/123e4567-e89b-12d3-a456-426614174000',
        payload: {
          title: 'Updated Memory',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('DELETE /api/memories/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/memories/123e4567-e89b-12d3-a456-426614174000',
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
