import sharp from 'sharp'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { photosService } from '../photos.service'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const mocks = vi.hoisted(() => {
  const memoryRow = { id: 'mem-1', userId: 'user-1' }
  const inserted: Array<Record<string, unknown>> = []
  const s3Send = vi.fn().mockResolvedValue({})
  return { memoryRow, inserted, s3Send }
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
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: {
    send: mocks.s3Send,
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
    mocks.s3Send.mockClear()
    mocks.s3Send.mockResolvedValue({})
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  describe('dimension extraction', () => {
    it('persists width and height for a valid image', async () => {
      const photo = await photosService.upload('mem-1', 'user-1', {
        ...baseFile,
        buffer: PNG_1X1,
      })

      expect(photo.width).toBe(1)
      expect(photo.height).toBe(1)
      expect(mocks.inserted[0]).toMatchObject({ width: 1, height: 1 })
    })

    it('resizes an image larger than the max dimension', async () => {
      const big = await sharp({
        create: { width: 4000, height: 3000, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toBuffer()

      const photo = await photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: big })

      expect(photo.width).toBe(2048)
      expect(photo.height).toBe(1536)
    })

    it('does not enlarge a small image', async () => {
      const photo = await photosService.upload('mem-1', 'user-1', {
        ...baseFile,
        buffer: PNG_1X1,
      })

      expect(photo.width).toBe(1)
      expect(photo.height).toBe(1)
    })
  })

  describe('MIME and signature validation', () => {
    it('rejects a buffer that matches no known signature', async () => {
      await expect(
        photosService.upload('mem-1', 'user-1', {
          ...baseFile,
          buffer: Buffer.from('this is definitely not an image, just text padding the buffer'),
        }),
      ).rejects.toThrow('Formato de imagem não suportado')

      expect(mocks.s3Send).not.toHaveBeenCalled()
      expect(mocks.inserted).toHaveLength(0)
    })

    it('rejects a file exceeding the size limit', async () => {
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0)
      // PNG signature so it passes sniffing and fails on size instead
      oversized[0] = 0x89
      oversized[1] = 0x50
      oversized[2] = 0x4e
      oversized[3] = 0x47

      await expect(
        photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: oversized }),
      ).rejects.toThrow('tamanho máximo')

      expect(mocks.s3Send).not.toHaveBeenCalled()
    })

    it('stores the sniffed type, not the declared one', async () => {
      // PNG bytes but declared as JPEG — the bytes win.
      const photo = await photosService.upload('mem-1', 'user-1', {
        filename: 'foto.jpg',
        mimetype: 'image/jpeg',
        buffer: PNG_1X1,
      })

      expect(photo.mimetype).toBe('image/png')
      expect(mocks.inserted[0]).toMatchObject({ mimetype: 'image/png' })
    })

    it('rejects a corrupt image that carries a valid signature', async () => {
      // Valid PNG signature followed by garbage — sharp must fail to decode it.
      const corrupt = Buffer.concat([PNG_1X1.subarray(0, 8), Buffer.alloc(64, 0xff)])

      await expect(
        photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: corrupt }),
      ).rejects.toThrow('Imagem inválida ou corrompida')

      expect(mocks.s3Send).not.toHaveBeenCalled()
    })
  })

  describe('S3 retry with backoff', () => {
    it('retries a transient failure and succeeds', async () => {
      mocks.s3Send
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValue({})

      const photo = await photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: PNG_1X1 })

      expect(photo.id).toBe('photo-1')
      expect(mocks.s3Send).toHaveBeenCalledTimes(3)
    })

    it('gives up after the last attempt', async () => {
      mocks.s3Send.mockRejectedValue(new Error('EIO'))

      await expect(
        photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: PNG_1X1 }),
      ).rejects.toThrow('EIO')

      expect(mocks.s3Send).toHaveBeenCalledTimes(3)
      expect(mocks.inserted).toHaveLength(0)
    })
  })

  describe('atomicity', () => {
    it('deletes the S3 object when the insert fails', async () => {
      const { db } = await import('@chronicle/db')
      vi.mocked(db.insert).mockImplementationOnce(() => {
        throw new Error('DB is down')
      })

      await expect(
        photosService.upload('mem-1', 'user-1', { ...baseFile, buffer: PNG_1X1 }),
      ).rejects.toThrow('DB is down')

      // One PutObject (the upload) and one DeleteObject (the compensation).
      expect(mocks.s3Send).toHaveBeenCalledTimes(2)
      const commands = mocks.s3Send.mock.calls.map((c) => c[0].constructor.name)
      expect(commands).toEqual(['PutObjectCommand', 'DeleteObjectCommand'])
    })
  })
})
