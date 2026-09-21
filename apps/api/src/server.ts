import Fastify from 'fastify'
import { env } from './env'
import { authPlugin } from './plugins/auth'
import { swaggerPlugin } from './plugins/swagger'

export function buildServer() {
  const server = Fastify({
    logger: true,
  })

  // Register plugins
  server.register(swaggerPlugin)
  server.register(authPlugin)

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
