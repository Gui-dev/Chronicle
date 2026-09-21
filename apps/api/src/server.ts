import multipart from '@fastify/multipart'
import Fastify from 'fastify'
import { env } from './env'
import { handleError } from './errors/error-handler'
import { authRoutes } from './modules/auth'
import { memoriesRoutes } from './modules/memories'
import { photosRoutes } from './modules/photos'
import { authPlugin } from './plugins/auth'
import { corsPlugin } from './plugins/cors'
import { swaggerPlugin } from './plugins/swagger'

export function buildServer() {
  const server = Fastify({
    logger: true,
  })

  // Set error handler on root scope so it catches errors from all registered plugins
  server.setErrorHandler((error: any, request, reply) => {
    request.log.error(error)

    const response = handleError(error)

    const statusCode =
      error.name === 'ZodError'
        ? 400
        : typeof error.statusCode === 'number'
          ? error.statusCode
          : 500

    reply.status(statusCode).send(response)
  })

  // Register plugins
  server.register(corsPlugin)
  server.register(swaggerPlugin)
  server.register(authPlugin)
  server.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  })

  // Register routes
  server.register(authRoutes)
  server.register(memoriesRoutes)
  server.register(photosRoutes)

  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  return server
}

export async function startServer() {
  const server = buildServer()

  try {
    await server.listen({ port: env.PORT, host: env.HOST })
    console.log(`🚀 Server running at http://${env.HOST}:${env.PORT}`)
    console.log(`📚 Swagger UI: http://${env.HOST}:${env.PORT}/docs`)
    console.log(`📖 Scalar: http://${env.HOST}:${env.PORT}/reference`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}
