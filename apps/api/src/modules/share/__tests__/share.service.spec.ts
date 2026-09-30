import { memories } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shareService } from '../share.service'

const mocks = vi.hoisted(() => ({
  state: {
    rows: {} as Record<string, Array<Record<string, unknown>>>,
    updates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
    selects: [] as Array<{ table: string; condition: unknown }>,
  },
}))

vi.mock('@chronicle/db', () => {
  const column = (name: string) => ({ __column: name })

  const tables = {
    memories: {
      __table: 'memories',
      id: column('id'),
      userId: column('user_id'),
      isPublic: column('is_public'),
      shareToken: column('share_token'),
      shareExpiresAt: column('share_expires_at'),
      deletedAt: column('deleted_at'),
      title: column('title'),
      content: column('content'),
      memoryDate: column('memory_date'),
      locationName: column('location_name'),
      locationLat: column('location_lat'),
      locationLng: column('location_lng'),
      weatherDesc: column('weather_desc'),
      weatherIcon: column('weather_icon'),
      musicTrack: column('music_track'),
      musicArtist: column('music_artist'),
      musicUrl: column('music_url'),
      musicCover: column('music_cover'),
      aiNarrative: column('ai_narrative'),
      aiMood: column('ai_mood'),
    },
    users: {
      __table: 'users',
      id: column('id'),
      name: column('name'),
      image: column('image'),
      email: column('email'),
    },
    memoryPeople: {
      __table: 'memoryPeople',
      id: column('id'),
      memoryId: column('memory_id'),
      name: column('name'),
    },
    memoryTags: {
      __table: 'memoryTags',
      id: column('id'),
      memoryId: column('memory_id'),
      name: column('name'),
    },
    memoryPhotos: {
      __table: 'memoryPhotos',
      id: column('id'),
      memoryId: column('memory_id'),
      url: column('url'),
      width: column('width'),
      height: column('height'),
      orderIndex: column('order_index'),
    },
  }

  const eq = (col: unknown, value: unknown) => ({ op: 'eq', col, value })
  const and = (...conds: unknown[]) => ({ op: 'and', conds })
  const isNull = (col: unknown) => ({ op: 'isNull', col })

  class SelectChain {
    private fromTable: { __table: string } | undefined

    from(table: { __table: string }) {
      this.fromTable = table
      return this
    }

    where(condition: unknown) {
      mocks.state.selects.push({ table: this.fromTable?.__table ?? '', condition })
      return this
    }

    orderBy() {
      return this
    }

    limit() {
      return this
    }

    // biome-ignore lint/suspicious/noThenProperty: awaits the terminal node of the mock chain
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      const rows = (this.fromTable && mocks.state.rows[this.fromTable.__table]) || []
      return Promise.resolve(rows).then(resolve, reject)
    }
  }

  const db = {
    select: () => new SelectChain(),
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          mocks.state.updates.push({ table, values })
          return { where: async () => [] }
        },
      }
    },
  }

  return { ...tables, eq, and, isNull, db }
})

const ownerMemory = (overrides: Record<string, unknown> = {}) => ({
  id: 'mem-1',
  userId: 'user-1',
  isPublic: false,
  shareToken: null,
  shareExpiresAt: null,
  deletedAt: null,
  title: 'Aniversário da vó',
  content: 'Todo mundo cantou junto.',
  memoryDate: new Date('2026-09-01T00:00:00Z'),
  locationName: 'São Paulo',
  locationLat: '-23.5505',
  locationLng: '-46.6333',
  weatherDesc: 'Sol',
  weatherIcon: 'sun',
  musicTrack: 'Parabéns',
  musicArtist: 'Tradição',
  musicUrl: 'https://open.spotify.com/track/1',
  musicCover: 'https://i.scdn.co/image/1',
  aiNarrative: 'Era um dia de sol...',
  aiMood: 'joyful',
  ...overrides,
})

const updateValues = () => mocks.state.updates.at(-1)?.values as Record<string, unknown>

