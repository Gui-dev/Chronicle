import type { FastifyError, FastifyInstance } from 'fastify'
import { AppError } from '../errors/app-error'
import { handleError } from '../errors/error-handler'

export async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error)

    const response = handleError(error)

    let statusCode = error instanceof AppError ? error.statusCode : error.statusCode || 500

    if (error.name === 'ZodError') {
      statusCode = 400
    }

    reply.status(statusCode).send(response)
  })

  // Convert route errors to AppError
  fastify.decorate('throwNotFound', (message?: string) => {
    throw AppError.notFound(message)
  })

  fastify.decorate('throwBadRequest', (message?: string) => {
    throw AppError.badRequest(message)
  })

  fastify.decorate('throwUnauthorized', (message?: string) => {
    throw AppError.unauthorized(message)
  })
}
