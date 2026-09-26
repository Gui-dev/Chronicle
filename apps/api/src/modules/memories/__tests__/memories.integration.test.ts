import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../memories.service', () => ({
  memoriesService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

const { auth } = await import('@chronicle/auth')
const { memoriesService } = await import('../memories.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(memoriesService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

describe('Memories Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    signOut()
    service.findAll.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    } as unknown as Awaited<ReturnType<typeof service.findAll>>)
    service.findById.mockResolvedValue({ id: 'mem-1' } as unknown as Awaited<
      ReturnType<typeof service.findById>
    >)
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
      signIn('user-1')

      const response = await server.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          // Missing title
          memoryDate: new Date().toISOString(),
        },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/memories', () => {
    it('serves the public feed without a session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories',
      })

      expect(response.statusCode).toBe(200)
    })

    it('returns 400 for invalid query params', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories?year=abc',
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for an unrecognised mine value', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories?mine=maybe',
      })

      expect(response.statusCode).toBe(400)
    })

    it('still returns 401 for the owner-only mine filter', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories?mine=true',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('GET /api/memories/:id', () => {
    it('serves a memory without a session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/memories/123e4567-e89b-12d3-a456-426614174000',
      })

      expect(response.statusCode).toBe(200)
    })

    it('does not reject an unknown id as unauthorized', async () => {
      service.findById.mockRejectedValue(Object.assign(new Error('Not found'), { statusCode: 404 }))

      const response = await server.inject({
        method: 'GET',
        url: '/api/memories/invalid-id',
      })

      expect(response.statusCode).toBe(404)
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
