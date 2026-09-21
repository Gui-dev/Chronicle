import { and, db, desc, eq, ilike, memories, memoryPeople, memoryTags, sql } from '@chronicle/db'
import type { MemoryFiltersInput } from '@chronicle/schemas'
import { AppError } from '../../errors/app-error'

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

  async findAll(userId: string, filters: MemoryFiltersInput) {
    const { year, month, weather, location, tag, search, page, limit } = filters

    const conditions = [eq(memories.userId, userId)]

    if (year) {
      conditions.push(sql`EXTRACT(YEAR FROM ${memories.memoryDate}) = ${year}`)
    }

    if (month) {
      conditions.push(sql`EXTRACT(MONTH FROM ${memories.memoryDate}) = ${month}`)
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

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(...conditions))

    return {
      data: results,
      pagination: {
        page,
        limit,
        total: countResult.count,
        totalPages: Math.ceil(countResult.count / limit),
      },
    }
  }

  async findById(id: string, userId: string) {
    const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    return memory
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
    },
  ) {
    await this.findById(id, userId)

    const [memory] = await db
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

    return memory
  }

  async delete(id: string, userId: string) {
    await this.findById(id, userId)
    await db.delete(memories).where(eq(memories.id, id))
  }
}

export const memoriesService = new MemoriesService()
