import { randomBytes } from 'node:crypto'
import {
  and,
  db,
  eq,
  isNull,
  memories,
  memoryPeople,
  memoryPhotos,
  memoryTags,
  users,
} from '@chronicle/db'
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

    if (
      !memory ||
      memory.deletedAt ||
      !memory.shareExpiresAt ||
      memory.shareExpiresAt.getTime() <= Date.now()
    ) {
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
