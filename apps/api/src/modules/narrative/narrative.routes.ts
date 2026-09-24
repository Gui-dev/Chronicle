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

    try {
      const narrative = await narrativeService.generate(id, session.user.id)
      return reply.send({ data: narrative })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      fastify.log.error({ err }, 'Narrative generation failed')
      return reply.status(500).send({
        error: {
          code: 'GENERATION_FAILED',
          message,
        },
      })
    }
  })
}
