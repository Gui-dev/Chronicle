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
    // A word glued to the closing quote is the next token, not part of the
    // phrase — the quoted state ends with the quote, not with the whitespace.
    const glued = parseSearchQuery('"fase com espaço"sol')
    expect(glued.phrases).toEqual(['fase com espaço'])
    expect(glued.text).toEqual(['sol'])
    // A phrase padded with spaces is the phrase without them: Task 7 wraps it
    // in `%…%`, and `% sol %` would not match "fase com sol".
    expect(parseSearchQuery('" sol "').phrases).toEqual(['sol'])
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
    // The same rule holds for bare text terms and for phrases.
    expect(parseSearchQuery('- .').text).toEqual([])
    expect(isEmptySearch(parseSearchQuery('- .'))).toBe(true)
    expect(parseSearchQuery('"---"').phrases).toEqual([])
  })

  it('reads prefixes regardless of case', () => {
    const parsed = parseSearchQuery('MES:SETEMBRO CLIMA:sol LOCAL:Praia')
    expect(parsed.month).toBe(9)
    expect(parsed.weather).toBe('sol')
    expect(parsed.location).toBe('Praia')
  })

  it('accepts the year boundaries and falls through outside them', () => {
    expect(parseSearchQuery('ano:2000').year).toBe(2000)
    expect(parseSearchQuery('ano:2100').year).toBe(2100)
    expect(parseSearchQuery('ano:2101').text).toEqual(['ano:2101'])
    expect(parseSearchQuery('ano:1999').text).toEqual(['ano:1999'])
  })

  it('accepts the month boundaries and falls through outside them', () => {
    expect(parseSearchQuery('mes:1').month).toBe(1)
    expect(parseSearchQuery('mes:12').month).toBe(12)
    expect(parseSearchQuery('mes:0').text).toEqual(['mes:0'])
    expect(parseSearchQuery('mes:13').text).toEqual(['mes:13'])
  })

  it('rejects a numeric value that is not plain digits', () => {
    // `Number()` alone would read these as 2000, 2002 and 10.
    expect(parseSearchQuery('ano:2e3').text).toEqual(['ano:2e3'])
    expect(parseSearchQuery('ano:0x7d2').text).toEqual(['ano:0x7d2'])
    expect(parseSearchQuery('mes:1e1').text).toEqual(['mes:1e1'])
  })

  it('reads the weather and location prefixes', () => {
    const parsed = parseSearchQuery('clima:Sol local:Praia do Norte')
    expect(parsed.weather).toBe('Sol')
    expect(parsed.location).toBe('Praia')
    // A dimension value is one token. `do` and `Norte` are free text, which
    // Task 7 ANDs against title/content — a multi-word value needs quoting,
    // which is how GitHub and Slack search behave too.
    expect(parsed.text).toEqual(['do', 'Norte'])
  })

  it('takes a quoted phrase as the whole dimension value', () => {
    const parsed = parseSearchQuery('local:"praia do norte"')
    expect(parsed.location).toBe('praia do norte')
    expect(parsed.text).toEqual([])
    expect(parsed.phrases).toEqual([])
    // The quoted value is trimmed like a phrase, for the same reason.
    expect(parseSearchQuery('local:" praia "').location).toBe('praia')
  })

  it('takes a quoted phrase as an author value', () => {
    const parsed = parseSearchQuery('@"author name"')
    expect(parsed.author).toBe('author name')
    // The quoted run must not survive as a free-text phrase: the user asked
    // for an author filter, and a phrase search is a different, wrong answer.
    expect(parsed.phrases).toEqual([])
    expect(parsed.text).toEqual([])
    // Author is a scalar, so last wins — including when the winner is quoted.
    expect(parseSearchQuery('@"a b" @bruce').author).toBe('bruce')
    expect(parseSearchQuery('@bruce @"a b"').author).toBe('a b')
    // An exact repeat is the same author twice, so it collapses like a tag.
    expect(parseSearchQuery('@"a b" @"a b"').author).toBe('a b')
    expect(parseSearchQuery('@"a b" @"a b"').phrases).toEqual([])
    // A quoted value with nothing searchable in it is not an author.
    expect(parseSearchQuery('@"---"').author).toBeNull()
    expect(parseSearchQuery('@').author).toBeNull()
  })

  it('takes a quoted phrase as a tag value', () => {
    const parsed = parseSearchQuery('#"praia do norte"')
    expect(parsed.tags).toEqual(['praia do norte'])
    expect(parsed.phrases).toEqual([])
    expect(parsed.text).toEqual([])
    // Distinct quoted tags are still an AND; an exact repeat still collapses.
    expect(parseSearchQuery('#"a b" #"c d"').tags).toEqual(['a b', 'c d'])
    expect(parseSearchQuery('#"a b" #"a b"').tags).toEqual(['a b'])
    // A quoted value with nothing searchable in it is not a tag.
    expect(parseSearchQuery('#"---"').tags).toEqual([])
  })

  it('leaves a quoted value on ano: and mes: as a phrase', () => {
    // Deliberately not composed. These two validate a number and fall through
    // to text when it is not one, so joining `ano:"99"` would push a bare
    // `ano:` to text and swallow the quoted value — strictly worse than leaving
    // it a phrase, and both spellings round-trip.
    const parsed = parseSearchQuery('ano:"99"')
    expect(parsed.year).toBeNull()
    expect(parsed.text).toEqual(['ano:'])
    expect(parsed.phrases).toEqual(['99'])
    expect(parseSearchQuery('mes:"99"').month).toBeNull()
  })

  it('keeps the last author and drops the rest', () => {
    // An author cannot be free text: Task 7 would AND `%@deb%` against
    // title/content, where no author name ever lives, so the extra term can
    // only ever remove rows.
    const parsed = parseSearchQuery('@bruce @deb')
    expect(parsed.author).toBe('deb')
    expect(parsed.text).toEqual([])
  })

  it('keeps the last value of a repeated scalar dimension', () => {
    expect(parseSearchQuery('clima:sol clima:chuva').weather).toBe('chuva')
    expect(parseSearchQuery('local:praia local:montanha').location).toBe('montanha')
    expect(parseSearchQuery('ano:2026 ano:2020').year).toBe(2020)
    expect(parseSearchQuery('mes:9 mes:3').month).toBe(3)
  })

  it('collapses duplicate tags but keeps distinct ones as an AND', () => {
    expect(parseSearchQuery('#a #a').tags).toEqual(['a'])
    expect(parseSearchQuery('#a #b #a').tags).toEqual(['a', 'b'])
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

  it('re-quotes a dimension value that the tokenizer would split', () => {
    // `clima:` and `local:` accept a quoted value, so their value can hold a
    // space. Written bare, the tokenizer would split it back into a dimension
    // plus free text, and Task 14 writes this string into the URL.
    expect(serializeSearchQuery(parseSearchQuery('local:"praia do norte"'))).toBe(
      'local:"praia do norte"',
    )
    expect(serializeSearchQuery(parseSearchQuery('clima:"sol de janeiro"'))).toBe(
      'clima:"sol de janeiro"',
    )
  })

  it('re-parses to the same query for every value the grammar can produce', () => {
    const queries = [
      'local:"praia do norte"',
      'clima:"sol de janeiro"',
      'clima:"ceu limpo" #festa @bruce ano:2026 mes:setembro',
      '#"praia do norte" #festa',
      '#"a b" #"c d" #"a b"',
      '@"author name" @"other name"',
      '@bruce @"other name" @"a b"',
      'local:"praia do norte" #"ano novo" @bruce',
      'local:praia clima:sol',
      '@bruce #festa #praia',
      'praia sol "fase com espaço"',
      // A bare dimension prefix survives as free text, and serialize puts free
      // text last — after the phrases, so a dropped `local:` can never end up
      // glued to a quote and compose a dimension out of thin air.
      'local: foo "bar baz"',
      'clima:---',
      'mes:0 ano:99',
      'ano: local:',
    ]

    for (const query of queries) {
      const parsed = parseSearchQuery(query)
      expect(parseSearchQuery(serializeSearchQuery(parsed)), query).toEqual(parsed)
    }
  })

  it('has no way to represent a double quote inside a dimension value', () => {
    // The tokenizer has no escape syntax — a backslash is an ordinary
    // character — so a quote always closes the value. Nothing the parser
    // produces can contain one, which is why the serializer wraps without
    // escaping: there is no faithful spelling of a quoted value to emit.
    expect(parseSearchQuery('local:praia"norte').location).toBe('praia')
    expect(parseSearchQuery('local:praia"norte').phrases).toEqual(['norte'])
    expect(parseSearchQuery('local:"praia"norte"').location).toBe('praia')
    expect(parseSearchQuery('@praia"norte').author).toBe('praia')
    expect(parseSearchQuery('#praia"norte').tags).toEqual(['praia'])
    expect(parseSearchQuery('local:"a \\b"').location).toBe('a \\b')
  })
})
