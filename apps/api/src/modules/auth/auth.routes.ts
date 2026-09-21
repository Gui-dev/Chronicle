import { auth } from '@chronicle/auth'
import { loginSchema, registerSchema } from '@chronicle/schemas'
import type { FastifyInstance } from 'fastify'

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post('/api/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const result = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.name || '',
      },
    })

    return reply.status(201).send({
      data: {
        user: result.user,
        token: result.token,
      },
    })
  })

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const result = await auth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password,
      },
    })

    return reply.send({
      data: {
        user: result.user,
        token: result.token,
      },
    })
  })

  // GET /api/auth/me
  fastify.get('/api/auth/me', async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })

    if (!session) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      })
    }

    return reply.send({
      data: {
        user: session.user,
      },
    })
  })
}
