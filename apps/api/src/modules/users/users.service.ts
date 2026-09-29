import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, memories, memoryPhotos, users } from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

const ALLOWED_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024
const EXT_BY_MIMETYPE: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

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

    const key = `users/${userId}/${randomUUID()}${EXT_BY_MIMETYPE[file.mimetype]}`

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

  async deleteAccount(userId: string): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user) {
      throw AppError.notFound('Usuário não encontrado')
    }

    // Delete all photos from MinIO. The DB rows go with the user via cascade,
    // but S3 objects have to be removed by hand.
    const photos = await db
      .select({ url: memoryPhotos.url })
      .from(memoryPhotos)
      .innerJoin(memories, eq(memoryPhotos.memoryId, memories.id))
      .where(eq(memories.userId, userId))
    await Promise.all(
      photos
        .filter((p) => p.url)
        .map((p) =>
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: p.url!.replace(`/${BUCKET_NAME}/`, ''),
            }),
          ),
        ),
    )

    // Delete avatar from MinIO
    if (user.image) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: user.image.replace(`/${BUCKET_NAME}/`, ''),
        }),
      )
    }

    // Delete the user. Memories, photos, people, tags, sessions, accounts all
    // cascade. The memories are hard-deleted here because the account is going
    // away — soft delete is for the trash, not for account deletion.
    await db.delete(users).where(eq(users.id, userId))
  }
}

export const usersService = new UsersService()
