import { memories, memoryPeople, memoryPhotos, memoryTags, users } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../errors/app-error'
import { memoriesService } from '../memories.service'

const mocks = vi.hoisted(() => ({
  state: {
    rows: [] as Array<Record<string, unknown>>,
    count: 0,
    memoryConditions: [] as unknown[],
    countConditions: [] as unknown[],
    junctionConditions: [] as unknown[],
    inserted: [] as Array<{ table: unknown; values: unknown }>,
    updates: [] as Array<Record<string, unknown>>,
    hardDeletes: [] as unknown[],
    fromCalls: [] as string[],
    junctionRows: {} as Record<string, Array<Record<string, unknown>>>,
    leftJoins: [] as Array<{ from: string; isCount: boolean; condition: unknown }>,
    projections: [] as Array<{ table: string; isCount: boolean; columns: unknown }>,
  },
}))

type RecordedOp = {
  op: string
  conds?: unknown[]
  values?: unknown[]
  col?: unknown
  pattern?: unknown
  value?: unknown
  text?: string
}

// The service wraps every predicate in a single and(...), and the mock records
// only the top of the chain, so assertions have to descend into `.conds`.
const memoryOps = (op?: string) => {
  const flat = mocks.state.memoryConditions.flatMap((c) => {
    const condition = c as { op: string; conds?: unknown[] }
    return condition.op === 'and' && condition.conds ? condition.conds : [c]
  })
  return op ? flat.filter((c) => (c as { op: string }).op === op) : flat
}

// `sql` records the operands a template interpolated in `values`, so the
// `ilike`s of a bare term or of a tag subquery sit one level below the
// condition list. This walk keeps a node and everything nested inside it —
// `and`/`or` children and `sql` operands alike — so a filter finds an operator
// wherever the service put it. It leaves `memoryOps` alone: that one reports the
// predicates as siblings of the privacy filter, which is the only shape that can
// say whether they are AND-ed with each other. A node without a string `op` is
// not a predicate — a column object or a Date — so it is skipped instead of
// being pushed and left for the caller's filter to trip over.
const collectOps = (node: unknown, into: RecordedOp[]): RecordedOp[] => {
  if (node === null || typeof node !== 'object') return into
  if (typeof (node as { op?: unknown }).op !== 'string') return into
  const recorded = node as RecordedOp
  into.push(recorded)
  for (const child of [...(recorded.conds ?? []), ...(recorded.values ?? [])]) {
    collectOps(child, into)
  }
  return into
}

const allOps = (op?: string) => {
  const collected = mocks.state.memoryConditions.flatMap((c) => collectOps(c, []))
  return op ? collected.filter((c) => c.op === op) : collected
}

// The junction predicates, unwrapped: each relation query filters with a bare
// inArray, so the recorded condition is the `{ op, col, values }` triple.
const junctionPredicates = () =>
  mocks.state.junctionConditions as Array<{ op: string; col: unknown; values: unknown }>

// Every predicate that reads a `users` column, matched by identity against the
// mocked columns. The author filter is the only thing in the query that touches
// that table, so "is an author predicate in the where" and "does the query
// reference `users` at all" are the same question — which is what makes the
// join/where equivalence below worth pinning.
const authorPredicates = () =>
  allOps('ilike').filter((c) => {
    const col = (c as { col: unknown }).col
    return col === users.name || col === users.email
  })

