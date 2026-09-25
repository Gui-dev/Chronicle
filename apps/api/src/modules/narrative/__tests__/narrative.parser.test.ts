import { describe, expect, it } from 'vitest'
import { parseNarrativeResponse } from '../narrative.parser'

describe('parseNarrativeResponse', () => {
  it('parses clean JSON response', () => {
    const text =
      '{"narrative":"Uma linda história","mood":"nostalgic","themes":["amizade","verão"]}'
    const result = parseNarrativeResponse(text)
    expect(result.narrative).toBe('Uma linda história')
    expect(result.mood).toBe('nostalgic')
    expect(result.themes).toEqual(['amizade', 'verão'])
  })

  it('parses JSON wrapped in markdown json fence', () => {
    const text = '```json\n{"narrative":"História do mar","mood":"calmo","themes":["praia"]}\n```'
    const result = parseNarrativeResponse(text)
    expect(result.narrative).toBe('História do mar')
    expect(result.mood).toBe('calmo')
    expect(result.themes).toEqual(['praia'])
  })

  it('parses JSON with extra prose before and after', () => {
    const text =
      'Aqui está sua narrativa:\n{"narrative":"Texto final","mood":"feliz","themes":["sol"]}\nEspero que goste!'
    const result = parseNarrativeResponse(text)
    expect(result.narrative).toBe('Texto final')
  })

  it('parses JSON narrative containing real newlines inside the string', () => {
    const text = `\`\`\`json
{
  "narrative": "Linha um.
Linha dois.
Linha três.",
  "mood": "Sereno",
  "themes": [
    "Amizade",
    "Contemplação"
  ]
}
\`\`\``
    const result = parseNarrativeResponse(text)
    expect(result.narrative).toContain('Linha um')
    expect(result.narrative).toContain('Linha três')
    expect(result.mood).toBe('Sereno')
    expect(result.themes).toEqual(['Amizade', 'Contemplação'])
  })

  it('returns raw text as narrative when no JSON is present', () => {
    const text = 'Uma narrativa cinematográfica sem estrutura JSON.'
    const result = parseNarrativeResponse(text)
    expect(result.narrative).toBe(text)
    expect(result.mood).toBe('neutral')
    expect(result.themes).toEqual([])
  })
})
