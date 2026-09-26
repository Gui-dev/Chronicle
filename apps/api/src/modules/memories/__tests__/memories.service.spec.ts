import { memories } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../errors/app-error'
import { memoriesService } from '../memories.service'

const mocks = vi.hoisted(() => ({
  state: {
    rows: [] as Array<Record<string, unknown>>,
    count: 0,
    memoryConditions: [] as unknown[],
    countConditions: [] as unknown[],
    inserted: [] as Array<{ table: unknown; values: unknown }>,
    updates: [] as Array<Record<string, unknown>>,
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
      memoryDate: column('memory_date'),
      title: column('title'),
      content: column('content'),
      weatherDesc: column('weather_desc'),
      locationName: column('location_name'),
    },
    memoryPeople: {
      __table: 'memoryPeople',
      memoryId: column('memory_id'),
      name: column('name'),
    },
    memoryTags: {
      __table: 'memoryTags',
      memoryId: column('memory_id'),
      name: column('name'),
    },
    memoryPhotos: {
      __table: 'memoryPhotos',
      memoryId: column('memory_id'),
      orderIndex: column('order_index'),
    },
  }

  const eq = (col: unknown, value: unknown) => ({ op: 'eq', col, value })
  const or = (...conds: unknown[]) => ({ op: 'or', conds })
  const and = (...conds: unknown[]) => ({ op: 'and', conds })
  const ilike = (col: unknown, pattern: unknown) => ({ op: 'ilike', col, pattern })
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    text: strings.join('?'),
    values,
  })
  const desc = (col: unknown) => ({ op: 'desc', col })
  const asc = (col: unknown) => ({ op: 'asc', col })

  class SelectChain {
    private fromTable: unknown

    constructor(private readonly projection: unknown) {}

    from(table: unknown) {
      this.fromTable = table
      return this
    }

    where(cond: unknown) {
      if (this.projection !== undefined) {
        mocks.state.countConditions.push(cond)
      } else if (this.fromTable === tables.memories) {
        mocks.state.memoryConditions.push(cond)
      }
      return this
    }

    orderBy() {
      return this
    }

    limit() {
      return this
    }

    offset() {
      return this
    }

    // biome-ignore lint/suspicious/noThenProperty: awaits any terminal node of the variable-length mock chain
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      if (this.projection !== undefined) {
        return Promise.resolve([{ count: mocks.state.count }]).then(resolve, reject)
      }
      if (this.fromTable === tables.memories) {
        return Promise.resolve(mocks.state.rows).then(resolve, reject)
      }
      return Promise.resolve([]).then(resolve, reject)
    }
  }

  const db = {
    select: (projection?: unknown) => new SelectChain(projection),
    insert(table: unknown) {
      return {
        values(values: unknown) {
          mocks.state.inserted.push({ table, values })
          return {
            returning: async () => [{ id: 'generated-id', ...(values as object) }],
          }
        },
      }
    },
    update(_table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          mocks.state.updates.push(values)
          return {
            where: () => ({ returning: async () => [{ id: 'updated-id' }] }),
          }
        },
      }
    },
    delete: () => ({ where: async () => undefined }),
  }

  return { ...tables, eq, or, and, ilike, sql, desc, asc, db }
})

const filters = (overrides: Record<string, unknown> = {}) =>
  ({
    page: 1,
    limit: 20,
    ...overrides,
  }) as Parameters<typeof memoriesService.findAll>[0]

