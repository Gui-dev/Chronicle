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

describe('Narrative Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/memories/:id/generate-narrative', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/memories/123e4567-e89b-12d3-a456-426614174000/generate-narrative',
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 401 for invalid UUID', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/memories/invalid-id/generate-narrative',
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
