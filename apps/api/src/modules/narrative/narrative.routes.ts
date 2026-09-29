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
    const { mood, partial } = request.body as { mood?: string; partial?: boolean }

    try {
      const narrative = await narrativeService.generate(id, session.user.id, { mood, partial })
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

  fastify.get('/api/memories/:id/narrative-versions', async (request, reply) => {
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
      const versions = await narrativeService.listVersions(id, session.user.id)
      return reply.send({ data: versions })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      fastify.log.error({ err }, 'Narrative version list failed')
      return reply.status(500).send({
        error: {
          code: 'VERSION_LIST_FAILED',
          message,
        },
      })
    }
  })

  fastify.post(
    '/api/memories/:id/narrative-versions/:versionId/restore',
    async (request, reply) => {
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

      const { id, versionId } = request.params as { id: string; versionId: string }

      try {
        await narrativeService.restoreVersion(id, versionId, session.user.id)
        return reply.status(204).send()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.error({ err }, 'Narrative version restore failed')
        return reply.status(500).send({
          error: {
            code: 'VERSION_RESTORE_FAILED',
            message,
          },
        })
      }
    },
  )
}
