import { db, eq, memories, memoryPeople, memoryTags } from '@chronicle/db'
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
}

export const memoriesService = new MemoriesService()
