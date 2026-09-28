import {
  and,
  db,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  memories,
  memoryPeople,
  memoryPhotos,
  memoryTags,
  or,
  sql,
  users,
} from '@chronicle/db'
import type { Memory, MemoryPerson, MemoryPhoto, MemoryTag } from '@chronicle/db'
import type { MemoryFiltersInput } from '@chronicle/schemas'
import { type ParsedSearchQuery, isEmptySearch, parseSearchQuery } from '@chronicle/schemas'
import { AppError } from '../../errors/app-error'

// A range predicate, not EXTRACT: `EXTRACT(YEAR FROM memory_date) = 2026` wraps
// the column in a function, so Postgres can never satisfy it with an index.
// A half-open interval over the raw column is sargable. The bounds are UTC
// instants, while `localDate` stores a local wall clock, so this only matches
// the old EXTRACT when the server and the session run in UTC — checked by hand
// in Task 5.
function dateRange(year: number, month?: number) {
  return {
    start: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
    end: new Date(Date.UTC(year, month ?? 12, 1)),
  }
}

function groupByMemory<T extends { memoryId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    const bucket = grouped.get(row.memoryId)
    if (bucket) bucket.push(row)
    else grouped.set(row.memoryId, [row])
  }
  return grouped
}

// Every `memories` column, named. A bare `select()` is `SELECT *`, and once the
// author search joins `users` the star expands to `users.name`, `users.email`,
// `users.image` and `users.email_verified` as well — every author's real email
// address on every row of a feed that is readable by anyone.
//
// The star also collides on `id`, which is the worse of the two. Both tables
// have one, the row object keeps a single `id` key, and postgres.js resolves the
// duplicate to the LAST occurrence — so `id` becomes the *user's*. Nothing
// throws: `results.map(r => r.id)` below hands the relation queries a list of
// user ids, those `inArray` batches match nothing, and every card renders with
// no photos, no people and no tags while the page looks otherwise healthy.
//
// Naming the columns keeps the returned row identical to the pre-join shape, so
// `Memory` still infers correctly and the id the batches use is the memory's.
// The spec pins this exact key set, so a column added to `memories` fails that
// test and has to be listed here on purpose.
const memoryColumns = {
  id: memories.id,
  userId: memories.userId,
  title: memories.title,
  content: memories.content,
  memoryDate: memories.memoryDate,
  locationName: memories.locationName,
  locationLat: memories.locationLat,
  locationLng: memories.locationLng,
  weatherTemp: memories.weatherTemp,
  weatherDesc: memories.weatherDesc,
  weatherIcon: memories.weatherIcon,
  musicTrack: memories.musicTrack,
  musicArtist: memories.musicArtist,
  musicUrl: memories.musicUrl,
  musicCover: memories.musicCover,
  isPublic: memories.isPublic,
  aiNarrative: memories.aiNarrative,
  aiMood: memories.aiMood,
  aiThemes: memories.aiThemes,
  createdAt: memories.createdAt,
  updatedAt: memories.updatedAt,
} as const

export class MemoriesService {
  async create(
    userId: string,
    data: {
      title: string
      content?: string
      memoryDate: Date
      locationName?: string
      locationLat?: number
      locationLng?: number
      weatherTemp?: number
      weatherDesc?: string
      weatherIcon?: string
      musicTrack?: string
      musicArtist?: string
      musicUrl?: string
      musicCover?: string
      people?: string[]
      tags?: string[]
      isPublic?: boolean
    },
  ) {
    const [memory] = await db
      .insert(memories)
      .values({
        userId,
        title: data.title,
        content: data.content,
        memoryDate: data.memoryDate,
        locationName: data.locationName,
        locationLat: data.locationLat?.toString(),
        locationLng: data.locationLng?.toString(),
        weatherTemp: data.weatherTemp?.toString(),
        weatherDesc: data.weatherDesc,
        weatherIcon: data.weatherIcon,
        musicTrack: data.musicTrack,
        musicArtist: data.musicArtist,
        musicUrl: data.musicUrl,
        musicCover: data.musicCover,
        isPublic: data.isPublic ?? true,
      })
      .returning()

    // Add people
    if (data.people && data.people.length > 0) {
      await db.insert(memoryPeople).values(
        data.people.map((name) => ({
          memoryId: memory.id,
          name,
        })),
      )
    }

    // Add tags
    if (data.tags && data.tags.length > 0) {
      await db.insert(memoryTags).values(
        data.tags.map((name) => ({
          memoryId: memory.id,
          name,
        })),
      )
    }

    return memory
  }

  async findAll(filters: MemoryFiltersInput, options?: { userId?: string }) {
    const { year, month, weather, location, tag, search, page, limit, mine } = filters
    const userId = options?.userId

    const conditions = []

    if (mine === true) {
      if (!userId) {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        }
      }
      conditions.push(eq(memories.userId, userId))
    } else {
      conditions.push(
        userId
          ? or(eq(memories.isPublic, true), eq(memories.userId, userId))
          : eq(memories.isPublic, true),
      )
    }

