import { randomUUID } from 'node:crypto'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import {
  and,
  db,
  eq,
  inArray,
  isNull,
  memories,
  memoryPeople,
  memoryPhotos,
  memoryTags,
  users,
} from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

// A job lives in memory, not in a table: exports are short-lived, the payload
// is only ever useful to the browser that asked for it, and a restart losing
// an in-flight job costs a retry rather than orphaned rows. The TTL is what
// keeps the map from growing forever on a long-lived process.
const JOB_TTL_MS = 60 * 60 * 1000
const MEDIA_CONCURRENCY = 8

export type ExportJobStatus = 'queued' | 'running' | 'done' | 'failed'

export interface ExportJobView {
  jobId: string
  status: ExportJobStatus
  error: string | null
  createdAt: string
  finishedAt: string | null
  downloadReady: boolean
}

interface ExportJob {
  id: string
  userId: string
  status: ExportJobStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
  payload: Buffer | null
}

interface ExportPhoto {
  id: string
  url: string
  filename: string | null
  mimetype: string | null
  width: number | null
  height: number | null
  /** The object bytes, base64-encoded, or null when MinIO could not serve them. */
  media: { encoding: 'base64'; data: string } | null
}

export interface ExportData {
  exportedAt: string
  user: {
    id: string
    name: string
    email: string
  }
  memories: Array<{
    id: string
    title: string
    content: string | null
    memoryDate: string
    locationName: string | null
    weatherDesc: string | null
    weatherTemp: string | null
    musicTrack: string | null
    musicArtist: string | null
    isPublic: boolean
    aiNarrative: string | null
    aiMood: string | null
    aiThemes: string[] | null
    createdAt: string
    people: string[]
    tags: string[]
    photos: ExportPhoto[]
  }>
}

const jobs = new Map<string, ExportJob>()

function pruneExpiredJobs(now: number) {
  for (const job of jobs.values()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(job.id)
    }
  }
}

function toView(job: ExportJob): ExportJobView {
  return {
    jobId: job.id,
    status: job.status,
    error: job.error,
    createdAt: new Date(job.createdAt).toISOString(),
    finishedAt: job.finishedAt === null ? null : new Date(job.finishedAt).toISOString(),
    downloadReady: job.status === 'done',
  }
}

function ownedJob(jobId: string, userId: string): ExportJob {
  const job = jobs.get(jobId)
  // A wrong owner reads as a missing job, so the endpoint cannot be used to
  // learn whether a job id exists.
  if (!job || job.userId !== userId) {
    throw AppError.notFound('Exportação não encontrada')
  }
  return job
}

async function fetchMedia(url: string): Promise<{ encoding: 'base64'; data: string } | null> {
  try {
    const key = url.replace(`/${BUCKET_NAME}/`, '')
    const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    const bytes = await response.Body?.transformToByteArray()
    if (!bytes || bytes.length === 0) return null
    return { encoding: 'base64', data: Buffer.from(bytes).toString('base64') }
  } catch {
    // The row, its URL and the fact the media is missing are still exported;
    // one unreachable object must not fail the whole job.
    return null
  }
}

export class ExportService {
  start(userId: string): ExportJobView {
    const now = Date.now()
    pruneExpiredJobs(now)

    const job: ExportJob = {
      id: randomUUID(),
      userId,
      status: 'queued',
      error: null,
      createdAt: now,
      finishedAt: null,
      payload: null,
    }
    jobs.set(job.id, job)

    setImmediate(() => {
      void this.run(job)
    })

    return toView(job)
  }

  status(jobId: string, userId: string): ExportJobView {
    return toView(ownedJob(jobId, userId))
  }

