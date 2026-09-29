# Fase 7.4 — Compartilhamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Third access level (`private | shared | public`) with expiring one-shot share links, a redacted public preview, and a management page with copy/revoke.

**Architecture:** Two nullable columns on `memories` (`share_token`, `share_expires_at`) + partial unique index; the `shared` state is derived (`!is_public && token && not expired`). New `share` API module (rotate/revoke/public resolve); `memories` module gains `findShared` + owner-only token exposure + the visibility invariant (any `isPublic` in an update clears the token). Web: share dialog on the card, public `/share/[token]` preview (noindex), `/share` list page.

**Tech Stack:** Drizzle/Postgres (migration via `pnpm db:generate` + psql), Fastify, Vitest, Next.js 16 (server page for metadata + client components), TanStack Query, Playwright chromium.

**Spec:** `docs/superpowers/specs/2026-09-29-phase-7-4-sharing-design.md` (approved). If a step and the spec disagree, the spec wins — stop and reconcile.

**Notes before starting:**
- Run all commands from the repo root `/home/dracarys/Documents/projects/fullstack/chronicle` unless a step says otherwise.
- `pnpm db:migrate` is broken against the dev DB (known limitation) — migration is applied with `psql`, same as `0003`.
- Never start servers manually for E2E — Playwright's `webServer` manages them. If ports are stuck: `lsof -ti:3000,3333 2>/dev/null | xargs kill -9`.
- Run `pnpm exec biome check --write <changed files>` before every commit (lefthook pre-commit runs biome on staged files).

---

### Task 1: DB — share columns, partial unique index, `gt` export, migration

**Files:**
- Modify: `packages/db/src/schema/memories.ts`
- Modify: `packages/db/src/index.ts`
- Test: `packages/db/src/schema/__tests__/memories.test.ts`
- Create (via generate): `packages/db/src/migrations/0004_*.sql` + `meta/0004_snapshot.json` + `meta/_journal.json` update

- [ ] **Step 1: Write the failing schema tests**

In `packages/db/src/schema/__tests__/memories.test.ts`:

1. In the `defines the memory columns` expected list, insert after the `is_public` entry:

```ts
      ['is_public', 'PgBoolean', true],
      ['share_token', 'PgText', false],
      ['share_expires_at', 'PgTimestamp', false],
      ['ai_narrative', 'PgText', false],
```

(they land where the schema declares them — Step 3 puts the columns right after `isPublic`, so the order must match).

2. Add this test inside `describe('Memories indexes')`, after the public-feed test:

```ts
  it('has a partial unique index on the share token', () => {
    // One active link per memory. Partial so the (common) no-link case is a
    // NULL that the unique constraint ignores — several memories without a
    // link all store NULL and must not collide.
    const found = getTableConfig(memories).indexes.find(
      (index) => index.config.name === 'memories_share_token_idx',
    )
    expect(found).toBeDefined()
    expect(found?.config.isUnique).toBe(true)
    expect(found?.config.where).toBeDefined()
    expect(indexOn(memories, 'memories_share_token_idx')).toEqual(['share_token'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @chronicle/db test`
Expected: FAIL — `defines the memory columns` (received array misses `share_token`) and the new index test (`found` undefined).

- [ ] **Step 3: Implement the schema**

In `packages/db/src/schema/memories.ts`:

1. Add `sql` to the `drizzle-orm` import and `uniqueIndex` to the `drizzle-orm/pg-core` import:

```ts
import { sql } from 'drizzle-orm'
import {
  boolean,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
```

2. After the `isPublic` column, add:

```ts
    isPublic: boolean('is_public').notNull().default(true),
    // Share link (7.4). NULL means "no link". The shared state is derived, never
    // stored: `!is_public && share_token && share_expires_at > now()`. Rotation
    // replaces the token in place (one active link per memory, enforced by the
    // partial unique index below); any update that carries `isPublic` clears
    // both columns so a public → private toggle can never resurrect a link.
    shareToken: text('share_token'),
    shareExpiresAt: timestamp('share_expires_at', { mode: 'date' }),
```

3. In the index array, after `memories_public_date_idx`:

```ts
    // One active share token per memory. Partial: without WHERE, two memories
    // with no link (both NULL) would collide under UNIQUE.
    uniqueIndex('memories_share_token_idx')
      .on(table.shareToken)
      .where(sql`${table.shareToken} is not null`),
```

- [ ] **Step 4: Export `gt` from `@chronicle/db`**

In `packages/db/src/index.ts` add `gt` to the drizzle-orm export block (alphabetical, between `gte` and `ilike`):

```ts
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm'
```

