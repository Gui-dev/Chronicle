# Fase 7.5 — Retrospectivas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five deliveries for the signed-in user: a "Há um ano" strip on the home, period summaries + "new since last visit", a places map, recurrence rankings, and UTC long month markers on the timeline — plus the new `/retrospectivas` dashboard.

**Architecture:** One nullable column `users.last_visit_at` (migration `0005`); new API module `retrospectives` (4 session-guarded routes: `year-ago`, `activity`, `visit`, `overview`) delegating the year-ago window to the existing `memoriesService.findAll` and adding the first GROUP BY aggregations of the codebase; web: `home-retrospect-strip` (read-then-bump), rewritten `timeline-marker`, `/retrospectivas` dashboard with Leaflet (pure, `ssr: false`), navbar entry.

**Tech Stack:** Drizzle/Postgres (migration via `pnpm db:generate` + psql), Fastify, Vitest, Next.js 16 (client components), TanStack Query, Leaflet + CARTO dark tiles, Playwright chromium.

**Spec:** `docs/superpowers/specs/2026-09-30-phase-7-5-retrospectives-design.md` (approved). If a step and the spec disagree, the spec wins — stop and reconcile.

**Notes before starting:**
- Run all commands from the repo root `/home/dracarys/Documents/projects/fullstack/chronicle` unless a step says otherwise.
- `pnpm db:migrate` is broken against the dev DB (known limitation) — migration is applied with `psql`, same as `0002/0003/0004`.
- Never start servers manually for E2E — Playwright's `webServer` manages them. If ports are stuck: `lsof -ti:3000,3333 2>/dev/null | xargs kill -9`.
- Run `pnpm exec biome check --write <changed files>` before every commit (lefthook pre-commit runs biome on staged files).
- UTC everywhere: every date window and label in this phase uses `getUTC*`/`Date.UTC` (spec § contexto, split UTC/local documented in the 7.0 spec).
- Web unit tests do not exist (spec §10) — web verification per task = typecheck + biome; full build and E2E land in Tasks 7/9/10.

---

### Task 1: DB — `lastVisitAt` column + migration 0005

**Files:**
- Modify: `packages/db/src/schema/__tests__/users.test.ts`
- Modify: `packages/db/src/schema/users.ts`
- Create (via generate): `packages/db/src/migrations/0005_*.sql` + `meta/0005_snapshot.json` + `meta/_journal.json` update

- [ ] **Step 1: Write the failing schema test**

In `packages/db/src/schema/__tests__/users.test.ts`, in the `defines the user columns` expected list, append after the `updated_at` entry (the order mirrors where the schema declares the column — Step 3 puts it last):

```ts
      ['created_at', 'PgTimestamp', true],
      ['updated_at', 'PgTimestamp', true],
      ['last_visit_at', 'PgTimestamp', false],
```

- [ ] **Step 2: Run the test, watch it fail**

```bash
pnpm --filter @chronicle/db test
```

`defines the user columns` fails: the actual column list has no `last_visit_at`.

- [ ] **Step 3: Add the column to the schema**

In `packages/db/src/schema/users.ts`, append after `updatedAt`:

```ts
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  // Null until the home strip records the first visit (7.5). No default: a
  // missing stamp must read as "never visited", not as "visited at row creation".
  lastVisitAt: timestamp('last_visit_at', { mode: 'date' }),
```

- [ ] **Step 4: Run the test, watch it pass**

```bash
pnpm --filter @chronicle/db test
```

All db tests pass (schema tests: memories + users).

- [ ] **Step 5: Generate and apply the migration**

```bash
pnpm db:generate
ls packages/db/src/migrations/
```

Expect a new `0005_<name>.sql` + `meta/0005_snapshot.json` + `_journal.json` update. Apply it (read the generated filename from `ls` first):

```bash
PGPASSWORD=chronicle psql -h localhost -U chronicle -d chronicle -f packages/db/src/migrations/0005_<name>.sql
```

- [ ] **Step 6: Verify the column exists**

```bash
PGPASSWORD=chronicle psql -h localhost -U chronicle -d chronicle -c '\d users'
```

`last_visit_at | timestamp without time zone` present, nullable, no default.

- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write packages/db/src/schema/users.ts packages/db/src/schema/__tests__/users.test.ts
git add packages/db
git commit -m "feat(db): add lastVisitAt column to users"
```

---

### Task 2: API — retrospectives service, year-ago/activity/visit (TDD)

**Files:**
- Modify: `packages/db/src/index.ts` (export `ne`)
- Create: `apps/api/src/modules/retrospectives/retrospectives.service.ts`
- Create: `apps/api/src/modules/retrospectives/__tests__/retrospectives.service.spec.ts`

- [ ] **Step 1: Export `ne` from `@chronicle/db`**

`packages/db/src/index.ts` currently re-exports `and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, or, sql` from `drizzle-orm`. Insert `ne` alphabetically (between `lt` and `or`):

```ts
  lt,
  ne,
  or,
```

The activity predicate needs `user_id <> <session>`.

- [ ] **Step 2: Write the failing service spec**

Create `apps/api/src/modules/retrospectives/__tests__/retrospectives.service.spec.ts`:

```ts
import { memories, memoryPeople, memoryTags, users } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { retrospectivesService } from '../retrospectives.service'

const mocks = vi.hoisted(() => ({
  state: {
    // One entry per awaited select, in call order. The overview queries all
    // read from `memories` and return different shapes, so a per-table map
    // cannot tell them apart; a FIFO queue can — and an extra or missing
    // query fails the test instead of silently returning the wrong rows.
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

vi.mock('../memories/memories.service', () => ({
  memoriesService: { findAll: vi.fn() },
}))

const { memoriesService } = await import('../memories/memories.service')

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
  vi.clearAllMocks()
})

describe('RetrospectivesService.yearAgo', () => {
  it('delegates to findAll with owner scope, previous-year month window and limit 3', async () => {
    vi.mocked(memoriesService.findAll).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 3, total: 0, totalPages: 0 },
      searchMeta: null,
    } as unknown as Awaited<ReturnType<typeof memoriesService.findAll>>)

    await retrospectivesService.yearAgo('user-1')

    const now = new Date()
    expect(memoriesService.findAll).toHaveBeenCalledTimes(1)
    const [filters, options] = vi.mocked(memoriesService.findAll).mock.calls[0]
    // The window, the owner scope, the soft-delete filter and the ordering are
    // findAll's tested contract (spec §2.1 mandates delegating); what this pins
    // is that the service picks exactly those parameters.
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
    vi.mocked(memoriesService.findAll).mockResolvedValue({
      data: [item],
      pagination: { page: 1, limit: 3, total: 1, totalPages: 1 },
      searchMeta: null,
    } as unknown as Awaited<ReturnType<typeof memoriesService.findAll>>)

    const result = await retrospectivesService.yearAgo('user-1')

    expect(result).toEqual([item])
  })
})

describe('RetrospectivesService.activity', () => {
  it('answers zero without a count query when the user never visited', async () => {
    mocks.state.queue = [[{ lastVisitAt: null }]]

    const result = await retrospectivesService.activity('user-1')

    expect(result).toEqual({ count: 0, since: null })
    // Exactly one select (the users lookup): if the count query had run, the
    // empty queue would have rejected and the selects list would show it.
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
        // Strictly greater: a memory created in the same instant as the visit
        // is not new (spec §2.2, tie resolved as "not new").
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
    expect(flattenOps(update.condition)).toEqual([
      { op: 'eq', col: users.id, value: 'user-1' },
    ])
  })
})
```

(The overview describe block is appended in Task 3 — the queue mock and helpers above are the scaffolding both tasks share.)

- [ ] **Step 3: Run the test, watch it fail**

```bash
pnpm --filter api test -- retrospectives
```

Fails: `../retrospectives.service` does not exist.

- [ ] **Step 4: Implement the service**

Create `apps/api/src/modules/retrospectives/retrospectives.service.ts`:

```ts
import { and, db, eq, gt, isNull, memories, ne, sql, users } from '@chronicle/db'
import { memoriesService } from '../memories/memories.service'

