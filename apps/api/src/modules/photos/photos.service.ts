import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, memories, memoryPhotos } from '@chronicle/db'
import sharp from 'sharp'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

// Must match the multipart `fileSize` limit in server.ts. If you change one,
// change the other — the multipart limit rejects first with a generic error,
// and this one exists so the service can report it precisely.
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIMENSION = 2048

const EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

// The client-supplied mimetype is never trusted. These signatures are the
// source of truth: a file claiming to be a PNG but carrying JPEG bytes is
// stored as JPEG, and a binary that matches nothing is rejected outright.
const SIGNATURES: Record<AllowedMimeType, (b: Buffer) => boolean> = {
  'image/png': (b) =>
    b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) =>
    b.length > 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  'image/webp': (b) =>
    b.length > 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 && // RIFF
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50, // WEBP
}

function sniffMimeType(buffer: Buffer): AllowedMimeType | null {
  for (const type of ALLOWED_MIME_TYPES) {
    if (SIGNATURES[type](buffer)) return type
  }
  return null
}

function validateImage(buffer: Buffer): AllowedMimeType {
  if (buffer.length > MAX_FILE_SIZE) {
    throw AppError.badRequest('Arquivo excede o tamanho máximo de 10MB')
  }

  const type = sniffMimeType(buffer)
  if (!type) {
    throw AppError.badRequest('Formato de imagem não suportado')
  }

  return type
}

async function processImage(
  buffer: Buffer,
): Promise<{ data: Buffer; width: number; height: number }> {
  try {
    // sharp strips all metadata (EXIF, GPS, ICC) by default — no .withMetadata()
    // call here, which is the point: photos must not carry the photographer's
    // location or device into storage. .rotate() applies any EXIF orientation
    // before the metadata is dropped, so the pixels end up upright.
    const result = await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer({ resolveWithObject: true })

    return { data: result.data, width: result.info.width, height: result.info.height }
  } catch {
    throw AppError.badRequest('Imagem inválida ou corrompida')
  }
}

async function putWithRetry(
  command: PutObjectCommand,
  attempts = 3,
  baseDelayMs = 100,
): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await s3Client.send(command)
      return
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)))
      }
    }
  }

  throw lastError
}

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

    const type = validateImage(file.buffer)
    const processed = await processImage(file.buffer)

    // The extension comes from the sniffed type, never from the filename —
    // otherwise a JPEG named .png is stored with a lying extension.
    const key = `memories/${memoryId}/${randomUUID()}${EXTENSIONS[type]}`

    await putWithRetry(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: processed.data,
        ContentType: type,
      }),
    )

    let photo: typeof memoryPhotos.$inferSelect
    try {
      ;[photo] = await db
        .insert(memoryPhotos)
        .values({
          memoryId,
          url: `/${BUCKET_NAME}/${key}`,
          filename: file.filename,
          mimetype: type,
          size: processed.data.length,
          width: processed.width,
          height: processed.height,
        })
        .returning()
    } catch (error) {
      // The object is already in S3. If the row fails to insert we must not
      // leave an orphan that no memory will ever reference.
      await s3Client
        .send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
        .catch(() => {})
      throw error
    }

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
