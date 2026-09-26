import { auth } from '@chronicle/auth'
import type { FastifyInstance } from 'fastify'
import { usersService } from './users.service'

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.post('/api/users/avatar', async (request, reply) => {
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

    const data = await request.file()
    if (!data) {
      return reply.status(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: 'No file uploaded',
        },
      })
    }

    const buffer = await data.toBuffer()
    const image = await usersService.uploadAvatar(session.user.id, {
      filename: data.filename,
      mimetype: data.mimetype,
      buffer,
    })

    return reply.status(201).send({ data: { image } })
  })

  fastify.delete('/api/users/avatar', async (request, reply) => {
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

    await usersService.deleteAvatar(session.user.id)

    return reply.status(204).send()
  })
}
