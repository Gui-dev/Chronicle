import { auth } from '@chronicle/auth'
import { registerSchema } from '@chronicle/schemas'
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
}
