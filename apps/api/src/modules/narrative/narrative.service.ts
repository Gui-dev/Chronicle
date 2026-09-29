import { db, desc, eq, memories, memoryPeople, memoryTags, narrativeVersions } from '@chronicle/db'
import type { GenerateContentResult } from '@google/generative-ai'
import { AppError } from '../../errors/app-error'
import { geminiModel } from '../../plugins/ai'
import { parseNarrativeResponse } from './narrative.parser'

interface NarrativeResult {
  narrative: string
  mood: string
  themes: string[]
}

interface NarrativeVersionRow {
  id: string
  version: number
  narrative: string
  mood: string | null
  themes: string[] | null
  createdAt: Date
}

const MOOD_INSTRUCTIONS: Record<string, string> = {
  nostalgic: 'with a nostalgic, reflective tone',
  joyful: 'with a joyful, celebratory tone',
  melancholic: 'with a melancholic, bittersweet tone',
  energetic: 'with an energetic, vibrant tone',
  peaceful: 'with a peaceful, serene tone',
  romantic: 'with a romantic, tender tone',
}

export class NarrativeService {
  async generate(
    memoryId: string,
    userId: string,
    options?: { mood?: string; partial?: boolean },
  ): Promise<NarrativeResult> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    const peopleRows = await db
      .select()
      .from(memoryPeople)
      .where(eq(memoryPeople.memoryId, memoryId))

    const tagRows = await db.select().from(memoryTags).where(eq(memoryTags.memoryId, memoryId))

    const people = peopleRows.map((p) => p.name)
    const tags = tagRows.map((t) => t.name)

    const moodInstruction = options?.mood ? MOOD_INSTRUCTIONS[options.mood] || '' : ''

    const prompt = `You are a professional storyteller and life narrator. Based on the following memory, create a beautiful, cinematic narrative that captures the essence of this moment.

Memory Title: ${memory.title}
Date: ${memory.memoryDate ? new Date(memory.memoryDate).toLocaleDateString('pt-BR') : 'Unknown'}
Location: ${memory.locationName || 'Unknown'}
Weather: ${memory.weatherDesc ? `${memory.weatherTemp}°C - ${memory.weatherDesc}` : 'Unknown'}
Music: ${memory.musicTrack ? `${memory.musicTrack} by ${memory.musicArtist}` : 'Unknown'}
People: ${people.join(', ') || 'Unknown'}
Tags: ${tags.join(', ') || 'Unknown'}

Content: ${memory.content || 'No additional content'}

${moodInstruction ? `Write the narrative ${moodInstruction}.` : ''}

Please provide:
1. A cinematic narrative (2-3 paragraphs) in Portuguese
2. The mood of the moment (one word)
3. Key themes (array of 2-3 themes)

Respond in JSON format:
{
  "narrative": "The cinematic narrative...",
  "mood": "nostalgic",
  "themes": ["friendship", "summer", "adventure"]
}`

    const result = await this.generateWithRetry(prompt)
    const response = result.response
    const text = response.text()

    const narrative = parseNarrativeResponse(text)

    // Save the current narrative as a version before overwriting. This runs in
    // the same transaction as the update so a failure leaves neither half-done.
    await this.saveVersion(memoryId, memory)

    await db
      .update(memories)
      .set({
        aiNarrative: narrative.narrative,
        aiMood: narrative.mood,
        aiThemes: narrative.themes,
      })
      .where(eq(memories.id, memoryId))

    return narrative
  }

  async listVersions(memoryId: string, userId: string): Promise<NarrativeVersionRow[]> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    return db
      .select({
        id: narrativeVersions.id,
        version: narrativeVersions.version,
        narrative: narrativeVersions.narrative,
        mood: narrativeVersions.mood,
        themes: narrativeVersions.themes,
        createdAt: narrativeVersions.createdAt,
      })
      .from(narrativeVersions)
      .where(eq(narrativeVersions.memoryId, memoryId))
      .orderBy(desc(narrativeVersions.version))
  }

  async restoreVersion(memoryId: string, versionId: string, userId: string): Promise<void> {
    const [memory] = await db.select().from(memories).where(eq(memories.id, memoryId)).limit(1)

    if (!memory) {
      throw AppError.notFound('Memória não encontrada')
    }

    if (memory.userId !== userId) {
      throw AppError.forbidden('Acesso negado')
    }

    const [version] = await db
      .select()
      .from(narrativeVersions)
      .where(eq(narrativeVersions.id, versionId))
      .limit(1)

    if (!version || version.memoryId !== memoryId) {
      throw AppError.notFound('Versão não encontrada')
    }

    await db
      .update(memories)
      .set({
        aiNarrative: version.narrative,
        aiMood: version.mood,
        aiThemes: version.themes,
      })
      .where(eq(memories.id, memoryId))
  }

  private async saveVersion(
    memoryId: string,
    memory: { aiNarrative: string | null; aiMood: string | null; aiThemes: string[] | null },
  ): Promise<void> {
    if (!memory.aiNarrative) return

    const [current] = await db
      .select({ max: narrativeVersions.version })
      .from(narrativeVersions)
      .where(eq(narrativeVersions.memoryId, memoryId))

    const nextVersion = (current?.max ?? 0) + 1

    await db.insert(narrativeVersions).values({
      memoryId,
      narrative: memory.aiNarrative,
      mood: memory.aiMood,
      themes: memory.aiThemes,
      version: nextVersion,
    })
  }

  private async generateWithRetry(prompt: string, attempts = 3): Promise<GenerateContentResult> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await geminiModel.generateContent(prompt)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        const isTransient = /50[0-9]|429/.test(message)
        const isLast = attempt === attempts - 1
        if (!isTransient || isLast) {
          throw err
        }
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
      }
    }
    throw new Error('Unexpected retry exhaustion')
  }
}

export const narrativeService = new NarrativeService()
