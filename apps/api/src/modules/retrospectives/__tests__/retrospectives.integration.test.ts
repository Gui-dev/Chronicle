import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../retrospectives.service', () => ({
  retrospectivesService: {
    yearAgo: vi.fn(),
    activity: vi.fn(),
    visit: vi.fn(),
    overview: vi.fn(),
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
const { retrospectivesService } = await import('../retrospectives.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(retrospectivesService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

const overviewData = {
  period: { year: 2026, month: null },
  years: [2026],
  summary: { memories: 0, people: 0, places: 0, topTags: [] },
  recurrences: { people: [], places: [], themes: [] },
  places: [],
}

describe('Retrospectives Integration Tests', () => {
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
    service.yearAgo.mockResolvedValue([])
    service.activity.mockResolvedValue({ count: 0, since: null })
    service.visit.mockResolvedValue(undefined)
    service.overview.mockResolvedValue(
      overviewData as unknown as Awaited<ReturnType<typeof service.overview>>,
    )
  })

  it('answers 401 on all four routes without a session', async () => {
    const responses = await Promise.all([
      server.inject({ method: 'GET', url: '/api/retrospectives/year-ago' }),
      server.inject({ method: 'GET', url: '/api/retrospectives/activity' }),
      server.inject({ method: 'POST', url: '/api/retrospectives/visit' }),
      server.inject({ method: 'GET', url: '/api/retrospectives/overview' }),
    ])

    for (const response of responses) {
      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }
    expect(service.yearAgo).not.toHaveBeenCalled()
    expect(service.activity).not.toHaveBeenCalled()
    expect(service.visit).not.toHaveBeenCalled()
    expect(service.overview).not.toHaveBeenCalled()
  })

  it('serves year-ago for the session user', async () => {
    signIn('user-7')
    service.yearAgo.mockResolvedValue([{ id: 'mem-1', title: 'Carnaval' }] as never)

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/year-ago' })

    expect(response.statusCode).toBe(200)
    expect(service.yearAgo).toHaveBeenCalledWith('user-7')
    expect(response.json().data).toHaveLength(1)
    expect(response.json().data[0].title).toBe('Carnaval')
  })

  it('serves activity for the session user', async () => {
    signIn('user-7')
    service.activity.mockResolvedValue({ count: 3, since: '2026-09-01T12:00:00.000Z' })

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/activity' })

    expect(response.statusCode).toBe(200)
    expect(service.activity).toHaveBeenCalledWith('user-7')
    expect(response.json()).toEqual({
      data: { count: 3, since: '2026-09-01T12:00:00.000Z' },
    })
  })

  it('records the visit and answers 204', async () => {
    signIn('user-7')

    const response = await server.inject({ method: 'POST', url: '/api/retrospectives/visit' })

    expect(response.statusCode).toBe(204)
    expect(service.visit).toHaveBeenCalledWith('user-7')
    expect(response.body).toBe('')
  })

  it('serves overview with default period arguments', async () => {
    signIn('user-7')

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/overview' })

    expect(response.statusCode).toBe(200)
    expect(service.overview).toHaveBeenCalledWith('user-7', undefined, undefined)
    expect(response.json().data.period).toEqual({ year: 2026, month: null })
  })

  it('passes validated year and month through', async () => {
    signIn('user-7')

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?year=2025&month=9',
    })

    expect(response.statusCode).toBe(200)
    expect(service.overview).toHaveBeenCalledWith('user-7', 2025, 9)
  })

  it('answers 400 without calling the service for a non-numeric year', async () => {
    signIn()

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?year=abc',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
    expect(service.overview).not.toHaveBeenCalled()
  })

  it('answers 400 for a month outside 1-12', async () => {
    signIn()

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?month=0',
    })

    expect(response.statusCode).toBe(400)
    expect(service.overview).not.toHaveBeenCalled()
  })
})