  download(jobId: string, userId: string): { buffer: Buffer; filename: string } {
    const job = ownedJob(jobId, userId)

    if (job.status !== 'done' || !job.payload) {
      throw AppError.conflict(
        job.status === 'failed'
          ? `Exportação falhou: ${job.error ?? 'erro desconhecido'}`
          : 'Exportação ainda em andamento',
      )
    }

    const day = new Date(job.finishedAt ?? job.createdAt).toISOString().split('T')[0]
    return { buffer: job.payload, filename: `chronicle-export-${day}.json` }
  }

  /** Builds the full document, media included. Runs inside the job. */
  async collect(userId: string): Promise<ExportData> {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user) {
      throw AppError.notFound('Usuário não encontrado')
    }

    const memoryRows = await db
      .select()
      .from(memories)
      .where(and(eq(memories.userId, userId), isNull(memories.deletedAt)))
      .orderBy(memories.memoryDate)

    const empty: ExportData = {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
      memories: [],
    }

    if (memoryRows.length === 0) {
      return empty
    }

    const ids = memoryRows.map((m) => m.id)

    const [peopleRows, tagRows, photoRows] = await Promise.all([
      db.select().from(memoryPeople).where(inArray(memoryPeople.memoryId, ids)),
      db.select().from(memoryTags).where(inArray(memoryTags.memoryId, ids)),
      db.select().from(memoryPhotos).where(inArray(memoryPhotos.memoryId, ids)),
    ])

    const peopleMap = new Map<string, string[]>()
    for (const p of peopleRows) {
      const list = peopleMap.get(p.memoryId) ?? []
      list.push(p.name)
      peopleMap.set(p.memoryId, list)
    }

    const tagMap = new Map<string, string[]>()
    for (const t of tagRows) {
      const list = tagMap.get(t.memoryId) ?? []
      list.push(t.name)
      tagMap.set(t.memoryId, list)
    }

    // Photos are fetched in bounded batches: unbounded Promise.all on an
    // account with a few hundred objects opens that many sockets at once.
    const mediaByUrl = new Map<string, { encoding: 'base64'; data: string } | null>()
    const photoList = photoRows.filter((p) => p.url)
    for (let i = 0; i < photoList.length; i += MEDIA_CONCURRENCY) {
      const batch = photoList.slice(i, i + MEDIA_CONCURRENCY)
      const fetched = await Promise.all(batch.map((p) => fetchMedia(p.url)))
      batch.forEach((p, index) => mediaByUrl.set(p.url, fetched[index]))
    }

    const photoMap = new Map<string, ExportPhoto[]>()
    for (const ph of photoRows) {
      const list = photoMap.get(ph.memoryId) ?? []
      list.push({
        id: ph.id,
        url: ph.url,
        filename: ph.filename,
        mimetype: ph.mimetype,
        width: ph.width,
        height: ph.height,
        media: ph.url ? (mediaByUrl.get(ph.url) ?? null) : null,
      })
      photoMap.set(ph.memoryId, list)
    }

    return {
      exportedAt: new Date().toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
      memories: memoryRows.map((m) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        memoryDate: m.memoryDate.toISOString(),
        locationName: m.locationName,
        weatherDesc: m.weatherDesc,
        weatherTemp: m.weatherTemp,
        musicTrack: m.musicTrack,
        musicArtist: m.musicArtist,
        isPublic: m.isPublic,
        aiNarrative: m.aiNarrative,
        aiMood: m.aiMood,
        aiThemes: m.aiThemes,
        createdAt: m.createdAt.toISOString(),
        people: peopleMap.get(m.id) ?? [],
        tags: tagMap.get(m.id) ?? [],
        photos: photoMap.get(m.id) ?? [],
      })),
    }
  }

  private async run(job: ExportJob): Promise<void> {
    job.status = 'running'
    try {
      const data = await this.collect(job.userId)
      job.payload = Buffer.from(JSON.stringify(data, null, 2))
      job.status = 'done'
    } catch (error) {
      job.status = 'failed'
      job.error = error instanceof Error ? error.message : 'Erro desconhecido'
    } finally {
      job.finishedAt = Date.now()
    }
  }
}

export const exportService = new ExportService()
