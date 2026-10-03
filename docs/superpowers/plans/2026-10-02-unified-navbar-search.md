# Unified Navbar Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal SearchDialog with a unified search input in the Navbar that opens a lightweight dropdown (combobox) with live top-5 results. Enter or "Ver todas" navigates to the full `/search` page.

**Architecture:** New `SearchDropdown` component (Radix Popover) receives debounced query from Navbar, uses `useMemories` with `limit: 5`. Navbar renders fixed-width input (~320px) with search icon prefix. Removes `SearchDialog` modal, `searchOpen` state, and keyboard shortcuts (`Ctrl+K`, `/`).

**Tech Stack:** Next.js 16 (App Router), React 18, Radix UI (Popover), Tailwind v4, TanStack Query (via `useMemories`), TypeScript, Playwright, Vitest

---

### Task 1: Create SearchDropdown Component

**Files:**
- Create: `apps/web/src/components/search-dropdown.tsx`
- Modify: `apps/web/src/components/navbar.tsx` (import and render)

- [ ] **Step 1: Write the failing Playwright test**

Create `apps/web/src/__tests__/search-dropdown.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Search Dropdown', () => {
  test.use({ colorScheme: 'dark' })

  test('opens on focus and shows top 5 results', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await expect(authenticatedPage.locator('[data-testid="search-dropdown"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').first()).toBeVisible()
    // Should show max 5 results
    const results = authenticatedPage.locator('[data-testid^="search-result-"]')
    await expect(results).toHaveCountLessThanOrEqual(5)
  })

  test('keyboard navigation works', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').first()).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('Enter')
    await expect(authenticatedPage).toHaveURL(/\/memories\//)
  })

  test('Enter in input navigates to /search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')
    await input.press('Enter')

    await expect(authenticatedPage).toHaveURL(/\/search\?q=praia/)
  })

  test('clicking "Ver todas" navigates to /search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.getByTestId('search-see-all').click()

    await expect(authenticatedPage).toHaveURL(/\/search\?q=praia/)
  })

  test('closes on Escape', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.keyboard.press('Escape')

    await expect(authenticatedPage.locator('[data-testid="search-dropdown"]')).toBeHidden()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec playwright test apps/web/src/__tests__/search-dropdown.spec.ts --project=chromium`