(`gt` is needed by `findShared` in Task 2: `gt(shareExpiresAt, now)` keeps expired links out of the list at the SQL level.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @chronicle/db test`
Expected: PASS (12 tests in `memories.test.ts` + schema suite green).

- [ ] **Step 6: Generate the migration and apply it to the dev DB**

```bash
pnpm db:generate
```

Expected: creates `packages/db/src/migrations/0004_<name>.sql` + `meta/0004_snapshot.json` and updates `meta/_journal.json`. Read the generated file (`ls packages/db/src/migrations/0004_*`) — it must contain the two `ALTER TABLE ... ADD COLUMN` statements and the `CREATE UNIQUE INDEX ... WHERE share_token IS NOT NULL`.

Apply (replaces `<file>` with the generated name):

```bash
PGPASSWORD=chronicle psql -h localhost -U chronicle -d chronicle -f packages/db/src/migrations/0004_<name>.sql
PGPASSWORD=chronicle psql -h localhost -U chronicle -d chronicle -c "\d memories" | grep share
```

Expected: both `share_token` and `share_expires_at` listed; index `memories_share_token_idx` present.

- [ ] **Step 7: Commit**

```bash
pnpm exec biome check --write packages/db/src
git add packages/db
git commit -m "feat(db): add share token columns and partial unique index"
```

---

### Task 2: Memories service — visibility invariant, owner-only token in detail, `findShared`

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts`
- Modify: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`:

1. In the `vi.mock('@chronicle/db', ...)` factory, add `shareToken`/`shareExpiresAt` to the `memories` table mock (after `isPublic`):

```ts
      isPublic: column('is_public'),
      shareToken: column('share_token'),
      shareExpiresAt: column('share_expires_at'),
```

2. Add `gt` next to `gte` in the factory and export it in the factory's return object:

```ts
  const gte = (col: unknown, value: unknown) => ({ op: 'gte', col, value })
  const gt = (col: unknown, value: unknown) => ({ op: 'gt', col, value })
```

return: `return { ...tables, eq, or, and, ilike, sql, desc, asc, gte, gt, lt, inArray, isNull, isNotNull, db }`

3. In the `describe('MemoriesService privacy')` file (or the update tests block), add — each `it` follows the existing style of setting `mocks.state.rows` first:

```ts
  it('clears the share token whenever isPublic is sent', async () => {
    mocks.state.rows = [{ id: 'mem-1', userId: 'user-1' }]

    await memoriesService.update('mem-1', 'user-1', { isPublic: false })

    expect(mocks.state.updates[0]).toMatchObject({
      shareToken: null,
      shareExpiresAt: null,
    })
  })

  it('leaves the share token alone when isPublic is omitted', async () => {
    mocks.state.rows = [{ id: 'mem-1', userId: 'user-1' }]

    await memoriesService.update('mem-1', 'user-1', { title: 'Novo título' })

    expect(mocks.state.updates[0].shareToken).toBeUndefined()
    expect(mocks.state.updates[0].shareExpiresAt).toBeUndefined()
  })

  it('includes the share token in the owner detail only', async () => {
    mocks.state.rows = [
      {
        id: 'mem-1',
        userId: 'user-1',
        isPublic: true,
        shareToken: 'tok-owner',
        shareExpiresAt: new Date('2026-10-06T12:00:00Z'),
      },
    ]

    const owner = await memoriesService.findById('mem-1', 'user-1')
    expect(owner.shareToken).toBe('tok-owner')
    expect(owner.shareExpiresAt).toEqual(new Date('2026-10-06T12:00:00Z'))
  })

  it('omits the share token from a non-owner read', async () => {
    mocks.state.rows = [
      { id: 'mem-1', userId: 'user-2', isPublic: true, shareToken: 'tok-secret' },
    ]

    const reader = await memoriesService.findById('mem-1', 'user-1')
    expect(reader.shareToken).toBeUndefined()
    expect(reader.shareExpiresAt).toBeUndefined()

    const anon = await memoriesService.findById('mem-1')
    expect(anon.shareToken).toBeUndefined()
  })

  describe('findShared', () => {
    it('selects only the owner active links and maps the DTO', async () => {
      const expiresAt = new Date(Date.now() + 86_400_000)
      mocks.state.rows = [
        {
          id: 'mem-1',
          title: 'Segredo',
          memoryDate: new Date('2026-09-01T00:00:00Z'),
          shareToken: 'tok-1',
          shareExpiresAt: expiresAt,
        },
      ]

      const rows = await memoriesService.findShared('user-1')

      expect(rows).toEqual([
        {
          id: 'mem-1',
          title: 'Segredo',
          memoryDate: new Date('2026-09-01T00:00:00Z'),
          token: 'tok-1',
          expiresAt,
        },
      ])
      expect(memoryOps('eq')).toEqual(
        expect.arrayContaining([
          { op: 'eq', col: memories.userId, value: 'user-1' },
          { op: 'eq', col: memories.isPublic, value: false },
        ]),
      )
      expect(memoryOps('isNotNull')).toEqual([{ op: 'isNotNull', col: memories.shareToken }])
      expect(memoryOps('isNull')).toEqual([{ op: 'isNull', col: memories.deletedAt }])
      const gtOps = memoryOps('gt')
      expect(gtOps).toHaveLength(1)
      expect((gtOps[0] as { col: unknown }).col).toBe(memories.shareExpiresAt)
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec vitest run src/modules/memories/__tests__/memories.service.spec.ts`
Expected: FAIL — `findShared is not a function`; `owner.shareToken` undefined; `updates[0].shareToken` undefined (clear never happens).

- [ ] **Step 3: Implement the service changes**

In `apps/api/src/modules/memories/memories.service.ts`:

1. Add `gt` to the `@chronicle/db` import (alphabetical).

2. In `update`, inside the `.set({...})` object, after `isPublic: data.isPublic,`:

```ts
        isPublic: data.isPublic,
        // Any explicit visibility change ends the current share cycle (spec §1):
        // choosing "Privado" and choosing "Público" both kill the link, so a
        // public → private toggle can never resurrect a shared state. Omitting
        // the field must leave the link alone — editing a title does not revoke
        // someone's link.
        ...(data.isPublic !== undefined
          ? { shareToken: null, shareExpiresAt: null }
          : {}),
```

3. In `findById`, replace the final `return {...}` — keep the query and owner gate untouched — with:

```ts
    // The share token is the owner's secret and the detail route is readable by
    // anyone for a public memory, so the two fields ride along only for the
    // owner. Feeds never even select them: `memoryColumns` deliberately omits
    // `shareToken`/`shareExpiresAt`, which is why this destructure is the one
    // place a token can leave the service.
    const { shareToken, shareExpiresAt, ...rest } = memory

    return {
      ...rest,
      ...(memory.userId === userId && userId !== undefined
        ? { shareToken, shareExpiresAt }
        : {}),
      userName: author?.name ?? null,
      people: peopleRows,
      tags: tagRows,
      photos: photoRows,
    }
```

4. Add the `findShared` method to the class (after `findAll`, before `findById`):

```ts
  // The owner's active share links. The expiry predicate runs in SQL so an
  // expired link never reaches the list (spec §2.4); `shareToken IS NOT NULL`
  // is redundant with `gt` (NULL > now is NULL) and stays as documentation of
  // the derived-state rule. No pagination on purpose: one user's shareable
  // memories are a handful of rows, and the route is owner-scoped.
  async findShared(userId: string) {
    const rows = await db
      .select({
        id: memories.id,
        title: memories.title,
        memoryDate: memories.memoryDate,
        shareToken: memories.shareToken,
        shareExpiresAt: memories.shareExpiresAt,
      })
      .from(memories)
      .where(
        and(
          eq(memories.userId, userId),
          eq(memories.isPublic, false),
          isNotNull(memories.shareToken),
          gt(memories.shareExpiresAt, new Date()),
          isNull(memories.deletedAt),
        ),
      )
      .orderBy(desc(memories.memoryDate))

    // `shareToken`/`shareExpiresAt` are non-null by the predicate above; the
    // select cannot express that, so the rename to the public DTO shape is the
    // cast. Everything else in the response is named here too — feeds sharing
    // this table must never see the token (spec §2.4).
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      memoryDate: row.memoryDate,
      token: row.shareToken as string,
      expiresAt: row.shareExpiresAt as Date,
    }))
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec vitest run src/modules/memories/__tests__/memories.service.spec.ts`
Expected: PASS — whole file green (the pinned projection test still passes: `memoryColumns` was NOT touched).

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm --filter api typecheck
pnpm exec biome check --write apps/api/src/modules/memories
git add apps/api/src/modules/memories
git commit -m "feat(api): enforce share invariants and expose the shared links list"
```

---

### Task 3: Route `GET /api/memories/shared` + route tests

**Files:**
- Modify: `apps/api/src/modules/memories/memories.routes.ts`
- Modify: `apps/api/src/modules/memories/__tests__/memories.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/memories/__tests__/memories.spec.ts`:

1. Add `findShared: vi.fn()` to the `vi.mock('../memories.service', ...)` factory object.
2. In `beforeEach`, after `service.findById.mockResolvedValue(...)`, add:

```ts
    service.findShared.mockResolvedValue([] as never)
```

3. Append this describe block at the end of the top-level `describe('Memories Routes')`:

```ts
  describe('GET /api/memories/shared', () => {
    it('returns 401 without a session', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/memories/shared' })

      expect(response.statusCode).toBe(401)
      expect(service.findShared).not.toHaveBeenCalled()
    })

    it("lists the signed-in owner's links without routing through :id", async () => {
      signIn('user-1')
      service.findShared.mockResolvedValue([
        {
          id: 'mem-1',
          title: 'Segredo',
          memoryDate: '2026-09-01T00:00:00.000Z',
          token: 'tok-1',
          expiresAt: '2026-10-06T12:00:00.000Z',
        },
      ] as never)

      const response = await server.inject({ method: 'GET', url: '/api/memories/shared' })

      expect(response.statusCode).toBe(200)
      expect(service.findShared).toHaveBeenCalledWith('user-1')
      // Static segments beat `:id` in find-my-way; this is the regression that
      // would otherwise silently send "shared" down the detail route.
      expect(service.findById).not.toHaveBeenCalled()
      expect(response.json().data).toHaveLength(1)
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec vitest run src/modules/memories/__tests__/memories.spec.ts`
Expected: FAIL — 404 (route `:id` catches `shared`, `findById` mocked returns `{id:'mem-1'}` → 200 but `findShared` never called; the 401 test fails because `:id` route has no session guard... it 200s). Either way: assertions on `findShared` fail.

- [ ] **Step 3: Implement the route**

In `apps/api/src/modules/memories/memories.routes.ts`, add after the `GET /api/memories/:id` handler (order in the file does not matter to find-my-way — the static segment always wins — but keeping it next to the other GET documents the pairing):

```ts
  // GET /api/memories/shared — the owner's active share links. Static path,
  // registered by the same plugin as `/:id`: find-my-way prefers the static
  // segment, so "shared" never reaches the detail handler (pinned by test).
  // Always owner-scoped and always 401 without a session — no query param to
  // misuse, same reasoning as `deleted=true`.
  fastify.get('/api/memories/shared', async (request, reply) => {
    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })

    if (!session) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      })
    }

    const links = await memoriesService.findShared(session.user.id)

    return reply.send({ data: links })
  })
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec vitest run src/modules/memories`
Expected: PASS — both route files + service spec green.

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/api/src/modules/memories
git add apps/api/src/modules/memories
git commit -m "feat(api): serve the shared links list route"
```

---

### Task 4: Share service — token lifecycle + redacted resolve (TDD)

**Files:**
- Create: `apps/api/src/modules/share/share.service.ts`
- Test: `apps/api/src/modules/share/__tests__/share.service.spec.ts`

- [ ] **Step 1: Write the failing service tests**

Create `apps/api/src/modules/share/__tests__/share.service.spec.ts`:

```ts
import { memories, memoryPeople, memoryPhotos, memoryTags, users } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../errors/app-error'
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec vitest run src/modules/share`
Expected: FAIL — `Failed to load ../share.service` (module does not exist yet).

- [ ] **Step 3: Implement the service**

Create `apps/api/src/modules/share/share.service.ts`:

```ts
import { and, db, eq, isNull, memories, memoryPeople, memoryPhotos, memoryTags, users } from '@chronicle/db'
import { randomBytes } from 'node:crypto'
import { AppError } from '../../errors/app-error'

// Fixed TTL, chosen in design (spec §2, decision 2): rotation restarts the 7
// days, so "Renovar" doubles as extension and the UI never configures dates.
const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const INVALID_LINK = 'Link inválido ou expirado'

export class ShareService {
  // Create or rotate. Wrong owner and unknown id answer the same 404 — the
  // same reasoning as the export routes in 7.3: a 403 would confirm the
  // memory exists to anyone holding a UUID.
  async share(memoryId: string, userId: string) {
    const memory = await this.requireOwnedMemory(memoryId, userId)

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SHARE_TTL_MS)

    await db
      .update(memories)
      .set({ shareToken: token, shareExpiresAt: expiresAt })
      .where(eq(memories.id, memory.id))

    return { token, expiresAt }
  }

  // Revoke is idempotent (spec §2.2): clearing a link that is not there is a
  // no-op, not an error, so double-clicking Revogar stays 204.
  async revoke(memoryId: string, userId: string) {
    const memory = await this.requireOwnedMemory(memoryId, userId)

    await db
      .update(memories)
      .set({ shareToken: null, shareExpiresAt: null })
      .where(eq(memories.id, memory.id))
  }

  // Public redacted preview. Unknown, expired and deleted all answer the same
  // 404 with the same message: telling them apart would hand anyone holding a
  // guess an oracle for valid tokens.
  async resolve(token: string) {
    const [memory] = await db
      .select()
      .from(memories)
      .where(and(eq(memories.shareToken, token), isNull(memories.deletedAt)))
      .limit(1)

    if (!memory || !memory.shareExpiresAt || memory.shareExpiresAt.getTime() <= Date.now()) {
      throw AppError.notFound(INVALID_LINK)
    }

    const [author] = await db
      .select({ name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, memory.userId))
      .limit(1)

    const [peopleRows, tagRows, photoRows] = await Promise.all([
      db.select().from(memoryPeople).where(eq(memoryPeople.memoryId, memory.id)),
      db.select().from(memoryTags).where(eq(memoryTags.memoryId, memory.id)),
      db
        .select()
        .from(memoryPhotos)
        .where(eq(memoryPhotos.memoryId, memory.id))
        .orderBy(memoryPhotos.orderIndex),
    ])

    // Whitelist (spec §3): the object is built field by field, so a column
    // added to `memories` tomorrow cannot leak here by spread. Email, userId,
    // coordinates, aiMood/aiThemes, timestamps and the token itself are not
    // named, so they do not exist in the response.
    return {
      memory: {
        id: memory.id,
        title: memory.title,
        content: memory.content,
        memoryDate: memory.memoryDate,
        locationName: memory.locationName,
        weatherDesc: memory.weatherDesc,
        weatherIcon: memory.weatherIcon,
        musicTrack: memory.musicTrack,
        musicArtist: memory.musicArtist,
        musicUrl: memory.musicUrl,
        musicCover: memory.musicCover,
        photos: photoRows.map((photo) => ({
          id: photo.id,
          url: photo.url,
          width: photo.width,
          height: photo.height,
        })),
        people: peopleRows.map((person) => ({ id: person.id, name: person.name })),
        tags: tagRows.map((tag) => ({ id: tag.id, name: tag.name })),
        aiNarrative: memory.aiNarrative,
      },
      author: { name: author?.name ?? null, image: author?.image ?? null },
    }
  }

  private async requireOwnedMemory(memoryId: string, userId: string) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory || memory.userId !== userId || memory.deletedAt) {
      throw AppError.notFound('Memória não encontrada')
    }

    return memory
  }
}

