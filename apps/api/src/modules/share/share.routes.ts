import { auth } from '@chronicle/auth'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { shareService } from './share.service'

async function currentUserId(request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  })
  return session ? session.user.id : null
}

export async function shareRoutes(fastify: FastifyInstance) {
  // POST /api/memories/:id/share — create or rotate (owner only).
  fastify.post<{ Params: { id: string } }>('/api/memories/:id/share', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }

    const data = await shareService.share(request.params.id, userId)
    return reply.status(201).send({ data })
  })

  // DELETE /api/memories/:id/share — revoke (owner only, idempotent).
  fastify.delete<{ Params: { id: string } }>('/api/memories/:id/share', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }

    await shareService.revoke(request.params.id, userId)
    return reply.status(204).send()
  })

  // GET /api/share/:token — the public redacted preview. No session: the token
  // is the credential. Errors thrown inside `resolve` reach the global handler,
  // which answers the single generic 404.
  fastify.get<{ Params: { token: string } }>('/api/share/:token', async (request, reply) => {
    const data = await shareService.resolve(request.params.token)
    return reply.send({ data })
  })
}
