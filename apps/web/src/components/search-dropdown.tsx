'use client'

import { useMemories } from '@/hooks/use-memories'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface SearchDropdownProps {
  debouncedQuery: string
  isOpen: boolean
  onClose: () => void
}

const EMPTY_RESULTS: Array<{
  id: string
  title: string
  memoryDate: string
  locationName: string | null
}> = []

export function SearchDropdown({ debouncedQuery, isOpen, onClose }: SearchDropdownProps) {
  const router = useRouter()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const trimmed = debouncedQuery.trim()
  const { data, isFetching } = useMemories(
    { page: 1, limit: 5, search: trimmed || undefined },
    {
      enabled: isOpen && trimmed.length > 0,
      scope: trimmed.length > 0 ? undefined : 'search-dropdown',
    },
  )

  const results =
    trimmed.length > 0
      ? ((data?.data as typeof EMPTY_RESULTS | undefined) ?? EMPTY_RESULTS)
      : EMPTY_RESULTS
  const total = trimmed.length > 0 ? (data?.pagination.total ?? 0) : 0

  const activeIndex = results.length === 0 ? 0 : Math.min(selectedIndex, results.length - 1)

  // Scroll selected item into view
  useEffect(() => {
    const node = listRef.current?.children[activeIndex]
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
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
        onClose()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, activeIndex, onClose, router])

  // Close on outside click (handled by Popover) but also on blur with delay
  useEffect(() => {
    if (!isOpen) return
    const handleBlur = (event: FocusEvent) => {
      // Don't close if focus moves to the dropdown content
      const relatedTarget = event.relatedTarget as HTMLElement | null
      if (relatedTarget?.closest('[data-testid="search-dropdown"]')) return
      const currentTarget = event.currentTarget as HTMLElement | null
      if (currentTarget && !currentTarget.contains(relatedTarget)) {
        setTimeout(onClose, 100)
      }
    }
    const input = document.querySelector('[data-testid="navbar-search-input"]') as HTMLElement
    input?.addEventListener('blur', handleBlur)
    return () => input?.removeEventListener('blur', handleBlur)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <ul ref={listRef} aria-live="polite" className="space-y-1 p-2 overflow-y-auto">
        {isFetching && (
          <li className="flex justify-center py-4 text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="sr-only">Buscando memórias…</span>
          </li>
        )}

        {trimmed.length > 0 && !isFetching && results.length === 0 && (
          <li className="py-4 text-center text-sm text-muted">
            Nenhuma memória encontrada para "{trimmed}".
          </li>
        )}

        {results.map((memory, index) => (
          <li key={memory.id}>
            <button
              type="button"
              aria-selected={index === activeIndex}
              onClick={() => {
                router.push(`/memories/${memory.id}`)
                onClose()
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

      {trimmed.length > 0 && (
        <div className="border-t border-border px-2 py-2">
          <button
            type="button"
            onClick={() => {
              router.push(`/search?q=${encodeURIComponent(trimmed)}`)
              onClose()
            }}
            data-testid="search-see-all"
            className="w-full text-xs font-medium text-primary hover:underline text-left"
          >
            Ver todas as {total} memórias
          </button>
        </div>
      )}
    </>
  )
}