export class RetrospectivesService {
  // Spec §2.1: `findAll({ mine, year: current−1, month: current })` builds
  // exactly the previous-year-this-month UTC window (dateRange is half-open
  // over `memory_date`), owner-scoped, soft-delete filtered, newest first.
  // The service only picks the parameters and wraps the items.
  async yearAgo(userId: string) {
    const now = new Date()
    const result = await memoriesService.findAll(
      {
        mine: true,
        year: now.getUTCFullYear() - 1,
        month: now.getUTCMonth() + 1,
        page: 1,
        limit: 3,
      },
      { userId },
    )
    return result.data
  }

  // Spec §2.2: read the visit first; only then count. A null stamp short-
  // circuits — "never visited" needs no count query and must not run one.
  async activity(userId: string) {
    const [row] = await db
      .select({ lastVisitAt: users.lastVisitAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    const since = row?.lastVisitAt ?? null
    if (!since) {
      return { count: 0, since: null }
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(
        and(
          eq(memories.isPublic, true),
          ne(memories.userId, userId),
          gt(memories.createdAt, since),
          isNull(memories.deletedAt),
        ),
      )

    // int8 comes back as a string from postgres — callers compare numbers.
    return { count: Number(countRow.count), since: since.toISOString() }
  }

  async visit(userId: string) {
    await db.update(users).set({ lastVisitAt: new Date() }).where(eq(users.id, userId))
  }
}

export const retrospectivesService = new RetrospectivesService()
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter api test -- retrospectives
```

All pass. Then the whole API suite (memories etc. untouched, still green):

```bash
pnpm --filter api test
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter api typecheck
pnpm --filter @chronicle/db typecheck
pnpm exec biome check --write packages/db/src/index.ts apps/api/src/modules/retrospectives
git add packages/db/src/index.ts apps/api/src/modules/retrospectives
git commit -m "feat(api): add retrospectives service for year-ago, activity and visit"
```

---

### Task 3: API — overview aggregation (TDD)

**Files:**
- Modify: `apps/api/src/modules/retrospectives/retrospectives.service.ts`
- Modify: `apps/api/src/modules/retrospectives/__tests__/retrospectives.service.spec.ts`

- [ ] **Step 1: Append the failing overview tests**

Append to `retrospectives.service.spec.ts`:

```ts
describe('RetrospectivesService.overview', () => {
  // Query order is part of the contract: 9 awaits in call order —
  // 0 memories count, 1 people distinct, 2 places distinct, 3 topTags,
  // 4 recurrences.people, 5 recurrences.places, 6 themes rows,
  // 7 years, 8 map places.
  const seedQueue = (overrides?: { themes?: unknown[]; years?: unknown[]; mapPlaces?: unknown[] }) => {
    mocks.state.queue = [
      [{ count: '4' }],
      [{ count: '2' }],
      [{ count: '1' }],
      [
        { name: 'família', count: '2' },
        { name: 'praia', count: '1' },
      ],
      [
        { name: 'Ana', count: '3' },
        { name: 'Bruno', count: '1' },
      ],
      [{ name: 'Recife', count: '2' }],
      overrides?.themes ?? [{ aiThemes: null }],
      overrides?.years ?? [{ year: '2026' }],
      overrides?.mapPlaces ?? [
        { name: 'Recife', lat: '-8.05000000', lng: '-34.90000000', count: '2' },
      ],
    ]
  }

  const hasPeriodBound = (condition: unknown) =>
    flattenOps(condition).some((op) => op.op === 'gte' || op.op === 'lt')

  it('defaults to the current UTC year over the whole year', async () => {
    seedQueue()

    const result = await retrospectivesService.overview('user-1')

    const now = new Date()
    expect(result.period).toEqual({ year: now.getUTCFullYear(), month: null })
    const ops = flattenOps(mocks.state.selects[0].condition)
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'gte', col: memories.memoryDate, value: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) },
        { op: 'lt', col: memories.memoryDate, value: new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1)) },
        { op: 'eq', col: memories.userId, value: 'user-1' },
        { op: 'isNull', col: memories.deletedAt },
      ]),
    )
  })

  it('scopes a month as a half-open UTC range', async () => {
    seedQueue()

    const result = await retrospectivesService.overview('user-1', 2025, 9)

    expect(result.period).toEqual({ year: 2025, month: 9 })
    const ops = flattenOps(mocks.state.selects[0].condition)
    expect(ops).toEqual(
      expect.arrayContaining([
        { op: 'gte', col: memories.memoryDate, value: new Date(Date.UTC(2025, 8, 1)) },
        { op: 'lt', col: memories.memoryDate, value: new Date(Date.UTC(2025, 9, 1)) },
      ]),
    )
  })

  it('keeps the period on summary/recurrences but drops it for years and map places', async () => {
    seedQueue()

    await retrospectivesService.overview('user-1', 2025, 9)

    const selects = mocks.state.selects
    expect(selects).toHaveLength(9)
    // 0..6: summary + recurrences + themes are period-scoped
    for (const index of [0, 1, 2, 3, 4, 5, 6]) {
      expect(hasPeriodBound(selects[index].condition)).toBe(true)
    }
    // 7..8: years and map places are all-time (spec §2.4, §10)
    expect(hasPeriodBound(selects[7].condition)).toBe(false)
    expect(hasPeriodBound(selects[8].condition)).toBe(false)
    // Every query is owner-scoped with the soft-delete filter
    for (const select of selects) {
      const ops = flattenOps(select.condition)
      expect(ops).toEqual(expect.arrayContaining([{ op: 'eq', col: memories.userId, value: 'user-1' }]))
      expect(ops).toEqual(expect.arrayContaining([{ op: 'isNull', col: memories.deletedAt }]))
    }
    // The two join-based counts go through memory_people / memory_tags
    expect(mocks.state.joins.map((join) => join.table)).toEqual([
      'memories',
      'memories',
      'memories',
    ])
  })

  it('orders top tags count desc name asc (limit 3) and recurrences limit 5', async () => {
    seedQueue()

    await retrospectivesService.overview('user-1', 2025)

    expect(mocks.state.limits).toEqual([3, 5, 5])
    const tagOrder = mocks.state.orderBys.find((order) => order.table === 'memoryTags')
    expect(tagOrder?.args.map((arg) => (arg as { dir: string }).dir)).toEqual(['desc', 'asc'])
    expect((tagOrder?.args[1] as { expr: unknown }).expr).toBe(memoryTags.name)
    const peopleOrder = mocks.state.orderBys.find((order) => order.table === 'memoryPeople')
    expect(peopleOrder?.args.map((arg) => (arg as { dir: string }).dir)).toEqual(['desc', 'asc'])
    const memoriesOrders = mocks.state.orderBys.filter((order) => order.table === 'memories')
    expect(memoriesOrders).toHaveLength(2)
    for (const order of memoriesOrders) {
      expect(order.args.map((arg) => (arg as { dir: string }).dir)).toEqual(['desc', 'asc'])
    }
    // Grouping happens on the name columns
    expect(mocks.state.groups.map((group) => group.table)).toEqual([
      'memoryTags',
      'memoryPeople',
      'memories',
      'memories',
    ])
  })

  it('flattens aiThemes deterministically, skips nulls and slices to top 5', async () => {
    seedQueue({
      themes: [
        { aiThemes: ['família', 'sol'] },
        { aiThemes: ['família', 'viagem'] },
        { aiThemes: ['praia'] },
        { aiThemes: null },
        { aiThemes: ['viagem', 'família', 'praia', 'sol'] },
        { aiThemes: ['luz'] },
      ],
    })

    const result = await retrospectivesService.overview('user-1', 2025)

    // família 3, praia 2, sol 2, viagem 2, luz 1 — ties by name asc; sixth
    // distinct theme (if any) would fall past the slice.
    expect(result.recurrences.themes).toEqual([
      { name: 'família', count: 3 },
      { name: 'praia', count: 2 },
      { name: 'sol', count: 2 },
      { name: 'viagem', count: 2 },
      { name: 'luz', count: 1 },
    ])
  })

  it('returns summary numbers, years desc and map places with numeric coords', async () => {
    seedQueue({
      years: [{ year: '2024' }, { year: '2026' }, { year: '2024' }],
    })

    const result = await retrospectivesService.overview('user-1', 2025)

    expect(result.summary).toEqual({
      memories: 4,
      people: 2,
      places: 1,
      topTags: [
        { name: 'família', count: 2 },
        { name: 'praia', count: 1 },
      ],
    })
    expect(result.recurrences.people).toEqual([
      { name: 'Ana', count: 3 },
      { name: 'Bruno', count: 1 },
    ])
    expect(result.recurrences.places).toEqual([{ name: 'Recife', count: 2 }])
    // Descending and deduped (spec §5 wants most recent first; §2.4's example
    // row is illustrative — the selector needs desc).
    expect(result.years).toEqual([2026, 2024])
    // Decimal columns are strings in Postgres; the API promises numbers.
    expect(result.places).toEqual([
      { name: 'Recife', lat: -8.05, lng: -34.9, count: 2 },
    ])
  })

  it('rejects an empty queue when a query appears or disappears', async () => {
    seedQueue()
    mocks.state.queue.pop()

    await expect(retrospectivesService.overview('user-1', 2025)).rejects.toThrow(
      /empty queue/,
    )
  })
})
```

- [ ] **Step 2: Run the tests, watch them fail**

```bash
pnpm --filter api test -- retrospectives
```

The overview describe fails: `overview is not a function`.

- [ ] **Step 3: Implement `overview`**

Extend `retrospectives.service.ts` — new imports (merge into the existing import):

```ts
import {
  and,
  asc,
  db,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  memories,
  memoryPeople,
  memoryTags,
  ne,
  sql,
  users,
} from '@chronicle/db'
```

Add the method to the class (after `visit`):

```ts
  // Spec §2.4: period-scoped summary and recurrences, all-time years and map
  // places, everything owner-scoped. The range mirrors memories.service's
  // dateRange — half-open UTC bounds over the raw column (sargable).
  // The query order below is pinned by the queue mock in the spec; a new
  // query or a reordering fails that test on purpose.
  async overview(userId: string, year?: number, month?: number) {
    const effectiveYear = year ?? new Date().getUTCFullYear()
    const start = new Date(Date.UTC(effectiveYear, (month ?? 1) - 1, 1))
    const end = month
      ? new Date(Date.UTC(effectiveYear, month, 1))
      : new Date(Date.UTC(effectiveYear + 1, 0, 1))

    const owned = and(eq(memories.userId, userId), isNull(memories.deletedAt))
    const inPeriod = and(owned, gte(memories.memoryDate, start), lt(memories.memoryDate, end))

    const [memRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(inPeriod)

    const [peopleRow] = await db
      .select({ count: sql<number>`count(distinct ${memoryPeople.name})` })
      .from(memoryPeople)
      .innerJoin(memories, eq(memoryPeople.memoryId, memories.id))
      .where(inPeriod)

    const [placesRow] = await db
      .select({ count: sql<number>`count(distinct ${memories.locationName})` })
      .from(memories)
      .where(and(inPeriod, isNotNull(memories.locationName)))

    const topTagRows = await db
      .select({ name: memoryTags.name, count: sql<number>`count(*)` })
      .from(memoryTags)
      .innerJoin(memories, eq(memoryTags.memoryId, memories.id))
      .where(inPeriod)
      .groupBy(memoryTags.name)
      .orderBy(desc(sql`count(*)`), asc(memoryTags.name))
      .limit(3)

    const recPeopleRows = await db
      .select({ name: memoryPeople.name, count: sql<number>`count(*)` })
      .from(memoryPeople)
      .innerJoin(memories, eq(memoryPeople.memoryId, memories.id))
      .where(inPeriod)
      .groupBy(memoryPeople.name)
      .orderBy(desc(sql`count(*)`), asc(memoryPeople.name))
      .limit(5)

    const recPlacesRows = await db
      .select({ name: memories.locationName, count: sql<number>`count(*)` })
      .from(memories)
      .where(and(inPeriod, isNotNull(memories.locationName)))
      .groupBy(memories.locationName)
      .orderBy(desc(sql`count(*)`), asc(memories.locationName))
      .limit(5)

    const themeRows = await db.select({ aiThemes: memories.aiThemes }).from(memories).where(inPeriod)

    // Flattened here instead of SQL `unnest`: same result set, no raw-SQL
    // construct, and the rows are one user's period (seq-scan scale, §10).
    const themeCounts = new Map<string, number>()
    for (const row of themeRows) {
      for (const theme of row.aiThemes ?? []) {
        themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1)
      }
    }
    const themes = [...themeCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      // count DESC, then name ASC by code unit — deterministic across locales
      // (localeCompare would follow the runtime's collation).
      .sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .slice(0, 5)

    const yearRows = await db
      .selectDistinct({ year: sql<number>`extract(year from ${memories.memoryDate})` })
      .from(memories)
      .where(owned)

    const placeRows = await db
      .select({
        name: memories.locationName,
        lat: memories.locationLat,
        lng: memories.locationLng,
        count: sql<number>`count(*)`,
      })
      .from(memories)
      .where(and(owned, isNotNull(memories.locationName)))
      .groupBy(memories.locationName, memories.locationLat, memories.locationLng)
      .orderBy(desc(sql`count(*)`), asc(memories.locationName))

    return {
      period: { year: effectiveYear, month: month ?? null },
      years: [...new Set(yearRows.map((row) => Number(row.year)))].sort((a, b) => b - a),
      summary: {
        memories: Number(memRow.count),
        people: Number(peopleRow.count),
        places: Number(placesRow.count),
        topTags: topTagRows.map((row) => ({ name: row.name, count: Number(row.count) })),
      },
      recurrences: {
        people: recPeopleRows.map((row) => ({ name: row.name, count: Number(row.count) })),
        places: recPlacesRows.map((row) => ({ name: row.name, count: Number(row.count) })),
        themes,
      },
      places: placeRows.map((row) => ({
        // Non-null by the predicate above; the select cannot express it.
        name: row.name as string,
        lat: Number(row.lat),
        lng: Number(row.lng),
        count: Number(row.count),
      })),
    }
  }
```

- [ ] **Step 4: Run the tests**

```bash
pnpm --filter api test -- retrospectives
```

All describes green (the empty-queue pin included).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter api typecheck
pnpm exec biome check --write apps/api/src/modules/retrospectives
git add apps/api/src/modules/retrospectives
git commit -m "feat(api): add overview aggregation to retrospectives service"
```

---

### Task 4: API — routes + registration + integration tests

**Files:**
- Create: `apps/api/src/modules/retrospectives/retrospectives.routes.ts`
- Create: `apps/api/src/modules/retrospectives/index.ts`
- Modify: `apps/api/src/server.ts`
- Create: `apps/api/src/modules/retrospectives/__tests__/retrospectives.integration.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `apps/api/src/modules/retrospectives/__tests__/retrospectives.integration.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../retrospectives.service', () => ({
  retrospectivesService: {
    yearAgo: vi.fn(),
    activity: vi.fn(),
    visit: vi.fn(),
    overview: vi.fn(),
  },
}))

