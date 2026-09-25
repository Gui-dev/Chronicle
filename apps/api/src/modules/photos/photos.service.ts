import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, memories, memoryPhotos } from '@chronicle/db'
import { imageSize } from 'image-size'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

export class PhotosService {
  async upload(
    memoryId: string,
    userId: string,
    file: {
      filename: string
      mimetype: string
      buffer: Buffer
    },
  ) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    const ext = path.extname(file.filename)
    const key = `memories/${memoryId}/${randomUUID()}${ext}`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    )

    let width: number | null = null
    let height: number | null = null
    try {
      const dimensions = imageSize(file.buffer)
      width = dimensions.width ?? null
      height = dimensions.height ?? null
    } catch {
      // unsupported or invalid image format — keep null
    }

    const [photo] = await db
      .insert(memoryPhotos)
      .values({
        memoryId,
        url: `/${BUCKET_NAME}/${key}`,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.buffer.length,
        width,
        height,
      })
      .returning()

    return photo
  }

  async delete(photoId: string, memoryId: string, userId: string) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    const [photo] = await db
      .select()
      .from(memoryPhotos)
      .where(eq(memoryPhotos.id, photoId))
      .limit(1)

    if (!photo) {
      throw AppError.notFound('Foto não encontrada')
    }

    if (photo.memoryId !== memoryId) {
      throw AppError.forbidden('Acesso negado')
    }

    const key = photo.url.replace(`/${BUCKET_NAME}/`, '')
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
    )

    await db.delete(memoryPhotos).where(eq(memoryPhotos.id, photoId))
  }
}

export const photosService = new PhotosService()
