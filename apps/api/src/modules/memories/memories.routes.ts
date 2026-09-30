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
      aiMood: body.aiMood,
    })

    return reply.status(201).send({ data: memory })
  })

  // GET /api/memories
  fastify.get('/api/memories', async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })

    const filters = memoryFiltersSchema.parse(request.query)

    // `deleted=true` is the trash view and is owner-scoped, so it needs a
    // session just like `mine=true` does.
    if ((filters.mine === true || filters.deleted === true) && !session) {
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

  // GET /api/memories/shared — the owner's active share links. Static path,
  // registered by the same plugin as `/:id`: find-my-way prefers the static
  // segment, so "shared" never reaches the detail handler (pinned by test).
  // Always owner-scoped and always 401 without a session — no query param to
  // misuse, same reasoning as `deleted=true`.
  fastify.get('/api/memories/shared', async (request, reply) => {
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

    const links = await memoriesService.findShared(session.user.id)

    return reply.send({ data: links })
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

  // POST /api/memories/:id/restore
  fastify.post('/api/memories/:id/restore', async (request, reply) => {
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

    await memoriesService.restore(id, session.user.id)

    return reply.status(204).send()
  })
}
