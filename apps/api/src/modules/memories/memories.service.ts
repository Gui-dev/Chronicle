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
import type { MemoryFiltersInput } from '@chronicle/schemas'
import { AppError } from '../../errors/app-error'

// A range predicate, not EXTRACT: `EXTRACT(YEAR FROM memory_date) = 2026` wraps
// the column in a function, so Postgres can never satisfy it with an index.
// A half-open interval over the raw column is sargable. Bounds are UTC because
// memoryDate is a `timestamp` fed by the localDate schema.
function dateRange(year: number, month?: number) {
  return {
    start: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
    end: new Date(Date.UTC(year, month ?? 12, 1)),
  }
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

    const effectiveYear = year ?? (month ? new Date().getUTCFullYear() : undefined)

    if (effectiveYear) {
      const { start, end } = dateRange(effectiveYear, month ?? undefined)
      conditions.push(gte(memories.memoryDate, start), lt(memories.memoryDate, end))
    }

    if (weather) {
      conditions.push(ilike(memories.weatherDesc, `%${weather}%`))
    }

    if (location) {
      conditions.push(ilike(memories.locationName, `%${location}%`))
    }

    if (search) {
      conditions.push(
        sql`(${ilike(memories.title, `%${search}%`)} OR ${ilike(memories.content, `%${search}%`)})`,
      )
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

    const enrichedResults = await Promise.all(
      results.map(async (memory) => {
        const [photos, people, tags] = await Promise.all([
          db
            .select()
            .from(memoryPhotos)
            .where(eq(memoryPhotos.memoryId, memory.id))
            .orderBy(memoryPhotos.orderIndex),
          db.select().from(memoryPeople).where(eq(memoryPeople.memoryId, memory.id)),
          db.select().from(memoryTags).where(eq(memoryTags.memoryId, memory.id)),
        ])
        return { ...memory, photos, people, tags }
      }),
    )

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
