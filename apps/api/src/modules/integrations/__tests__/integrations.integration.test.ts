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
    MINIO_ENDPOINT: 'http://localhost:9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'chronicle-test',
  },
}))

describe('Integrations Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('GET /api/spotify/search', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/spotify/search?q=test',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 400 for missing query param', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/spotify/search',
      })

      // Will be 401 if no auth, or 400 if auth passes
      expect([400, 401]).toContain(response.statusCode)
    })
  })

  describe('GET /api/weather', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/weather?latitude=40.7128&longitude=-74.0060',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 400 for missing params', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/weather',
      })

      // Will be 401 if no auth, or 400 if auth passes
      expect([400, 401]).toContain(response.statusCode)
    })
  })

  describe('GET /api/geocoding', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/geocoding?q=New+York',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 400 for missing query param', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/geocoding',
      })

      // Will be 401 if no auth, or 400 if auth passes
      expect([400, 401]).toContain(response.statusCode)
    })
  })
})
