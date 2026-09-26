import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, users } from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

const ALLOWED_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024

export class UsersService {
  async uploadAvatar(
    userId: string,
    file: {
      filename: string
      mimetype: string
      buffer: Buffer
    },
  ) {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw AppError.badRequest('Formato de imagem inválido')
    }

    if (file.buffer.length > MAX_SIZE) {
      throw AppError.badRequest('Imagem muito grande (máx. 5MB)')
    }

    const ext = path.extname(file.filename)
    const key = `users/${userId}/${randomUUID()}${ext}`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    )

    const image = `/${BUCKET_NAME}/${key}`
    await db.update(users).set({ image }).where(eq(users.id, userId))

    return image
  }

  async deleteAvatar(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user?.image) {
      return
    }

    const key = user.image.replace(`/${BUCKET_NAME}/`, '')

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
    )

    await db.update(users).set({ image: null }).where(eq(users.id, userId))
  }
}

export const usersService = new UsersService()
