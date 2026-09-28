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
  if (Number.isInteger(asNumber)) {
    return asNumber >= 1 && asNumber <= 12 ? asNumber : null
  }
  return MONTH_NAMES[normalize(raw)] ?? null
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

  for (const token of tokenize(input)) {
    if (token.quoted) {
      if (isWordLike(token.value)) parsed.phrases.push(token.value)
      continue
    }

    if (token.value.startsWith('@')) {
      const author = token.value.slice(1)
      if (!isWordLike(author)) continue
      if (parsed.author === null) parsed.author = author
      else parsed.text.push(token.value)
      continue
    }

    if (token.value.startsWith('#')) {
      const tag = token.value.slice(1)
      if (isWordLike(tag)) parsed.tags.push(tag)
      continue
    }

    const lowered = token.value.toLowerCase()
    const prefix = PREFIXES.find((p) => lowered.startsWith(p))

    if (prefix) {
      const rest = token.value.slice(prefix.length)
      if (rest) {
        if (prefix === 'ano:') {
          const year = Number(rest)
          if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
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

export function serializeSearchQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = []
  if (parsed.author) parts.push(`@${parsed.author}`)
  for (const tag of parsed.tags) parts.push(`#${tag}`)
  if (parsed.year) parts.push(`ano:${parsed.year}`)
  if (parsed.month) parts.push(`mes:${parsed.month}`)
  if (parsed.weather) parts.push(`clima:${parsed.weather}`)
  if (parsed.location) parts.push(`local:${parsed.location}`)
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