describe('MemoriesService privacy', () => {
  beforeEach(() => {
    mocks.state.rows = []
    mocks.state.count = 0
    mocks.state.memoryConditions = []
    mocks.state.countConditions = []
    mocks.state.inserted = []
    mocks.state.updates = []
  })

  describe('findAll', () => {
    it('restricts anonymous reads to public memories only', async () => {
      await memoriesService.findAll(filters())

      expect(mocks.state.memoryConditions).toHaveLength(1)
      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [{ op: 'eq', col: memories.isPublic, value: true }],
      })
      expect(JSON.stringify(mocks.state.memoryConditions)).not.toContain('user_id')
    })

    it('lets a signed-in user read public memories plus their own private ones', async () => {
      await memoriesService.findAll(filters(), { userId: 'user-1' })

      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [
          {
            op: 'or',
            conds: [
              { op: 'eq', col: memories.isPublic, value: true },
              { op: 'eq', col: memories.userId, value: 'user-1' },
            ],
          },
        ],
      })
    })

    it('treats mine=false as public feed, not as the owner filter', async () => {
      await memoriesService.findAll(filters({ mine: false }), { userId: 'user-1' })

      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [
          {
            op: 'or',
            conds: [
              { op: 'eq', col: memories.isPublic, value: true },
              { op: 'eq', col: memories.userId, value: 'user-1' },
            ],
          },
        ],
      })
    })

    it('restricts mine=true to the signed-in user', async () => {
      await memoriesService.findAll(filters({ mine: true }), { userId: 'user-1' })

      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [{ op: 'eq', col: memories.userId, value: 'user-1' }],
      })
    })

    it('returns an empty page for mine=true when no user is given', async () => {
      const result = await memoriesService.findAll(filters({ mine: true }))

      expect(result.data).toEqual([])
      expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 })
      expect(mocks.state.memoryConditions).toHaveLength(0)
    })

    it('composes other filters with the privacy condition', async () => {
      await memoriesService.findAll(filters({ year: 2024, search: 'praia' }), { userId: 'user-1' })

      const condition = mocks.state.memoryConditions[0] as { op: string; conds: unknown[] }
      expect(condition.op).toBe('and')
      expect(condition.conds).toHaveLength(3)
      expect(condition.conds[0]).toEqual({
        op: 'or',
        conds: [
          { op: 'eq', col: memories.isPublic, value: true },
          { op: 'eq', col: memories.userId, value: 'user-1' },
        ],
      })
    })

    it('reuses the same privacy condition for the count query', async () => {
      await memoriesService.findAll(filters(), { userId: 'user-1' })

      expect(mocks.state.countConditions[0]).toEqual(mocks.state.memoryConditions[0])
    })
  })

  describe('findById', () => {
    it('returns a public memory to a different user', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: true }]

      const memory = await memoriesService.findById('mem-1', 'user-1')

      expect(memory.id).toBe('mem-1')
    })

    it('returns a public memory to an anonymous reader', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: true }]

      const memory = await memoriesService.findById('mem-1')

      expect(memory.id).toBe('mem-1')
    })

    it('rejects a private memory read by another user', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: false }]

      await expect(memoriesService.findById('mem-1', 'user-1')).rejects.toBeInstanceOf(AppError)
      await expect(memoriesService.findById('mem-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      })
    })

    it('rejects a private memory read anonymously', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: false }]

      await expect(memoriesService.findById('mem-1')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns a private memory to its owner', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: false }]

      const memory = await memoriesService.findById('mem-1', 'user-1')

      expect(memory.id).toBe('mem-1')
    })

    it('still reports missing memories as not found', async () => {
      mocks.state.rows = []

      await expect(memoriesService.findById('missing', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('create', () => {
    const base = { title: 'Praia', memoryDate: new Date('2024-01-01') }

    it('defaults isPublic to true', async () => {
      await memoriesService.create('user-1', base)

      expect(mocks.state.inserted[0].values).toMatchObject({ isPublic: true })
    })

    it('stores isPublic false when the user hides the memory', async () => {
      await memoriesService.create('user-1', { ...base, isPublic: false })

      expect(mocks.state.inserted[0].values).toMatchObject({ isPublic: false })
    })
  })

  describe('update', () => {
    it('persists an isPublic change', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: true }]

      await memoriesService.update('mem-1', 'user-1', { isPublic: false })

      expect(mocks.state.updates[0]).toMatchObject({ isPublic: false })
    })

    it('leaves isPublic untouched when it is omitted', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: true }]

      await memoriesService.update('mem-1', 'user-1', { title: 'Novo titulo' })

      expect(mocks.state.updates[0].isPublic).toBeUndefined()
    })

    it('refuses to update a private memory owned by someone else', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: false }]

      await expect(memoriesService.update('mem-1', 'user-1', { title: 'X' })).rejects.toMatchObject(
        {
          statusCode: 403,
        },
      )
    })
  })
})