Expected: FAIL (component doesn't exist yet)

- [ ] **Step 3: Create SearchDropdown component**

Create `apps/web/src/components/search-dropdown.tsx`:

```tsx
'use client'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMemories } from '@/hooks/use-memories'
import { Popover, PopoverContent, PopoverTrigger } from '@chronicle/ui'
import { Loader2, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'

interface SearchDropdownProps {
  debouncedQuery: string
  isOpen: boolean
  onClose: () => void
}

const EMPTY_RESULTS: Array<{ id: string; title: string; memoryDate: string; locationName: string | null }> = []

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

  const results = trimmed.length > 0
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
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setTimeout(onClose, 100)
      }
    }
    const input = document.querySelector('[data-testid="navbar-search-input"]') as HTMLElement
    input?.addEventListener('blur', handleBlur)
    return () => input?.removeEventListener('blur', handleBlur)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <Popover open={isOpen} onOpenChange={onClose}>
      <PopoverTrigger asChild>
        {/* Trigger is rendered by Navbar — this is a no-op for positioning */}
        <span data-testid="search-dropdown-trigger" style={{ display: 'none' }} />
      </PopoverTrigger>
      <PopoverContent
        data-testid="search-dropdown"
        className="w-80 max-h-80 p-0 border-border bg-card shadow-xl"
        sideOffset={4}
        align="start"
      >
        <ul
          ref={listRef}
          aria-live="polite"
          role="listbox"
          className="space-y-1 p-2 overflow-y-auto"
        >
          {isFetching && (
            <li className="flex justify-center py-4 text-muted" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="sr-only">Buscando memórias…</span>
            </li>
          )}

          {trimmed.length > 0 && !isFetching && results.length === 0 && (
            <li className="py-4 text-center text-sm text-muted" role="status">
              Nenhuma memória encontrada para “{trimmed}”.
            </li>
          )}

          {results.map((memory, index) => (
            <li key={memory.id}>
              <button
                type="button"
                role="option"
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

        {trimmed.length > 0 && results.length > 0 && (
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
          )}
        </PopoverContent>
      </Popover>
    </Popover>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec playwright test apps/web/src/__tests__/search-dropdown.spec.ts --project=chromium`
Expected: Tests pass (or adjust component until they do)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/search-dropdown.tsx apps/web/src/__tests__/search-dropdown.spec.ts
git commit -m "feat: add SearchDropdown component with live results"
```

---

### Task 2: Integrate Search Input into Navbar

**Files:**
- Modify: `apps/web/src/components/navbar.tsx`

- [ ] **Step 1: Run existing navbar tests to establish baseline**

Run: `pnpm --filter web exec playwright test apps/web/src/__tests__/user-menu.spec.ts apps/web/src/__tests__/search-dialog.spec.ts --project=chromium`
Expected: Current tests pass (will update them later)

- [ ] **Step 2: Add search state and render input + dropdown**

In `navbar.tsx`, replace the search button (lines 147-158) and `SearchDialog` render (line 314) with:

```tsx
// Add after themeOptions constant (around line 133)
const [searchQuery, setSearchQuery] = useState('')
const [searchOpen, setSearchOpen] = useState(false)
const searchInputRef = useRef<HTMLInputElement>(null)
const debouncedSearchQuery = useDebouncedValue(searchQuery, 300)
```

```tsx
// Replace search button (lines 147-158) with:
<div className="relative w-80 sm:w-80 hidden sm:block">
  <label htmlFor="navbar-search" className="sr-only">Buscar memórias</label>
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
    <input
      ref={searchInputRef}
      id="navbar-search"
      type="search"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onFocus={() => setSearchOpen(true)}
      onBlur={() => setTimeout(() => setSearchOpen(false), 100)}
      placeholder="Buscar: #tag @pessoa ano:2026 local:praia"
      data-testid="navbar-search-input"
      className="w-full h-10 rounded-lg border-2 bg-background pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
      role="combobox"
      aria-expanded={searchOpen}
      aria-controls="search-dropdown"
      aria-autocomplete="list"
    />
    <SearchDropdown
      debouncedQuery={debouncedSearchQuery}
      isOpen={searchOpen && debouncedSearchQuery.trim().length > 0}
      onClose={() => setSearchOpen(false)}
    />
  </div>
</div>
```

```tsx
// Remove SearchDialog import (line 3) and render (line 314)
// Remove searchOpen state (line 18) — replaced above
// Remove Ctrl+K and '/' shortcuts (lines 70-98) — dropdown opens on focus
```

- [ ] **Step 3: Update mobile layout**

Add mobile search input below logo (after `Link` to "/", around line 144):

```tsx
{/* Mobile search input */}
<div className="sm:hidden w-full mt-2">
  <label htmlFor="navbar-search-mobile" className="sr-only">Buscar memórias</label>
  <div className="relative">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
    <input
      id="navbar-search-mobile"
      type="search"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onFocus={() => setSearchOpen(true)}
      onBlur={() => setTimeout(() => setSearchOpen(false), 100)}
      placeholder="Buscar: #tag @pessoa ano:2026 local:praia"
      data-testid="navbar-search-input"
      className="w-full h-10 rounded-lg border-2 bg-background pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      role="combobox"
      aria-expanded={searchOpen}
      aria-controls="search-dropdown"
      aria-autocomplete="list"
    />
    <SearchDropdown
      debouncedQuery={debouncedSearchQuery}
      isOpen={searchOpen && debouncedSearchQuery.trim().length > 0}
      onClose={() => setSearchOpen(false)}
    />
  </div>
</div>
```

- [ ] **Step 4: Run navbar and search tests**

Run: `pnpm --filter web exec playwright test apps/web/src/__tests__/user-menu.spec.ts apps/web/src/__tests__/search-dropdown.spec.ts --project=chromium`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/navbar.tsx
git commit -m "feat: add unified search input to navbar with dropdown"
```

---

### Task 3: Remove SearchDialog and Clean Up

**Files:**
- Delete: `apps/web/src/components/search-dialog.tsx`
- Modify: `apps/web/src/__tests__/search-dialog.spec.ts` (remove or archive)
- Modify: `apps/web/src/__tests__/focus-management.spec.ts` (remove search dialog focus test)
- Modify: `apps/web/src/__tests__/a11y.spec.ts` (remove search dialog a11y test)
- Modify: `apps/web/src/__tests__/search-navigation.spec.ts` (update to use navbar input)
- Modify: `apps/web/src/__tests__/landmarks.spec.ts` (update search test)
- Modify: `apps/web/src/__tests__/search-page.spec.ts` (update "Ver todas" test)

- [ ] **Step 1: Delete search-dialog.tsx**

```bash
rm apps/web/src/components/search-dialog.tsx
```

- [ ] **Step 2: Update/remove affected tests**

For each test file, remove tests that depend on `SearchDialog` modal:
- `search-dialog.spec.ts` → delete or archive (replace with `search-dropdown.spec.ts`)
- `focus-management.spec.ts` → remove "search dialog focuses the input" test
- `a11y.spec.ts` → remove "open search dialog has no violations" test
- `search-navigation.spec.ts` → update to use navbar search input
- `landmarks.spec.ts` → update search test to use navbar input
- `search-page.spec.ts` → update "Ver todas" test to use navbar input

- [ ] **Step 3: Run all Playwright tests**

Run: `pnpm --filter web exec playwright test --project=chromium`
Expected: All tests pass (115+ tests, no regressions)

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/components/search-dialog.tsx apps/web/src/__tests__/
git commit -m "refactor: remove SearchDialog modal, unify search in navbar"
```

---

### Task 4: Verify All Gates and Update Docs

**Files:**
- Modify: `docs/tasks.md` (add section for unified search)

- [ ] **Step 1: Run all gates**

```bash
pnpm lint:fix && pnpm exec biome check .
pnpm --filter web typecheck
pnpm build
pnpm test
pnpm --filter web exec playwright test --project=chromium
```

Expected: All gates green.

- [ ] **Step 2: Update docs/tasks.md**

Add after §7.7 (purple theme) section:

```markdown
### 7.8 Busca Unificada na Navbar
- [x] Input único na Navbar (substitui botão de lupa) — largura fixa 320px, ícone prefixado, placeholder com exemplos
- [x] Dropdown combobox (Radix Popover) — abre no focus, top 5 resultados via `useMemories(limit: 5)`, debounce 300ms
- [x] Navegação por teclado — ArrowUp/Down, Enter (abre memória), Escape (fecha), Enter no input → `/search`
- [x] Link "Ver todas X memórias" → `/search?q=...`
- [x] Mobile: input full-width abaixo do logo
- [x] Removido modal `SearchDialog` — atalhos `Ctrl+K` e `/` removidos
- [x] Testes: dropdown (abre, resultados, teclado, Enter, Ver todas, Escape), navegação, a11y

#### Gates da 7.8
`pnpm build` 6/6 · `pnpm typecheck --force` 10/10 · `pnpm test` 9/9 · `biome check` 235 arquivos, 0 avisos · Playwright chromium **115/115**
```

- [ ] **Step 3: Commit docs**

```bash
git add docs/tasks.md
git commit -m "docs: mark unified navbar search as complete"
```

---

### Task 5: Final Verification and Push

**Files:** (none)

- [ ] **Step 1: Run final verification**

```bash
pnpm --filter web exec playwright test apps/web/src/__tests__/search-dropdown.spec.ts --project=chromium
pnpm --filter web exec playwright test --project=chromium
pnpm exec biome check .
pnpm --filter web typecheck
pnpm build
```

- [ ] **Step 2: Show git log for review**

```bash
git log --oneline -10
```

- [ ] **Step 3: Push to origin/main** (after user confirmation)

```bash
git push origin main
```