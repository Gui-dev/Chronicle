import { auth } from '@chronicle/auth'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { exportService } from './export.service'

// Exports are always the session's own; no id in the payload or URL ever
// selects whose data to collect.
async function currentUserId(request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  })
  return session ? session.user.id : null
}

export async function exportRoutes(fastify: FastifyInstance) {
  // POST /api/export — starts the job and answers 202 with its status view.
  fastify.post('/api/export', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }

    return reply.status(202).send({ data: exportService.start(userId) })
  })

  // GET /api/export/:jobId — status polling while the job runs.
  fastify.get<{ Params: { jobId: string } }>('/api/export/:jobId', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }

    // Ownership misses are thrown as 404 inside the service, so a job id from
    // another account is indistinguishable from one that never existed.
    return reply.send({ data: exportService.status(request.params.jobId, userId) })
  })

  // GET /api/export/:jobId/download — the finished file, as an attachment.
  fastify.get<{ Params: { jobId: string } }>(
    '/api/export/:jobId/download',
    async (request, reply) => {
      const userId = await currentUserId(request)
      if (!userId) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        })
      }

      const { buffer, filename } = exportService.download(request.params.jobId, userId)
      return reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-disposition', `attachment; filename="${filename}"`)
        .send(buffer)
    },
  )
}
