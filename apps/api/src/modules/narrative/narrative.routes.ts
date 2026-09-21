import { auth } from '@chronicle/auth'
import type { FastifyInstance } from 'fastify'
import { narrativeService } from './narrative.service'

export async function narrativeRoutes(fastify: FastifyInstance) {
  fastify.post('/api/memories/:id/generate-narrative', async (request, reply) => {
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

    const { id } = request.params as { id: string }

    const narrative = await narrativeService.generate(id, session.user.id)

    return reply.send({ data: narrative })
  })
}