export const shareService = new ShareService()
```

Note: the music fields are the flat `musicTrack`/`musicArtist`/`musicUrl`/`musicCover` columns — spec §3 sketched them nested as `music: {...}`; the names stay flat so the preview component renders them exactly like `MemoryCardFull` does. Same fields, no new names.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec vitest run src/modules/share`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
pnpm exec biome check --write apps/api/src/modules/share
git add apps/api/src/modules/share
git commit -m "feat(api): add share service with token lifecycle and redacted preview"
```

---

### Task 5: Share routes + registration + integration tests

**Files:**
- Create: `apps/api/src/modules/share/share.routes.ts`
- Create: `apps/api/src/modules/share/index.ts`
- Test: `apps/api/src/modules/share/__tests__/share.integration.test.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write the failing integration tests**

Create `apps/api/src/modules/share/__tests__/share.integration.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../../../errors/app-error'
import { buildServer } from '../../../server'

vi.mock('@chronicle/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

vi.mock('../share.service', () => ({
  shareService: {
    share: vi.fn(),
    revoke: vi.fn(),
    resolve: vi.fn(),
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
const { shareService } = await import('../share.service')

const getSession = vi.mocked(auth.api.getSession)
const service = vi.mocked(shareService)

type Session = Awaited<ReturnType<typeof auth.api.getSession>>

const signIn = (userId = 'user-1') =>
  getSession.mockResolvedValue({ user: { id: userId } } as unknown as Session)

const signOut = () => getSession.mockResolvedValue(null)

describe('Share Integration Tests', () => {
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
    service.share.mockResolvedValue({
      token: 'tok-1',
      expiresAt: new Date('2026-10-06T12:00:00.000Z'),
    })
    service.revoke.mockResolvedValue(undefined)
    service.resolve.mockResolvedValue({
      memory: { id: 'mem-1', title: 'Segredo' },
      author: { name: 'Deborah', image: null },
    })
  })

  describe('POST /api/memories/:id/share', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
      expect(service.share).not.toHaveBeenCalled()
    })

    it('creates the link for the session user and answers 201', async () => {
      signIn('user-7')

      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(201)
      expect(service.share).toHaveBeenCalledWith('mem-1', 'user-7')
      expect(response.json().data.token).toBe('tok-1')
      expect(response.json().data.expiresAt).toBeDefined()
    })

    it('maps the service 404 to the reply', async () => {
      signIn()
      service.share.mockRejectedValue(AppError.notFound('Memória não encontrada'))

      const response = await server.inject({ method: 'POST', url: '/api/memories/mem-1/share' })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Memória não encontrada' },
      })
    })
  })

  describe('DELETE /api/memories/:id/share', () => {
    it('returns 401 for unauthenticated request', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/memories/mem-1/share',
      })

      expect(response.statusCode).toBe(401)
      expect(service.revoke).not.toHaveBeenCalled()
    })

    it('revokes and answers 204', async () => {
      signIn('user-7')

      const response = await server.inject({
        method: 'DELETE',
        url: '/api/memories/mem-1/share',
      })

      expect(response.statusCode).toBe(204)
      expect(service.revoke).toHaveBeenCalledWith('mem-1', 'user-7')
    })
  })

  describe('GET /api/share/:token', () => {
    it('serves the redacted preview without a session', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/share/tok-1' })

      expect(response.statusCode).toBe(200)
      expect(response.json().data.author.name).toBe('Deborah')
      expect(service.resolve).toHaveBeenCalledWith('tok-1')
    })

    it('answers the same generic 404 for expired and unknown tokens', async () => {
      service.resolve.mockRejectedValue(AppError.notFound('Link inválido ou expirado'))

      const expired = await server.inject({ method: 'GET', url: '/api/share/expired' })
      const unknown = await server.inject({ method: 'GET', url: '/api/share/unknown' })

      expect(expired.statusCode).toBe(404)
      expect(unknown.statusCode).toBe(404)
      expect(expired.json()).toEqual(unknown.json())
      expect(expired.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Link inválido ou expirado' },
      })
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api exec vitest run src/modules/share/__tests__/share.integration.test.ts`
Expected: FAIL — `shareRoutes` 404 for every URL (routes not registered; the module's `share.routes` file does not exist).

- [ ] **Step 3: Implement the routes and register the module**

Create `apps/api/src/modules/share/share.routes.ts`:

```ts
import { auth } from '@chronicle/auth'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { shareService } from './share.service'

async function currentUserId(request: FastifyRequest): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  })
  return session ? session.user.id : null
}

export async function shareRoutes(fastify: FastifyInstance) {
  // POST /api/memories/:id/share — create or rotate (owner only).
  fastify.post<{ Params: { id: string } }>('/api/memories/:id/share', async (request, reply) => {
    const userId = await currentUserId(request)
    if (!userId) {
      return reply.status(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      })
    }

    const data = await shareService.share(request.params.id, userId)
    return reply.status(201).send({ data })
  })

  // DELETE /api/memories/:id/share — revoke (owner only, idempotent).
  fastify.delete<{ Params: { id: string } }>(
    '/api/memories/:id/share',
    async (request, reply) => {
      const userId = await currentUserId(request)
      if (!userId) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        })
      }

      await shareService.revoke(request.params.id, userId)
      return reply.status(204).send()
    },
  )

  // GET /api/share/:token — the public redacted preview. No session: the token
  // is the credential. Errors thrown inside `resolve` reach the global handler,
  // which answers the single generic 404.
  fastify.get<{ Params: { token: string } }>('/api/share/:token', async (request, reply) => {
    const data = await shareService.resolve(request.params.token)
    return reply.send({ data })
  })
}
```

Create `apps/api/src/modules/share/index.ts`:

```ts
export { shareRoutes } from './share.routes'
```

In `apps/api/src/server.ts`:

1. Add to the imports: `import { shareRoutes } from './modules/share'`
2. After `server.register(exportRoutes)` add: `server.register(shareRoutes)`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api exec vitest run src/modules/share`
Expected: PASS — service (13) + integration (7).

- [ ] **Step 5: Run the whole API suite (regression check) and commit**

Run: `pnpm --filter api test`
Expected: PASS — everything, including the route suites that now build the server with `shareRoutes` registered.

```bash
pnpm exec biome check --write apps/api/src
git add apps/api/src
git commit -m "feat(api): add share routes and register the module"
```

---

### Task 6: Web — `Memory` type, share dialog, card button

**Files:**
- Modify: `apps/web/src/hooks/use-memories.ts`
- Create: `apps/web/src/hooks/use-revoke-share.ts`
- Create: `apps/web/src/components/share-dialog.tsx`
- Modify: `apps/web/src/components/memory-card.tsx`

- [ ] **Step 1: Add the owner-only fields to the `Memory` type**

In `apps/web/src/hooks/use-memories.ts`, inside `interface Memory`, after `isPublic: boolean`:

```ts
  isPublic: boolean
  /**
   * Owner-only detail fields (7.4). Present in `GET /api/memories/:id` for the
   * owner and nowhere else — feeds never return them, so they are optional.
   */
  shareToken?: string | null
  shareExpiresAt?: string | null
```

- [ ] **Step 2: Create the revoke hook**

Create `apps/web/src/hooks/use-revoke-share.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useRevokeShare() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memoryId: string) => {
      return api.delete(`/api/memories/${memoryId}/share`)
    },
    onSuccess: () => {
      // The dialog reads ['memory', id] for its state and the list page reads
      // ['shared-links']; one revoke moves both, which is why the dialog and
      // the /share page share this hook.
      queryClient.invalidateQueries({ queryKey: ['shared-links'] })
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    },
  })
}
```

- [ ] **Step 3: Create the share dialog**

Create `apps/web/src/components/share-dialog.tsx`:

```tsx
'use client'

