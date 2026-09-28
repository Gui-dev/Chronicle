import { and, db, eq, ilike, memories, or, sql, users } from '@chronicle/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { memoriesService } from '../memories.service'

// The statements the driver was handed, in the order the service issued them.
//
// `drizzle-orm/pg-proxy` is a driver whose "connection" is this callback, so the
// service runs its real code path — real schema, real operators, real query
// builder, real `leftJoin` — and what lands in this array is the exact text
// postgres.js would have received.
//
// This file exists because the mock in `memories.service.spec.ts` cannot see the
// grouping. Its `or` is `{ op: 'or', conds }`: there is nowhere in that shape to
// record whether the group is parenthesised, and the shape is what that file
// asserts. The measured consequence is narrower than "it misses the bug" —
// rewriting the author predicate as a `sql` template does turn that file red, on
// the claim "the predicate is no longer an `or` node". That is a different
// failure from "the clause renders without parentheses", and it is a claim about
// a mock rather than about SQL.
//
// The finding behind that: with `drizzle-orm`, the parentheses *are* the node
// structure — `and`/`or` wrap two or more operands, always — so there is no edit
// to the service that loses the grouping while keeping the node. The one route
// drizzle leaves open is a `sql` template, whose text is emitted verbatim, and
// the counterexample test below builds the leak that way. This file pins the
// rendered text so the question is asked of the artefact that actually runs.
//
// `drizzle-orm/pg-proxy` is preferred over `postgres('postgres://', { max: 0 })`
// plus `.toSQL()` because there is no client here at all, so there is nothing
// that *could* connect: no socket, no DNS, no port. Its output is
// byte-identical to `drizzle-orm/postgres-js`'s `.toSQL()` for the same query
// (verified by hand against a `max: 0` client), so nothing about the assertions
// below depends on which driver is swapped in.
const executed = vi.hoisted(() => [] as Array<{ sql: string; params: unknown[] }>)

// The schema is taken from `@chronicle/db/src/schema` and not from the
// `@chronicle/db` barrel, which re-exports `db` — a real postgres client built
// out of `env.ts`'s `DATABASE_URL`, and `env.ts` throws without one. The deep
// path is pure table definitions, so this file needs no database, no `.env` and
// no network, which is the only reason it can run in CI.
//
// The factory replaces `db` and nothing else. Everything the service imports —
// the tables, `and`, `or`, `eq`, `ilike`, `sql` — is the real one, which is the
// whole point: only the connection is fake, so the clause under test is the one
// that will run.
//
// This file imports those from `@chronicle/db` rather than from `drizzle-orm`
// for a type reason. `drizzle-orm` is now a devDependency here, and pnpm linked
// it as a second copy alongside the one `packages/db` resolved — same version,
// different optional-peer set, so a different peer hash. A file that used
// `drizzle-orm` and the schema side by side would fail `tsc` on class identity
// (two structurally identical `Column` classes, one of them with a protected
// member) even though at runtime they are interchangeable: `drizzle-orm`'s
// `is()` falls back to a `Symbol.for` lookup, which is why the SQL below renders
// correctly either way. Going through the barrel keeps every symbol this file
// touches on one instance. The `await import('drizzle-orm')` inside the factory
// is the one place the second copy is used, and it only ever hands real operators
// to the service — the same situation `memories.service.ts` is already in.
vi.mock('@chronicle/db', async () => {
  const { and, desc, eq, gte, ilike, inArray, lt, or, sql } = await import('drizzle-orm')
  const { drizzle } = await import('drizzle-orm/pg-proxy')
  const { memories, memoryPeople, memoryPhotos, memoryTags, users } = await import(
    '@chronicle/db/src/schema'
  )

  const schema = { memories, memoryPeople, memoryPhotos, memoryTags, users }

  return {
    ...schema,
    and,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lt,
    or,
    sql,
    db: drizzle(
      async (query: string, params: unknown[]) => {
        executed.push({ sql: query, params })
        // The count query is selected *as* `count(*)` and the service reads
        // `countResult.count` off the first row, so an empty result set here
        // throws a TypeError before any assertion runs. The rows query gets no
        // rows on purpose: an empty page skips the three relation batches, so the
        // recorded statements are the rows query and the count query and nothing
        // else.
        return /count\(\*\)/.test(query) ? { rows: [{ count: 0 }] } : { rows: [] }
      },
      { schema },
    ),
  }
})

