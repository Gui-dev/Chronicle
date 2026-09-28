import { auth } from '@chronicle/auth'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const BOUNDARY = '----chronicle-photos-boundary'

const multipartPayload = (filename: string, mimetype: string, content: Buffer) => {
  const head =
    `--${BOUNDARY}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`
  return Buffer.concat([Buffer.from(head), content, Buffer.from(`\r\n--${BOUNDARY}--\r\n`)])
}

const mocks = vi.hoisted(() => ({
  memoryRow: { id: '123e4567-e89b-12d3-a456-426614174000', userId: 'user-1' },
  inserted: [] as Array<Record<string, unknown>>,
}))

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('@chronicle/db', () => ({
  eq: vi.fn(),
  memories: {},
  memoryPhotos: {},
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [mocks.memoryRow]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi.fn(async () => {
          mocks.inserted.push(values)
          return [{ id: 'photo-1', ...values }]
        }),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: { send: vi.fn().mockResolvedValue({}) },
  BUCKET_NAME: 'chronicle-test',
}))

const MEMORY_ID = '123e4567-e89b-12d3-a456-426614174000'

const authed = () => {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    session: { id: 'sess-1', userId: 'user-1' },
    user: { id: 'user-1', email: 'deb@test.com' },
  } as never)
}

describe('Photos Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  beforeEach(() => {
    vi.mocked(auth.api.getSession).mockReset()
    vi.mocked(auth.api.getSession).mockResolvedValue(undefined as never)
  })

  afterAll(async () => {
    await server.close()
  })

  describe('POST /api/memories/:id/photos', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/memories/${MEMORY_ID}/photos`,
        payload: {},
      })

      expect(response.statusCode).toBe(401)
    })

    it('should return 400 when the body is not a valid image', async () => {
      authed()

      const response = await server.inject({
        method: 'POST',
        url: `/api/memories/${MEMORY_ID}/photos`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: multipartPayload('photo.png', 'image/png', Buffer.from('definitely not an image')),
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('BAD_REQUEST')
    })

    it('should store the sniffed type when it contradicts the declared one', async () => {
      authed()
      mocks.inserted.length = 0

      const response = await server.inject({
        method: 'POST',
        url: `/api/memories/${MEMORY_ID}/photos`,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
        payload: multipartPayload('foto.jpg', 'image/jpeg', PNG_1X1),
      })

      expect(response.statusCode).toBe(201)
      expect(response.json().data.mimetype).toBe('image/png')
    })
  })

  describe('DELETE /api/memories/:id/photos/:photoId', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/memories/${MEMORY_ID}/photos/${MEMORY_ID}`,
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
