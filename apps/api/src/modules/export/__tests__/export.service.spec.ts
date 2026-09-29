import { isNull, memories } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportService } from '../export.service'

const mocks = vi.hoisted(() => ({
  userRows: [] as unknown[],
  memoryRows: [] as unknown[],
  peopleRows: [] as unknown[],
  tagRows: [] as unknown[],
  photoRows: [] as unknown[],
  s3Send: vi.fn(),
}))

vi.mock('@chronicle/db', () => {
  const users = { __table: 'users' }
  const memories = { __table: 'memories', deletedAt: { name: 'deleted_at' } }
  const memoryPeople = { __table: 'memoryPeople' }
  const memoryTags = { __table: 'memoryTags' }
  const memoryPhotos = { __table: 'memoryPhotos' }

  const rowsFor = (table: unknown) => {
    if (table === users) return mocks.userRows
    if (table === memories) return mocks.memoryRows
    if (table === memoryPeople) return mocks.peopleRows
    if (table === memoryTags) return mocks.tagRows
    if (table === memoryPhotos) return mocks.photoRows
    return []
  }

  // Every query in the service is awaited after `where`, some after `limit`
  // and some after `orderBy`. A thenable with both methods covers all three
  // shapes without the service having to know it is talking to a mock.
  const makeQuery = (table: unknown) => {
    const rows = rowsFor(table)
    return {
      limit: async () => rows,
      orderBy: async () => rows,
      // biome-ignore lint/suspicious/noThenProperty: awaits any terminal node of the mock chain
      then: (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
    }
  }

  return {
    users,
    memories,
    memoryPeople,
    memoryTags,
    memoryPhotos,
    and: vi.fn((...conds: unknown[]) => conds),
    eq: vi.fn((col: unknown, value: unknown) => ({ col, value })),
    isNull: vi.fn((col: unknown) => ({ col })),
    inArray: vi.fn((col: unknown, values: unknown) => ({ col, values })),
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => makeQuery(table),
        }),
      }),
    },
  }
})

vi.mock('../../../plugins/minio', () => ({
  s3Client: { send: mocks.s3Send },
  BUCKET_NAME: 'chronicle-test',
}))

const memoryRow = {
  id: 'm1',
  title: 'Praia',
  content: null,
  memoryDate: new Date('2026-01-05T12:00:00.000Z'),
  locationName: null,
  weatherDesc: null,
  weatherTemp: null,
  musicTrack: null,
  musicArtist: null,
  isPublic: true,
  aiNarrative: null,
  aiMood: null,
  aiThemes: null,
  createdAt: new Date('2026-01-05T13:00:00.000Z'),
}

const photoRow = {
  id: 'p1',
  memoryId: 'm1',
  url: '/chronicle-test/memories/m1/photo.png',
  filename: 'photo.png',
  mimetype: 'image/png',
  width: 10,
  height: 20,
}

describe('ExportService', () => {
  beforeEach(() => {
    mocks.userRows = [{ id: 'user-1', name: 'Bruce', email: 'bruce@test.com' }]
    mocks.memoryRows = [memoryRow]
    mocks.peopleRows = [{ memoryId: 'm1', name: 'Ana' }]
    mocks.tagRows = [{ memoryId: 'm1', name: 'verao' }]
    mocks.photoRows = [photoRow]
    mocks.s3Send.mockReset()
    mocks.s3Send.mockResolvedValue({
      Body: { transformToByteArray: async () => Buffer.from('fake-png-bytes') },
    })
  })

  it('runs the job to completion and serves the file with media embedded', async () => {
    const started = exportService.start('user-1')
    expect(started.status).toBe('queued')

    await vi.waitFor(() => {
      expect(exportService.status(started.jobId, 'user-1').status).toBe('done')
    })

    const { buffer, filename } = exportService.download(started.jobId, 'user-1')
    expect(filename).toMatch(/^chronicle-export-\d{4}-\d{2}-\d{2}\.json$/)

    const parsed = JSON.parse(buffer.toString()) as {
      user: { id: string }
      memories: Array<{
        people: string[]
        tags: string[]
        photos: Array<{ media: { encoding: string; data: string } | null }>
      }>
    }

    expect(parsed.user.id).toBe('user-1')
    expect(parsed.memories[0].people).toEqual(['Ana'])
    expect(parsed.memories[0].tags).toEqual(['verao'])
    expect(parsed.memories[0].photos[0].media).toEqual({
      encoding: 'base64',
      data: Buffer.from('fake-png-bytes').toString('base64'),
    })

    // The object key comes from the stored URL, bucket prefix stripped.
    expect(mocks.s3Send).toHaveBeenCalledTimes(1)
    const command = mocks.s3Send.mock.calls[0][0] as { input: { Bucket: string; Key: string } }
    expect(command.input.Bucket).toBe('chronicle-test')
    expect(command.input.Key).toBe('memories/m1/photo.png')
  })

  it('still finishes when an object cannot be fetched, leaving media null', async () => {
    mocks.s3Send.mockRejectedValue(new Error('minio down'))

    const started = exportService.start('user-1')
    await vi.waitFor(() => {
      expect(exportService.status(started.jobId, 'user-1').status).toBe('done')
    })

    const { buffer } = exportService.download(started.jobId, 'user-1')
    const parsed = JSON.parse(buffer.toString()) as {
      memories: Array<{ photos: Array<{ url: string; media: unknown }> }>
    }

    expect(parsed.memories[0].photos[0].url).toBe('/chronicle-test/memories/m1/photo.png')
    expect(parsed.memories[0].photos[0].media).toBeNull()
  })

  it('refuses the download while the job has not finished', () => {
    const started = exportService.start('user-1')

    // Same tick as `start`, before setImmediate gets to run the job.
    expect(() => exportService.download(started.jobId, 'user-1')).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    )
  })

  it('fails the job when the user no longer exists', async () => {
    mocks.userRows = []

    const started = exportService.start('ghost')
    await vi.waitFor(() => {
      expect(exportService.status(started.jobId, 'ghost').status).toBe('failed')
    })

    expect(exportService.status(started.jobId, 'ghost').error).toContain('Usuário não encontrado')
    expect(() => exportService.download(started.jobId, 'ghost')).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    )
  })

  it('hides a job from every other account', async () => {
    const started = exportService.start('user-1')
    await vi.waitFor(() => {
      expect(exportService.status(started.jobId, 'user-1').status).toBe('done')
    })

    expect(() => exportService.status(started.jobId, 'user-2')).toThrow(
      expect.objectContaining({ statusCode: 404 }),
    )
    expect(() => exportService.download(started.jobId, 'user-2')).toThrow(
      expect.objectContaining({ statusCode: 404 }),
    )
  })

  it('applies the soft-delete filter to the export query', async () => {
    vi.mocked(isNull).mockClear()

    await exportService.collect('user-1')

    // The predicate's shape is pinned by the memories service tests; what
    // matters here is that collect goes through the same filter as the reads,
    // so the trash never leaks into an export.
    expect(vi.mocked(isNull)).toHaveBeenCalledWith(memories.deletedAt)
  })
})