vi.mock('../../../env', () => ({
  env: {
    PORT: 3333,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chronicle_test',
    BETTER_AUTH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}))

const { auth } = await import('@chronicle/auth')
const { retrospectivesService } = await import('../retrospectives.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(retrospectivesService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

const overviewData = {
  period: { year: 2026, month: null },
  years: [2026],
  summary: { memories: 0, people: 0, places: 0, topTags: [] },
  recurrences: { people: [], places: [], themes: [] },
  places: [],
}

describe('Retrospectives Integration Tests', () => {
  let server: ReturnType<typeof buildServer>

  beforeAll(async () => {
    server = buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    signOut()
    service.yearAgo.mockResolvedValue([])
    service.activity.mockResolvedValue({ count: 0, since: null })
    service.visit.mockResolvedValue(undefined)
    service.overview.mockResolvedValue(
      overviewData as unknown as Awaited<ReturnType<typeof service.overview>>,
    )
  })

  it('answers 401 on all four routes without a session', async () => {
    const responses = await Promise.all([
      server.inject({ method: 'GET', url: '/api/retrospectives/year-ago' }),
      server.inject({ method: 'GET', url: '/api/retrospectives/activity' }),
      server.inject({ method: 'POST', url: '/api/retrospectives/visit' }),
      server.inject({ method: 'GET', url: '/api/retrospectives/overview' }),
    ])

    for (const response of responses) {
      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }
    expect(service.yearAgo).not.toHaveBeenCalled()
    expect(service.activity).not.toHaveBeenCalled()
    expect(service.visit).not.toHaveBeenCalled()
    expect(service.overview).not.toHaveBeenCalled()
  })

  it('serves year-ago for the session user', async () => {
    signIn('user-7')
    service.yearAgo.mockResolvedValue([{ id: 'mem-1', title: 'Carnaval' }] as never)

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/year-ago' })

    expect(response.statusCode).toBe(200)
    expect(service.yearAgo).toHaveBeenCalledWith('user-7')
    expect(response.json().data).toHaveLength(1)
    expect(response.json().data[0].title).toBe('Carnaval')
  })

  it('serves activity for the session user', async () => {
    signIn('user-7')
    service.activity.mockResolvedValue({ count: 3, since: '2026-09-01T12:00:00.000Z' })

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/activity' })

    expect(response.statusCode).toBe(200)
    expect(service.activity).toHaveBeenCalledWith('user-7')
    expect(response.json()).toEqual({
      data: { count: 3, since: '2026-09-01T12:00:00.000Z' },
    })
  })

  it('records the visit and answers 204', async () => {
    signIn('user-7')

    const response = await server.inject({ method: 'POST', url: '/api/retrospectives/visit' })

    expect(response.statusCode).toBe(204)
    expect(service.visit).toHaveBeenCalledWith('user-7')
    expect(response.body).toBe('')
  })

  it('serves overview with default period arguments', async () => {
    signIn('user-7')

    const response = await server.inject({ method: 'GET', url: '/api/retrospectives/overview' })

    expect(response.statusCode).toBe(200)
    expect(service.overview).toHaveBeenCalledWith('user-7', undefined, undefined)
    expect(response.json().data.period).toEqual({ year: 2026, month: null })
  })

  it('passes validated year and month through', async () => {
    signIn('user-7')

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?year=2025&month=9',
    })

    expect(response.statusCode).toBe(200)
    expect(service.overview).toHaveBeenCalledWith('user-7', 2025, 9)
  })

  it('answers 400 without calling the service for a non-numeric year', async () => {
    signIn()

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?year=abc',
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe('VALIDATION_ERROR')
    expect(service.overview).not.toHaveBeenCalled()
  })

  it('answers 400 for a month outside 1-12', async () => {
    signIn()

    const response = await server.inject({
      method: 'GET',
      url: '/api/retrospectives/overview?month=0',
    })

    expect(response.statusCode).toBe(400)
    expect(service.overview).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests, watch them fail**

```bash
pnpm --filter api test -- retrospectives
```

The integration describe fails: the routes are not registered (404s).

- [ ] **Step 3: Write the routes**

Create `apps/api/src/modules/retrospectives/retrospectives.routes.ts`:

```ts
import { auth } from '@chronicle/auth'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { retrospectivesService } from './retrospectives.service'

async function currentUserId(request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  })
  return session ? session.user.id : null
}

// Mirrors memoryFiltersSchema's year bounds (2000-2100) so a bad year behaves
// the same on both endpoints. month 1-12; absent = whole year (spec §2.4).
const overviewQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
})

const UNAUTHORIZED = {
  error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
} as const

export async function retrospectivesRoutes(fastify: FastifyInstance) {
  // GET /api/retrospectives/year-ago — home strip "Há um ano" (owner only).
  fastify.get('/api/retrospectives/year-ago', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const data = await retrospectivesService.yearAgo(userId)
    return reply.send({ data })
  })

  // GET /api/retrospectives/activity — just the count and the stamp (§2.2).
  fastify.get('/api/retrospectives/activity', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const data = await retrospectivesService.activity(userId)
    return reply.send({ data })
  })

  // POST /api/retrospectives/visit — bump lastVisitAt, 204 (§2.3).
  fastify.post('/api/retrospectives/visit', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    await retrospectivesService.visit(userId)
    return reply.status(204).send()
  })

  // GET /api/retrospectives/overview?year=&month= — the dashboard (§2.4).
  // The parse throws ZodError, which the root error handler maps to 400.
  fastify.get('/api/retrospectives/overview', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send(UNAUTHORIZED)
    }
    const query = overviewQuerySchema.parse(request.query)
    const data = await retrospectivesService.overview(userId, query.year, query.month)
    return reply.send({ data })
  })
}
```

Create `apps/api/src/modules/retrospectives/index.ts`:

```ts
export { retrospectivesRoutes } from './retrospectives.routes'
```

- [ ] **Step 4: Register the routes in `server.ts`**

In `apps/api/src/server.ts`:

1. Add the import next to the other module imports (alphabetical: after `photosRoutes`, before `shareRoutes`):

```ts
import { retrospectivesRoutes } from './modules/retrospectives'
```

2. Register after `shareRoutes` (line ~65):

```ts
  server.register(shareRoutes)
  server.register(retrospectivesRoutes)
```

- [ ] **Step 5: Run the tests**

```bash
pnpm --filter api test -- retrospectives
```

Green. Full API suite:

```bash
pnpm --filter api test
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter api typecheck
pnpm exec biome check --write apps/api/src/modules/retrospectives apps/api/src/server.ts
git add apps/api/src/modules/retrospectives apps/api/src/server.ts
git commit -m "feat(api): add retrospectives routes with session guard"
```

---

### Task 5: Web — home strip (year-ago + activity + visit bump)

**Files:**
- Create: `apps/web/src/hooks/use-year-ago.ts`
- Create: `apps/web/src/hooks/use-activity.ts`
- Create: `apps/web/src/hooks/use-visit.ts`
- Create: `apps/web/src/components/home-retrospect-strip.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: The three hooks**

`apps/web/src/hooks/use-year-ago.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import type { Memory } from '@/hooks/use-memories'
import { useQuery } from '@tanstack/react-query'

export function useYearAgo() {
  return useQuery<{ data: Memory[] }>({
    queryKey: ['retro', 'year-ago'],
    queryFn: () => api.get<{ data: Memory[] }>('/api/retrospectives/year-ago'),
    // The window moves with the clock; a cached answer from yesterday's mount
    // could hide a memory that entered the month today.
    staleTime: 0,
  })
}
```

`apps/web/src/hooks/use-activity.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export function useActivity() {
  return useQuery<{ data: { count: number; since: string | null } }>({
    queryKey: ['retro', 'activity'],
    queryFn: () =>
      api.get<{ data: { count: number; since: string | null } }>('/api/retrospectives/activity'),
    // Never cached across mounts: after the bump the next mount must read 0.
    staleTime: 0,
  })
}
```

`apps/web/src/hooks/use-visit.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import { useMutation } from '@tanstack/react-query'

// Fire-and-forget bump of `lastVisitAt`, once per home mount, always after the
// activity read succeeded (read-then-write, spec §3). Deliberately no
// invalidation: refetching `activity` in the same mount would replace the
// count the strip is showing with the post-bump zero.
export function useVisit() {
  return useMutation({
    mutationFn: () => api.post('/api/retrospectives/visit'),
  })
}
```

- [ ] **Step 2: The strip component**

Create `apps/web/src/components/home-retrospect-strip.tsx`:

```tsx
'use client'

import { useActivity } from '@/hooks/use-activity'
import { useVisit } from '@/hooks/use-visit'
import { useYearAgo } from '@/hooks/use-year-ago'
import { useEffect } from 'react'

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

// Lowercase weekday, PT, for "desde terça" (spec §3). UTC: the stamp is a UTC
// instant and a local day could disagree around midnight.
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function formatUtcMonthYear(dateStr: string): string {
  const d = new Date(dateStr)
  return `${MONTH_NAMES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function HomeRetrospectStrip() {
  const yearAgo = useYearAgo()
  const activity = useActivity()
  const visit = useVisit()
  const { mutate: bumpVisit } = visit

  // The one deliberate useEffect of this phase (AGENTS "avoid useEffect"
  // exception, spec §3): a mount-time fire-and-forget side effect. Deps are
  // `bumpVisit` (stable identity in TanStack) + the success flag, so StrictMode
  // may run it twice — idempotent, it writes `now` twice.
  useEffect(() => {
    if (activity.isSuccess) {
      bumpVisit()
    }
  }, [activity.isSuccess, bumpVisit])

  const count = activity.data?.data.count ?? 0
  const since = activity.data?.data.since
  const items = yearAgo.data?.data ?? []
  const isLoading = yearAgo.isLoading || activity.isLoading
  const hasError = yearAgo.isError || activity.isError

  if (isLoading) {
    return (
      <div
        data-testid="retro-strip-loading"
        className="mb-6 h-20 animate-pulse rounded-xl border border-card bg-card"
      />
    )
  }

  if (hasError) {
    // Never fall through to the empty state on failure (lesson from 7.4).
    return (
      <p data-testid="retro-strip-error" className="mb-6 text-sm text-muted">
        Não foi possível carregar a retrospectiva.
      </p>
    )
  }

  const showNew = count > 0 && since !== null
  const showYearAgo = items.length > 0

  if (!showNew && !showYearAgo) {
    return null
  }

  const weekday = since ? WEEKDAYS[new Date(since).getUTCDay()] : ''
  const newLabel =
    count === 1 ? `1 memória nova desde ${weekday}` : `${count} memórias novas desde ${weekday}`

  return (
    <div
      data-testid="retro-strip"
      className="mb-6 flex items-stretch gap-4 rounded-xl border border-card bg-card p-4"
    >
      {showNew && (
        <button
          type="button"
          data-testid="retro-new"
          onClick={() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex shrink-0 flex-col justify-center rounded-lg border border-primary/40 px-3 py-2 text-left transition-colors hover:bg-primary/10"
        >
          <span data-testid="retro-new-count" className="text-sm font-semibold text-primary">
            {newLabel}
          </span>
          <span data-testid="retro-new-go" className="mt-0.5 text-xs text-muted">
            Ver na timeline →
          </span>
        </button>
      )}

      {showNew && showYearAgo && <div className="w-px shrink-0 bg-card" aria-hidden="true" />}

      {showYearAgo && (
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          {items.map((memory) => (
            <div
              key={memory.id}
              data-testid={`retro-year-ago-${memory.id}`}
              className="shrink-0 rounded-lg border border-card/60 bg-background px-3 py-2"
            >
              <p data-testid="retro-year-ago-title" className="max-w-40 truncate text-sm text-text">
                {memory.title}
              </p>
              <p data-testid="retro-year-ago-date" className="mt-0.5 text-xs text-muted">
                {formatUtcMonthYear(memory.memoryDate)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Note: mini-cards are informational only — the detail page was removed in 6.3 (spec §10), so there is no link/click on them.

- [ ] **Step 3: Wire the strip and the scroll target into the home page**

In `apps/web/src/app/(dashboard)/page.tsx`:

1. Add imports:

```tsx
import { HomeRetrospectStrip } from '@/components/home-retrospect-strip'
```

2. Render the strip between the header block and `<MemoryFilters>` (only for the signed-in user — the API 401s otherwise):

```tsx
      </div>

      {isAuthenticated && <HomeRetrospectStrip />}

      <MemoryFilters filters={filters} onFilterChange={setFilter} onReset={resetFilters} />
```

3. Wrap the timeline so the strip's "Ver na timeline" has a scroll target:

```tsx
      <div id="timeline">
        <MemoryTimeline
          memories={memories}
          pagination={pagination}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          onPageChange={setPage}
          emptyTitle={...}
          emptyDescription={...}
        />
      </div>
```

- [ ] **Step 4: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src/hooks/use-year-ago.ts apps/web/src/hooks/use-activity.ts apps/web/src/hooks/use-visit.ts apps/web/src/components/home-retrospect-strip.tsx "apps/web/src/app/(dashboard)/page.tsx"
git add apps/web/src
git commit -m "feat(web): add year-ago and activity strip on home"
```

---

### Task 6: Web — timeline month markers

**Files:**
- Modify: `apps/web/src/components/timeline-marker.tsx`
- Modify: `apps/web/src/components/memory-timeline.tsx`

- [ ] **Step 1: Rewrite the marker (dead component, UTC long label)**

Replace `apps/web/src/components/timeline-marker.tsx` entirely:

```tsx
const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

interface TimelineMarkerProps {
  date: string
}

// Month header for the timeline: `setembro de 2026`, UTC (spec §4, decision
// 11). Deliberately not toLocaleDateString — a local timezone would move a
// card across the month boundary near midnight, disagreeing with the UTC
// windows the API filters on. This component was dead code before 7.5; the
// old `set. 2026` local format and the isLast rule/vertical-line visuals are
// gone with the rewrite.
export function TimelineMarker({ date }: TimelineMarkerProps) {
  const d = new Date(date)
  const label = `${MONTH_NAMES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`

  return (
    <div
      data-testid="timeline-marker"
      className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted"
    >
      {label}
    </div>
  )
}
```

- [ ] **Step 2: Group cards by (UTC year, month) in the timeline**

In `apps/web/src/components/memory-timeline.tsx`:

1. Add the import:

```tsx
import { TimelineMarker } from '@/components/timeline-marker'
```

2. Add the helper next to `TimelineSkeleton`:

```tsx
function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`
}
```

3. In the card loop, render the marker before the first card of each UTC month (the distance lines stay exactly as they are — decision 11):

```tsx
        {memories.map((memory, index) => (
          <div key={memory.id}>
            {(index === 0 ||
              monthKey(memories[index - 1].memoryDate) !== monthKey(memory.memoryDate)) && (
              <TimelineMarker date={memory.memoryDate} />
            )}
            {index > 0 && (
              <div className="my-6 flex items-center gap-3 pl-4">
                ...unchanged distance line...
              </div>
            )}
            <MemoryCardFull memory={memory} isOwner={user?.id === memory.userId} />
          </div>
        ))}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src/components/timeline-marker.tsx apps/web/src/components/memory-timeline.tsx
git add apps/web/src/components
git commit -m "feat(web): group timeline under UTC month markers"
```

---

### Task 7: Web — `/retrospectivas` dashboard + Leaflet map

**Files:**
- Modify: `apps/web/package.json` (leaflet deps)
- Create: `apps/web/src/hooks/use-overview.ts`
- Create: `apps/web/src/components/retrospect-map.tsx`
- Create: `apps/web/src/app/(dashboard)/retrospectivas/page.tsx`

- [ ] **Step 1: Install Leaflet (pure — no react-leaflet, spec §6)**

```bash
pnpm --filter web add leaflet
pnpm --filter web add -D @types/leaflet
```

- [ ] **Step 2: The overview hook**

Create `apps/web/src/hooks/use-overview.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export interface OverviewCount {
  name: string
  count: number
}

export interface OverviewResponse {
  period: { year: number; month: number | null }
  years: number[]
  summary: {
    memories: number
    people: number
    places: number
    topTags: OverviewCount[]
  }
  recurrences: {
    people: OverviewCount[]
    places: OverviewCount[]
    themes: OverviewCount[]
  }
  places: Array<{ name: string; lat: number; lng: number; count: number }>
}

export function useOverview(year: number | undefined, month: number | undefined) {
  return useQuery<{ data: OverviewResponse }>({
    queryKey: ['retro', 'overview', { year, month }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (year !== undefined) params.set('year', String(year))
      if (month !== undefined) params.set('month', String(month))
      const qs = params.toString()
      // No params = server default (current UTC year, whole year).
      return api.get<{ data: OverviewResponse }>(
        `/api/retrospectives/overview${qs ? `?${qs}` : ''}`,
      )
    },
    staleTime: 0,
  })
}
```

- [ ] **Step 3: The map component**

Create `apps/web/src/components/retrospect-map.tsx`:

```tsx
'use client'

import type * as LeafletNamespace from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'

export interface MapPlace {
  name: string
  lat: number
  lng: number
  count: number
}

interface RetrospectMapProps {
  places: MapPlace[]
}

// Leaflet runs on `window`, so the page loads this with next/dynamic ssr:false
// (spec §6). Tiles are CARTO dark to match the Chronicle palette; when they
// fail (offline/CI) the container stays and the place list below keeps working.
export default function RetrospectMap({ places }: RetrospectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletNamespace.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let map: LeafletNamespace.Map | undefined

    void (async () => {
      const L = await import('leaflet')
      if (disposed || !containerRef.current) return

      map = L.map(containerRef.current)

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // divIcon keeps the gold pin out of the bundle (no Leaflet PNGs).
      const icon = L.divIcon({
        className: '',
        html: '<span style="display:block;width:14px;height:14px;border-radius:50%;background:#f0c040;border:2px solid #0a0a0f;box-shadow:0 0 6px rgba(240,192,64,0.8)"></span>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      for (const place of places) {
        L.marker([place.lat, place.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `${place.name} — ${place.count} ${place.count === 1 ? 'memória' : 'memórias'}`,
          )
      }

      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], 10)
      } else {
        const bounds = L.latLngBounds(places.map((place) => [place.lat, place.lng] as [number, number]))
        map.fitBounds(bounds, { padding: [24, 24] })
      }

      if (disposed) {
        // Unmounted while the import resolved — do not leak the instance.
        map.remove()
        map = undefined
        return
      }
      mapRef.current = map
    })()

    return () => {
      disposed = true
      map?.remove()
      mapRef.current = null
    }
  }, [places])

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        data-testid="retro-map"
        className="h-96 overflow-hidden rounded-xl border border-card lg:h-[480px]"
      />
      {/* The list is the keyboard path to a place (flyTo), spec §6. */}
      <ul data-testid="retro-place-list" className="space-y-2">
        {places.map((place, index) => (
          <li key={`${place.name}-${place.lat}-${place.lng}`}>
            <button
              type="button"
              data-testid={`retro-place-${index}`}
              onClick={() => {
                const map = mapRef.current
                if (map) map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 10))
              }}
              className="flex w-full items-center justify-between rounded-lg border border-card bg-card px-3 py-2 text-left text-sm text-text transition-colors hover:border-primary hover:text-primary"
            >
              <span className="truncate">
                {place.name} — {place.count} {place.count === 1 ? 'memória' : 'memórias'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

If `import type * as LeafletNamespace from 'leaflet'` or `await import('leaflet')` disagrees with the installed typings at typecheck time, adapt the import shape to what `@types/leaflet` exposes (default vs named) — the behavior above stays fixed. If `next build` rejects the stylesheet import inside the component, move `import 'leaflet/dist/leaflet.css'` to `apps/web/src/app/layout.tsx` (App Router allows global CSS there) — note the move in the commit message.

- [ ] **Step 4: The page**

Create `apps/web/src/app/(dashboard)/retrospectivas/page.tsx`:

```tsx
'use client'

import { RequireAuth } from '@/components/require-auth'
import { type OverviewCount, type OverviewResponse, useOverview } from '@/hooks/use-overview'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const RetrospectMap = dynamic(() => import('@/components/retrospect-map'), { ssr: false })

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const selectClass =
  'rounded-lg border border-card bg-card px-3 py-2 text-sm text-text focus:border-primary focus:outline-none'

export default function RetrospectivasPage() {
  return (
    <RequireAuth>
      <RetrospectivasContent />
    </RequireAuth>
  )
}

function RetrospectivasContent() {
  // undefined = "let the server default speak" — the served period is the
  // source of truth for the selects, local state only records user intent.
  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)
  const { data, isLoading, isError, refetch } = useOverview(year, month)
  const overview = data?.data

  const servedYear = overview?.period.year ?? new Date().getUTCFullYear()
  const yearOptions = overview
    ? [...new Set([servedYear, ...overview.years])].sort((a, b) => b - a)
    : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-text">Retrospectivas</h1>
        {overview && (
          <div className="flex gap-2">
            <select
              data-testid="retro-year"
              aria-label="Ano"
              className={selectClass}
              value={String(year ?? servedYear)}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              data-testid="retro-month"
              aria-label="Mês"
              className={selectClass}
              value={month !== undefined ? String(month) : ''}
              onChange={(event) =>
                setMonth(event.target.value === '' ? undefined : Number(event.target.value))
              }
            >
              <option value="">Todos os meses</option>
              {MONTH_NAMES.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && (
        <div
          data-testid="retro-loading"
          className="h-40 animate-pulse rounded-xl border border-card bg-card"
        />
      )}

      {isError && !isLoading && (
        <div
          data-testid="retro-error"
          className="flex flex-col items-center gap-3 rounded-xl border border-card bg-card py-10"
        >
          <p className="text-sm text-muted">Erro ao carregar as retrospectivas.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-primary underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {overview && !isLoading && !isError && <OverviewBody overview={overview} />}
    </div>
  )
}

function OverviewBody({ overview }: { overview: OverviewResponse }) {
  const empty = overview.summary.memories === 0

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {empty ? (
          <div
            data-testid="retro-empty"
            className="rounded-xl border-2 border-dashed border-card py-12 text-center text-sm text-muted"
          >
            Nenhuma memória no período.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                testid="retro-stat-memories"
                label="Memórias"
                value={overview.summary.memories}
              />
              <StatCard testid="retro-stat-people" label="Pessoas" value={overview.summary.people} />
              <StatCard testid="retro-stat-places" label="Lugares" value={overview.summary.places} />
              <div
                data-testid="retro-stat-top-tags"
                className="rounded-xl border border-card bg-card p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-muted">Top tags</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {overview.summary.topTags.length === 0 ? (
                    <span className="text-sm text-muted">—</span>
                  ) : (
                    overview.summary.topTags.map((tag) => (
                      <span
                        key={tag.name}
                        className="rounded-full bg-background px-2 py-0.5 text-xs text-primary"
                      >
                        #{tag.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <RecurrenceCard
                testid="retro-rec-people"
                title="Pessoas"
                items={overview.recurrences.people}
              />
              <RecurrenceCard
                testid="retro-rec-places"
                title="Lugares"
                items={overview.recurrences.places}
              />
              <RecurrenceCard
                testid="retro-rec-themes"
                title="Temas"
                items={overview.recurrences.themes}
                note="contagem só de memórias com narrativa gerada"
              />
            </div>
          </>
        )}
      </div>

      {/* All-time map: it does not belong to the period, so it stays even when
          the period card is empty (spec §5). */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        {overview.places.length > 0 ? (
          <RetrospectMap places={overview.places} />
        ) : (
          <div
            data-testid="retro-map-empty"
            className="rounded-xl border border-card bg-card p-6 text-sm text-muted"
          >
            Nenhum lugar com localização registrada.
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ testid, label, value }: { testid: string; label: string; value: number }) {
  return (
    <div data-testid={testid} className="rounded-xl border border-card bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  )
}

function RecurrenceCard({
  testid,
  title,
  items,
  note,
}: {
  testid: string
  title: string
  items: OverviewCount[]
  note?: string
}) {
  return (
    <div data-testid={testid} className="rounded-xl border border-card bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Sem dados no período</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.name} className="truncate text-sm text-text">
              {item.name} ×{item.count}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Verify — typecheck, biome, and a web build here (CSS/dynamic import)**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src/hooks/use-overview.ts apps/web/src/components/retrospect-map.tsx "apps/web/src/app/(dashboard)/retrospectivas/page.tsx" apps/web/package.json
pnpm --filter web build
```

The build must pass (it catches the Leaflet CSS import and the `dynamic(..., { ssr: false })` wiring before the gate run).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): add retrospectives dashboard with leaflet map"
```

---

### Task 8: Web — navbar entry

**Files:**
- Modify: `apps/web/src/components/navbar.tsx`

- [ ] **Step 1: Add the menu item**

1. Extend the lucide import (alphabetical):

```tsx
import { Disc3, History, Library, LogOut, Plus, Search, User } from 'lucide-react'
```

2. Insert the link between `menu-my-memories` and `menu-profile` in the dropdown (the one dropdown covers desktop and mobile — spec §7):

```tsx
                    <Link
                      href="/retrospectivas"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-retrospectivas"
                    >
                      <History className={menuIconClass} />
                      Retrospectivas
                    </Link>
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src/components/navbar.tsx
git add apps/web/src/components/navbar.tsx
git commit -m "feat(web): add retrospectives entry to user menu"
```

---

### Task 9: E2E — helpers, reset, `retrospectives.spec.ts`

**Files:**
- Modify: `apps/web/src/__tests__/helpers.ts`
- Modify: `packages/db/src/scripts/reset-e2e-data.ts`
- Create: `apps/web/src/__tests__/retrospectives.spec.ts`

- [ ] **Step 1: Let `createMemory` send coordinates**

In `apps/web/src/__tests__/helpers.ts`:

1. Extend `MemoryData` (the create schema already validates `locationLat`/`locationLng`):

```ts
  locationName?: string
  locationLat?: number
  locationLng?: number
```

2. Pass them through in `createMemory`'s body:

```ts
      locationName: data.locationName,
      locationLat: data.locationLat,
      locationLng: data.locationLng,
```

- [ ] **Step 2: Reset `last_visit_at` and the second E2E user**

In `packages/db/src/scripts/reset-e2e-data.ts`:

1. Next to `E2E_EMAIL`, add:

```ts
const OTHER_EMAIL = 'other@test.com'
```

2. Inside `main()`'s `try`, before the deb-user block, add the other-user cleanup (independent of deb, so a half-seeded DB still cannot leak a stale counter):

```ts
    // The activity E2E signs in as a second user; its public memory would
    // satisfy next run's counter assertion, so it goes with the reset.
    const other = await sql<{ id: string }[]>`
      select id from users where email = ${OTHER_EMAIL}
    `
    let otherDeleted = 0
    if (other.length > 0) {
      const rows = await sql<{ id: string }[]>`
        delete from memories where user_id = ${other[0].id} returning id
      `
      otherDeleted = rows.length
    }
```

3. Extend the existing avatar cleanup to also clear the visit stamp:

```ts
    const [cleared] = await sql<{ image: string | null }[]>`
      update users set image = null, last_visit_at = null
      where id = ${user[0].id} returning image
    `
```

4. Fold both counts into the final log:

```ts
    console.log(
      `[e2e-reset] deleted ${deleted.length} memories owned by ${E2E_EMAIL}${avatarNote}, ` +
        `cleared last_visit_at, deleted ${otherDeleted} memories owned by ${OTHER_EMAIL}`,
    )
```

- [ ] **Step 3: Write the spec**

Create `apps/web/src/__tests__/retrospectives.spec.ts`:

```ts
import type { Browser } from '@playwright/test'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const OTHER_EMAIL = 'other@test.com'
const OTHER_PASSWORD = 'E2E-password-123'

const PT_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const PT_WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function utcNow() {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

function pad(month: number): string {
  return String(month).padStart(2, '0')
}

/**
 * Creates a public memory for the second E2E user in its own browser context,
 * so the cookies never touch the page under test (whose session belongs to
 * deb). Sign-up first, sign-in on later runs — the reset deletes the memories
 * but keeps the account.
 */
async function createOtherUserMemory(
  browser: Browser,
  data: { title: string; memoryDate: string },
): Promise<void> {
  const context = await browser.newContext()
  try {
    let response = await context.request.post(`${API_URL}/api/auth/sign-up/email`, {
      data: { name: 'Other User', email: OTHER_EMAIL, password: OTHER_PASSWORD },
    })
    if (!response.ok()) {
      response = await context.request.post(`${API_URL}/api/auth/sign-in/email`, {
        data: { email: OTHER_EMAIL, password: OTHER_PASSWORD },
      })
    }
    if (!response.ok()) {
      throw new Error(`other user auth failed: ${response.status()} ${await response.text()}`)
    }
    const created = await context.request.post(`${API_URL}/api/memories`, { data })
    if (!created.ok()) {
      throw new Error(`other memory failed: ${created.status()} ${await created.text()}`)
    }
  } finally {
    await context.close()
  }
}

test.describe('Retrospectivas', () => {
  test('shows the year-ago strip for memories from the same month last year', async ({
    authenticatedPage,
  }) => {
    const { year, month } = utcNow()
    const id = await createMemory(authenticatedPage, {
      title: 'Viagem do ano passado',
      memoryDate: `${year - 1}-${pad(month)}-15`,
    })

    await authenticatedPage.goto('/')

    await expect(authenticatedPage.getByTestId('retro-strip')).toBeVisible()
    await expect(authenticatedPage.getByTestId(`retro-year-ago-${id}`)).toBeVisible()
    await expect(authenticatedPage.getByTestId('retro-year-ago-title')).toHaveText(
      'Viagem do ano passado',
    )
    await expect(authenticatedPage.getByTestId('retro-year-ago-date')).toHaveText(
      `${PT_MONTHS[month - 1]} de ${year - 1}`,
    )
    // The reset clears last_visit_at → nothing counts as "new" yet.
    await expect(authenticatedPage.getByTestId('retro-new')).toHaveCount(0)
  })

  test('hides the strip entirely when there is nothing to show', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    // Wait for both queries before asserting absence — the loading skeleton is
    // not the strip, and asserting too early would pass vacuously. No error
    // either: an API failure must not masquerade as "nothing to show".
    await expect(authenticatedPage.getByTestId('retro-strip-loading')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-strip-error')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-strip')).toHaveCount(0)
  })

  test('counts public memories created since the last visit', async ({
    authenticatedPage,
    browser,
  }) => {
    // (a) Record the visit first: with a null stamp the count short-circuits.
    const visit = await authenticatedPage.request.post(`${API_URL}/api/retrospectives/visit`)
    expect(visit.status()).toBe(204)

    // The weekday comes from the stored stamp, not from a local clock read —
    // it is what the strip will render.
    const activity = await authenticatedPage.request.get(`${API_URL}/api/retrospectives/activity`)
    const activityBody = (await activity.json()) as { data: { count: number; since: string } }
    expect(activityBody.data.since).not.toBeNull()
    const weekday = PT_WEEKDAYS[new Date(activityBody.data.since).getUTCDay()]

    // (b) The predicate is strictly created_at > last_visit_at.
    await authenticatedPage.waitForTimeout(1100)

    // (c) Another user publishes a memory.
    const { year, month } = utcNow()
    await createOtherUserMemory(browser, {
      title: 'Memória de outra pessoa',
      memoryDate: `${year}-${pad(month)}-10`,
    })

    // (d) The home shows the counter; its mount bump is awaited so (e) cannot
    // race it.
    const bumped = authenticatedPage.waitForResponse(
      (response) =>
        response.url().includes('/api/retrospectives/visit') &&
        response.request().method() === 'POST' &&
        response.status() === 204,
    )
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.getByTestId('retro-new-count')).toHaveText(
      `1 memória nova desde ${weekday}`,
    )
    await bumped

    // (e) The bump wrote `now` after the other memory — nothing is new now.
    await authenticatedPage.reload()
    await expect(authenticatedPage.getByTestId('retro-strip-loading')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-new')).toHaveCount(0)
  })

  test('groups the timeline under UTC month markers', async ({ authenticatedPage }) => {
    const { year, month } = utcNow()
    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1

    await createMemory(authenticatedPage, {
      title: 'Memória deste mês',
      memoryDate: `${year}-${pad(month)}-10`,
    })
    await createMemory(authenticatedPage, {
      title: 'Memória do mês passado',
      memoryDate: `${prevYear}-${pad(prevMonth)}-10`,
    })

    await authenticatedPage.goto('/')

    const markers = authenticatedPage.getByTestId('timeline-marker')
    await expect(markers).toHaveCount(2)
    // Newest first: current month, then previous month.
    await expect(markers.nth(0)).toHaveText(`${PT_MONTHS[month - 1]} de ${year}`)
    await expect(markers.nth(1)).toHaveText(`${PT_MONTHS[prevMonth - 1]} de ${prevYear}`)
    // The distance lines survive the markers (decision 11) — two memories a
    // month apart read "… depois", never "No mesmo dia".
    await expect(authenticatedPage.getByText(/depois/).first()).toBeVisible()
  })

  test('renders the overview dashboard with stats, recurrences and places', async ({
    authenticatedPage,
  }) => {
    const { year, month } = utcNow()
    await createMemory(authenticatedPage, {
      title: 'Férias no Recife',
      memoryDate: `${year}-${pad(month)}-15`,
      people: ['Ana', 'Bruno'],
      tags: ['família', 'praia'],
      locationName: 'Recife',
      locationLat: -8.05,
      locationLng: -34.9,
    })
    await createMemory(authenticatedPage, {
      title: 'Viagem de junho',
      memoryDate: `${year - 1}-06-20`,
      people: ['Ana'],
    })

    await authenticatedPage.goto('/')
    await authenticatedPage.getByTestId('user-menu-toggle').click()
    await authenticatedPage.getByTestId('menu-retrospectivas').click()
    await authenticatedPage.waitForURL('**/retrospectivas')

    // Current year: 1 memory, 2 distinct people, 1 place.
    // The seed universe is two memories, so every count is a single digit and
    // toContainText cannot be satisfied by a wrong multi-digit number.
    await expect(authenticatedPage.getByTestId('retro-stat-memories')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-stat-people')).toContainText('2')
    await expect(authenticatedPage.getByTestId('retro-stat-places')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-stat-top-tags')).toContainText('#família')
    await expect(authenticatedPage.getByTestId('retro-stat-top-tags')).toContainText('#praia')
    await expect(authenticatedPage.getByTestId('retro-rec-people')).toContainText('Ana ×1')
    await expect(authenticatedPage.getByTestId('retro-rec-places')).toContainText('Recife ×1')
    await expect(authenticatedPage.getByTestId('retro-rec-themes')).toContainText(
      'Sem dados no período',
    )
    await expect(authenticatedPage.getByTestId('retro-place-list')).toContainText('Recife')
    // Assert the container, never the tiles — CI may have no external network.
    await expect(authenticatedPage.getByTestId('retro-map')).toBeVisible()

    // Switching the year changes the served period (people 2 → 1 is the wait).
    await authenticatedPage.getByTestId('retro-year').selectOption(String(year - 1))
    await expect(authenticatedPage.getByTestId('retro-stat-people')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-error')).toHaveCount(0)

    // A month without memories empties the period card but keeps the
    // all-time map visible (spec §5).
    const emptyMonth = month === 1 ? '2' : '1'
    await authenticatedPage.getByTestId('retro-month').selectOption(emptyMonth)
    await expect(authenticatedPage.getByTestId('retro-empty')).toBeVisible()
    await expect(authenticatedPage.getByTestId('retro-map')).toBeVisible()
  })

  test('never exposes lastVisitAt in the session payload', async ({ authenticatedPage }) => {
    // Spec §8: the stamp is internal bookkeeping, not profile data.
    const response = await authenticatedPage.request.get(`${API_URL}/api/auth/get-session`)
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).not.toContain('lastVisitAt')
    expect(text).not.toContain('last_visit_at')
  })
})
```

- [ ] **Step 4: Run the full chromium suite**

```bash
lsof -ti:3000,3333 2>/dev/null | xargs kill -9 2>/dev/null || true
pnpm --filter web exec playwright test --project=chromium
```

- New specs must all pass; the suite total grows by 6.
- If an **existing** spec breaks (markers add text nodes; the strip adds a home block for signed-in users), treat it as a product/spec question first: read what the old assertion pinned, decide whether the new product broke it, and report the change — never just loosen the assertion.

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/web/src/__tests__/helpers.ts apps/web/src/__tests__/retrospectives.spec.ts packages/db/src/scripts/reset-e2e-data.ts
git add apps/web/src/__tests__ packages/db/src/scripts/reset-e2e-data.ts
git commit -m "test(e2e): cover retrospectives strip, markers and dashboard"
```

---

### Task 10: Gates, `docs/tasks.md`, final commit

- [ ] **Step 1: Lint**

```bash
pnpm lint:fix
pnpm exec biome check .
```

Must end with 0 diagnostics (note the file count for the gates block).

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck --force
```

10/10 workspaces.

- [ ] **Step 3: Build**

```bash
pnpm build
```

6/6 packages.

- [ ] **Step 4: Unit/integration tests**

```bash
pnpm test
```

8/8 projects; note the API test count (205 + the specs added in Tasks 2-4) and db (11) for the gates block.

- [ ] **Step 5: E2E**

```bash
lsof -ti:3000,3333 2>/dev/null | xargs kill -9 2>/dev/null || true
pnpm --filter web exec playwright test --project=chromium
```

Note the real total (67 previous + 6 new = expect **73/73** — report the actual number).

- [ ] **Step 6: Update `docs/tasks.md` §7.5**

Replace the five `- [ ]` items under `### 7.5 Retrospectivas` with:

```markdown
### 7.5 Retrospectivas
- [x] "Há um ano" na home, com memória do período — `GET /api/retrospectives/year-ago`
      delega a `findAll({ mine, year: UTC−1, month: UTC, page: 1, limit: 3 })` (janela,
      escopo do dono e soft-delete são contrato testado do `findAll`); faixa
      `home-retrospect-strip` (layout A) com mini-cards `retro-year-ago-<id>`, estado
      próprio de loading/erro e some quando vazia — só para logado.
- [x] Resumos por período e novos itens desde a última visita — coluna `last_visit_at`
      em `users` (migration `0005`, gerada por `drizzle-kit generate` e aplicada via
      `psql`); `GET /activity` conta públicas de terceiros com `created_at >
      last_visit_at` (estrito; `null` → `{count:0, since:null}` sem query de contagem)
      e `POST /visit` é gravado uma vez por montagem **depois** da leitura
      (read-then-write, sem invalidar no mesmo mount); `GET /overview?year=&month=`
      (zod → 400) devolve `period/years/summary/recurrences/places` — summary e
      recorrências no período (UTC half-open), `years` e `places` all-time, tudo
      owner-scoped com `deletedAt IS NULL`.
- [x] Mapa de lugares visitados a partir de `locationLat`/`locationLng` — Leaflet puro
      (sem react-leaflet) + tiles CARTO dark, carregado com `next/dynamic ssr: false`,
      pin dourado via `divIcon`, `fitBounds`/`setView` e lista `retro-place-list` com
      `flyTo` (caminho acessível sem mouse); página `/retrospectivas` (RequireAuth,
      dashboard 2 colunas, mapa sticky) com seletor ano/mês e estados
      `retro-loading`/`retro-error`/`retro-empty` (vazio do período não esconde o
      mapa all-time).
- [x] Recorrências: pessoas, lugares e temas mais frequentes — top 5 com ordem
      determinística `count DESC, name ASC` (top 3 nas tags), temas via flatten de
      `ai_themes` (até 5) com nota "contagem só de memórias com narrativa gerada" e
      fallback "Sem dados no período".
- [x] Mês/ano no formato "setembro de 2026" na timeline — `timeline-marker.tsx`
      reescrito em UTC longo (sai `toLocaleDateString` local e a regra `isLast`) e
      ligado ao agrupamento de `memory-timeline` por (ano, mês) UTC; linhas de
      distância ("5 dias depois") intactas; card mantém a data cheia.

#### Gates da 7.5
`pnpm build` 6/6 · `pnpm typecheck --force` 10/10 · `pnpm test` 8/8 (API [REAL],
schemas 57, db 11, auth 3) · `biome check` [N] arquivos, 0 avisos · Playwright chromium
**[REAL]/[REAL]**
```

Fill `[REAL]`/`[N]` from Steps 1-5 output — never invent numbers.

- [ ] **Step 7: Final commit**

```bash
pnpm exec biome check --write docs/tasks.md
git add docs/tasks.md
git commit -m "docs: mark 7.5 as complete"
git status   # clean tree
```

---

## Self-review (run after writing the plan, before executing)

- [ ] Every step has exact file paths, complete code, and an explicit verify command.
- [ ] Order is TDD where the spec mandates tests first; failing states named.
- [ ] No step assumes a server is already running; E2E uses Playwright's `webServer`.
- [ ] Every commit message is Conventional Commits, English, imperative, no period.
- [ ] Spec conflicts resolved in the spec's favor and documented in place:
  - §2.4 example shows `years` ascending, §5 requires desc for the selector → service returns desc (documented in Task 3 test).
  - §9 asks for year-ago window boundary tests, §2.1 mandates delegating to `findAll` → boundaries stay `findAll`'s tested contract; Task 2 pins the delegation parameters (documented in the test comment).
  - §2.4 says themes are `unnest`ed; Task 3 flattens in JS — same result set, documented at the code site.
- [ ] Security: 401 on all 4 routes, owner scope asserted in Task 3, session payload leak guarded by an E2E test (spec §8).
- [ ] `docs/tasks.md` update (user's explicit ask) is a step of the final task with real gate numbers.