    // The query string is parsed once and every dimension is read off the result.
    const grammar: ParsedSearchQuery | null = search ? parseSearchQuery(search) : null
    const hasGrammar = grammar !== null && !isEmptySearch(grammar)

    // Precedence (spec §2.3): for the same dimension the grammar wins and the URL
    // param is discarded with no trace. `?weather=Sol` with `clima:chuva` searches
    // only `chuva`, and the caller is left showing `Sol` — the filter controls
    // mirroring the query is the UI's problem, not a reason to change this.
    // `?tag=` is the one deliberate exception: it is a separate filter rather than
    // a grammar dimension, so the `if (tag)` block below ANDs its own EXISTS with
    // the grammar's. The two rules differ on purpose; do not "fix" one of them
    // into matching the other.
    //
    // A month filter is only meaningful within a year, and the spec resolves
    // `month` without `year` to the current one. `memory-filters.tsx` sets the
    // year alongside the month so the UI never sends the bare case silently.
    //
    // This service does not re-validate `filters` — `memoryFiltersSchema` at the
    // route is what keeps a bad month out, and `?month=0` is a 400 there. The
    // `Number`/`isFinite` pair is what survives a caller that skips that schema,
    // and it has one live case: `NaN` is assignable to `number`, so a `month: NaN`
    // would otherwise reach `dateRange` and build an Invalid Date. Under the
    // schema both are dead, and they stay because that guarantee lives in another
    // file and has to hold for whoever calls `findAll` next.
    const effectiveMonthRaw = grammar?.month ?? month
    const effectiveMonth = effectiveMonthRaw === undefined ? undefined : Number(effectiveMonthRaw)
    const hasMonth = effectiveMonth !== undefined && Number.isFinite(effectiveMonth)
    const effectiveYear =
      grammar?.year ?? year ?? (hasMonth ? new Date().getUTCFullYear() : undefined)
    const effectiveWeather = grammar?.weather ?? weather
    const effectiveLocation = grammar?.location ?? location

    if (effectiveYear) {
      const { start, end } = dateRange(effectiveYear, hasMonth ? effectiveMonth : undefined)
      conditions.push(gte(memories.memoryDate, start), lt(memories.memoryDate, end))
    }

    if (effectiveWeather) {
      conditions.push(ilike(memories.weatherDesc, `%${effectiveWeather}%`))
    }

    if (effectiveLocation) {
      conditions.push(ilike(memories.locationName, `%${effectiveLocation}%`))
    }

    // The author is read once, off the same `grammar` the other dimensions use,
    // and it is deliberately NOT folded into the `if (hasGrammar)` block below.
    // That block pushes a predicate over `users`, and the queries below only
    // join `users` when this value is set — so the two have to be decided from
    // one place. Leaving the predicate inside `hasGrammar` makes the agreement
    // depend on `isEmptySearch` counting `author`, which is true today and is
    // nobody's stated reason. A `where` naming an unjoined table is a 500, and
    // a join with no predicate is a slower query that returns the wrong rows.
    const author = grammar?.author ?? null

    if (author) {
      conditions.push(or(ilike(users.name, `%${author}%`), ilike(users.email, `%${author}%`)))
    }

