import { auth } from '@chronicle/auth'
import type { FastifyInstance } from 'fastify'
import { photosService } from './photos.service'

export async function photosRoutes(fastify: FastifyInstance) {
  fastify.post('/api/memories/:id/photos', async (request, reply) => {
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
    const photo = await photosService.upload(id, session.user.id, {
      filename: data.filename,
      mimetype: data.mimetype,
      buffer,
    })

    return reply.status(201).send({ data: photo })
  })

  fastify.delete('/api/memories/:id/photos/:photoId', async (request, reply) => {
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

    const { id, photoId } = request.params as { id: string; photoId: string }

    await photosService.delete(photoId, id, session.user.id)

    return reply.status(204).send()
  })
}
