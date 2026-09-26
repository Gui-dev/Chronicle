import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../users.service', () => ({
  usersService: {
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
}))

vi.mock('../../../env', () => ({
  env: {
    PORT: 3333,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chronicle_test',
    BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
    BETTER_AUTH_URL: 'http://localhost:3000',
    MINIO_ENDPOINT: 'http://localhost:9000',
    MINIO_ACCESS_KEY: 'minioadmin',
    MINIO_SECRET_KEY: 'minioadmin',
    MINIO_BUCKET: 'chronicle-test',
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: {
    send: vi.fn().mockResolvedValue({}),
  },
  BUCKET_NAME: 'chronicle-test',
}))

const { auth } = await import('@chronicle/auth')
const { usersService } = await import('../users.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(usersService)

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const BOUNDARY = '----chronicle-test-boundary'

const multipartPayload = (
  parts: Array<{
    name: string
    filename?: string
    mimetype?: string
    content: Buffer | string
  }>,
) => {
  const chunks: Buffer[] = []

  for (const part of parts) {
    let head = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.name}"`
    if (part.filename) {
      head += `; filename="${part.filename}"`
    }
    head += '\r\n'
    if (part.mimetype) {
      head += `Content-Type: ${part.mimetype}\r\n`
    }
    head += '\r\n'

    chunks.push(Buffer.from(head))
    chunks.push(Buffer.isBuffer(part.content) ? part.content : Buffer.from(part.content))
    chunks.push(Buffer.from('\r\n'))
  }

  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`))

  return Buffer.concat(chunks)
}

const uploadFile = (file?: { filename: string; mimetype: string; content: Buffer }) =>
  server.inject({
    method: 'POST',
    url: '/api/users/avatar',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    payload: multipartPayload(
      file
        ? [
            {
              name: 'file',
              filename: file.filename,
              mimetype: file.mimetype,
              content: file.content,
            },
          ]
        : [{ name: 'note', content: 'sem arquivo' }],
    ),
  })

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Awaited<
    ReturnType<typeof auth.api.getSession>
  >)

const signOut = () => getSession.mockResolvedValue(null)

let server: ReturnType<typeof buildServer>

describe('Users Routes', () => {
  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    signOut()
    service.uploadAvatar.mockResolvedValue('/chronicle-test/users/user-1/abc.png')
    service.deleteAvatar.mockResolvedValue(undefined)
  })

  describe('POST /api/users/avatar', () => {
    it('returns 401 without a session', async () => {
      const response = await uploadFile({
        filename: 'avatar.png',
        mimetype: 'image/png',
        content: PNG_1X1,
      })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
      expect(service.uploadAvatar).not.toHaveBeenCalled()
    })

    it('returns 400 when the request carries no file', async () => {
      signIn('user-1')

      const response = await uploadFile()

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        error: { code: 'BAD_REQUEST', message: 'No file uploaded' },
      })
      expect(service.uploadAvatar).not.toHaveBeenCalled()
    })

    it('stores the avatar for the signed-in user and returns its URL', async () => {
      signIn('user-9')

      const response = await uploadFile({
        filename: 'avatar.png',
        mimetype: 'image/png',
        content: PNG_1X1,
      })

      expect(response.statusCode).toBe(201)
      expect(response.json()).toEqual({ data: { image: '/chronicle-test/users/user-1/abc.png' } })
      expect(service.uploadAvatar).toHaveBeenCalledWith('user-9', {
        filename: 'avatar.png',
        mimetype: 'image/png',
        buffer: PNG_1X1,
      })
    })

    it('surfaces a rejected upload as a bad request', async () => {
      const { AppError } = await import('../../../errors/app-error')
      signIn('user-1')
      service.uploadAvatar.mockRejectedValue(AppError.badRequest('Formato de imagem inválido'))

      const response = await uploadFile({
        filename: 'avatar.gif',
        mimetype: 'image/gif',
        content: PNG_1X1,
      })

      expect(response.statusCode).toBe(400)
      expect(response.json()).toEqual({
        error: { code: 'BAD_REQUEST', message: 'Formato de imagem inválido' },
      })
    })
  })

  describe('DELETE /api/users/avatar', () => {
    it('returns 401 without a session', async () => {
      const response = await server.inject({ method: 'DELETE', url: '/api/users/avatar' })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
      expect(service.deleteAvatar).not.toHaveBeenCalled()
    })

    it('removes the avatar of the signed-in user', async () => {
      signIn('user-9')

      const response = await server.inject({ method: 'DELETE', url: '/api/users/avatar' })

      expect(response.statusCode).toBe(204)
      expect(service.deleteAvatar).toHaveBeenCalledWith('user-9')
    })
  })
})