const filters = (overrides: Record<string, unknown> = {}) =>
  ({
    page: 1,
    limit: 20,
    ...overrides,
  }) as Parameters<typeof memoriesService.findAll>[0]

// The signed-in author search: the one query in the service that puts an `or`
// next to the privacy `or` inside a single `and`. A session is required — the
// privacy filter is the two-armed `or` rather than a bare `is_public = true` —
// and `@bruce` is required to put the second `or` there at all.
const searchByAuthor = async () => {
  await memoriesService.findAll(filters({ search: '@bruce' }), { userId: 'user-1' })
  return executed
}

// The `where` clause and nothing else. Comparing whole statements would pin the
// projection and the join as well, which are other tests' business, and every
// column rename would then fail here too.
//
// Read by parenthesis depth rather than by cutting at ` order by`, because the
// top-level `and` wraps its own operands and the clauses that follow it sit
// *outside* those parentheses. The count is safe to ignore for the same reason:
// this service never interpolates a value into the text, it binds one, so every
// literal here is a `$n` placeholder.
const whereOf = (query: string) => {
  const marker = ' where '
  const at = query.indexOf(marker)
  if (at === -1) throw new Error(`no where clause in: ${query}`)
  const start = at + marker.length
  let depth = 0
  let i = start
  for (; i < query.length; i += 1) {
    if (query[i] === '(') depth += 1
    else if (query[i] === ')') depth -= 1
    else if (depth === 0) break
  }
  return query.slice(start, i)
}

// Placeholders renumbered, so two statements can be compared as predicates
// rather than as strings. The count query evaluates its `count(*)` projection
// ahead of the `where`, so its predicate is numbered from `$5` rather than `$1`.
const renumber = (query: string) => query.replace(/\$\d+/g, '$?')

// The boolean operators of a clause, each with how deeply it is nested.
//
// Identifiers are dropped first, because a column or table whose name contains
// `and` or `or` — `brand`, `author` — would otherwise be read as an operator.
// Drizzle quotes every identifier, so removing quoted spans cannot swallow a
// real operator. What is left is `=`, `ilike`, the placeholders and the
// operators, and the placeholders carry no letters to match by accident.
const booleanOps = (where: string) => {
  const bare = where.replace(/"[^"]*"/g, '""')
  const ops: Array<{ op: 'and' | 'or'; depth: number }> = []
  let depth = 0
  for (const token of bare.match(/[()]|\b(?:and|or)\b/gi) ?? []) {
    if (token === '(') depth += 1
    else if (token === ')') depth -= 1
    else ops.push({ op: token.toLowerCase() as 'and' | 'or', depth })
  }
  return ops
}

