import { auth } from '@chronicle/auth'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { geocodingService } from './geocoding.service'
import { spotifyService } from './spotify.service'
import { weatherService } from './weather.service'

const spotifySearchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

const weatherSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
})

const geocodingSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().min(1).max(10).default(5),
})

export async function integrationsRoutes(fastify: FastifyInstance) {
  // GET /api/spotify/search
  fastify.get('/api/spotify/search', async (request, reply) => {
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

    const query = spotifySearchSchema.parse(request.query)
    const tracks = await spotifyService.search(query.q, query.limit)

    return reply.send({ data: tracks })
  })

  // GET /api/weather
  fastify.get('/api/weather', async (request, reply) => {
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

    const query = weatherSchema.parse(request.query)
    const weather = await weatherService.getCurrentWeather(query.latitude, query.longitude)

    return reply.send({ data: weather })
  })

  // GET /api/geocoding
  fastify.get('/api/geocoding', async (request, reply) => {
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

    const query = geocodingSchema.parse(request.query)
    const results = await geocodingService.search(query.q, query.limit)

    return reply.send({ data: results })
  })
}
