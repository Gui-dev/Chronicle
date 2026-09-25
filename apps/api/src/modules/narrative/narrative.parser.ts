export interface NarrativeParserResult {
  narrative: string
  mood: string
  themes: string[]
}

export function parseNarrativeResponse(text: string): NarrativeParserResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      narrative: text.trim(),
      mood: 'neutral',
      themes: [],
    }
  }

  const narrative = parseJsonLoose(jsonMatch[0])
  if (narrative) {
    return narrative
  }

  return {
    narrative: text.trim(),
    mood: 'neutral',
    themes: [],
  }
}

function parseJsonLoose(json: string): NarrativeParserResult | null {
  try {
    const parsed = JSON.parse(json) as {
      narrative?: unknown
      mood?: unknown
      themes?: unknown
    }
    if (typeof parsed.narrative !== 'string') {
      return null
    }
    return {
      narrative: parsed.narrative,
      mood: typeof parsed.mood === 'string' ? parsed.mood : 'neutral',
      themes: Array.isArray(parsed.themes)
        ? parsed.themes.filter((t): t is string => typeof t === 'string')
        : [],
    }
  } catch {
    return extractFieldsManually(json)
  }
}

function extractFieldsManually(json: string): NarrativeParserResult | null {
  const narrativeMatch = json.match(/"narrative"\s*:\s*"([\s\S]*?)"\s*,/)
  if (!narrativeMatch) {
    return null
  }

  const narrative = narrativeMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')

  const moodMatch = json.match(/"mood"\s*:\s*"([^"]*)"/)
  const themesMatch = json.match(/"themes"\s*:\s*\[([\s\S]*?)\]/)

  const themes = themesMatch
    ? (themesMatch[1].match(/"([^"]*)"/g)?.map((t) => t.slice(1, -1)) ?? [])
    : []

  return {
    narrative: narrative.trim(),
    mood: moodMatch?.[1] ?? 'neutral',
    themes,
  }
}
