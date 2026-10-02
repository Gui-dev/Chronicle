'use client'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMemories } from '@/hooks/use-memories'
import { useDialogFocusRestore } from '@/lib/use-dialog-focus-restore'
import { Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@chronicle/ui'
import { Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SearchResultRow {
  id: string
  title: string
  memoryDate: string
  locationName: string | null
}

/**
 * Module-level so the identity survives a render with no data. A fresh `[]` per
 * render would land in the keydown effect's deps and re-register the window
 * listener on every render of the empty state.
 */
const EMPTY_RESULTS: SearchResultRow[] = []

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const debouncedQuery = useDebouncedValue(query, 300)
  const router = useRouter()
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const focusRestore = useDialogFocusRestore()

  const trimmed = debouncedQuery.trim()
  // `enabled` keeps a keystroke from firing a request for an empty or
  // prefix-only query; `limit` is a preview, the full result set lives on /search.
  // Only the empty term collides with the timeline: both sides hash to
  // `{page:1, limit:20}` while `search` is undefined, and a disabled query
  // still reads the cache. A term already makes the key distinct — and shared
  // with /search — so scoping it too would cost a duplicate fetch on "Ver todas".
  const { data, isFetching } = useMemories(
    { page: 1, limit: 20, search: trimmed || undefined },
    {
      enabled: open && trimmed.length > 0,
      scope: trimmed.length > 0 ? undefined : 'search-dialog',
    },
  )

  // Nothing is a result until a query is actually running: the empty-query
  // cache entry (however it got there) must not paint rows. These guards only
  // cover what renders — the scope above is what shields `isFetching` (the
  // spinner) and every other cache read from the timeline's entry.
  const results =
    trimmed.length > 0
      ? ((data?.data as SearchResultRow[] | undefined) ?? EMPTY_RESULTS)
      : EMPTY_RESULTS
  const total = trimmed.length > 0 ? (data?.pagination.total ?? 0) : 0

  // The result set can shrink under a live index — a refetch that matches
  // fewer rows, or a list the user just cleared. Clamping on read keeps the
  // highlight, Enter and the scroll-into-view in agreement with what is
  // rendered, instead of silently pointing past the end of the list.
  const activeIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1)

  const isEmpty = trimmed.length > 0 && !isFetching && results.length === 0

  useEffect(() => {
    if (open) return
    setQuery('')
    setSelectedIndex(0)
  }, [open])

  // A new query means a new list, so the highlight goes back to the top.
  // Adjusting during render instead of in an effect puts the reset in the same
  // commit as the query, so the first render of the new results is already
  // correct — an effect would leave the previous index highlighted for a frame.
  const [settledQuery, setSettledQuery] = useState(debouncedQuery)
  if (settledQuery !== debouncedQuery) {
    setSettledQuery(debouncedQuery)
    setSelectedIndex(0)
  }

  useEffect(() => {
    const node = listRef.current?.children[activeIndex]
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  useEffect(() => {
    if (!open) return
    // Escape is not handled here: Radix's DismissableLayer already maps it to
    // `onOpenChange(false)`, so a second path would just close it twice.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' && results.length > 0) {
        event.preventDefault()
        setSelectedIndex((index) => (index + 1) % results.length)
      }
      if (event.key === 'ArrowUp' && results.length > 0) {
        event.preventDefault()
        setSelectedIndex((index) => (index - 1 + results.length) % results.length)
      }
      if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault()
        router.push(`/memories/${results[activeIndex].id}`)
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, results, activeIndex, onOpenChange, router])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl border-card bg-card text-text"
        data-testid="search-dialog"
        // Fires before Radix moves focus, which is the only moment
        // `document.activeElement` still names the element the user left. React's
        // `autoFocus` would fire in the commit phase, ahead of this event, and
        // both this snapshot and Radix's own would then point at this dialog's
        // input — so the input is focused here instead. The hook takes the
        // snapshot; the default is prevented so focus lands on the input and
        // `onCloseAutoFocus` can hand it back to the navbar button.
        onOpenAutoFocus={(event) => {
          focusRestore.onOpenAutoFocus(event)
          event.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={focusRestore.onCloseAutoFocus}
      >
        <DialogTitle className="sr-only">Buscar memórias</DialogTitle>
        <DialogDescription className="sr-only">
          Busca por título, conteúdo, pessoa, tag, ano, mês, clima e lugar.
        </DialogDescription>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar: #tag @pessoa ano:2026 local:praia"
            data-testid="search-dialog-input"
            className="h-11 rounded-lg border-2 border-input bg-background pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <ul
          ref={listRef}
          aria-live="polite"
          className="max-h-96 space-y-1 overflow-y-auto"
          data-testid="search-results"
        >
          {results.map((memory, index) => (
            <li key={memory.id}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/memories/${memory.id}`)
                  onOpenChange(false)
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                data-testid={`search-result-${memory.id}`}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  index === activeIndex ? 'bg-primary/10' : 'hover:bg-primary/5'
                }`}
              >
                <span className="block truncate text-sm font-medium text-text">{memory.title}</span>
                <span className="block text-xs text-muted">
                  {new Date(memory.memoryDate).toLocaleDateString('pt-BR')}
                  {memory.locationName ? ` · ${memory.locationName}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* The live regions are mounted from the start and only their content
            changes: a region that mounts together with its text is not
            consistently announced by screen readers. */}
        <output
          className="block py-6 text-center text-sm text-muted"
          data-testid="search-empty"
          hidden={!isEmpty}
        >
          {isEmpty ? `Nenhuma memória encontrada para “${trimmed}”.` : null}
        </output>

        <output
          className="flex justify-center py-4"
          data-testid="search-loading"
          hidden={!isFetching}
        >
          {isFetching && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="sr-only">Buscando memórias…</span>
            </>
          )}
        </output>

        <div className="flex items-center justify-between border-t border-card pt-3">
          <p className="text-xs text-muted">
            <kbd className="rounded border border-card px-1">↑</kbd>{' '}
            <kbd className="rounded border border-card px-1">↓</kbd> para navegar,{' '}
            <kbd className="rounded border border-card px-1">Enter</kbd> para abrir
          </p>
          {trimmed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                router.push(`/search?q=${encodeURIComponent(trimmed)}`)
                onOpenChange(false)
              }}
              data-testid="search-see-all"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todas as {total} memórias
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
