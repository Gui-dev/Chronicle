import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: {
    queue: [] as unknown[][],
    selects: [] as Array<{ table: string; condition: unknown }>,
    joins: [] as Array<{ table: string }>,
    groups: [] as Array<{ table: string; args: unknown[] }>,
    orderBys: [] as Array<{ table: string; args: unknown[] }>,
    limits: [] as number[],
    updates: [] as Array<{
      table: unknown
      values: Record<string, unknown>
      condition: unknown
    }>,
  },
  findAllMock: vi.fn(),
}))

vi.mock('@chronicle/db', () => {
  const column = (name: string) => ({ __column: name })

  const tables = {
    users: {
      __table: 'users',
      id: column('id'),
      lastVisitAt: column('last_visit_at'),
    },
    memories: {
      __table: 'memories',
      id: column('id'),
      userId: column('user_id'),
      isPublic: column('is_public'),
      createdAt: column('created_at'),
      deletedAt: column('deleted_at'),
      memoryDate: column('memory_date'),
      locationName: column('location_name'),
      locationLat: column('location_lat'),
      locationLng: column('location_lng'),
      aiThemes: column('ai_themes'),
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
  }

  const eq = (col: unknown, value: unknown) => ({ op: 'eq', col, value })
  const ne = (col: unknown, value: unknown) => ({ op: 'ne', col, value })
  const gt = (col: unknown, value: unknown) => ({ op: 'gt', col, value })
  const gte = (col: unknown, value: unknown) => ({ op: 'gte', col, value })
  const lt = (col: unknown, value: unknown) => ({ op: 'lt', col, value })
  const and = (...conds: unknown[]) => ({ op: 'and', conds })
  const isNull = (col: unknown) => ({ op: 'isNull', col })
  const isNotNull = (col: unknown) => ({ op: 'isNotNull', col })
  const asc = (expr: unknown) => ({ dir: 'asc', expr })
  const desc = (expr: unknown) => ({ dir: 'desc', expr })
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    __sql: [...strings],
    values,
  })

  class SelectChain {
    private fromTable: { __table: string } | undefined

    from(table: { __table: string }) {
      this.fromTable = table
      return this
    }

    innerJoin(table: { __table: string }, _on: unknown) {
      mocks.state.joins.push({ table: table.__table })
      return this
    }

    where(condition: unknown) {
      mocks.state.selects.push({ table: this.fromTable?.__table ?? '', condition })
      return this
    }

    groupBy(...args: unknown[]) {
      mocks.state.groups.push({ table: this.fromTable?.__table ?? '', args })
      return this
    }

    orderBy(...args: unknown[]) {
      mocks.state.orderBys.push({ table: this.fromTable?.__table ?? '', args })
      return this
    }

    limit(value: number) {
      mocks.state.limits.push(value)
      return this
    }

    offset() {
      return this
    }

    // biome-ignore lint/suspicious/noThenProperty: awaits the terminal node of the mock chain
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      const rows = mocks.state.queue.shift()
      if (!rows) {
        return Promise.reject(
          new Error('retrospectives mock: query ran with an empty queue (order matters)'),
        )
      }
      return Promise.resolve(rows).then(resolve, reject)
    }
  }

  const db = {
    select: () => new SelectChain(),
    selectDistinct: () => new SelectChain(),
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          mocks.state.updates.push({ table, values, condition: undefined })
          return {
            where: async (condition: unknown) => {
              const entry = mocks.state.updates.at(-1)
              if (entry) entry.condition = condition
              return []
            },
          }
        },
      }
    },
  }

  return { ...tables, eq, ne, gt, gte, lt, and, isNull, isNotNull, asc, desc, sql, db }
})

vi.mock('../../memories/memories.service', () => ({
  memoriesService: {
    findAll: mocks.findAllMock,
  },
}))

import { memories, users } from '@chronicle/db'
import { retrospectivesService } from '../retrospectives.service'

type OpNode = { op?: string; conds?: unknown[]; col?: unknown; value?: unknown }

