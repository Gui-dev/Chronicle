import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import scalarPlugin from '@scalar/fastify-api-reference'
import type { FastifyInstance } from 'fastify'

export async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Chronicle API',
        description: 'Soundtrack da sua vida - API',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3333',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  })

  await fastify.register(scalarPlugin, {
    routePrefix: '/reference',
    configuration: {
      theme: 'kepler',
      darkMode: true,
    },
  })
}