import { useRevokeShare } from '@/hooks/use-revoke-share'
import type { Memory } from '@/hooks/use-memories'
import { api } from '@/lib/api-client'
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@chronicle/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ShareDialogProps {
  memoryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ShareDialog({ memoryId, open, onOpenChange }: ShareDialogProps) {
  const queryClient = useQueryClient()
  const revoke = useRevokeShare()

  // Same query key as useMemory: opening the dialog reuses a cached detail
  // read instead of fetching a second copy of the memory.
  const detail = useQuery({
    queryKey: ['memory', memoryId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Memory }>(`/api/memories/${memoryId}`)
      return data
    },
    enabled: open,
  })

  const token = detail.data?.shareToken ?? null
  const expiresAt = detail.data?.shareExpiresAt ?? null
  const shareUrl = token && typeof window !== 'undefined' ? `${window.location.origin}/share/${token}` : ''

  const shareMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { token: string; expiresAt: string } }>(
        `/api/memories/${memoryId}/share`,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory', memoryId] })
      toast.success('Link gerado!')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar o link')
    },
  })

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const handleRevoke = () => {
    revoke.mutate(memoryId, {
      onSuccess: () => toast.success('Link revogado'),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Erro ao revogar o link')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-card bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text">Compartilhar memória</DialogTitle>
          <DialogDescription className="text-muted">
            Quem tem o link vê a memória por 7 dias, sem os seus dados pessoais.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex justify-center py-6" data-testid="share-loading">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {token && expiresAt ? (
              <div className="space-y-2">
                <p className="text-sm text-text" data-testid="share-active">
                  Link ativo — expira em {formatDate(expiresAt)}
                </p>
                <code
                  className="block break-all rounded-lg border border-card bg-background p-2 font-mono text-xs text-primary"
                  data-testid="share-url"
                >
                  {shareUrl}
                </code>
              </div>
            ) : (
              <p className="text-sm text-muted" data-testid="share-none">
                Sem link ativo. Gere um link para quem quiser ver esta memória.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => shareMutation.mutate()}
                disabled={shareMutation.isPending}
                data-testid="share-generate"
                className="bg-primary text-background hover:bg-secondary"
              >
                {shareMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : token ? (
                  <RefreshCw className="mr-2 h-4 w-4" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                {token ? 'Renovar link' : 'Gerar link'}
              </Button>

              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={!token}
                data-testid="share-copy"
                className="border-card text-text hover:border-primary hover:text-primary"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>

              <Button
                variant="outline"
                onClick={handleRevoke}
                disabled={!token || revoke.isPending}
                data-testid="share-revoke"
                className="border-card text-red-500 hover:border-red-500 hover:text-red-600"
              >
                {revoke.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Revogar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Add the button to the card**

In `apps/web/src/components/memory-card.tsx`:

1. Add `Link2` to the `lucide-react` import and `import { ShareDialog } from '@/components/share-dialog'`.
2. Next to the existing state: `const [shareOpen, setShareOpen] = useState(false)`
3. In the owner actions block, **between the narrative button and the privacy button**, add (only when the memory is private — a public memory needs no link, spec §5.1):

```tsx
                {!memory.isPublic && (
                  <Button
                    variant="outline"
                    size="icon"
                    data-testid="card-share"
                    aria-label="Compartilhar link"
                    title="Compartilhar link"
                    onClick={() => setShareOpen(true)}
                    className="h-9 w-9 border-card text-muted hover:border-primary hover:text-primary"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                )}
```

4. Next to the existing `<ConfirmDialog ...>` at the bottom of the component:

```tsx
      <ShareDialog memoryId={memory.id} open={shareOpen} onOpenChange={setShareOpen} />
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src
git add apps/web/src
git commit -m "feat(web): add share dialog to memory cards"
```

---

### Task 7: Web — public preview page `/share/[token]`

**Files:**
- Create: `apps/web/src/app/share/[token]/page.tsx` (server component — metadata needs it)
- Create: `apps/web/src/components/share-preview.tsx`

- [ ] **Step 1: Create the server wrapper (metadata + params)**

Create `apps/web/src/app/share/[token]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { SharePreview } from '@/components/share-preview'

// A share link is a temporary door, not a page for search. noindex is courtesy
// (spec §6) — revocation is the real guarantee — and it needs a server
// component: `export const metadata` is ignored in a 'use client' file.
export const metadata: Metadata = {
  title: 'Memória compartilhada — Chronicle',
  robots: { index: false, follow: false },
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharePreview token={token} />
}
```

(`params` is a `Promise` in Next 16 — confirmed in `node_modules/next/dist/docs/.../page.md`: `const { slug } = await params`.)

- [ ] **Step 2: Create the preview component**

Create `apps/web/src/components/share-preview.tsx`:

```tsx
'use client'

import { getInitials } from '@/lib/get-initials'
import { api } from '@/lib/api-client'
import { PhotoGallery } from '@/components/photo-gallery'
import { Button } from '@chronicle/ui'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MapPin, Music, Tag, Users } from 'lucide-react'
import Link from 'next/link'

interface SharePreviewData {
  memory: {
    id: string
    title: string
    content: string | null
    memoryDate: string
    locationName: string | null
    weatherDesc: string | null
    weatherIcon: string | null
    musicTrack: string | null
    musicArtist: string | null
    musicUrl: string | null
    musicCover: string | null
    photos: Array<{ id: string; url: string; width: number | null; height: number | null }>
    people: Array<{ id: string; name: string }>
    tags: Array<{ id: string; name: string }>
    aiNarrative: string | null
  }
  author: { name: string | null; image: string | null }
}

const MONTHS = [
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
] as const

function formatUtcDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getUTCDate()).padStart(2, '0')} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`
}

export function SharePreview({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery<SharePreviewData>({
    queryKey: ['share', token],
    queryFn: async () => {
      const { data } = await api.get<{ data: SharePreviewData }>(`/api/share/${token}`)
      return data
    },
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20" data-testid="share-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Expired, unknown and deleted all arrive here as the same 404 message —
  // one state, never a redirect (spec §4): the visitor must learn the link died.
  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center" data-testid="share-invalid">
        <p className="mb-2 text-xl font-bold text-text">Link inválido ou expirado</p>
        <p className="mb-8 text-sm text-muted">
          Este link não existe mais ou o prazo de validade acabou.
        </p>
        <Link href="/">
          <Button
            variant="outline"
            className="border-card text-text hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ir para a timeline
          </Button>
        </Link>
      </div>
    )
  }

  const { memory, author } = data

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-primary">
          Memória compartilhada
        </span>
        <Link href="/" className="text-sm text-muted transition-colors hover:text-primary">
          Chronicle
        </Link>
      </div>

      <article data-testid={`share-card-${memory.id}`}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
            {formatUtcDate(memory.memoryDate)}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-card bg-background px-3 py-1 text-xs text-muted"
            data-testid="share-author"
          >
            {author.image ? (
              <img
                src={author.image}
                alt={author.name || 'Autor'}
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[8px] font-bold text-background">
                {getInitials(author.name, null)}
              </span>
            )}
            {author.name}
          </span>
        </div>

        <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 shadow-lg sm:p-8">
          <div>
            <h1 className="text-2xl font-bold text-text" data-testid="share-title">
              {memory.title}
            </h1>
            {memory.content && (
              <p className="mt-2 font-serif text-sm italic text-muted">{memory.content}</p>
            )}
          </div>

          {memory.musicTrack && (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-background p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                  Trilha Sonora
                </span>
                <span className="block text-xs font-bold text-text">
                  {memory.musicArtist ? `${memory.musicArtist} — ` : ''}
                  {memory.musicTrack}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            {memory.weatherDesc && (
              <span className="rounded-xl border border-card bg-background px-3 py-1.5 text-amber-300">
                {memory.weatherIcon || '🌤'} {memory.weatherDesc}
              </span>
            )}
            {memory.locationName && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
                <MapPin className="h-3 w-3" />
                {memory.locationName}
              </span>
            )}
            {memory.people.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
                <Users className="h-3 w-3" />
                {memory.people.map((person) => person.name).join(', ')}
              </span>
            )}
            {memory.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary"
              >
                <Tag className="h-3 w-3" />
                {tag.name}
              </span>
            ))}
          </div>

          {memory.photos.length > 0 && (
            <PhotoGallery
              photos={memory.photos}
              heading={null}
              className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3"
              itemClassName="h-44 rounded-2xl border border-card aspect-auto"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          )}

          {memory.aiNarrative && (
            <div className="border-t border-card/60 pt-4">
              <p className="font-serif text-sm leading-relaxed italic text-gray-300">
                {memory.aiNarrative}
              </p>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
```

Notes:
- People and tags are **plain spans, not buttons** — the card's chips navigate to `/search`, which is meaningless (and auth-gated) for an anonymous visitor of a share link.
- Avatar uses `<img>` (like `audio-player.tsx` already does): `users.image` may point at domains the `next/image` config does not allow (`remotePatterns` only lists `localhost:9000` and `i.scdn.co`).
- No weather temp: the approved whitelist (spec §3) names `weatherDesc`/`weatherIcon` only.

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src
git add apps/web/src/app/share apps/web/src/components/share-preview.tsx
git commit -m "feat(web): add public share preview page"
```

---

### Task 8: Web — `/share` list page + profile link

**Files:**
- Create: `apps/web/src/hooks/use-shared-links.ts`
- Create: `apps/web/src/app/(dashboard)/share/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/profile/page.tsx`

- [ ] **Step 1: Create the list query hook**

Create `apps/web/src/hooks/use-shared-links.ts`:

```ts
'use client'

import { api } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export interface SharedLink {
  id: string
  title: string
  memoryDate: string
  token: string
  expiresAt: string
}

export function useSharedLinks() {
  return useQuery<{ data: SharedLink[] }>({
    queryKey: ['shared-links'],
    queryFn: async () => {
      return api.get<{ data: SharedLink[] }>('/api/memories/shared')
    },
  })
}
```

- [ ] **Step 2: Create the page**

Create `apps/web/src/app/(dashboard)/share/page.tsx`:

```tsx
'use client'

import { RequireAuth } from '@/components/require-auth'
import { useRevokeShare } from '@/hooks/use-revoke-share'
import { type SharedLink, useSharedLinks } from '@/hooks/use-shared-links'
import { Button, Card } from '@chronicle/ui'
import { Copy, Link2, Share2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

function formatDay(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

export default function SharedLinksPage() {
  return (
    <RequireAuth>
      <SharedLinksContent />
    </RequireAuth>
  )
}

function SharedLinksContent() {
  const { data, isLoading } = useSharedLinks()
  const revoke = useRevokeShare()

  const handleCopy = async (link: SharedLink) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const handleRevoke = (link: SharedLink) => {
    revoke.mutate(link.id, {
      onSuccess: () => toast.success(`Link de "${link.title}" revogado`),
      onError: () => toast.error('Erro ao revogar o link'),
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Share2 className="h-6 w-6 text-muted" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">Compartilhamentos</h1>
      </div>
      <p className="mb-8 text-sm text-muted">
        Memórias com link ativo. Revogar mata o link na hora; renovar gera um token novo com 7
        dias.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted" data-testid="share-list-loading">
          Carregando...
        </p>
      ) : !data || data.data.length === 0 ? (
        <Card className="border-card bg-card p-6">
          <p className="text-sm text-muted" data-testid="share-list-empty">
            Nenhuma memória está compartilhada no momento.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((link) => (
            <li key={link.id}>
              <Card className="border-card bg-card p-4" data-testid={`share-item-${link.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate font-medium text-text"
                      data-testid={`share-title-${link.id}`}
                    >
                      {link.title}
                    </p>
                    <p className="text-xs text-muted" data-testid={`share-expires-${link.id}`}>
                      {formatDay(link.memoryDate)} · expira em{' '}
                      {new Date(link.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(link)}
                      className="border-card text-text hover:border-primary hover:text-primary"
                      data-testid={`share-copy-${link.id}`}
                    >
                      <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRevoke(link)}
                      disabled={revoke.isPending}
                      className="border-card text-red-500 hover:border-red-500 hover:text-red-600"
                      data-testid={`share-revoke-${link.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Revogar
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link
          href="/profile"
          className="text-sm text-muted transition-colors hover:text-primary"
          data-testid="share-back-profile"
        >
          Voltar ao perfil
        </Link>
      </div>
    </div>
  )
}
```

(The `formatDay` helper is deliberately local — `trash/page.tsx` carries its own copy too; a shared util for two callers is not worth the import.)

- [ ] **Step 3: Add the profile link**

In `apps/web/src/app/(dashboard)/profile/page.tsx`, add `Link2` to the `lucide-react` import, then insert after the `profile-trash-link` Link:

```tsx
            <Link
              href="/share"
              data-testid="profile-share-link"
              className="inline-flex items-center gap-2 rounded-lg border border-card px-4 py-2 text-sm font-medium text-muted transition-all hover:border-primary/40 hover:text-primary"
            >
              <Link2 className="h-4 w-4" />
              Compartilhamentos
            </Link>
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter web typecheck
pnpm exec biome check --write apps/web/src
git add apps/web/src
git commit -m "feat(web): add shared links list page"
```

---

### Task 9: E2E — generation, anonymous preview, revocation, list

**Files:**
- Create: `apps/web/src/__tests__/share-link.spec.ts`

- [ ] **Step 1: Write the spec**

Create `apps/web/src/__tests__/share-link.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

test.describe('Compartilhamento', () => {
  test('generates a link, shows the redacted preview anonymously, and revokes it', async ({
    authenticatedPage,
    browser,
  }) => {
    const title = 'Churrasco na casa da vó'
    const memoryId = await createMemory(authenticatedPage, {
      title,
      memoryDate: '2026-09-20',
      content: 'Todo mundo cantou junto.',
      isPublic: false,
    })

    await authenticatedPage.goto('/')
    const card = authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)
    await expect(card).toBeVisible()
    await card.locator('[data-testid="card-share"]').click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('share-none')).toBeVisible()

    await dialog.getByTestId('share-generate').click()
    await expect(dialog.getByTestId('share-active')).toBeVisible()

    const urlText = (await dialog.getByTestId('share-url').textContent()) ?? ''
    expect(urlText).toContain('/share/')
    const token = urlText.trim().split('/share/')[1]
    expect(token).toBeTruthy()

    // Fresh context = no cookies: the visitor is anonymous.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/share/${token}`)

    await expect(anonPage.getByTestId('share-title')).toHaveText(title)
    await expect(anonPage.getByText('Todo mundo cantou junto.')).toBeVisible()
    await expect(anonPage.getByTestId('share-author')).toBeVisible()
    // The redaction is the whole point of the preview: no author PII, ever.
    await expect(anonPage.locator('body')).not.toContainText('deb@test.com')
    await expect(anonPage.locator('body')).not.toContainText('locationLat')
    await anonContext.close()

    // Revoke from the still-open dialog, then the same URL must be dead.
    await dialog.getByTestId('share-revoke').click()
    await expect(dialog.getByTestId('share-none')).toBeVisible()

    const afterContext = await browser.newContext()
    const afterPage = await afterContext.newPage()
    await afterPage.goto(`/share/${token}`)
    await expect(afterPage.getByTestId('share-invalid')).toBeVisible()
    await expect(afterPage.getByText('Link inválido ou expirado')).toBeVisible()
    await afterContext.close()
  })

  test.describe('lista de compartilhamentos', () => {
    // Clipboard permissions have to be on the context before it opens, and the
    // fixture builds that context from `contextOptions`.
    test.use({ contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] } })

    test('lists shared links with copy and revoke', async ({ authenticatedPage }) => {
      const memoryId = await createMemory(authenticatedPage, {
        title: 'Segredo compartilhado',
        memoryDate: '2026-09-21',
        isPublic: false,
      })
      const shareResponse = await authenticatedPage.request.post(
        `${API_URL}/api/memories/${memoryId}/share`,
      )
      expect(shareResponse.ok()).toBe(true)
      const { data } = (await shareResponse.json()) as { data: { token: string } }

      await authenticatedPage.goto('/profile')
      await authenticatedPage.locator('[data-testid="profile-share-link"]').click()
      await expect(authenticatedPage.getByTestId(`share-item-${memoryId}`)).toBeVisible()
      await expect(authenticatedPage.getByTestId(`share-expires-${memoryId}`)).toContainText(
        'expira em',
      )

      await authenticatedPage.locator(`[data-testid="share-copy-${memoryId}"]`).click()
      const clipboard = await authenticatedPage.evaluate(() => navigator.clipboard.readText())
      expect(clipboard).toBe(`${authenticatedPage.url().split('/share')[0]}/share/${data.token}`)

      await authenticatedPage.locator(`[data-testid="share-revoke-${memoryId}"]`).click()
      await expect(authenticatedPage.getByTestId(`share-item-${memoryId}`)).toHaveCount(0)
      await expect(authenticatedPage.getByTestId('share-list-empty')).toBeVisible()
    })
  })
})
```

Notes:
- Expiry behavior itself (past `expiresAt`) is covered in service/integration tests (Task 4) — E2E does not manipulate time.
- The clipboard assertion builds the URL from the page origin; if it proves flaky in the local Chromium, drop the `evaluate` read and keep the click + item assertions — the clipboard path is the least durable part.

- [ ] **Step 2: Run the spec**

First make sure no stale servers hold the ports:

```bash
lsof -ti:3000,3333 2>/dev/null | xargs kill -9
```

Run: `pnpm --filter web exec playwright test --project=chromium src/__tests__/share-link.spec.ts`
Expected: PASS (2 tests). If the first run fails on an actual product bug, fix the product — not the test — unless the failure is the clipboard note above.

- [ ] **Step 3: Run the full chromium suite**

Run: `pnpm --filter web exec playwright test --project=chromium`
Expected: PASS — 67 tests (65 existing + 2 new).

- [ ] **Step 4: Commit**

```bash
pnpm exec biome check --write apps/web/src/__tests__/share-link.spec.ts
git add apps/web/src/__tests__/share-link.spec.ts
git commit -m "test(e2e): cover share link generation, preview and revocation"
```

---

### Task 10: Gates, `docs/tasks.md`, final commit

**Files:**
- Modify: `docs/tasks.md`

- [ ] **Step 1: Run every gate**

```bash
pnpm lint:fix
pnpm typecheck --force
pnpm build
pnpm test
lsof -ti:3000,3333 2>/dev/null | xargs kill -9
pnpm --filter web exec playwright test --project=chromium
```

Expected: lint 0 avisos · typecheck 10/10 · build 6/6 · test 8/8 (API suite now includes 20 share tests) · Playwright chromium 67/67.

- [ ] **Step 2: Update `docs/tasks.md`**

Replace the four `- [ ]` items of section `### 7.4 Compartilhamento` with:

```markdown
### 7.4 Compartilhamento
- [x] Link privado com token expirável para memórias não públicas — colunas
      `share_token`/`share_expires_at` em `memories` + índice parcial único
      (migration `0004`, gerada por `drizzle-kit generate` e aplicada via `psql`).
      `POST /api/memories/:id/share` cria ou rotaciona (token de 32 bytes
      base64url, expira em 7 dias), `DELETE .../share` revoga (idempotente),
      `GET /api/share/:token` entrega a prévia pública. Token desconhecido,
      expirado e memória deletada respondem o **mesmo** 404
      (`Link inválido ou expirado`) — distinguir seria um oráculo de enumeração.
      Dono errado responde 404 (mesmo critério do export da 7.3).
- [x] Nível de acesso por memória além de público/privado — estado derivado
      (`público` → `is_public`; `compartilhado` → `!is_public` + token não nulo +
      não expirado; `privado` → o resto), sem coluna explícita: qualquer
      `update` que carregue `isPublic` **limpa o token**, então alternar
      público/privado nunca ressuscita um link (invariante travada em teste).
      Feed e detalhe público **nunca selecionam** o token (`memoryColumns` não
      o inclui); `findById` só o devolve ao dono.
- [x] Prévia redigida para memória compartilhada (sem dados sensíveis do autor) —
      `GET /api/share/:token` monta o payload por **whitelist** campo a campo:
      conteúdo completo da memória + `author { name, image }`; nunca `email`,
      `userId`, lat/lng, `aiMood`, timestamps ou o próprio token (teste varre a
      resposta). Página pública `/share/[token]` com `robots: noindex`, estado
      404 próprio e pessoas/tags como texto (sem navegação para visitante
      anônimo).
- [x] Lista de memórias compartilhadas e revogação de acesso —
      `GET /api/memories/shared` (401 sem sessão, só links ativos) + página
      `/share` (RequireAuth) com copiar/revogar e estado vazio, entrada por
      `profile-share-link`. No card, ação "Compartilhhar" (só quando privada)
      abre dialog com estado do link, Gerar/Renovar, Copiar e Revogar — usa o
      mesmo `useRevokeShare` da lista.
```

And add below it:

```markdown
#### Gates da 7.4
`pnpm build` 6/6 · `pnpm typecheck --force` 10/10 · `pnpm test` 8/8 (API 195, schemas 57,
db 12, auth 3) · `biome check` 0 avisos · Playwright chromium **67/67**

> Obs.: o spec `docs/superpowers/specs/2026-09-29-phase-7-4-sharing-design.md` descreve o
> preview em `/share/[token]` e a lista em `/share` — rotas paralelas legais (URLs
> distintas). `music: {...}` na seção 3 do spec são os campos planos
> `musicTrack/musicArtist/musicUrl/musicCover`, para o preview renderizar como o card.
```

(Adjust the API/db test counts to the numbers the run actually reports — do not invent them: run `pnpm test` first and read the summaries.)

- [ ] **Step 3: Final commit**

```bash
pnpm exec biome check --write docs/tasks.md
git add docs/tasks.md
git commit -m "docs: mark 7.4 as complete"
git status
```

Expected: clean tree (if `git status` shows the regenerated Next agent-docs block or anything unexpected, inspect before committing — do not sweep unknown files into the commit).

---

## Self-review (run after writing the plan, before executing)

1. **Spec coverage** — §1 model → Task 1 (+ invariant in Task 2); §2.1/2.2/2.3 routes → Tasks 4–5; §2.4 list → Tasks 2–3; §2.5 owner-only detail → Task 2; §3 whitelist → Task 4; §4 preview page → Task 7; §5.1 dialog → Task 6; §5.2 list page → Task 8; §7 tests → Tasks 1–5, 9; gates → Task 10. Limitations/spec-notes recorded in Task 10's tasks.md block.
2. **Placeholders** — none: every step carries code, exact paths, commands and expected output.
3. **Type consistency** — DTO names `token`/`expiresAt` (service → route → hook `SharedLink`), testids `card-share`, `share-{active,none,url,generate,copy,revoke,invalid,author,title,loading}`, `share-item/title/expires/copy/revoke-<id>`, `share-list-empty`, `profile-share-link`, `share-back-profile`. Query keys `['memory', id]` (shared with `use-memory.ts`), `['shared-links']`, `['share', token]`.
