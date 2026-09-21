import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppError } from '../errors/app-error'
import { buildServer } from '../server'

describe('Error Handler', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()

    // Add a test route that throws
    server.get('/test-error', async () => {
      throw AppError.notFound('Test not found')
    })

    server.get('/test-validation', async () => {
      throw AppError.badRequest('Invalid input')
    })

    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should handle AppError not found', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test-error',
    })

    expect(response.statusCode).toBe(404)
  })

  it('should handle AppError bad request', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/test-validation',
    })

    expect(response.statusCode).toBe(400)
  })
})
