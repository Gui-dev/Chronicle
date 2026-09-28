import { memories, memoryPeople, memoryPhotos, memoryTags } from '@chronicle/db'
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
    fromCalls: [] as string[],
    junctionRows: {} as Record<string, Array<Record<string, unknown>>>,
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
  const gte = (col: unknown, value: unknown) => ({ op: 'gte', col, value })
  const lt = (col: unknown, value: unknown) => ({ op: 'lt', col, value })
  const inArray = (col: unknown, values: unknown) => ({ op: 'inArray', col, values })
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
      mocks.state.fromCalls.push((table as { __table: string }).__table)
      return this
    }

    where(cond: unknown) {
      if (this.projection !== undefined) {
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

    // biome-ignore lint/suspicious/noThenProperty: awaits any terminal node of the variable-length mock chain
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      if (this.projection !== undefined) {
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
    delete: () => ({ where: async () => undefined }),
  }

  return { ...tables, eq, or, and, ilike, sql, desc, asc, gte, lt, inArray, db }
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
    mocks.state.fromCalls = []
    mocks.state.junctionRows = {}
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
      // privacy + the two halves of the year range + search
      expect(condition.conds).toHaveLength(4)
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
      expect(predicates.map((p) => p.op)).toEqual(['inArray', 'inArray', 'inArray'])
      expect(predicates).toHaveLength(3)

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
      // hand every other filter a different meaning.
      expect(memoryOps()[1]).toEqual({
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
      expect(memoryOps().map((c) => (c as RecordedOp).op)).toEqual(['eq', 'sql', 'sql'])
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
      expect(memoryOps().map((c) => (c as RecordedOp).op)).toEqual(['eq', 'sql', 'sql'])
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

      const subquery = memoryOps()[1] as RecordedOp
      expect(subquery.text).toContain('EXISTS')
      // The tag is matched on the tag table only: a title/content ilike here
      // would pass every memory whose text mentions the word.
      expect(allOps('ilike')).toEqual([{ op: 'ilike', col: memoryTags.name, pattern: '%festa%' }])
    })

    it('ANDs the tag param with a #tag named in the query', async () => {
      await memoriesService.findAll(filters({ search: '#bar', tag: 'foo' }))

      // What makes these two conditions rather than one is that each is its own
      // `push` into the same `and(...)`, and nothing merges them: three
      // conditions, both of them `sql`, and no `or` anywhere at that level. The
      // order they are pushed in says nothing about it — moving the `tag` block
      // above the grammar block leaves the query identical — so the tags are
      // compared as a set rather than in sequence.
      const conditions = memoryOps()
      expect(conditions).toHaveLength(3)
      expect(conditions.slice(1).map((c) => (c as RecordedOp).op)).toEqual(['sql', 'sql'])
      expect(conditions.filter((c) => (c as RecordedOp).op === 'or')).toHaveLength(0)

      const tagIlikes = allOps('ilike')
      expect(tagIlikes).toHaveLength(2)
      expect(tagIlikes.map((c) => c.col)).toEqual([memoryTags.name, memoryTags.name])
      expect(tagIlikes.map((c) => c.pattern).sort()).toEqual(['%bar%', '%foo%'])
    })

    it('adds no condition for a query with no searchable token', async () => {
      await memoriesService.findAll(filters({ search: '   ' }))

      // Only the privacy filter survives; no ilike, no EXISTS, no range.
      expect(memoryOps()).toHaveLength(1)
      expect(allOps('ilike')).toHaveLength(0)
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
  })
})