describe('ShareService.share', () => {
  beforeEach(() => {
    mocks.state.rows = {}
    mocks.state.updates = []
    mocks.state.selects = []
  })

  it('creates a base64url token expiring in 7 days', async () => {
    mocks.state.rows.memories = [ownerMemory()]

    const before = Date.now()
    const result = await shareService.share('mem-1', 'user-1')

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 7 * 24 * 60 * 60 * 1000 - 5000,
    )
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000)
    expect(updateValues()).toMatchObject({ shareToken: result.token })
    expect(updateValues().shareExpiresAt).toEqual(result.expiresAt)
  })

  it('rotates by overwriting whatever token was there', async () => {
    mocks.state.rows.memories = [
      ownerMemory({ shareToken: 'old-token', shareExpiresAt: new Date('2026-10-01') }),
    ]

    await shareService.share('mem-1', 'user-1')

    // One UPDATE with the fresh values — rotation replaces, never accumulates.
    expect(mocks.state.updates).toHaveLength(1)
    expect(updateValues().shareToken).not.toBe('old-token')
  })

  it('answers 404 with the same body for unknown and non-owner', async () => {
    mocks.state.rows.memories = []
    await expect(shareService.share('missing', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Memória não encontrada',
    })

    mocks.state.rows.memories = [ownerMemory({ userId: 'someone-else' })]
    await expect(shareService.share('mem-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Memória não encontrada',
    })
  })

  it('answers 404 for a soft-deleted memory', async () => {
    mocks.state.rows.memories = [ownerMemory({ deletedAt: new Date('2026-09-10') })]

    await expect(shareService.share('mem-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('allows generating a link on a public memory (inert token)', async () => {
    mocks.state.rows.memories = [ownerMemory({ isPublic: true })]

    const result = await shareService.share('mem-1', 'user-1')

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})

describe('ShareService.revoke', () => {
  beforeEach(() => {
    mocks.state.rows = {}
    mocks.state.updates = []
    mocks.state.selects = []
  })

  it('clears both share columns', async () => {
    mocks.state.rows.memories = [
      ownerMemory({ shareToken: 'tok', shareExpiresAt: new Date('2026-10-01') }),
    ]

    await shareService.revoke('mem-1', 'user-1')

    expect(updateValues()).toMatchObject({ shareToken: null, shareExpiresAt: null })
  })

  it('is idempotent when there was no link', async () => {
    mocks.state.rows.memories = [ownerMemory()]

    await expect(shareService.revoke('mem-1', 'user-1')).resolves.toBeUndefined()
    expect(updateValues()).toMatchObject({ shareToken: null, shareExpiresAt: null })
  })

  it('answers 404 for a non-owner', async () => {
    mocks.state.rows.memories = [ownerMemory({ userId: 'someone-else' })]

    await expect(shareService.revoke('mem-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ShareService.resolve', () => {
  beforeEach(() => {
    mocks.state.rows = {}
    mocks.state.updates = []
    mocks.state.selects = []
  })

  it('returns the whitelisted preview and nothing else', async () => {
    mocks.state.rows.memories = [
      ownerMemory({
        shareToken: 'tok-valid',
        shareExpiresAt: new Date(Date.now() + 60_000),
      }),
    ]
    // The author row carries email — the whitelist must drop it.
    mocks.state.rows.users = [
      { name: 'Deborah', image: 'https://lh3.example/avatar.png', email: 'deb@test.com' },
    ]
    mocks.state.rows.memoryPeople = [{ id: 'p1', memoryId: 'mem-1', name: 'Vó' }]
    mocks.state.rows.memoryTags = [{ id: 't1', memoryId: 'mem-1', name: 'festa' }]
    mocks.state.rows.memoryPhotos = [
      { id: 'ph1', memoryId: 'mem-1', url: 'http://localhost:9000/x.jpg', width: 100, height: 80 },
    ]

    const result = await shareService.resolve('tok-valid')

    expect(Object.keys(result.memory).sort()).toEqual(
      [
        'aiNarrative',
        'content',
        'id',
        'locationName',
        'memoryDate',
        'musicArtist',
        'musicCover',
        'musicTrack',
        'musicUrl',
        'people',
        'photos',
        'tags',
        'title',
        'weatherDesc',
        'weatherIcon',
      ].sort(),
    )
    expect(result.author).toEqual({
      name: 'Deborah',
      image: 'https://lh3.example/avatar.png',
    })
    expect(result.memory.photos).toEqual([
      { id: 'ph1', url: 'http://localhost:9000/x.jpg', width: 100, height: 80 },
    ])

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('deb@test.com')
    expect(serialized).not.toContain('-23.5505')
    expect(serialized).not.toContain('user-1')
    expect(serialized).not.toContain('joyful')
    expect(serialized).not.toContain('tok-valid')
  })

  it('answers 404 for an expired token, with the generic message', async () => {
    mocks.state.rows.memories = [
      ownerMemory({
        shareToken: 'tok-expired',
        shareExpiresAt: new Date(Date.now() - 1000),
      }),
    ]

    await expect(shareService.resolve('tok-expired')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Link inválido ou expirado',
    })
  })

  it('answers 404 for an unknown token, with the same message', async () => {
    mocks.state.rows.memories = []

    await expect(shareService.resolve('nope')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Link inválido ou expirado',
    })
  })

  it('answers 404 when the memory was deleted after sharing', async () => {
    mocks.state.rows.memories = [
      ownerMemory({
        shareToken: 'tok',
        shareExpiresAt: new Date(Date.now() + 60_000),
        deletedAt: new Date('2026-09-10'),
      }),
    ]

    await expect(shareService.resolve('tok')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('looks the memory up by token with the soft-delete filter', async () => {
    mocks.state.rows.memories = [
      ownerMemory({ shareToken: 'tok', shareExpiresAt: new Date(Date.now() + 60_000) }),
    ]

    await shareService.resolve('tok')

    const memorySelect = mocks.state.selects.find((s) => s.table === 'memories')
    expect(memorySelect).toBeDefined()
    const flat: Array<{ op: string; col?: unknown; value?: unknown }> = []
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      const n = node as { op?: string; conds?: unknown[]; col?: unknown; value?: unknown }
      if (typeof n.op === 'string') flat.push(n as never)
      for (const child of n.conds ?? []) walk(child)
    }
    walk(memorySelect?.condition)
    expect(flat).toEqual(
      expect.arrayContaining([
        { op: 'eq', col: memories.shareToken, value: 'tok' },
        { op: 'isNull', col: memories.deletedAt },
      ]),
    )
  })
})
