import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:6006'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
}
