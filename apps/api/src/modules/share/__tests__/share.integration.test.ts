import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../errors/app-error'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../share.service', () => ({
  shareService: {
    share: vi.fn(),
    revoke: vi.fn(),
    resolve: vi.fn(),
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
const { shareService } = await import('../share.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(shareService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

describe('Share Integration Tests', () => {
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
    service.share.mockResolvedValue({
      token: 'tok-1',
      expiresAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    service.revoke.mockResolvedValue(undefined)
    service.resolve.mockResolvedValue({
      memory: { id: 'mem-1', title: 'Segredo' },
      author: { name: 'Deborah', image: null },
    } as unknown as Awaited<ReturnType<typeof service.resolve>>)
  })

  describe('POST /api/memories/:id/share', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
      expect(service.share).not.toHaveBeenCalled()
    })

    it('creates the link for the session user and answers 201', async () => {
      signIn('user-7')

      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(201)
      expect(service.share).toHaveBeenCalledWith('mem-1', 'user-7')
      expect(response.json().data.token).toBe('tok-1')
      expect(response.json().data.expiresAt).toBeDefined()
    })

    it('maps the service 404 to the reply', async () => {
      signIn()
      service.share.mockRejectedValue(AppError.notFound('Memória não encontrada'))

      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Memória não encontrada' },
      })
    })
  })

  describe('DELETE /api/memories/:id/share', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/memories/mem-1/share',
      })

      expect(response.statusCode).toBe(401)
      expect(service.revoke).not.toHaveBeenCalled()
    })

    it('revokes and answers 204', async () => {
      signIn('user-7')

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/memories/mem-1/share',
      })

      expect(response.statusCode).toBe(204)
      expect(service.revoke).toHaveBeenCalledWith('mem-1', 'user-7')
    })
  })

  describe('GET /api/share/:token', () => {
    it('serves the redacted preview without a session', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/share/tok-1' })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.author.name).toBe('Deborah')
      expect(service.resolve).toHaveBeenCalledWith('tok-1')
    })

    it('answers the same generic 404 for expired and unknown tokens', async () => {
      service.resolve.mockRejectedValue(AppError.notFound('Link inválido ou expirado'))

      const expired = await server.inject({ method: 'GET', url: '/api/share/expired' })
      const unknown = await server.inject({ method: 'GET', url: '/api/share/unknown' })

      expect(expired.statusCode).toBe(404)
      expect(unknown.statusCode).toBe(404)
      expect(expired.json()).toEqual(unknown.json())
      expect(expired.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Link inválido ou expirado' },
      })
    })
  })
})
