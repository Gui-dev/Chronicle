'use client'

import { useEffect, useState } from 'react'

/**
 * Trails `value` by `delay` ms, cancelling the pending update whenever it
 * changes again. Used to keep the search dialog from firing a request per
 * keystroke.
 *
 * `apps/web` has no unit test script, so this hook is only exercised by the
 * E2E suite. The two failure modes worth knowing about: the cleanup return
 * cancels a pending timer, so a value that changes twice within `delay` never
 * reaches the trailing state; and the initial state is `value` itself, not
 * `undefined`, so the first render is not a flash of empty before the first
 * timer fires.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
