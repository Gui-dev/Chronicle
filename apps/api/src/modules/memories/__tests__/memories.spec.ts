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

describe('Memories Routes', () => {
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
  })

  describe('GET /api/memories', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/memories/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories/123',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('PUT /api/memories/:id', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/memories/123',
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
        url: '/api/memories/123',
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
