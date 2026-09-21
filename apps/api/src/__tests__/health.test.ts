import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildServer } from '../server'

describe('Health Endpoint', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should return health status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})
