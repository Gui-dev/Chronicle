import { db, eq, memories, memoryPeople, memoryTags } from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { geminiModel } from '../../plugins/ai'

interface NarrativeResult {
  narrative: string
  mood: string
  themes: string[]
}

export class NarrativeService {
  async generate(memoryId: string, userId: string): Promise<NarrativeResult> {
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

    const prompt = `You are a professional storyteller and life narrator. Based on the following memory, create a beautiful, cinematic narrative that captures the essence of this moment.

Memory Title: ${memory.title}
Date: ${memory.memoryDate ? new Date(memory.memoryDate).toLocaleDateString('pt-BR') : 'Unknown'}
Location: ${memory.locationName || 'Unknown'}
Weather: ${memory.weatherDesc ? `${memory.weatherTemp}°C - ${memory.weatherDesc}` : 'Unknown'}
Music: ${memory.musicTrack ? `${memory.musicTrack} by ${memory.musicArtist}` : 'Unknown'}
People: ${people.join(', ') || 'Unknown'}
Tags: ${tags.join(', ') || 'Unknown'}

Content: ${memory.content || 'No additional content'}

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

    const result = await geminiModel.generateContent(prompt)
    const response = result.response
    const text = response.text()

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from AI')
      }

      const parsed = JSON.parse(jsonMatch[0]) as NarrativeResult
      return {
        narrative: parsed.narrative,
        mood: parsed.mood || 'neutral',
        themes: parsed.themes || [],
      }
    } catch {
      return {
        narrative: text,
        mood: 'neutral',
        themes: [],
      }
    }
  }
}

export const narrativeService = new NarrativeService()
