'use client'

import type { MemoryFiltersInput } from '@chronicle/schemas'
import { useCallback, useState } from 'react'

interface UseFiltersReturn {
  filters: MemoryFiltersInput
  setFilter: <K extends keyof MemoryFiltersInput>(key: K, value: MemoryFiltersInput[K]) => void
  resetFilters: () => void
  setPage: (page: number) => void
}

const defaultFilters: MemoryFiltersInput = {
  page: 1,
  limit: 20,
}

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = useState<MemoryFiltersInput>(defaultFilters)

  const setFilter = useCallback(
    <K extends keyof MemoryFiltersInput>(key: K, value: MemoryFiltersInput[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        page: 1, // Reset to first page when filter changes
      }))
    },
    [],
  )

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({
      ...prev,
      page,
    }))
  }, [])

  return {
    filters,
    setFilter,
    resetFilters,
    setPage,
  }
}