describe('MemoriesService generated SQL', () => {
  beforeEach(() => {
    executed.length = 0
  })

  it('parents the privacy or and the author or inside the top-level and', async () => {
    const [rows] = await searchByAuthor()

    // The whole clause, placeholders included. `$1`/`$2` are the privacy pair
    // and `$3`/`$4` the author pair, and the numbering is what ties the text to
    // the params below: `is_public = true` first, then the *signed-in* user's
    // id. The claim is the shape — a single `and` whose two operands are each a
    // parenthesised `or` — not the spacing.
    expect(whereOf(rows.sql)).toBe(
      '(("memories"."is_public" = $1 or "memories"."user_id" = $2)' +
        ' and ("users"."name" ilike $3 or "users"."email" ilike $4))',
    )

    // `limit` is the only trailing param on this query: `page: 1, limit: 20`
    // gives `offset 0`, which the builder omits.
    expect(rows.params).toEqual([true, 'user-1', '%bruce%', '%bruce%', 20])
  })

  it('nests both ors inside the and rather than beside it', async () => {
    const [rows] = await searchByAuthor()

    // The security claim, as a property of the rendered text rather than of one
    // spelling of it. Postgres binds `AND` tighter than `OR`, so the question
    // is not "are there parentheses" but "does any `or` sit *beside* the
    // top-level `and`". The `drizzle-orm` `and`/`or` helpers always wrap two or
    // more operands, so that outermost pair is the top-level `and`'s own — hence
    // `and` at depth 1 with each `or` at depth 2.
    //
    // The failure this exists for: an `or` written as a `sql` template rather
    // than as `or(...)` carries no parentheses of its own, because the template
    // text is passed through verbatim. The clause then renders as
    // `is_public = $1 and name ilike $3 OR email ilike $4` inside the outer
    // group, which Postgres reads as `(privacy) and name ilike` OR
    // `email ilike` — so the second arm is no longer restricted by the privacy
    // filter at all, and `@bruce` returns every memory, private ones included,
    // that belongs to an author whose *email* matches. The author's own search
    // is the one query where a reader can see other users' private memories.
    // The title/content term in this same service already lost its parentheses
    // that way once, which is why its test pins the template text. The test
    // below is the counterexample: it renders that edit and shows these depths
    // do not survive it.
    expect(booleanOps(whereOf(rows.sql))).toEqual([
      { op: 'or', depth: 2 },
      { op: 'and', depth: 1 },
      { op: 'or', depth: 2 },
    ])
  })

  it('rejects the same clause once the author or loses its parentheses', async () => {
    // Deliberately reads nothing from the service. This is a statement about the
    // check above, not about the service: it renders the leak that check exists
    // to catch and pins what the renderer makes of it. The service's own clause
    // is what tests one and two assert, so those are where a change to the
    // service has to show up. Tying this one to the service's output would have
    // made it fail a second time for the same single edit — which is noise, not
    // coverage.
    await db
      .select({ id: memories.id })
      .from(memories)
      .where(
        and(
          or(eq(memories.isPublic, true), eq(memories.userId, 'user-1')),
          sql`${ilike(users.name, '%bruce%')} OR ${ilike(users.email, '%bruce%')}`,
        ),
      )

    const leaked = whereOf(executed[executed.length - 1].sql)

    // The parentheses that are gone, visible in the text: `and` and then a bare
    // `OR`. Read as `(is_public or user_id) and name ilike` OR `email ilike`,
    // the second arm is not restricted by the privacy filter at all, so the
    // search answers with other users' private memories. Built with the same
    // operators, the same tables and the same driver as the query above — the
    // only difference is that the two `ilike`s are joined by a `sql` template
    // instead of by `or(...)`, and a template's text is emitted verbatim, so the
    // parentheses `or()` supplies are simply absent.
    expect(leaked).toBe(
      '(("memories"."is_public" = $1 or "memories"."user_id" = $2)' +
        ' and "users"."name" ilike $3 OR "users"."email" ilike $4)',
    )

    // The difference the assertion above sees is a depth, not a spelling: the
    // second `or` has come up a level and now sits *beside* the `and` instead
    // of inside it, which is the whole of the leak. Compare this with the depths
    // the test above demands, and the reason that test is worth having at all.
    expect(booleanOps(leaked)).toEqual([
      { op: 'or', depth: 2 },
      { op: 'and', depth: 1 },
      { op: 'or', depth: 1 },
    ])
  })

  it('restricts the count query with the same predicate as the rows query', async () => {
    const [rows, count] = await searchByAuthor()

    // `conditions` is one array shared by both queries, so the object-level
    // equality the other spec asserts cannot tell a count query that renders
    // the predicate from one that does not — but a count query that lost it is
    // a `total` that counts the whole feed, and paging built on that `total`
    // walks memories the reader may not read. Compared after renumbering
    // because the projection is built before the `where`.
    expect(renumber(whereOf(count.sql))).toBe(renumber(whereOf(rows.sql)))
    expect(count.params).toEqual([true, 'user-1', '%bruce%', '%bruce%'])
  })
})
