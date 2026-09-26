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

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Awaited<
    ReturnType<typeof auth.api.getSession>
  >)

const signOut = () => getSession.mockResolvedValue(null)

describe('Memories Routes', () => {
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
      data: [{ id: 'mem-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof service.findAll>>)
    service.findById.mockResolvedValue({ id: 'mem-1' } as unknown as Awaited<
      ReturnType<typeof service.findById>
    >)
  })

  describe('GET /api/memories', () => {
    it('serves the public feed to anonymous visitors', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/memories' })

      expect(response.statusCode).toBe(200)
      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
        { userId: undefined },
      )
    })

    it('passes the signed-in user id so they also see their private memories', async () => {
      signIn('user-9')

      const response = await server.inject({ method: 'GET', url: '/api/memories' })

      expect(response.statusCode).toBe(200)
      expect(service.findAll).toHaveBeenCalledWith(expect.anything(), { userId: 'user-9' })
    })

    it('returns 401 when mine=true is requested without a session', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/memories?mine=true' })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
      expect(service.findAll).not.toHaveBeenCalled()
    })

    it('allows mine=true for a signed-in user', async () => {
      signIn('user-9')

      const response = await server.inject({ method: 'GET', url: '/api/memories?mine=true' })

      expect(response.statusCode).toBe(200)
      expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ mine: true }), {
        userId: 'user-9',
      })
    })

    it('treats mine=false as a public feed request, not an owner filter', async () => {
      signIn('user-9')

      const response = await server.inject({ method: 'GET', url: '/api/memories?mine=false' })

      expect(response.statusCode).toBe(200)
      expect(service.findAll).toHaveBeenCalledWith(expect.objectContaining({ mine: false }), {
        userId: 'user-9',
      })
    })

    it('returns 400 for invalid query params', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/memories?year=abc' })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/memories/:id', () => {
    it('serves a public memory to anonymous visitors', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/memories/123' })

      expect(response.statusCode).toBe(200)
      expect(service.findById).toHaveBeenCalledWith('123', undefined)
    })

    it('passes the signed-in user id to the privacy check', async () => {
      signIn('user-9')

      const response = await server.inject({ method: 'GET', url: '/api/memories/123' })

      expect(response.statusCode).toBe(200)
      expect(service.findById).toHaveBeenCalledWith('123', 'user-9')
    })

    it('surfaces the forbidden error for a private memory', async () => {
      const { AppError } = await import('../../../errors/app-error')
      service.findById.mockRejectedValue(AppError.forbidden('Acesso negado'))

      const response = await server.inject({ method: 'GET', url: '/api/memories/123' })

      expect(response.statusCode).toBe(403)
    })
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

    it('stores isPublic from the body', async () => {
      signIn('user-1')
      service.create.mockResolvedValue({ id: 'mem-1' } as unknown as Awaited<
        ReturnType<typeof service.create>
      >)

      const response = await server.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          title: 'Privada',
          memoryDate: new Date().toISOString(),
          isPublic: false,
        },
      })

      expect(response.statusCode).toBe(201)
      expect(service.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isPublic: false }),
      )
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

    it('forwards isPublic changes to the service', async () => {
      signIn('user-1')
      service.update.mockResolvedValue({ id: '123' } as unknown as Awaited<
        ReturnType<typeof service.update>
      >)

      const response = await server.inject({
        method: 'PUT',
        url: '/api/memories/123',
        payload: { isPublic: false },
      })

      expect(response.statusCode).toBe(200)
      expect(service.update).toHaveBeenCalledWith(
        '123',
        'user-1',
        expect.objectContaining({ isPublic: false }),
      )
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

    it('deletes a memory owned by the signed-in user', async () => {
      signIn('user-1')

      const response = await server.inject({ method: 'DELETE', url: '/api/memories/123' })

      expect(response.statusCode).toBe(204)
      expect(service.delete).toHaveBeenCalledWith('123', 'user-1')
    })
  })
})
