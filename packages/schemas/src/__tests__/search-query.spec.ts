import { describe, expect, it } from 'vitest'
import { isEmptySearch, parseSearchQuery, serializeSearchQuery } from '../search-query'

describe('parseSearchQuery', () => {
  it('treats bare words as title/content text', () => {
    expect(parseSearchQuery('praia sol').text).toEqual(['praia', 'sol'])
  })

  it('reads the author prefix', () => {
    expect(parseSearchQuery('@bruce').author).toBe('bruce')
  })

  it('collects every tag', () => {
    expect(parseSearchQuery('#festa #praia').tags).toEqual(['festa', 'praia'])
  })

  it('combines dimensions with AND semantics', () => {
    expect(parseSearchQuery('@bruce #festa local:praia ano:2026')).toEqual({
      text: [],
      phrases: [],
      author: 'bruce',
      tags: ['festa'],
      year: 2026,
      month: null,
      weather: null,
      location: 'praia',
    })
  })

  it('keeps quoted phrases intact and treats them as phrases', () => {
    const parsed = parseSearchQuery('"fase com espaço" sol')
    expect(parsed.phrases).toEqual(['fase com espaço'])
    expect(parsed.text).toEqual(['sol'])
  })

  it('accepts a month by number and by name', () => {
    expect(parseSearchQuery('mes:9').month).toBe(9)
    expect(parseSearchQuery('mes:setembro').month).toBe(9)
    expect(parseSearchQuery('mes:março').month).toBe(3)
  })

  it('falls back to text for an out-of-range year or month', () => {
    expect(parseSearchQuery('ano:99').text).toEqual(['ano:99'])
    expect(parseSearchQuery('mes:44').text).toEqual(['mes:44'])
  })

  it('treats an unknown prefix as literal text instead of failing', () => {
    expect(parseSearchQuery('http://exemplo.com').text).toEqual(['http://exemplo.com'])
    expect(parseSearchQuery('foo:bar').text).toEqual(['foo:bar'])
  })

  it('ignores bare punctuation', () => {
    expect(parseSearchQuery('@# ""   ').author).toBeNull()
    // A dimension value with no word characters is dropped, not demoted to
    // text: as text it would still reach findAll as a LIKE.
    expect(parseSearchQuery('#').tags).toEqual([])
    expect(parseSearchQuery('clima:#').weather).toBeNull()
    expect(parseSearchQuery('local:#').location).toBeNull()
    // So a punctuation-only query adds no condition at all.
    expect(isEmptySearch(parseSearchQuery('@# ""   '))).toBe(true)
  })

  it('reads the weather and location prefixes', () => {
    const parsed = parseSearchQuery('clima:Sol local:Praia do Norte')
    expect(parsed.weather).toBe('Sol')
    expect(parsed.location).toBe('Praia')
    expect(parsed.text).toEqual(['do', 'Norte'])
  })

  it('keeps the first author and degrades the rest to text', () => {
    const parsed = parseSearchQuery('@bruce @deb')
    expect(parsed.author).toBe('bruce')
    expect(parsed.text).toEqual(['@deb'])
  })

  it('reports an empty query as empty', () => {
    expect(isEmptySearch(parseSearchQuery(''))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('   '))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('#festa'))).toBe(false)
  })
})

describe('serializeSearchQuery', () => {
  it('round-trips every dimension', () => {
    const original =
      '@bruce #festa #praia ano:2026 mes:9 clima:sol local:praia "fase com espaço" sol'
    expect(parseSearchQuery(serializeSearchQuery(parseSearchQuery(original)))).toEqual(
      parseSearchQuery(original),
    )
  })

  it('emits prefixes, not raw values', () => {
    expect(serializeSearchQuery(parseSearchQuery('9'))).toBe('9')
    expect(serializeSearchQuery(parseSearchQuery('mes:9'))).toBe('mes:9')
  })
})
