import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { photosService } from '../photos.service'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const mocks = vi.hoisted(() => {
  const memoryRow = { id: 'mem-1', userId: 'user-1' }
  const inserted: Array<Record<string, unknown>> = []
  return { memoryRow, inserted }
})

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
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: {
    send: vi.fn().mockResolvedValue({}),
  },
  BUCKET_NAME: 'chronicle-test',
}))

describe('PhotosService', () => {
  const baseFile = {
    filename: 'foto.png',
    mimetype: 'image/png',
  }

  beforeEach(() => {
    mocks.inserted.length = 0
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  it('persists width and height for a valid image', async () => {
    const photo = await photosService.upload('mem-1', 'user-1', {
      ...baseFile,
      buffer: PNG_1X1,
    })

    expect(photo.width).toBe(1)
    expect(photo.height).toBe(1)
    expect(mocks.inserted[0]).toMatchObject({ width: 1, height: 1 })
  })

  it('keeps width and height null for an unparseable buffer', async () => {
    const photo = await photosService.upload('mem-1', 'user-1', {
      ...baseFile,
      buffer: Buffer.from('not-an-image'),
    })

    expect(photo.width).toBeNull()
    expect(photo.height).toBeNull()
    expect(mocks.inserted[0]).toMatchObject({ width: null, height: null })
  })
})
