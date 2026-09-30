import { auth } from '@chronicle/auth'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { retrospectivesService } from './retrospectives.service'

async function currentUserId(request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  })
  return session ? session.user.id : null
}

const overviewQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
})

const UNAUTHORIZED = {
  error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
} as const

export async function retrospectivesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/retrospectives/year-ago', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const data = await retrospectivesService.yearAgo(userId)
    return reply.send({ data })
  })

  fastify.get('/api/retrospectives/activity', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const data = await retrospectivesService.activity(userId)
    return reply.send({ data })
  })

  fastify.post('/api/retrospectives/visit', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    await retrospectivesService.visit(userId)
    return reply.status(204).send()
  })

  fastify.get('/api/retrospectives/overview', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const query = overviewQuerySchema.parse(request.query)
    const data = await retrospectivesService.overview(userId, query.year, query.month)
    return reply.send({ data })
  })
}
