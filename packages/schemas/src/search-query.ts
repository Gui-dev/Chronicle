export interface ParsedSearchQuery {
  text: string[]
  phrases: string[]
  author: string | null
  tags: string[]
  year: number | null
  month: number | null
  weather: string | null
  location: string | null
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
}

const PREFIXES = ['ano:', 'mes:', 'clima:', 'local:'] as const

// A year and a month are plain decimal digits. `Number()` alone would also read
// `2e3` as 2000, `0x7d2` as 2002 and `9.0` as 9 — syntax the grammar does not
// describe, so it has to be rejected before the range check sees it.
const PLAIN_INTEGER = /^\d{1,4}$/

// A dimension whose value holds no letter or number is not a dimension: `@#` is
// punctuation, not an author named `#`. Such a token is dropped rather than
// demoted to text, because as text it would still reach the SQL as a LIKE and
// the spec requires a punctuation-only query to add no condition at all.
function isWordLike(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value)
}

interface Token {
  value: string
  quoted: boolean
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let current = ''
  let quoted = false
  let inQuotes = false

  for (const char of input) {
    if (char === '"') {
      if (inQuotes) {
        if (current) tokens.push({ value: current, quoted: true })
        current = ''
        inQuotes = false
        // The phrase ends with the quote, not with the next whitespace, so
        // `"a"b` is two tokens rather than one phrase.
        quoted = false
      } else {
        if (current) tokens.push({ value: current, quoted: false })
        current = ''
        inQuotes = true
        quoted = true
      }
      continue
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) tokens.push({ value: current, quoted })
      current = ''
      quoted = false
      continue
    }
    current += char
  }

  if (current) tokens.push({ value: current, quoted })

  return tokens
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function parseMonthValue(raw: string): number | null {
  const asNumber = Number(raw)
  if (PLAIN_INTEGER.test(raw) && Number.isInteger(asNumber)) {
    return asNumber >= 1 && asNumber <= 12 ? asNumber : null
  }
  return MONTH_NAMES[normalize(raw)] ?? null
}

// A quoted value reaches the parse loop as its own token, because the tokenizer
// ends the bare token at the opening quote: `local:"praia do norte"` and
// `#"praia do norte"` each arrive as two tokens. A sigil or prefix with no value
// of its own therefore adopts the next quoted token as that value. `ano:` and
// `mes:` are excluded by their callers: they validate a number and fall through
// to text when it is not one, so a joined `ano:"99"` would push a bare `ano:` to
// text and swallow the value.
function quotedValueAfter(tokens: Token[], index: number): string | null {
  const next = tokens[index + 1]
  return next?.quoted ? next.value.trim() : null
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const parsed: ParsedSearchQuery = {
    text: [],
    phrases: [],
    author: null,
    tags: [],
    year: null,
    month: null,
    weather: null,
    location: null,
  }

  const tokens = tokenize(input)

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]

    if (token.quoted) {
      // Task 7 wraps a phrase in `%…%`, so the padding a user typed inside the
      // quotes would have to be part of the text to match.
      const phrase = token.value.trim()
      if (isWordLike(phrase)) parsed.phrases.push(phrase)
      continue
    }

    if (token.value.startsWith('@')) {
      let author = token.value.slice(1)
      // A bare `@` is not an author named nothing, so it adopts a quoted value.
      if (!author) {
        const quoted = quotedValueAfter(tokens, index)
        if (quoted !== null) {
          author = quoted
          index += 1
        }
      }
      if (isWordLike(author)) parsed.author = author
      continue
    }

    if (token.value.startsWith('#')) {
      let tag = token.value.slice(1)
      // A bare `#` is not a tag named nothing, so it adopts a quoted value.
      if (!tag) {
        const quoted = quotedValueAfter(tokens, index)
        if (quoted !== null) {
          tag = quoted
          index += 1
        }
      }
      // Distinct tags are an AND and all of them are kept; an exact repeat is
      // the same condition twice, so it collapses.
      if (isWordLike(tag) && !parsed.tags.includes(tag)) parsed.tags.push(tag)
      continue
    }

    const lowered = token.value.toLowerCase()
    const prefix = PREFIXES.find((p) => lowered.startsWith(p))

    if (prefix) {
      let rest = token.value.slice(prefix.length)
      // A free-text dimension with no value of its own adopts a quoted one.
      if (!rest && (prefix === 'clima:' || prefix === 'local:')) {
        const quoted = quotedValueAfter(tokens, index)
        if (quoted !== null) {
          rest = quoted
          index += 1
        }
      }
      if (rest) {
        if (prefix === 'ano:') {
          const year = Number(rest)
          if (PLAIN_INTEGER.test(rest) && Number.isInteger(year) && year >= 2000 && year <= 2100) {
            parsed.year = year
            continue
          }
        } else if (prefix === 'mes:') {
          const month = parseMonthValue(rest)
          if (month !== null) {
            parsed.month = month
            continue
          }
        } else if (prefix === 'clima:') {
          if (isWordLike(rest)) parsed.weather = rest
          continue
        } else {
          if (isWordLike(rest)) parsed.location = rest
          continue
        }
      }
    }

    // An unknown prefix, an out-of-range value, or a bare word all land here as
    // text. The grammar never rejects input; a term with nothing searchable in
    // it is the one thing it discards.
    if (isWordLike(token.value)) parsed.text.push(token.value)
  }

  return parsed
}

// The tokenizer splits a bare token on whitespace, so a dimension value holding
// one has to be written back quoted — otherwise it re-parses as the dimension
// plus free text, which is how a removed chip silently narrows a search.
// Wrapping is the whole of it: the tokenizer has no escape syntax (a backslash
// is an ordinary character), so a quote always closes the value and no value
// the parser produces can contain one. There is nothing to escape.
function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value
}

export function serializeSearchQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = []
  if (parsed.author) parts.push(`@${quoteIfNeeded(parsed.author)}`)
  for (const tag of parsed.tags) parts.push(`#${quoteIfNeeded(tag)}`)
  if (parsed.year) parts.push(`ano:${parsed.year}`)
  if (parsed.month) parts.push(`mes:${parsed.month}`)
  if (parsed.weather) parts.push(`clima:${quoteIfNeeded(parsed.weather)}`)
  if (parsed.location) parts.push(`local:${quoteIfNeeded(parsed.location)}`)
  for (const phrase of parsed.phrases) parts.push(`"${phrase}"`)
  for (const term of parsed.text) parts.push(term)
  return parts.join(' ')
}

export function isEmptySearch(parsed: ParsedSearchQuery): boolean {
  return (
    parsed.text.length === 0 &&
    parsed.phrases.length === 0 &&
    parsed.author === null &&
    parsed.tags.length === 0 &&
    parsed.year === null &&
    parsed.month === null &&
    parsed.weather === null &&
    parsed.location === null
  )
}
