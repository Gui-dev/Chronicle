import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, users } from '@chronicle/db'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUCKET_NAME, s3Client } from '../../../plugins/minio'
import { usersService } from '../users.service'

const mocks = vi.hoisted(() => {
  const updates: Array<Record<string, unknown>> = []
  const userRow: { current: { id: string; image: string | null } | null } = { current: null }
  return { updates, userRow }
})

vi.mock('@chronicle/db', () => ({
  eq: vi.fn(() => ({ __eq: true })),
  users: { id: 'id', image: 'image' },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (mocks.userRow.current ? [mocks.userRow.current] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        mocks.updates.push(values)
        return { where: vi.fn(async () => undefined) }
      }),
    })),
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: {
    send: vi.fn().mockResolvedValue({}),
  },
  BUCKET_NAME: 'chronicle-test',
}))

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const send = vi.mocked(s3Client.send)
const update = vi.mocked(db.update)
const eqPredicate = vi.mocked(eq)

describe('UsersService', () => {
  const baseFile = {
    filename: 'avatar.png',
    mimetype: 'image/png',
  }

  beforeEach(() => {
    send.mockClear()
    update.mockClear()
    mocks.updates.length = 0
    mocks.userRow.current = { id: 'user-1', image: null }
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  describe('uploadAvatar', () => {
    it('rejects an unsupported image format', async () => {
      await expect(
        usersService.uploadAvatar('user-1', {
          ...baseFile,
          filename: 'avatar.gif',
          mimetype: 'image/gif',
          buffer: PNG_1X1,
        }),
      ).rejects.toMatchObject({ name: 'AppError', statusCode: 400, code: 'BAD_REQUEST' })

      expect(send).not.toHaveBeenCalled()
    })

    it('rejects an image larger than 5MB', async () => {
      await expect(
        usersService.uploadAvatar('user-1', {
          ...baseFile,
          buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
        }),
      ).rejects.toMatchObject({ name: 'AppError', statusCode: 400, code: 'BAD_REQUEST' })

      expect(send).not.toHaveBeenCalled()
    })

    it('uploads the file to a per-user key keeping the original extension', async () => {
      await usersService.uploadAvatar('user-1', {
        ...baseFile,
        buffer: PNG_1X1,
      })

      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0]?.[0] as PutObjectCommand
      expect(command).toBeInstanceOf(PutObjectCommand)
      expect(command.input.Bucket).toBe(BUCKET_NAME)
      expect(command.input.Key).toMatch(/^users\/user-1\/[\w-]+\.png$/)
      expect(command.input.ContentType).toBe('image/png')
      expect(command.input.Body).toEqual(PNG_1X1)
    })

    it('stores the public URL of the object on the user', async () => {
      const image = await usersService.uploadAvatar('user-1', {
        ...baseFile,
        buffer: PNG_1X1,
      })

      const key = (send.mock.calls[0]?.[0] as PutObjectCommand).input.Key

      expect(image).toBe(`/${BUCKET_NAME}/${key}`)
      expect(update).toHaveBeenCalledWith(users)
      expect(eqPredicate).toHaveBeenCalledWith(users.id, 'user-1')
      expect(mocks.updates[0]).toEqual({ image })
    })
  })

  describe('deleteAvatar', () => {
    it('does nothing when the user has no avatar', async () => {
      await usersService.deleteAvatar('user-1')

      expect(send).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it('does nothing when the user no longer exists', async () => {
      mocks.userRow.current = null

      await usersService.deleteAvatar('user-1')

      expect(send).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
    })

    it('removes the stored object and clears the user image', async () => {
      mocks.userRow.current = { id: 'user-1', image: '/chronicle-test/users/user-1/abc.png' }

      await usersService.deleteAvatar('user-1')

      expect(send).toHaveBeenCalledTimes(1)
      const command = send.mock.calls[0]?.[0] as DeleteObjectCommand
      expect(command).toBeInstanceOf(DeleteObjectCommand)
      expect(command.input.Bucket).toBe(BUCKET_NAME)
      expect(command.input.Key).toBe('users/user-1/abc.png')
      expect(update).toHaveBeenCalledWith(users)
      expect(mocks.updates[0]).toEqual({ image: null })
    })
  })
})
