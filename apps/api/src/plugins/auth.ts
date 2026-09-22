import { auth } from '@chronicle/auth'
import { fromNodeHeaders } from 'better-auth/node'
import type { FastifyInstance } from 'fastify'

export async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate('auth', auth)

  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`)
        const headers = fromNodeHeaders(request.headers)

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        })

        const response = await auth.handler(req)

        reply.status(response.status)
        reply.header('Access-Control-Allow-Origin', 'http://localhost:3000')
        reply.header('Access-Control-Allow-Credentials', 'true')
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'access-control-allow-origin') {
            reply.header(key, value)
          }
        })
        return reply.send(response.body ? await response.text() : 'null')
      } catch (error) {
        fastify.log.error(error as Error, 'Authentication Error:')
        reply.status(500)
        reply.header('Access-Control-Allow-Origin', 'http://localhost:3000')
        reply.header('Access-Control-Allow-Credentials', 'true')
        reply.header('Content-Type', 'application/json')
        return reply.send({
          error: 'Internal authentication error',
          code: 'AUTH_FAILURE',
          details: (error as Error).message,
        })
      }
    },
  })
}
