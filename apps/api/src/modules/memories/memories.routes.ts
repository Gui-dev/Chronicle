import { auth } from '@chronicle/auth'
import { createMemorySchema, memoryFiltersSchema, updateMemorySchema } from '@chronicle/schemas'
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
      isPublic: body.isPublic,
    })

    return reply.status(201).send({ data: memory })
  })

  // GET /api/memories
  fastify.get('/api/memories', async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })

    const filters = memoryFiltersSchema.parse(request.query)

    if (filters.mine === true && !session) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      })
    }

    const result = await memoriesService.findAll(filters, { userId: session?.user.id })

    return reply.send(result)
  })

  // GET /api/memories/:id
  fastify.get('/api/memories/:id', async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })

    const { id } = request.params as { id: string }

    const memory = await memoriesService.findById(id, session?.user.id)

    return reply.send({ data: memory })
  })

  // PUT /api/memories/:id
  fastify.put('/api/memories/:id', async (request, reply) => {
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
    const body = updateMemorySchema.parse(request.body)

    const memory = await memoriesService.update(id, session.user.id, {
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
      isPublic: body.isPublic,
    })

    return reply.send({ data: memory })
  })

  // DELETE /api/memories/:id
  fastify.delete('/api/memories/:id', async (request, reply) => {
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

    await memoriesService.delete(id, session.user.id)

    return reply.status(204).send()
  })
}
