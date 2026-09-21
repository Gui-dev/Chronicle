import { auth } from '@chronicle/auth'
import { createMemorySchema } from '@chronicle/schemas'
import type { FastifyInstance } from 'fastify'
import { memoriesService } from './memories.service'

export async function memoriesRoutes(fastify: FastifyInstance) {
  // POST /api/memories
  fastify.post('/api/memories', async (request, reply) => {
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

    const body = createMemorySchema.parse(request.body)

    const memory = await memoriesService.create(session.user.id, {
      title: body.title,
      content: body.content,
      memoryDate: body.memoryDate,
      locationName: body.locationName,
      locationLat: body.locationLat,
      locationLng: body.locationLng,
      weatherTemp: body.weatherTemp,
      weatherDesc: body.weatherDesc,
      weatherIcon: body.weatherIcon,
      musicTrack: body.musicTrack,
      musicArtist: body.musicArtist,
      musicUrl: body.musicUrl,
      musicCover: body.musicCover,
      people: body.people,
      tags: body.tags,
    })

    return reply.status(201).send({ data: memory })
  })
}
