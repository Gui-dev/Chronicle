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

    // The query string is parsed once and every dimension is read off the result,
    // so `#festa` and `?tag=festa` build the same kind of condition while
    // `?tag=` keeps working for the URLs that already carry it.
    const grammar: ParsedSearchQuery | null = search ? parseSearchQuery(search) : null
    const hasGrammar = grammar !== null && !isEmptySearch(grammar)

    // A month filter is only meaningful within a year, and the spec resolves
    // `month` without `year` to the current one. `memory-filters.tsx` sets the
    // year alongside the month so the UI never sends the bare case silently.
    // `??` here is a nullish test, not a falsy one: `month` can be a string from
    // the URL query, so `''` would read as "no month given" while a real `'9'`
    // would not — and `dateRange` needs a number, hence the coercion.
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

    const results = await db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.memoryDate))
      .limit(limit)
      .offset(offset)

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

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(...conditions))

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
