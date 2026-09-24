import type { FastifyError } from 'fastify'
import { AppError } from './app-error'

export function handleError(error: FastifyError) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    }
  }

  // Zod validation errors
  if (error.name === 'ZodError') {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: JSON.parse(error.message),
      },
    }
  }

  // Default
  console.error('[API Error]', error)
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  }
}
