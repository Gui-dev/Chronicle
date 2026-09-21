import Fastify from 'fastify'
import { env } from './env'
import { authPlugin } from './plugins/auth'

export function buildServer() {
  const server = Fastify({
    logger: true,
  })

  // Register plugins
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
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}
