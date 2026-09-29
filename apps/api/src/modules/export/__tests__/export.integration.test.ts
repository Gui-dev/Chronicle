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

vi.mock('../export.service', () => ({
  exportService: {
    start: vi.fn(),
    status: vi.fn(),
    download: vi.fn(),
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
const { exportService } = await import('../export.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(exportService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

const view = (overrides: Record<string, unknown> = {}) => ({
  jobId: 'job-1',
  status: 'queued',
  error: null,
  createdAt: '2026-09-29T12:00:00.000Z',
  finishedAt: null,
  downloadReady: false,
  ...overrides,
})

describe('Export Integration Tests', () => {
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
    service.start.mockReturnValue(view() as never)
    service.status.mockReturnValue(view({ status: 'done' }) as never)
    service.download.mockReturnValue({
      buffer: Buffer.from('{"memories":[]}'),
      filename: 'chronicle-export-2026-09-29.json',
    })
  })

  describe('POST /api/export', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({ method: 'POST', url: '/api/export' })

      expect(response.statusCode).toBe(401)
      expect(service.start).not.toHaveBeenCalled()
    })

    it('starts the job for the session user and answers 202', async () => {
      signIn()

      const response = await server.inject({ method: 'POST', url: '/api/export' })

      expect(response.statusCode).toBe(202)
      expect(response.json().data.jobId).toBe('job-1')
      expect(service.start).toHaveBeenCalledWith('user-1')
    })
  })

  describe('GET /api/export/:jobId', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/export/job-1' })

      expect(response.statusCode).toBe(401)
      expect(service.status).not.toHaveBeenCalled()
    })

    it('reports the job status scoped to the session user', async () => {
      signIn()

      const response = await server.inject({ method: 'GET', url: '/api/export/job-1' })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.status).toBe('done')
      expect(service.status).toHaveBeenCalledWith('job-1', 'user-1')
    })

    it('answers 404 for a job belonging to someone else', async () => {
      signIn()
      service.status.mockImplementation(() => {
        throw AppError.notFound('Exportação não encontrada')
      })

      const response = await server.inject({ method: 'GET', url: '/api/export/job-1' })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('GET /api/export/:jobId/download', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/export/job-1/download',
      })

      expect(response.statusCode).toBe(401)
      expect(service.download).not.toHaveBeenCalled()
    })

    it('serves the finished file as an attachment', async () => {
      signIn()

      const response = await server.inject({
        method: 'GET',
        url: '/api/export/job-1/download',
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="chronicle-export-2026-09-29.json"',
      )
      expect(response.json()).toEqual({ memories: [] })
      expect(service.download).toHaveBeenCalledWith('job-1', 'user-1')
    })

    it('answers 409 while the job is still running', async () => {
      signIn()
      service.download.mockImplementation(() => {
        throw AppError.conflict('Exportação ainda em andamento')
      })

      const response = await server.inject({
        method: 'GET',
        url: '/api/export/job-1/download',
      })

      expect(response.statusCode).toBe(409)
    })
  })
})