// Flattens an op-tree — and(...) children included — so an assertion can find a
// predicate wherever the service put it. Same helper as share.service.spec.
const flattenOps = (node: unknown): OpNode[] => {
  if (!node || typeof node !== 'object') return []
  const n = node as OpNode
  const found: OpNode[] = typeof n.op === 'string' ? [n] : []
  for (const child of n.conds ?? []) found.push(...flattenOps(child))
  return found
}

beforeEach(() => {
  mocks.state.queue = []
  mocks.state.selects = []
  mocks.state.joins = []
  mocks.state.groups = []
  mocks.state.orderBys = []
  mocks.state.limits = []
  mocks.state.updates = []
  mocks.findAllMock.mockReset()
  vi.clearAllMocks()
})

describe('RetrospectivesService.yearAgo', () => {
  it('delegates to findAll with owner scope, previous-year month window and limit 3', async () => {
    mocks.findAllMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 3, total: 0, totalPages: 0 },
      searchMeta: null,
    } as unknown as Awaited<ReturnType<typeof mocks.findAllMock>>)

    await retrospectivesService.yearAgo('user-1')

    const now = new Date()
    expect(mocks.findAllMock).toHaveBeenCalledTimes(1)
    const [filters, options] = mocks.findAllMock.mock.calls[0]
    expect(filters).toMatchObject({
      mine: true,
      year: now.getUTCFullYear() - 1,
      month: now.getUTCMonth() + 1,
      page: 1,
      limit: 3,
    })
    expect(options).toEqual({ userId: 'user-1' })
  })

  it('returns the enriched items unchanged', async () => {
    const item = { id: 'mem-1', title: 'Carnaval' }
    mocks.findAllMock.mockResolvedValue({
      data: [item],
      pagination: { page: 1, limit: 3, total: 1, totalPages: 1 },
      searchMeta: null,
    } as unknown as Awaited<ReturnType<typeof mocks.findAllMock>>)

    const result = await retrospectivesService.yearAgo('user-1')

    expect(result).toEqual([item])
  })
})

describe('RetrospectivesService.activity', () => {
  it('answers zero without a count query when the user never visited', async () => {
    mocks.state.queue = [[{ lastVisitAt: null }]]

    const result = await retrospectivesService.activity('user-1')

    expect(result).toEqual({ count: 0, since: null })
    expect(mocks.state.selects).toHaveLength(1)
    expect(mocks.state.selects[0].table).toBe('users')
  })

  it('counts public memories from others strictly after lastVisitAt', async () => {
    const since = new Date('2026-09-01T12:00:00.000Z')
    mocks.state.queue = [[{ lastVisitAt: since }], [{ count: '7' }]]

    const result = await retrospectivesService.activity('user-1')

    expect(result).toEqual({ count: 7, since: since.toISOString() })
    expect(mocks.state.selects).toHaveLength(2)
    const countSelect = mocks.state.selects[1]
    expect(countSelect.table).toBe('memories')
    expect(flattenOps(countSelect.condition)).toEqual(
      expect.arrayContaining([
        { op: 'eq', col: memories.isPublic, value: true },
        { op: 'ne', col: memories.userId, value: 'user-1' },
        { op: 'gt', col: memories.createdAt, value: since },
        { op: 'isNull', col: memories.deletedAt },
      ]),
    )
  })

  it('coerces the count to a number', async () => {
    const since = new Date('2026-09-01T12:00:00.000Z')
    mocks.state.queue = [[{ lastVisitAt: since }], [{ count: '12' }]]

    const result = await retrospectivesService.activity('user-1')

    expect(result.count).toBe(12)
  })
})

describe('RetrospectivesService.visit', () => {
  it('stamps lastVisitAt on the session user', async () => {
    const before = Date.now()

    await retrospectivesService.visit('user-1')

    expect(mocks.state.updates).toHaveLength(1)
    const update = mocks.state.updates[0]
    expect(update.table).toBe(users)
    const stamp = (update.values as { lastVisitAt: Date }).lastVisitAt
    expect(stamp).toBeInstanceOf(Date)
    expect(stamp.getTime()).toBeGreaterThanOrEqual(before)
    expect(stamp.getTime()).toBeLessThanOrEqual(Date.now())
    expect(flattenOps(update.condition)).toEqual([{ op: 'eq', col: users.id, value: 'user-1' }])
  })
})
