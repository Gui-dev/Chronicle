'use client'

import { MemoryTimeline } from '@/components/memory-timeline'
import { useMemories } from '@/hooks/use-memories'
import type { MemoryFiltersInput } from '@chronicle/schemas'
import { type ParsedSearchQuery, serializeSearchQuery } from '@chronicle/schemas'
import { Badge } from '@chronicle/ui'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const PAGE_SIZE = 20

interface SearchResultsProps {
  query: string
}

interface Chip {
  label: string
  /** `label` reduced to `[a-z0-9-]`, so a `data-testid` never needs quoting. */
  slug: string
  remove: () => ParsedSearchQuery
}

/**
 * Drops the occurrence at `index` and keeps every other one, duplicates included.
 * The parser does not dedupe `text` or `phrases`, so `q=praia praia` arrives with
 * two identical terms; a value filter would take both and turn one click into a
 * two-chip removal.
 */
function withoutAt<T>(items: T[], index: number): T[] {
  return items.filter((_, position) => position !== index)
}

/**
 * A label reduced to `[a-z0-9-]`. The quotes a phrase carries and the accents a
 * word carries are both dropped, so a chip is selectable without escaping. A
 * month slugifies to `mes-9`, which is the spelling the query language itself
 * takes, so the testid reads like the query that produced it.
 */
function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Chips render in a fixed order — author, tags, year, month, weather, location,
 * phrases, text — so an index is predictable when two chips slug to the same
 * testid (a tag and a free-text term of the same name, `q=#sol sol`).
 */
function buildChips(meta: ParsedSearchQuery): Chip[] {
  const chips: Chip[] = []
  const add = (label: string, remove: () => ParsedSearchQuery) => {
    chips.push({ label, slug: slugify(label), remove })
  }

  if (meta.author) add(`@${meta.author}`, () => ({ ...meta, author: null }))
  meta.tags.forEach((tag, index) => {
    add(`#${tag}`, () => ({ ...meta, tags: withoutAt(meta.tags, index) }))
  })
  if (meta.year) add(`ano: ${meta.year}`, () => ({ ...meta, year: null }))
  if (meta.month) add(`mês: ${meta.month}`, () => ({ ...meta, month: null }))
  if (meta.weather) add(`clima: ${meta.weather}`, () => ({ ...meta, weather: null }))
  if (meta.location) add(`local: ${meta.location}`, () => ({ ...meta, location: null }))
  meta.phrases.forEach((phrase, index) => {
    add(`"${phrase}"`, () => ({ ...meta, phrases: withoutAt(meta.phrases, index) }))
  })
  meta.text.forEach((term, index) => {
    add(term, () => ({ ...meta, text: withoutAt(meta.text, index) }))
  })

  return chips
}

export function SearchResults({ query }: SearchResultsProps) {
  const router = useRouter()

  // The page is derived from the query rather than reset by an effect. An effect
  // would let the first render fetch with the filter state it already has — no
  // `search`, page 1 — and only correct it on a second render, so a search would
  // fire twice and flash every memory before narrowing. Deriving makes the first
  // render the only one, and `setPage` still works within a query.
  const [pagination, setPagination] = useState({ query, page: 1 })
  const page = pagination.query === query ? pagination.page : 1

  const filters: MemoryFiltersInput = { page, limit: PAGE_SIZE, search: query || undefined }
  const { data, isLoading, error, refetch } = useMemories(filters, {
    enabled: query.trim().length > 0,
  })

  const meta = data?.searchMeta ?? null
  const chips = meta ? buildChips(meta) : []

  return (
    <div>
      {chips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2" data-testid="search-chips">
          {chips.map((chip, index) => (
            <button
              key={`${chip.slug}-${index}`}
              type="button"
              onClick={() =>
                router.replace(
                  `/search?q=${encodeURIComponent(serializeSearchQuery(chip.remove()))}`,
                )
              }
              data-testid={`search-chip-${chip.slug}`}
              data-chip-label={chip.label}
              className="cursor-pointer"
            >
              <Badge className="flex cursor-pointer items-center gap-1.5 rounded-full border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
                {chip.label}
                <X className="h-3 w-3" />
              </Badge>
            </button>
          ))}
        </div>
      )}

      {data && (
        <p className="mb-4 text-sm text-muted" data-testid="search-count">
          {data.pagination.total} {data.pagination.total === 1 ? 'memória' : 'memórias'}
        </p>
      )}

      <MemoryTimeline
        memories={data?.data ?? []}
        pagination={data?.pagination}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onPageChange={(next) => setPagination({ query, page: next })}
        emptyTitle="Nenhuma memória encontrada"
        emptyDescription="Tente outra combinação ou remova um filtro acima."
      />
    </div>
  )
}