    if (hasGrammar) {
      // Loose terms and quoted phrases are AND-ed with each other, each one OR-ed
      // across title/content: "praia sol" means both words are present, each in
      // either column. A phrase is a term that has to appear whole, and the
      // padding is ours, so the quotes the user typed never reach the SQL.
      const terms = [...grammar.text, ...grammar.phrases]
      for (const term of terms) {
        conditions.push(
          sql`(${ilike(memories.title, `%${term}%`)} OR ${ilike(memories.content, `%${term}%`)})`,
        )
      }

      for (const tag of grammar.tags) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${memoryTags}
            WHERE ${memoryTags.memoryId} = ${memories.id}
            AND ${ilike(memoryTags.name, `%${tag}%`)}
          )`,
        )
      }
    }

    if (tag) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${memoryTags}
          WHERE ${memoryTags.memoryId} = ${memories.id}
          AND ${ilike(memoryTags.name, `%${tag}%`)}
        )`,
      )
    }

    const offset = (page - 1) * limit

    // `memories.user_id` -> `users.id` is many-to-one on the target table's
    // primary key, so the join adds at most one row per memory: it cannot
    // duplicate a memory, and `count(*)` below stays the number of memories
    // matching the filter. Both queries take the join or neither. The count one
    // is not optional bookkeeping — it shares `conditions` with the rows query,
    // so once the author predicate is in there, a count query without the join
    // is `where users.name ilike ...` with `users` absent from the FROM clause.
    //
    // The call order is safe: Drizzle defers SQL generation to `.toSQL()`, so
    // `leftJoin` after `.limit()`/`.offset()` emits the join in the FROM clause
    // ahead of `where`, `order by` and `limit` regardless of the order the
    // builder methods were called in. Verified against `.toSQL()`.
    const authorJoin = eq(memories.userId, users.id)
    const needsAuthorJoin = author !== null

    const baseRows = db
      .select(memoryColumns)
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.memoryDate))
      .limit(limit)
      .offset(offset)

    const baseCount = db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(...conditions))

    const results = needsAuthorJoin ? await baseRows.leftJoin(users, authorJoin) : await baseRows

    // One query per relation for the whole page. The previous per-memory
    // version issued 3N queries on top of the rows and count, which made the
    // timeline cost grow with the page size.
    const enrichedResults: Array<
      Memory & { photos: MemoryPhoto[]; people: MemoryPerson[]; tags: MemoryTag[] }
    > = results.map((memory) => ({ ...memory, photos: [], people: [], tags: [] }))

    if (results.length > 0) {
      const ids = results.map((m) => m.id)
      const [photoRows, peopleRows, tagRows] = await Promise.all([
        db.select().from(memoryPhotos).where(inArray(memoryPhotos.memoryId, ids)),
        db.select().from(memoryPeople).where(inArray(memoryPeople.memoryId, ids)),
        db.select().from(memoryTags).where(inArray(memoryTags.memoryId, ids)),
      ])

      const photoMap = groupByMemory(photoRows as MemoryPhoto[])
      const peopleMap = groupByMemory(peopleRows as MemoryPerson[])
      const tagMap = groupByMemory(tagRows as MemoryTag[])

      for (const memory of enrichedResults) {
        // inArray returns rows in an unspecified order, so photos are sorted by
        // orderIndex once they are grouped. Nothing sets orderIndex on upload
        // yet, so today the sort is a stable no-op; it stays because inArray
        // will not start promising an order.
        const ordered = [...(photoMap.get(memory.id) ?? [])].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        )
        memory.photos = ordered
        memory.people = peopleMap.get(memory.id) ?? []
        memory.tags = tagMap.get(memory.id) ?? []
      }
    }

    const [countResult] = needsAuthorJoin
      ? await baseCount.leftJoin(users, authorJoin)
      : await baseCount

    // postgres returns count(*) as a string (int8), so `total` has to be
    // coerced: callers compare it against numbers, and the profile pluralises
    // on `total === 1`, which a "1" would never match.
    const total = Number(countResult.count)

    return {
      data: enrichedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findById(id: string, userId?: string) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (!memory.isPublic && memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    const peopleRows = await db.select().from(memoryPeople).where(eq(memoryPeople.memoryId, id))

    const tagRows = await db.select().from(memoryTags).where(eq(memoryTags.memoryId, id))

    const photoRows = await db
      .select()
      .from(memoryPhotos)
      .where(eq(memoryPhotos.memoryId, id))
      .orderBy(memoryPhotos.orderIndex)

    return {
      ...memory,
      people: peopleRows,
      tags: tagRows,
      photos: photoRows,
    }
  }

  async update(
    id: string,
    userId: string,
    data: {
      title?: string
      content?: string
      memoryDate?: Date
      locationName?: string
      locationLat?: number
      locationLng?: number
      weatherTemp?: number
      weatherDesc?: string
      weatherIcon?: string
      musicTrack?: string
      musicArtist?: string
      musicUrl?: string
      musicCover?: string
      people?: string[]
      tags?: string[]
      isPublic?: boolean
    },
  ) {
    await this.assertOwner(id, userId)

    const [updated] = await db
      .update(memories)
      .set({
        title: data.title,
        content: data.content,
        memoryDate: data.memoryDate,
        locationName: data.locationName,
        locationLat: data.locationLat?.toString(),
        locationLng: data.locationLng?.toString(),
        weatherTemp: data.weatherTemp?.toString(),
        weatherDesc: data.weatherDesc,
        weatherIcon: data.weatherIcon,
        musicTrack: data.musicTrack,
        musicArtist: data.musicArtist,
        musicUrl: data.musicUrl,
        musicCover: data.musicCover,
        isPublic: data.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(memories.id, id))
      .returning()

    if (data.people !== undefined) {
      await db.delete(memoryPeople).where(eq(memoryPeople.memoryId, id))
      if (data.people.length > 0) {
        await db.insert(memoryPeople).values(
          data.people.map((name) => ({
            memoryId: id,
            name,
          })),
        )
      }
    }

    if (data.tags !== undefined) {
      await db.delete(memoryTags).where(eq(memoryTags.memoryId, id))
      if (data.tags.length > 0) {
        await db.insert(memoryTags).values(
          data.tags.map((name) => ({
            memoryId: id,
            name,
          })),
        )
      }
    }

    return updated
  }

  async delete(id: string, userId: string) {
    await this.assertOwner(id, userId)
    await db.delete(memories).where(eq(memories.id, id))
  }

  private async assertOwner(id: string, userId: string) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }
  }
}

export const memoriesService = new MemoriesService()