// The single column list the rows query selects, as the service spelled it.
const rowsProjection = () => {
  const recorded = mocks.state.projections.filter((p) => p.table === 'memories' && !p.isCount)
  expect(recorded).toHaveLength(1)
  return recorded[0].columns as Record<string, { __column: string }>
}

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
      deletedAt: column('deleted_at'),
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
    users: {
      __table: 'users',
      id: column('id'),
      name: column('name'),
      email: column('email'),
    },
  }

  const eq = (col: unknown, value: unknown) => ({ op: 'eq', col, value })
  const or = (...conds: unknown[]) => ({ op: 'or', conds })
  const and = (...conds: unknown[]) => ({ op: 'and', conds })
  const ilike = (col: unknown, pattern: unknown) => ({ op: 'ilike', col, pattern })
  const gte = (col: unknown, value: unknown) => ({ op: 'gte', col, value })
  const lt = (col: unknown, value: unknown) => ({ op: 'lt', col, value })
  const isNull = (col: unknown) => ({ op: 'isNull', col })
  const isNotNull = (col: unknown) => ({ op: 'isNotNull', col })
  const inArray = (col: unknown, values: unknown) => ({ op: 'inArray', col, values })
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    text: strings.join('?'),
    values,
  })
  const desc = (col: unknown) => ({ op: 'desc', col })
  const asc = (col: unknown) => ({ op: 'asc', col })

  // The count query is the one that asks for `{ count: ... }`; the rows query
  // now names its columns too, so `projection !== undefined` no longer tells
  // the two apart. Keying on the `count` key is what survives the rows query
  // gaining a projection — without this, every rows query would be recorded as
  // a count and the whole privacy suite would read the wrong bucket.
  const isCountProjection = (projection: unknown) =>
    typeof projection === 'object' && projection !== null && 'count' in projection

  class SelectChain {
    private fromTable: unknown

    constructor(private readonly projection: unknown) {}

    from(table: unknown) {
      this.fromTable = table
      const name = (table as { __table: string }).__table
      mocks.state.fromCalls.push(name)
      // The projection is recorded here rather than in `select` because it is
      // the *combination* with the table that matters: the row-shape assertion
      // is about which columns come out of `memories` once `users` is joined
      // in, and a projection recorded without its table could not be checked.
      mocks.state.projections.push({
        table: name,
        isCount: isCountProjection(this.projection),
        columns: this.projection,
      })
      return this
    }

    where(cond: unknown) {
      if (isCountProjection(this.projection)) {
        mocks.state.countConditions.push(cond)
      } else if (this.fromTable === tables.memories) {
        mocks.state.memoryConditions.push(cond)
      } else {
        // The batched relation queries carry the page's ids, so their predicates
        // are the only observable trace of them. Discarding them here is what
        // let a wrong id list or a wrong column pass the query-count tests.
        mocks.state.junctionConditions.push(cond)
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

    // Called after `.limit()`/`.offset()` on the rows query, and on the count
    // query with neither. Which query this join landed on is recorded, because
    // the equivalence under test is per query: a join on the rows query alone
    // would leave the count query's `where` referencing an unjoined `users`.
    leftJoin(table: unknown, condition: unknown) {
      mocks.state.leftJoins.push({
        from: (table as { __table: string }).__table,
        isCount: isCountProjection(this.projection),
        condition,
      })
      return this
    }

    // biome-ignore lint/suspicious/noThenProperty: awaits any terminal node of the variable-length mock chain
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      if (isCountProjection(this.projection)) {
        return Promise.resolve([{ count: mocks.state.count }]).then(resolve, reject)
      }
      if (this.fromTable === tables.memories) {
        return Promise.resolve(mocks.state.rows).then(resolve, reject)
      }
      if (this.fromTable === tables.memoryPhotos) {
        return Promise.resolve(mocks.state.junctionRows.photos ?? []).then(resolve, reject)
      }
      if (this.fromTable === tables.memoryPeople) {
        return Promise.resolve(mocks.state.junctionRows.people ?? []).then(resolve, reject)
      }
      if (this.fromTable === tables.memoryTags) {
        return Promise.resolve(mocks.state.junctionRows.tags ?? []).then(resolve, reject)
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
    delete: (table: unknown) => ({
      where: async () => {
        mocks.state.hardDeletes.push(table)
        return undefined
      },
    }),
  }

  return { ...tables, eq, or, and, ilike, sql, desc, asc, gte, lt, inArray, isNull, isNotNull, db }
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
    mocks.state.junctionConditions = []
    mocks.state.inserted = []
    mocks.state.updates = []
    mocks.state.hardDeletes = []
    mocks.state.fromCalls = []
    mocks.state.junctionRows = {}
    mocks.state.leftJoins = []
    mocks.state.projections = []
  })

  describe('findAll', () => {
    it('restricts anonymous reads to public memories only', async () => {
      await memoriesService.findAll(filters())

      expect(mocks.state.memoryConditions).toHaveLength(1)
      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [
          { op: 'eq', col: memories.isPublic, value: true },
          { op: 'isNull', col: memories.deletedAt },
        ],
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
          { op: 'isNull', col: memories.deletedAt },
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
          { op: 'isNull', col: memories.deletedAt },
        ],
      })
    })

    it('restricts mine=true to the signed-in user', async () => {
      await memoriesService.findAll(filters({ mine: true }), { userId: 'user-1' })

      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [
          { op: 'eq', col: memories.userId, value: 'user-1' },
          { op: 'isNull', col: memories.deletedAt },
        ],
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
      // privacy + soft-delete + the two halves of the year range + search
      expect(condition.conds).toHaveLength(5)
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

    it('uses a sargable range for the year filter instead of EXTRACT', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, year: 2026 })

      expect(JSON.stringify(memoryOps())).not.toContain('EXTRACT')

      const range = [...memoryOps('gte'), ...memoryOps('lt')]
      expect(range).toHaveLength(2)

      const [start, end] = range as Array<{ value: Date }>
      expect(start.value.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(end.value.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    })

    it('narrows the range to a single month when month is given', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, year: 2026, month: 9 })

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>

      expect(range[0].value.toISOString()).toBe('2026-09-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    })

    it('defaults the year to the current UTC year when only month is given', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2031-03-15T12:00:00Z'))
      try {
        await memoriesService.findAll({ page: 1, limit: 20, month: 9 })

        const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>
        expect(range[0].value.toISOString()).toBe('2031-09-01T00:00:00.000Z')
        expect(range[1].value.toISOString()).toBe('2031-10-01T00:00:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })

    it('loads photos, people and tags once per page, not once per memory', async () => {
      mocks.state.rows = [
        { id: 'm1', userId: 'u1', isPublic: true },
        { id: 'm2', userId: 'u1', isPublic: true },
        { id: 'm3', userId: 'u1', isPublic: true },
        { id: 'm4', userId: 'u1', isPublic: true },
      ]

      await memoriesService.findAll({ page: 1, limit: 20 })

      const times = (table: string) => mocks.state.fromCalls.filter((t) => t === table).length

      expect(times('memoryPhotos')).toBe(1)
      expect(times('memoryPeople')).toBe(1)
      expect(times('memoryTags')).toBe(1)
      // rows + count
      expect(times('memories')).toBe(2)
    })

    it('scopes every relation query to the ids on the page', async () => {
      mocks.state.rows = [
        { id: 'm1', userId: 'u1', isPublic: true },
        { id: 'm2', userId: 'u1', isPublic: true },
        { id: 'm3', userId: 'u1', isPublic: true },
        { id: 'm4', userId: 'u1', isPublic: true },
      ]

      await memoriesService.findAll({ page: 1, limit: 20 })

      // Query counts alone cannot tell a correct batch from one that filters on
      // the wrong ids or the wrong column, so bind each relation query to its
      // own memoryId column and assert the ids that column carried. Exactly one
      // match per column also rules out a query that never ran and a column
      // copied from the wrong table. Do not swap this for
      // `expect.arrayContaining`: it passed here with a wrong column in place
      // and the expected column missing from the actual array.
      const predicates = junctionPredicates()
      expect(predicates.map((p) => p.op)).toEqual(['inArray', 'inArray', 'inArray', 'inArray'])
      expect(predicates).toHaveLength(4)

      const idsOn = (col: unknown) => {
        const matches = predicates.filter((p) => p.col === col)
        expect(matches).toHaveLength(1)
        return matches[0].values
      }

      expect(idsOn(memoryPhotos.memoryId)).toEqual(['m1', 'm2', 'm3', 'm4'])
      expect(idsOn(memoryPeople.memoryId)).toEqual(['m1', 'm2', 'm3', 'm4'])
      expect(idsOn(memoryTags.memoryId)).toEqual(['m1', 'm2', 'm3', 'm4'])
    })

    it('keeps photos ordered by orderIndex after batching', async () => {
      mocks.state.rows = [{ id: 'm1', userId: 'u1', isPublic: true }]
      mocks.state.junctionRows.photos = [
        { id: 'p2', memoryId: 'm1', orderIndex: 2 },
        { id: 'p0', memoryId: 'm1', orderIndex: 0 },
        { id: 'p1', memoryId: 'm1', orderIndex: 1 },
      ]

      const result = await memoriesService.findAll({ page: 1, limit: 20 })

      expect(result.data[0].photos.map((p) => p.id)).toEqual(['p0', 'p1', 'p2'])
    })

    it('expands a bare term into a title/content OR condition', async () => {
      await memoriesService.findAll(filters({ search: 'praia' }))

      // The whole recorded node, template text included. `text` is
      // `strings.join('?')`, so `toContain('OR')` only proved the letters are in
      // the source; pinning the text is what catches the parentheses going away,
      // which would read as `… AND title ILIKE $n OR content ILIKE $n+1` and
      // hand every other filter a different meaning. Index 2, not 1: privacy
      // and the soft-delete filter occupy the first two slots.
      expect(memoryOps()[2]).toEqual({
        op: 'sql',
        text: '(? OR ?)',
        values: [
          { op: 'ilike', col: memories.title, pattern: '%praia%' },
          { op: 'ilike', col: memories.content, pattern: '%praia%' },
        ],
      })
    })

    it('ANDs multiple bare terms and ORs each across title and content', async () => {
      await memoriesService.findAll(filters({ search: 'praia sol' }))

      // Sibling predicates, not one `or`: "praia sol" means both words, each in
      // either column. An `or` here would return every memory holding either.
      expect(memoryOps().map((c) => (c as RecordedOp).op)).toEqual(['eq', 'isNull', 'sql', 'sql'])
      expect(allOps('ilike')).toHaveLength(4)
      expect(allOps('ilike').map((c) => c.pattern)).toEqual([
        '%praia%',
        '%praia%',
        '%sol%',
        '%sol%',
      ])
    })

    it('ANDs a quoted phrase with the bare terms around it', async () => {
      await memoriesService.findAll(filters({ search: 'praia "sol do norte"' }))

      // Two sibling conditions, which is the whole claim: a phrase is a term
      // that has to appear whole in one column, so it narrows the same way a
      // bare term does. Joining the two into one `sql` node with `OR` between
      // the term groups leaves the `ilike`s identical and the top-level `or`
      // count at zero, because the node is `sql` and not `or` — so the sibling
      // count is what has to catch it. Padding is `%phrase%`, not `"phrase"`,
      // so the quotes the user typed never reach the SQL.
      expect(memoryOps().map((c) => (c as RecordedOp).op)).toEqual(['eq', 'isNull', 'sql', 'sql'])
      expect(allOps('ilike').map((c) => c.pattern)).toEqual([
        '%praia%',
        '%praia%',
        '%sol do norte%',
        '%sol do norte%',
      ])
      expect(memoryOps().filter((c) => (c as RecordedOp).op === 'or')).toHaveLength(0)
    })

    it('feeds ano: into the same date range as the year filter', async () => {
      await memoriesService.findAll(filters({ search: 'ano:2026' }))

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>

      expect(range[0].value.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    })

    it('narrows the range to a month named in the query', async () => {
      await memoriesService.findAll(filters({ search: 'ano:2026 mes:setembro' }))

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>

      expect(range[0].value.toISOString()).toBe('2026-09-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    })

    it('keeps an out-of-range month as text instead of collapsing the range', async () => {
      await memoriesService.findAll(filters({ search: 'mes:0' }))

      // The parser refuses 0, so no month reaches `dateRange`. `0` would read as
      // a given month — `0 ?? x` is `0` — and `[Jan 1, Jan 1)` matches nothing,
      // so this test is the pin on that staying unreachable from the grammar.
      expect(memoryOps('gte')).toHaveLength(0)
      expect(memoryOps('lt')).toHaveLength(0)
      expect(allOps('ilike').map((c) => c.pattern)).toEqual(['%mes:0%', '%mes:0%'])
    })

    // Precedence, per spec §2.3: the grammar wins the URL param of the same
    // dimension and the param is dropped with no trace. These four pin that for
    // every dimension the `??` chain covers, so the rule is not a comment nobody
    // checks. `?tag=` is the documented exception and has its own test below.
    it('lets clima: override the weather param', async () => {
      await memoriesService.findAll(filters({ weather: 'Sol', search: 'clima:chuva' }))

      // Exactly one ilike, and it carries the grammar's value: the param winning
      // would leave '%Sol%', and ANDing the two would leave a second ilike.
      expect(allOps('ilike')).toEqual([
        { op: 'ilike', col: memories.weatherDesc, pattern: '%chuva%' },
      ])
    })

    it('lets local: override the location param', async () => {
      await memoriesService.findAll(filters({ location: 'Casa', search: 'local:praia' }))

      expect(allOps('ilike')).toEqual([
        { op: 'ilike', col: memories.locationName, pattern: '%praia%' },
      ])
    })

    it('lets ano: override the year param', async () => {
      await memoriesService.findAll(filters({ year: 2024, search: 'ano:2026' }))

      // Both bounds are counted so that pushing two ranges — one per source —
      // cannot pass on the first one alone.
      expect(memoryOps('gte')).toHaveLength(1)
      expect(memoryOps('lt')).toHaveLength(1)

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>
      expect(range[0].value.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    })

    it('lets mes: override the month param while the year param still applies', async () => {
      await memoriesService.findAll(filters({ year: 2024, month: 3, search: 'mes:9' }))

      // One dimension overrides; it does not consume the others. March 2024 is
      // wrong twice over: wrong month, and discarding `month: 3` with it would
      // also discard the year that `month: 3` was pinning.
      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>
      expect(range).toHaveLength(2)
      expect(range[0].value.toISOString()).toBe('2024-09-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2024-10-01T00:00:00.000Z')
    })

    it('resolves mes: with no year anywhere to the current year, not the month param', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2031-03-15T12:00:00Z'))
      try {
        await memoriesService.findAll(filters({ month: 3, search: 'mes:9' }))

        // The grammar's month wins, and the year falls back to the current one
        // because neither `ano:` nor `?year=` named a year. `?month=3` is
        // discarded whole — on its own it pinned no year either, so honouring it
        // would have silently moved the search to a different month *and* left
        // the year unstated.
        const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>
        expect(range[0].value.toISOString()).toBe('2031-09-01T00:00:00.000Z')
        expect(range[1].value.toISOString()).toBe('2031-10-01T00:00:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })

    it('maps clima: and local: onto the weather and location columns', async () => {
      await memoriesService.findAll(
        filters({ weather: 'Sol', location: 'Casa', search: 'clima:sol local:praia' }),
      )

      // Columns only, and only because that is what this test is for: whether
      // the grammar or the param supplies the value is the four tests above.
      // Neither dimension reaches title/content as loose text, and a second
      // condition on either column would show up as a third entry here.
      expect(allOps('ilike').map((c) => c.col)).toEqual([
        memories.weatherDesc,
        memories.locationName,
      ])
    })

    it('turns a tag into an EXISTS subquery', async () => {
      await memoriesService.findAll(filters({ search: '#festa' }))

      // Index 2: privacy and the soft-delete filter come first.
      const subquery = memoryOps()[2] as RecordedOp
      expect(subquery.text).toContain('EXISTS')
      // The tag is matched on the tag table only: a title/content ilike here
      // would pass every memory whose text mentions the word.
      expect(allOps('ilike')).toEqual([{ op: 'ilike', col: memoryTags.name, pattern: '%festa%' }])
    })

    it('ANDs the tag param with a #tag named in the query', async () => {
      await memoriesService.findAll(filters({ search: '#bar', tag: 'foo' }))

      // What makes these two conditions rather than one is that each is its own
      // `push` into the same `and(...)`, and nothing merges them: four
      // conditions (privacy, soft-delete, tag param, grammar tag), both tags
      // `sql`, and no `or` anywhere at that level. The order they are pushed in
      // says nothing about it — moving the `tag` block above the grammar block
      // leaves the query identical — so the tags are compared as a set rather
      // than in sequence.
      const conditions = memoryOps()
      expect(conditions).toHaveLength(4)
      expect(conditions.slice(2).map((c) => (c as RecordedOp).op)).toEqual(['sql', 'sql'])
      expect(conditions.filter((c) => (c as RecordedOp).op === 'or')).toHaveLength(0)

      const tagIlikes = allOps('ilike')
      expect(tagIlikes).toHaveLength(2)
      expect(tagIlikes.map((c) => c.col)).toEqual([memoryTags.name, memoryTags.name])
      expect(tagIlikes.map((c) => c.pattern).sort()).toEqual(['%bar%', '%foo%'])
    })

    it('adds no condition for a query with no searchable token', async () => {
      await memoriesService.findAll(filters({ search: '   ' }))

      // Only the privacy and soft-delete filters survive; no ilike, no EXISTS,
      // no range.
      expect(memoryOps()).toHaveLength(2)
      expect(allOps('ilike')).toHaveLength(0)
    })

    it('joins users on both queries when the query names an author', async () => {
      await memoriesService.findAll(filters({ search: '@bruce' }))

      // Two joins, one per query, and which is which. The plan asserted a
      // single join, which is the wrong number: `conditions` is one array shared
      // by both queries, so once the author predicate is in it the count query's
      // `where` names `users.name` as well, and without the join Postgres
      // answers `missing FROM-clause entry for table "users"` (verified against
      // a real database). The plan's assertion could also not tell the count
      // join from the rows join, so joining both twice, or joining the wrong
      // query twice, looked the same to it.
      expect(mocks.state.leftJoins.map((j) => j.isCount)).toEqual([false, true])
      expect(mocks.state.countConditions).toHaveLength(1)
      expect(mocks.state.countConditions[0]).toEqual(mocks.state.memoryConditions[0])
    })

    it('joins on memories.user_id = users.id, not on a same-typed users column', async () => {
      await memoriesService.findAll(filters({ search: '@bruce' }))

      // The condition is the whole claim, and it is a hole on its own: a
      // leftJoin with a missing or wrong condition still leaves `leftJoins` at
      // the right length, so every other test in this file passes. Measured
      // against a real database (6 memories, 13 users, 8 of them matching the
      // author filter):
      //
      //   ON `true`          -> count(*) 48. Every memory paired with every
      //                          matching author, so paging walks a cross
      //                          product: `total` overstates the feed and the
      //                          same memory recurs across pages.
      //   ON user_id = email -> count(*) 0. `memories.user_id` and `users.email`
      //                          are both varchar(255), so nothing refuses to
      //                          compile. Every row fails the ON, so
      //                          `users.name`/`users.email` are NULL, the author
      //                          ILIKE never matches, and `@bruce` answers HTTP
      //                          200 with an empty feed and `total: 0`.
      //
      // Both mutations pass the length assertion, which is why this one is here.
      expect(mocks.state.leftJoins.map((j) => j.condition)).toEqual([
        { op: 'eq', col: memories.userId, value: users.id },
        { op: 'eq', col: memories.userId, value: users.id },
      ])
    })

    it('does not join users when no author is named', async () => {
      await memoriesService.findAll(filters({ search: 'praia' }))

      // The plain-language counterpart to the matrix below, which is the
      // exhaustive version over the grammar's dimensions.
      expect(mocks.state.leftJoins).toHaveLength(0)
    })

    it('puts the author predicate in the where, AND-ed with the privacy filter', async () => {
      await memoriesService.findAll(filters({ search: '@bruce' }))

      // The assertion the plan's own two tests could not make. A leftJoin whose
      // predicate is dropped still leaves `leftJoins` at length 2, so the length
      // test passes on an implementation that joins and forgets the condition in
      // the `where` — and that one answers `@bruce` with the entire public feed.
      // Sibling, not merged into the privacy `or`, so the two cannot be confused
      // for each other.
      expect(memoryOps().map((c) => (c as RecordedOp).op)).toEqual(['eq', 'isNull', 'or'])
      expect(memoryOps()[2]).toEqual({
        op: 'or',
        conds: [
          { op: 'ilike', col: users.name, pattern: '%bruce%' },
          { op: 'ilike', col: users.email, pattern: '%bruce%' },
        ],
      })
    })

    it('joins if and only if the where carries an author predicate', async () => {
      // The invariant, over the searches that exercise every branch of the
      // grammar. The author predicate and `needsAuthorJoin` are both read off
      // one `const author` declared above the `if (hasGrammar)` block, so they
      // cannot disagree: either the `where` names `users` and both queries join
      // it, or neither does. The predicate used to be pushed inside
      // `if (hasGrammar)`, which agreed only because `isEmptySearch` happens to
      // count `author` — a coupling nothing stated and nothing checked. A
      // mismatch either way is a runtime failure: a `where` naming an unjoined
      // table, or a join with nothing to match on. This matrix is the pin.
      let exercisedSome = false

      const searches = [
        undefined,
        '   ',
        'praia',
        'praia sol',
        '"sol do norte"',
        '#festa',
        'ano:2026',
        'mes:9',
        'clima:chuva',
        'local:praia',
        '@bruce',
        '@bruce #festa',
        '@bruce @',
        '@"joão silva"',
        'clima:sol @bruce local:praia ano:2026',
      ]

      for (const search of searches) {
        mocks.state.leftJoins = []
        mocks.state.projections = []
        mocks.state.memoryConditions = []
        mocks.state.countConditions = []

        await memoriesService.findAll(filters({ search }))

        const authorInWhere = authorPredicates().length > 0
        const rowsJoins = mocks.state.leftJoins.filter((j) => !j.isCount)
        const countJoins = mocks.state.leftJoins.filter((j) => j.isCount)

        // Counts, not `some()`. `some()` is idempotent, so a query joined twice
        // reads identically to a query joined once and a duplicated join sails
        // straight through an equivalence check. Pinning the exact number per
        // query also pins the two queries against each other, since one flag
        // decides both: 2 joins on rows and 1 on count is as broken as 1 and 0.
        expect({
          search,
          rowsJoins: rowsJoins.length,
          countJoins: countJoins.length,
          authorInWhere,
        }).toEqual({
          search,
          rowsJoins: authorInWhere ? 1 : 0,
          countJoins: authorInWhere ? 1 : 0,
          authorInWhere,
        })

        if (authorInWhere) exercisedSome = true
      }

      // Without this the loop above is satisfied by every side being false, so
      // the test would pass against an implementation that never joins and never
      // filters. Some searches have to actually reach the author branch, or the
      // equivalence was never exercised.
      expect(exercisedSome).toBe(true)
    })

    it('selects the memory columns and nothing from users', async () => {
      await memoriesService.findAll(filters({ search: '@bruce' }))

      // A bare `select()` joined to `users` is not `SELECT *` — Drizzle expands
      // it to a fully-qualified list of both tables' columns, 21 from `memories`
      // and 7 from `users`, and then `mapResultRow` nests each row by table path
      // into `{ memories: {...}, users: {...} }`. Verified against a real
      // database: the top-level keys are exactly `memories,users`.
      //
      // The leak is the point. A real returned row carried
      // `users: { id, email: "bruce@email.com", name, image, emailVerified,
      // createdAt, updatedAt }` — every author's real email address, on a feed
      // readable by anyone. Asserting the exact key set catches that, and also
      // catches the opposite drift, a column dropped from the list.
      //
      // It also rules out a shape I got wrong once: the nesting means there is
      // NO `id` collision, because the two land under different keys. `row.id` is
      // `undefined`, so `results.map(r => r.id)` feeds
      // `inArray(memoryPhotos.memoryId, [undefined])` and postgres.js rejects it
      // with `UNDEFINED_VALUE: Undefined values are not allowed` — a 500, not
      // silently empty cards. The explicit list keeps `id` a real `memories.id`,
      // which is what the relation batches need.
      const columns = rowsProjection()

      expect(Object.keys(columns)).toEqual([
        'id',
        'userId',
        'title',
        'content',
        'memoryDate',
        'locationName',
        'locationLat',
        'locationLng',
        'weatherTemp',
        'weatherDesc',
        'weatherIcon',
        'musicTrack',
        'musicArtist',
        'musicUrl',
        'musicCover',
        'isPublic',
        'aiNarrative',
        'aiMood',
        'aiThemes',
        'deletedAt',
        'createdAt',
        'updatedAt',
      ])
      expect(columns.id).toBe(memories.id)
      expect(Object.values(columns).some((c) => c === (users.id as unknown))).toBe(false)
      expect(Object.values(columns).some((c) => c === (users.name as unknown))).toBe(false)
      expect(Object.values(columns).some((c) => c === (users.email as unknown))).toBe(false)
    })

    it('selects the same columns when no author is named', async () => {
      await memoriesService.findAll(filters({ search: '@bruce' }))
      const withAuthor = Object.keys(rowsProjection())

      mocks.state.projections = []
      await memoriesService.findAll(filters({ search: 'praia' }))

      // Everything else here pins the *contents* of the list, so this is the one
      // test that fails if the *choice* of list becomes conditional — say
      // `needsAuthorJoin ? <star> : memoryColumns`, which is the shape a
      // future author-search-only projection would take. Under that change the
      // two searches stop agreeing, and the first call above has no column list
      // to read at all, because a bare `select()` is `undefined` to the mock.
      //
      // It cannot catch a list that is merely the wrong constant, and it does
      // not claim to: it guards one specific future regression. What it buys is
      // that the response shape cannot start depending on which search ran, so a
      // client cannot tell an author search from a plain one by looking at a row.
      expect(Object.keys(rowsProjection())).toEqual(withAuthor)
    })

    // The canonical parsed query, so the client renders its chips from what the
    // server actually did instead of re-parsing the raw string. That only holds
    // if the two agree, which is what the precedence test below is for.
    describe('searchMeta', () => {
      it('returns the canonical parsed query so the client does not re-parse it', async () => {
        const result = await memoriesService.findAll(filters({ search: '  #Festa   ano:2026  ' }))

        // The whole object, not a few fields. A key added to `ParsedSearchQuery`
        // has to show up here, and a field the client would read but the server
        // does not send is exactly the divergence this field exists to remove.
        expect(result.searchMeta).toEqual({
          text: [],
          phrases: [],
          author: null,
          tags: ['Festa'],
          year: 2026,
          month: null,
          weather: null,
          location: null,
        })
      })

      it('returns null searchMeta when no search was given', async () => {
        const result = await memoriesService.findAll(filters())

        expect(result.searchMeta).toBeNull()
      })

      it('reports the grammar value, not the param it overrode', async () => {
        const result = await memoriesService.findAll(
          filters({ weather: 'Sol', search: 'clima:chuva' }),
        )

        // The two have to agree, because the chip and the query are the same
        // thing to the person reading them. `Sol` is gone from the response
        // entirely: it is not merged in, not kept under a second key, and the
        // chip says `chuva` — which is what the `ilike '%chuva%'` above
        // actually filtered on. A chip that named `Sol` while the results were
        // `chuva` would be a worse bug than no chip, so the discarded param
        // stays discarded here. Spec §2.3 assigns the mirror-the-query duty to
        // the filter controls (Task 13), not to the response.
        expect(result.searchMeta?.weather).toBe('chuva')
        expect(allOps('ilike')).toEqual([
          { op: 'ilike', col: memories.weatherDesc, pattern: '%chuva%' },
        ])
      })

      it('returns null searchMeta for a query that parses to nothing', async () => {
        // Whitespace and punctuation are both ruled out by the grammar (§2.1:
        // "query vazia ou só com pontuação → sem condições"), so neither produces
        // a filter, and neither gets a meta. Returning the empty object instead
        // would make the client render zero chips off a truthy value, and would
        // make `searchMeta !== null` mean "a search was sent" when the search
        // filtered nothing.
        const blank = await memoriesService.findAll(filters({ search: '   ' }))
        const punctuation = await memoriesService.findAll(filters({ search: '!!!' }))

        expect(blank.searchMeta).toBeNull()
        expect(punctuation.searchMeta).toBeNull()
      })

      it('says nothing about a filter the URL param supplied on its own', async () => {
        // A gap, pinned so it is a decision rather than an oversight:
        // `searchMeta` describes the grammar, and `?year=2024` is not part of
        // the grammar, so this response has no echo of the filter that actually
        // ran. A client rendering chips from `searchMeta` alone would show none
        // for the year. Nothing consumes that today — `/search` builds its query
        // from `q` alone — but any future caller that combines the two has to
        // render its URL-param filters from the URL, not from here.
        const result = await memoriesService.findAll(filters({ year: 2024 }))

        // The filter did run; only the meta is silent about it.
        expect(memoryOps('gte')).toHaveLength(1)
        expect(result.searchMeta).toBeNull()
      })

      it('returns null searchMeta on the early return for mine=true with no user', async () => {
        const result = await memoriesService.findAll(filters({ mine: true, search: '#festa' }))

        // This branch answers before the query is parsed, and the route 401s
        // before it gets here, so no search is ever applied on it. `null` says
        // "nothing was filtered by a query", which keeps the field present in
        // the response shape instead of leaving it `undefined` on one of the two
        // returns — a `searchMeta` that is `null` on the normal path and missing
        // on this one is the kind of difference a client only finds in
        // production.
        expect(result.data).toEqual([])
        expect(result.searchMeta).toBeNull()
      })
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

    it('refuses to update a public memory owned by someone else', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: true }]

      await expect(memoriesService.update('mem-1', 'user-1', { title: 'X' })).rejects.toMatchObject(
        {
          statusCode: 403,
        },
      )
    })
  })

  describe('delete', () => {
    it('refuses to delete a public memory owned by someone else', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: true }]

      await expect(memoriesService.delete('mem-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('deletes a memory owned by the signed-in user', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: false }]

      await expect(memoriesService.delete('mem-1', 'user-1')).resolves.toBeUndefined()
    })

    it('soft-deletes: stamps deletedAt and never removes the row', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: false }]

      await memoriesService.delete('mem-1', 'user-1')

      expect(mocks.state.updates).toHaveLength(1)
      expect(mocks.state.updates[0].deletedAt).toBeInstanceOf(Date)
      expect(mocks.state.hardDeletes).toHaveLength(0)
    })
  })

  describe('restore', () => {
    it('clears deletedAt for a memory the signed-in user owns', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-1', isPublic: false }]

      await memoriesService.restore('mem-1', 'user-1')

      expect(mocks.state.updates).toHaveLength(1)
      expect(mocks.state.updates[0].deletedAt).toBeNull()
      expect(mocks.state.hardDeletes).toHaveLength(0)
    })

    it('refuses to restore a memory owned by someone else', async () => {
      mocks.state.rows = [{ id: 'mem-1', userId: 'user-2', isPublic: false }]

      await expect(memoriesService.restore('mem-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403,
      })
      expect(mocks.state.updates).toHaveLength(0)
    })

    it('reports a missing memory as not found', async () => {
      mocks.state.rows = []

      await expect(memoriesService.restore('gone', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('trash listing', () => {
    it('scopes deleted=true to the owner and flips the predicate to isNotNull', async () => {
      // Without `mine`: the trash is owner-scoped by `deleted=true` alone, so
      // another account's deleted memories can never appear in this list.
      await memoriesService.findAll(filters({ deleted: true }), { userId: 'user-1' })

      expect(mocks.state.memoryConditions[0]).toEqual({
        op: 'and',
        conds: [
          { op: 'eq', col: memories.userId, value: 'user-1' },
          { op: 'isNotNull', col: memories.deletedAt },
        ],
      })
    })

    it('returns an empty page for deleted=true when no user is given', async () => {
      const result = await memoriesService.findAll(filters({ deleted: true }))

      expect(result.data).toEqual([])
      expect(mocks.state.memoryConditions).toHaveLength(0)
    })

    it('keeps the normal feed free of soft-deleted rows', async () => {
      await memoriesService.findAll(filters())

      expect(memoryOps('isNotNull')).toHaveLength(0)
      expect(memoryOps('isNull').map((c) => (c as { col: unknown }).col)).toEqual([
        memories.deletedAt,
      ])
    })
  })
})
