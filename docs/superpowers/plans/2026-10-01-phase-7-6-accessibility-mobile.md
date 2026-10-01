# Fase 7.6 — Acessibilidade e Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Chronicle acessível (WCAG 2.1 AA: contraste, teclado, foco, landmarks, `aria-live`) e garantir comportamento mobile sólido (timeline single-column, wizard com passos menores), com regressão automatizada.

**Architecture:** Mudanças pontuais em componentes existentes (palette, landmarks, roving tabindex na timeline) + refatoração do wizard para uma rota por passo (`/memories/new/[step]`) com `WizardProvider` no layout do App Router para manter estado entre navegações. Regressão garantida por specs Playwright novos (teclado, foco, mobile, axe) e um script Node de verificação de contraste.

**Tech Stack:** Next.js 16 (App Router, `useParams` client-side pattern já usado em `memories/[id]`), react-hook-form, Radix Dialog, Tailwind v4, Playwright + `@axe-core/playwright`, Biome.

---

## Contexto e convenções (ler antes de qualquer task)

- Repo: `/home/dracarys/Documents/projects/fullstack/chronicle`, trabalho direto na `main`.
- Biome: aspas simples, `semicolons: asNeeded` (sem ponto e vírgula no fim), 2-space, lineWidth 100. Rodar `pnpm lint:fix` após edições.
- Comandos de verificação (rodar da raiz):
  - `pnpm lint:fix && pnpm exec biome check .` (esperado: 0 avisos)
  - `pnpm typecheck --force` (esperado: 10/10 packages)
  - `pnpm build` (esperado: 6/6)
  - `pnpm test` (esperado: 8/8 — API 225, schemas 57, db 11, auth 3)
  - `pnpm --filter web exec playwright test <spec> --project=chromium` (Playwright sobe API+web sozinho via `webServer`, reutiliza se já estiverem de pé)
- E2E: fixtures (`apps/web/src/__tests__/fixtures.ts`) fazem reset de dados + login (`deb@test.com`). Specs criam dados via `createMemory(page, ...)` de `./helpers`.
- **Próximo do Next.js**: `apps/web/AGENTS.md` exige consultar `apps/web/node_modules/next/dist/docs/` antes de escrever código Next. Padrões novos neste plano: `redirect()` de `next/navigation` em page server e `notFound()` em page client — confirmar na docs local antes de implementar (Task 4).
- `sessionStorage` só existe no cliente: o `WizardProvider` fica dentro de `RequireAuth`, que renderiza spinner até a sessão resolver — o provider só monta no cliente. Manter o guard `typeof window === 'undefined'` de qualquer forma.
- Commits convencionais, inglês, imperative, sem ponto. `git add` explícito. O lefthook roda biome staged — se reclamar, `pnpm exec biome check --write <files>` antes do commit.
- Specs/plans em português; código e comentários em inglês.

## Mapa de arquivos

| Ação | Arquivo | Responsabilidade |
|------|---------|------------------|
| Modify | `apps/web/src/app/globals.css` | palette AA + `--text` |
| Create | `apps/web/scripts/verify-contrast.mjs` | verificação de ratios (gate) |
| Modify | `apps/web/package.json` | script `test:contrast` |
| Modify | `apps/web/src/components/confirm-dialog.tsx` | `variant="destructive"` + focus restore |
| Modify | `packages/ui/src/components/ui/dialog.tsx` | remover acento no X |
| Modify | steps 0-2, `chip-input`, `search-dialog`, `memory-filters`, edit page | `border-card` → `border-input` em controles |
| Create | `apps/web/src/__tests__/landmarks.spec.ts` | regressão de landmarks/aria-live |
| Modify | `(dashboard)/layout.tsx`, `(auth)/layout.tsx`, `(dashboard)/page.tsx` | `<header>`/`<main>`/`<section>` |
| Modify | `home-retrospect-strip.tsx` | `aria-live` + região de rolagem focável |
| Modify | `memory-timeline.tsx` | `<ol>` + roving tabindex + setas |
| Create | `apps/web/src/__tests__/timeline-keyboard.spec.ts` | regressão de teclado |
| Create | `apps/web/src/components/wizard-provider.tsx` | estado do wizard + sessionStorage |
| Create | `apps/web/src/components/wizard-shell.tsx` | progresso, form, botões, Enter, foco |
| Create | `(dashboard)/memories/new/layout.tsx` | `RequireAuth` + provider + header |
| Create | `(dashboard)/memories/new/[step]/page.tsx` | renderiza um passo |
| Modify | `(dashboard)/memories/new/page.tsx` | `redirect('/memories/new/0')` |
| Delete | `apps/web/src/components/create-memory-wizard.tsx` | substituído |
| Modify | 5× `steps/step-*.tsx` | `tabIndex={-1}` no `h2` |
| Modify | `apps/web/src/__tests__/user-menu.spec.ts` | `waitForURL` p/ `/memories/new/0` |
| Create | `apps/web/src/__tests__/wizard-pages.spec.ts` | URLs, Enter, draft, voltar |
| Create | `apps/web/src/__tests__/mobile-layout.spec.ts` | viewport 375px |
| Create | `apps/web/src/lib/use-dialog-focus-restore.ts` | hook de foco |
| Modify | `share-dialog.tsx`, `search-dialog.tsx` | aplicar hook |
| Create | `apps/web/src/__tests__/focus-management.spec.ts` | foco em 4 superfícies |
| Create | `apps/web/src/__tests__/a11y.spec.ts` | axe WCAG2AA |
| Modify | `docs/tasks.md` | §7.6 completo + correção do §7.5 |

---

### Task 1: Contraste AA na palette + foco visível + bordas de formulário

**Files:**
- Create: `apps/web/scripts/verify-contrast.mjs`
- Modify: `apps/web/package.json` (scripts)
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/confirm-dialog.tsx`
- Modify: `packages/ui/src/components/ui/dialog.tsx`
- Modify: `apps/web/src/components/steps/step-basic-info.tsx`, `step-location.tsx`, `step-music.tsx`
- Modify: `apps/web/src/components/chip-input.tsx`
- Modify: `apps/web/src/components/search-dialog.tsx`
- Modify: `apps/web/src/components/memory-filters.tsx`
- Modify: `apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx`

- [ ] **Step 1: Escrever o teste de contraste (failing)**

Crie `apps/web/scripts/verify-contrast.mjs`:

```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const cssPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/app/globals.css')
const css = readFileSync(cssPath, 'utf8')

function readVar(name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`variable ${name} not found in globals.css`)
  return match[1]
}

function luminance(hex) {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const names = [
  '--background',
  '--card',
  '--text',
  '--muted',
  '--muted-foreground',
  '--input',
  '--border',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
]
const palette = Object.fromEntries(names.map((name) => [name, readVar(name)]))

const checks = [
  ['--muted-foreground text on --card', '--muted-foreground', '--card', 4.5],
  ['--muted-foreground text on --background', '--muted-foreground', '--background', 4.5],
  ['--text on --background', '--text', '--background', 4.5],
  ['--text on --card', '--text', '--card', 4.5],
  ['--muted text on --background', '--muted', '--background', 4.5],
  ['--muted text on --card', '--muted', '--card', 4.5],
  ['--primary on --background', '--primary', '--background', 4.5],
  ['--primary on --card', '--primary', '--card', 4.5],
  ['--primary-foreground on --primary', '--primary-foreground', '--primary', 4.5],
  ['--secondary on --background', '--secondary', '--background', 4.5],
  ['--secondary-foreground on --secondary', '--secondary-foreground', '--secondary', 4.5],
  ['--accent-foreground on --accent', '--accent-foreground', '--accent', 4.5],
  ['--destructive-foreground on --destructive', '--destructive-foreground', '--destructive', 4.5],
  ['--input border vs --background (UI 3:1)', '--input', '--background', 3],
  ['--input border vs --card (UI 3:1)', '--input', '--card', 3],
  ['--border vs --card (UI 3:1)', '--border', '--card', 3],
]

let failed = 0
for (const [label, fg, bg, min] of checks) {
  const ratio = contrast(palette[fg], palette[bg])
  const ok = ratio >= min
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${ratio.toFixed(2)}:1 (min ${min}) — ${label}`)
}

if (failed > 0) {
  console.error(`\n${failed} contrast check(s) failed`)
  process.exit(1)
}
console.log('\nall contrast checks passed')
```

Adicione em `apps/web/package.json` → `"scripts"`:

```json
"test:contrast": "node scripts/verify-contrast.mjs"
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm --filter web test:contrast`
Expected: **FAIL** com `--muted-foreground` (3.07/3.55 < 4.5), `--input`/`--border` (1.22 < 3), `--accent-foreground on --accent` (2.33 < 4.5), `--secondary-foreground on --secondary` (2.33 < 4.5), `--destructive-foreground on --destructive` (3.76 < 4.5).

- [ ] **Step 3: Corrigir a palette em `globals.css`**

Em `apps/web/src/app/globals.css`, bloco `:root` — troque as variáveis para:

```css
:root {
  --background: #0a0a0f;
  --foreground: #ffffff;
  --card: #1a1a2e;
  --card-foreground: #ffffff;
  --primary: #f0c040;
  --primary-foreground: #0a0a0f;
  --secondary: #ff8c00;
  --secondary-foreground: #0a0a0f;
  --muted: #a0a0b0;
  --muted-foreground: #8888a8;
  --accent: #ff8c00;
  --accent-foreground: #0a0a0f;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --text: #ffffff;
  --border: #6a6a84;
  --input: #6a6a84;
  --ring: #f0c040;
  --radius: 0.5rem;
}
```

(`--text` é obrigatório: `@theme inline` mapeia `--color-text: var(--text)` e hoje a variável é indefinida — o `text-text` só funciona por herança acidental.)

Adicione ao final do arquivo (foco de teclado para elementos customizados que não usam o Button do shadcn):

```css
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm --filter web test:contrast`
Expected: `all contrast checks passed` (exit 0).

- [ ] **Step 5: Trocar bordas de formulário `border-card` → `border-input`**

Substituições automáticas (padrões só casam com controles, não com Cards/divisores):

```bash
perl -pi -e 's/border-card bg-background/border-input bg-background/g' \
  apps/web/src/components/steps/step-basic-info.tsx \
  apps/web/src/components/steps/step-location.tsx \
  apps/web/src/components/steps/step-music.tsx \
  apps/web/src/components/chip-input.tsx \
  apps/web/src/components/search-dialog.tsx \
  "apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx"

perl -pi -e 's/border-2 border-card bg-card/border-2 border-input bg-card/g' \
  apps/web/src/components/memory-filters.tsx

perl -pi -e 's/border-card text-/border-input text-/g' \
  apps/web/src/components/chip-input.tsx \
  apps/web/src/components/memory-card.tsx \
  apps/web/src/components/navbar.tsx \
  apps/web/src/components/share-dialog.tsx \
  "apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx" \
  "apps/web/src/app/(dashboard)/profile/page.tsx" \
  "apps/web/src/app/(dashboard)/share/page.tsx" \
  "apps/web/src/app/(dashboard)/trash/page.tsx"
```

Verificação:

Run: `grep -rn "border-2 border-card bg-card" apps/web/src`
Expected: **nenhuma saída** (0 ocorrências).

Run: `grep -rn "border-card bg-background" apps/web/src; grep -rn "border-card text-" apps/web/src`
Expected: **nenhuma ocorrência em controles de formulário** — as ocorrências restantes são decorativas por design (pílulas/tags, `border-b` do navbar, toast, `border-t` do áudio, caixa de URL, caixa de narrativa por IA) e permanecem. O restante de `border-card` (Cards, `border-t` divisores, `kbd`, spinners, dropzone) é decorativo e permanece.

- [ ] **Step 6: Corrigir vermelho do ConfirmDialog e o X do dialog do shadcn**

`apps/web/src/components/confirm-dialog.tsx`, botão de confirmação (white-on-red 3.76:1) — use o token destrutivo (4.83:1) em vez de vermelho hardcoded:

```tsx
          <Button
            onClick={onConfirm}
            disabled={isPending}
            variant="destructive"
          >
```

`packages/ui/src/components/ui/dialog.tsx`, linha do `DialogPrimitive.Close` — remova os estados com acento (laranja + muted-foreground ≈ 1.4:1):

```tsx
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
```

- [ ] **Step 7: Verificação de sanidade**

Run: `pnpm lint:fix && pnpm exec biome check . && pnpm --filter web test:contrast && pnpm --filter web typecheck`
Expected: 0 avisos biome, contrast `all contrast checks passed`, typecheck OK.

- [ ] **Step 8: Commit**

```bash
git add apps/web/scripts/verify-contrast.mjs apps/web/package.json apps/web/src/app/globals.css \
  apps/web/src/components/confirm-dialog.tsx packages/ui/src/components/ui/dialog.tsx \
  apps/web/src/components/steps/step-basic-info.tsx apps/web/src/components/steps/step-location.tsx \
  apps/web/src/components/steps/step-music.tsx apps/web/src/components/chip-input.tsx \
  apps/web/src/components/search-dialog.tsx apps/web/src/components/memory-filters.tsx \
  apps/web/src/components/memory-card.tsx apps/web/src/components/navbar.tsx \
  apps/web/src/components/share-dialog.tsx \
  "apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx" \
  "apps/web/src/app/(dashboard)/profile/page.tsx" \
  "apps/web/src/app/(dashboard)/share/page.tsx" \
  "apps/web/src/app/(dashboard)/trash/page.tsx"
git commit -m "fix: meet wcag aa contrast in palette and form borders"
```

---

### Task 2: Landmarks semânticos + `aria-live`

**Files:**
- Create: `apps/web/src/__tests__/landmarks.spec.ts`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/app/(auth)/layout.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/components/search-dialog.tsx`
- Modify: `apps/web/src/components/home-retrospect-strip.tsx`

- [ ] **Step 1: Escrever o teste (failing)**

Crie `apps/web/src/__tests__/landmarks.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const YEAR_AGO = (() => {
  const now = new Date()
  const y = now.getUTCFullYear() - 1
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-15`
})()

test.describe('Landmarks e regiões ao vivo', () => {
  test('dashboard exposes banner, main and a labelled timeline section', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, { title: 'Landmark', memoryDate: '2026-09-24' })
    await authenticatedPage.goto('/')

    await expect(authenticatedPage.getByRole('banner')).toHaveCount(1)
    await expect(authenticatedPage.getByRole('main')).toHaveCount(1)
    await expect(authenticatedPage.getByRole('region', { name: 'Linha do tempo' })).toBeVisible()
  })

  test('login page exposes a main landmark', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('main')).toHaveCount(1)
  })

  test('search results are announced politely', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator('[data-testid="search-button"]').click()

    const results = authenticatedPage.locator('[data-testid="search-results"]')
    await expect(results).toHaveAttribute('aria-live', 'polite')

    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'zzzznadaexiste')
    await expect(authenticatedPage.locator('[data-testid="search-empty"]')).toHaveAttribute(
      'role',
      'status',
    )
  })

  test('retrospective strip is a live region with a focusable scroll area', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, { title: 'Faixa viva', memoryDate: YEAR_AGO })
    await authenticatedPage.goto('/')

    const strip = authenticatedPage.locator('[data-testid="retro-strip"]')
    await expect(strip).toBeVisible()
    await expect(strip).toHaveAttribute('aria-live', 'polite')

    const scroll = strip.locator('[role="region"]')
    await expect(scroll).toHaveAttribute('aria-label', 'Memórias de um ano atrás')
    await expect(scroll).toHaveAttribute('tabindex', '0')
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm --filter web exec playwright test src/__tests__/landmarks.spec.ts --project=chromium`
Expected: FAIL — banner/region/aria-live inexistente (o teste do login falha primeiro: sem `<main>`).

- [ ] **Step 3: Landmarks nos layouts e na home**

`apps/web/src/app/(dashboard)/layout.tsx` — envolva a Navbar:

```tsx
    <div className="flex min-h-screen flex-col">
      <header>
        <Navbar />
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <LazyAudioPlayer />
    </div>
```

`apps/web/src/app/(auth)/layout.tsx` — troque o `<div>` por `<main>`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">{children}</main>
  )
}
```

`apps/web/src/app/(dashboard)/page.tsx` — troque `<div id="timeline">` por:

```tsx
      <section id="timeline" aria-label="Linha do tempo">
        <MemoryTimeline
          memories={memories}
          pagination={pagination}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          onPageChange={setPage}
          emptyTitle={
            isAuthenticated ? 'Nenhuma memória encontrada' : 'Nenhuma memória pública encontrada'
          }
          emptyDescription={
            isAuthenticated
              ? 'Crie sua primeira memória para começar!'
              : 'Entre na sua conta para criar sua primeira memória.'
          }
        />
      </section>
```

- [ ] **Step 4: `aria-live` na busca**

`apps/web/src/components/search-dialog.tsx`:

Na lista:

```tsx
        <ul
          ref={listRef}
          aria-live="polite"
          className="max-h-96 space-y-1 overflow-y-auto"
          data-testid="search-results"
        >
```

No estado vazio:

```tsx
        {trimmed.length > 0 && !isFetching && results.length === 0 && (
          <p
            className="py-6 text-center text-sm text-muted"
            data-testid="search-empty"
            role="status"
          >
            Nenhuma memória encontrada para “{trimmed}”.
          </p>
        )}
```

No loading:

```tsx
        {isFetching && (
          <div className="flex justify-center py-4" data-testid="search-loading" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="sr-only">Buscando memórias…</span>
          </div>
        )}
```

- [ ] **Step 5: `aria-live` + região de rolagem focável no strip**

`apps/web/src/components/home-retrospect-strip.tsx`:

Container:

```tsx
    <div
      data-testid="retro-strip"
      aria-live="polite"
      className="mb-6 flex items-stretch gap-4 rounded-xl border border-card bg-card p-4"
    >
```

Área de rolagem (axe `scrollable-region-focusable`: div com `overflow-x-auto` sem foco e sem elementos focáveis dentro):

```tsx
        <div
          role="region"
          aria-label="Memórias de um ano atrás"
          tabIndex={0}
          className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto"
        >
```

- [ ] **Step 6: Rodar e verificar que passa**

Run: `pnpm --filter web exec playwright test src/__tests__/landmarks.spec.ts --project=chromium`
Expected: 4/4 PASS.

- [ ] **Step 7: Verificação de sanidade**

Run: `pnpm lint:fix && pnpm exec biome check . && pnpm --filter web typecheck`
Expected: 0 avisos, typecheck OK.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/__tests__/landmarks.spec.ts apps/web/src/app/\(dashboard\)/layout.tsx \
  apps/web/src/app/\(auth\)/layout.tsx apps/web/src/app/\(dashboard\)/page.tsx \
  apps/web/src/components/search-dialog.tsx apps/web/src/components/home-retrospect-strip.tsx
git commit -m "feat: add semantic landmarks and aria-live regions"
```

---

### Task 3: Navegação de teclado na timeline (roving tabindex)

**Files:**
- Create: `apps/web/src/__tests__/timeline-keyboard.spec.ts`
- Modify: `apps/web/src/components/memory-timeline.tsx`

- [ ] **Step 1: Escrever o teste (failing)**

Crie `apps/web/src/__tests__/timeline-keyboard.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Timeline por teclado', () => {
  test('arrows move between cards and Home/End jump to the ends', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Primeira pelo teclado', memoryDate: '2026-09-20' })
    await createMemory(authenticatedPage, { title: 'Segunda pelo teclado', memoryDate: '2026-09-21' })
    await authenticatedPage.goto('/')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards).toHaveCount(2)

    await cards.first().focus()
    await expect(cards.first()).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(cards.nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowUp')
    await expect(cards.first()).toBeFocused()

    await authenticatedPage.keyboard.press('End')
    await expect(cards.nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('Home')
    await expect(cards.first()).toBeFocused()
  })

  test('only the active card sits in the tab order', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Roving um', memoryDate: '2026-09-20' })
    await createMemory(authenticatedPage, { title: 'Roving dois', memoryDate: '2026-09-21' })
    await authenticatedPage.goto('/')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards.first()).toHaveAttribute('tabindex', '0')
    await expect(cards.nth(1)).toHaveAttribute('tabindex', '-1')

    await authenticatedPage.locator('[data-timeline-card]').nth(1).focus()
    await expect(cards.first()).toHaveAttribute('tabindex', '-1')
    await expect(cards.nth(1)).toHaveAttribute('tabindex', '0')
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm --filter web exec playwright test src/__tests__/timeline-keyboard.spec.ts --project=chromium`
Expected: FAIL — `locator('[data-timeline-card]')` não encontrado.

- [ ] **Step 3: Implementar roving + setas em `memory-timeline.tsx`**

Imports — adicione `useRef`, `useState`:

```tsx
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
```

Dentro de `MemoryTimeline` (antes do `return`, após `const { user } = useAuth()`):

```tsx
  const listRef = useRef<HTMLOListElement>(null)
  const [activeCardIndex, setActiveCardIndex] = useState(0)

  const cardElements = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-timeline-card]') ?? [])

  const focusCard = (index: number) => {
    const cards = cardElements()
    if (cards.length === 0) return
    const next = Math.max(0, Math.min(index, cards.length - 1))
    setActiveCardIndex(next)
    cards[next].focus()
  }

  // Roving tabindex: Tab enters the list at the active card, arrows move
  // card-to-card (spec §1). Inputs keep their own arrow behaviour.
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return
    }
    const target = event.target as HTMLElement
    if (
      target !== event.currentTarget &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
    ) {
      return
    }
    const cards = cardElements()
    if (cards.length === 0) return
    event.preventDefault()
    const focused = document.activeElement
    const currentIndex = cards.findIndex((card) => card === focused || card.contains(focused))
    const base = currentIndex === -1 ? activeCardIndex : currentIndex
    if (event.key === 'ArrowDown') focusCard(base + 1)
    else if (event.key === 'ArrowUp') focusCard(base - 1)
    else if (event.key === 'Home') focusCard(0)
    else focusCard(cards.length - 1)
  }
```

Troque o bloco de retorno — o container vira `<ol>` e cada item vira `<li>` com roving (o `rovingIndex` limita o estado a faixas válidas quando a página de memórias muda; `tabIndex=0` em exatamente um item mantém a lista alcançável por Tab):

```tsx
  const rovingIndex = memories.length === 0 ? 0 : Math.min(activeCardIndex, memories.length - 1)

  return (
    <div className="relative pl-6 sm:pl-10">
      <div className="absolute left-[7px] sm:left-[11px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-secondary to-primary opacity-80" />

      <ol
        ref={listRef}
        onKeyDown={handleListKeyDown}
        data-testid="timeline-list"
        aria-label="Linha do tempo"
        className="space-y-8"
      >
        {memories.map((memory, index) => (
          <li
            key={memory.id}
            data-timeline-card
            tabIndex={index === rovingIndex ? 0 : -1}
            onFocus={(event) => {
              if (event.target === event.currentTarget) setActiveCardIndex(index)
            }}
          >
            {(index === 0 ||
              monthKey(memories[index - 1].memoryDate) !== monthKey(memory.memoryDate)) && (
              <TimelineMarker date={memory.memoryDate} />
            )}
            {index > 0 && (
              <div className="my-6 flex items-center gap-3 pl-4">
                <div className="h-px flex-1 bg-card" />
                <span className="rounded-full border border-primary/30 bg-card px-3 py-1 font-mono text-xs font-bold text-primary">
                  ⏳ {formatElapsed(memory.memoryDate, memories[index - 1].memoryDate)}
                </span>
                <div className="h-px flex-1 bg-card" />
              </div>
            )}
            <MemoryCardFull memory={memory} isOwner={user?.id === memory.userId} />
          </li>
        ))}
      </ol>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="rounded-lg border-input text-text hover:border-primary hover:text-primary"
          >
            Anterior
          </Button>
          <span className="px-4 text-sm text-muted">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="rounded-lg border-input text-text hover:border-primary hover:text-primary"
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
```

Obs.: os botões de paginação acima já estão com `border-card` na árvore atual — se o Task 1 ainda não tiver tocado neste arquivo, o `perl` de `border-card text-` não os pegou (padrão `border-card text-text` casou? `rounded-lg border-card text-text` contém `border-card text-` ✓ — então já foram trocados pelo Task 1; mantenha `border-input` como acima).

- [ ] **Step 4: Rodar e verificar que passa**

Run: `pnpm --filter web exec playwright test src/__tests__/timeline-keyboard.spec.ts --project=chromium`
Expected: 2/2 PASS.

- [ ] **Step 5: Regressão da timeline existente**

Run: `pnpm --filter web exec playwright test src/__tests__/timeline.spec.ts src/__tests__/filter-memory.spec.ts --project=chromium`
Expected: todos PASS (seletores `[data-memory-id]` continuam válidos dentro do `<li>`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/__tests__/timeline-keyboard.spec.ts apps/web/src/components/memory-timeline.tsx
git commit -m "feat: add keyboard navigation to the memory timeline"
```

---

### Task 4: Wizard em uma página por passo

O wizard deixa de ser um componente com 5 steps internos e vira rotas `/memories/new/[step]`. O estado vive num `WizardProvider` montado no **layout** `memories/new/layout.tsx` — o App Router mantém o layout montado entre navegações irmãs, então form/photos/people/tags sobrevivem ao Próximo/Anterior e ao botão Voltar do navegador. Reload duro restaura campos escalares via `sessionStorage`; `File[]` de fotos não é serializável e é descartado por decisão (comentado no código).

**Files:**
- Create: `apps/web/src/components/wizard-provider.tsx`
- Create: `apps/web/src/components/wizard-shell.tsx`
- Create: `apps/web/src/app/(dashboard)/memories/new/layout.tsx`
- Create: `apps/web/src/app/(dashboard)/memories/new/[step]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/memories/new/page.tsx`
- Delete: `apps/web/src/components/create-memory-wizard.tsx`
- Modify: `apps/web/src/components/steps/step-basic-info.tsx`, `step-location.tsx`, `step-music.tsx`, `step-photos.tsx`, `step-people.tsx` (`tabIndex={-1}` no `h2`)
- Modify: `apps/web/src/__tests__/user-menu.spec.ts`
- Create: `apps/web/src/__tests__/wizard-pages.spec.ts`

- [ ] **Step 0: Confirmar a API do Next na docs local**

Run: `grep -rn "redirect" apps/web/node_modules/next/dist/docs/01-app --include="*.mdx" -l | head -5`
Leia o guia de `redirect` e de `useParams`/dynamic params correspondente. Padrão esperado (mesmo que o da docs): `import { redirect } from 'next/navigation'` em page server; `useParams()` em page client. Se a docs local indicar sintaxe diferente (ex.: `params` como Promise em page server), ajustar os passos abaixo para o que a docs local diz — **a docs local manda**.

- [ ] **Step 1: `wizard-provider.tsx`**

Crie `apps/web/src/components/wizard-provider.tsx`:

```tsx
'use client'

import { useCreateMemory } from '@/hooks/use-create-memory'
import { usePhotoUpload } from '@/hooks/use-photo-upload'
import { api } from '@/lib/api-client'
import type { CreateMemoryFormValues, CreateMemoryInput } from '@chronicle/schemas'
import { createMemorySchema } from '@chronicle/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'

export const WIZARD_STEPS = [
  { id: 0, label: 'Básico' },
  { id: 1, label: 'Local' },
  { id: 2, label: 'Música' },
  { id: 3, label: 'Fotos' },
  { id: 4, label: 'Pessoas' },
] as const

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length

const STORAGE_KEY = 'chronicle-wizard-draft'

interface WizardDraft {
  values: Partial<CreateMemoryFormValues>
  people: string[]
  tags: string[]
}

const EMPTY_DRAFT: WizardDraft = { values: {}, people: [], tags: [] }

function loadDraft(): WizardDraft {
  if (typeof window === 'undefined') return EMPTY_DRAFT
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw) as Partial<WizardDraft>
    return {
      values: parsed.values ?? {},
      people: Array.isArray(parsed.people) ? parsed.people : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      // File objects are not serializable: photos are dropped on reload by design.
    }
  } catch {
    return EMPTY_DRAFT
  }
}

interface WizardContextValue {
  currentStep: number
  form: UseFormReturn<CreateMemoryFormValues, unknown, CreateMemoryInput>
  photos: File[]
  setPhotos: (photos: File[]) => void
  people: string[]
  setPeople: (people: string[]) => void
  tags: string[]
  setTags: (tags: string[]) => void
  isCreating: boolean
  isUploading: boolean
  progress: { current: number; total: number } | null
  validateStep: () => Promise<boolean>
  handleNext: () => Promise<void>
  handlePrevious: () => void
  onSubmit: (data: CreateMemoryInput) => Promise<void>
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext)
  if (!value) throw new Error('useWizard must be used inside WizardProvider')
  return value
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams<{ step: string }>()
  const parsed = Number(params.step)
  const currentStep =
    Number.isInteger(parsed) && parsed >= 0 && parsed < WIZARD_STEP_COUNT ? parsed : 0

  const createMemory = useCreateMemory()
  const { uploadPhotos, progress, isUploading } = usePhotoUpload()

  const draft = useMemo(loadDraft, [])
  const [photos, setPhotos] = useState<File[]>([])
  const [people, setPeople] = useState<string[]>(draft.people)
  const [tags, setTags] = useState<string[]>(draft.tags)

  const form = useForm<CreateMemoryFormValues, unknown, CreateMemoryInput>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      title: '',
      content: '',
      memoryDate: new Date().toISOString().split('T')[0],
      ...draft.values,
    },
  })

  // The draft is best-effort: written whenever form values or chips change so
  // a reload lands the user back where they were (photos excepted).
  useEffect(() => {
    const save = (values: Partial<CreateMemoryFormValues>) => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ values, people, tags }))
      } catch {
        // storage unavailable — drafts are optional
      }
    }
    save(form.getValues())
    const subscription = form.watch((values) => save(values))
    return () => subscription.unsubscribe()
  }, [form, people, tags])

  const validateStep = useCallback(async () => {
    if (currentStep !== 0) return true
    return await form.trigger(['title', 'memoryDate'])
  }, [currentStep, form])

  const handleNext = useCallback(async () => {
    const isValid = await validateStep()
    if (isValid && currentStep < WIZARD_STEP_COUNT - 1) {
      router.push(`/memories/new/${currentStep + 1}`)
    }
  }, [currentStep, router, validateStep])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) router.push(`/memories/new/${currentStep - 1}`)
  }, [currentStep, router])

  const onSubmit = useCallback(
    async (data: CreateMemoryInput) => {
      const memoryData: CreateMemoryInput = {
        ...data,
        memoryDate: data.memoryDate,
        people: people.length > 0 ? people : undefined,
        tags: tags.length > 0 ? tags : undefined,
      }

      const result = await createMemory.mutateAsync(memoryData)

      if (photos.length > 0 && result?.data?.id) {
        const memoryId = result.data.id
        try {
          await uploadPhotos(memoryId, photos)
        } catch {
          await api.delete(`/api/memories/${memoryId}`).catch(() => {})
          toast.error('Não foi possível salvar as fotos. A memória não foi criada.')
          return
        }
      }

      toast.success('Memória criada!')
      window.sessionStorage.removeItem(STORAGE_KEY)
      router.push('/')
    },
    [createMemory, people, photos, router, tags, uploadPhotos],
  )

  const value: WizardContextValue = {
    currentStep,
    form,
    photos,
    setPhotos,
    people,
    setPeople,
    tags,
    setTags,
    isCreating: createMemory.isPending,
    isUploading,
    progress,
    validateStep,
    handleNext,
    handlePrevious,
    onSubmit,
  }

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}
```

- [ ] **Step 2: `tabIndex={-1}` nos headings dos steps**

Em cada um dos 5 arquivos `apps/web/src/components/steps/step-*.tsx`, o `h2` do cabeçalho ganha `tabIndex={-1}` para o shell poder focá-lo após a troca de rota. Exemplo (repita o padrão nos 5):

`step-basic-info.tsx`:

```tsx
        <h2 tabIndex={-1} className="text-xl font-semibold text-text">
          Informações Básicas
        </h2>
```

Os demais headings: `step-location.tsx` (`Localização`), `step-music.tsx` (`Trilha Sonora`), `step-photos.tsx` (`Fotos`), `step-people.tsx` (`Pessoas e Tags`). Use exatamente o mesmo `className` que já existe em cada arquivo.

- [ ] **Step 3: `wizard-shell.tsx`**

Crie `apps/web/src/components/wizard-shell.tsx`:

```tsx
'use client'

import { useWizard, WIZARD_STEPS, WIZARD_STEP_COUNT } from '@/components/wizard-provider'
import { Button, Card } from '@chronicle/ui'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

export function WizardShell({ children }: { children: ReactNode }) {
  const { currentStep, form, isCreating, isUploading, progress, handleNext, handlePrevious, onSubmit } =
    useWizard()
  const { handleSubmit } = form
  const containerRef = useRef<HTMLDivElement>(null)

  // Every step page mounts fresh: hand focus to the step heading so keyboard
  // and screen-reader users land where the content changed (spec §1).
  useEffect(() => {
    const heading = containerRef.current?.querySelector<HTMLElement>('h2')
    heading?.focus()
  }, [currentStep])

  // Enter in a field advances instead of submitting the wizard halfway
  // through. The chip inputs call preventDefault first, textareas keep their
  // newline, and buttons keep their native activation.
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.metaKey || event.ctrlKey) return
    const target = event.target
    if (target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLButtonElement) return
    if (target instanceof HTMLInputElement && !['text', 'date', 'search'].includes(target.type)) {
      return
    }
    if (currentStep >= WIZARD_STEP_COUNT - 1) return
    event.preventDefault()
    void handleNext()
  }

  return (
    <div ref={containerRef}>
      <Card className="mx-auto max-w-2xl border-card bg-card p-4 sm:p-6">
        <div className="mb-6">
          <div
            className="flex items-center justify-between"
            role="group"
            aria-label="Progresso da criação da memória"
          >
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  aria-current={index === currentStep ? 'step' : undefined}
                  aria-label={`Passo ${index + 1}: ${step.label}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    index === currentStep
                      ? 'bg-primary text-background'
                      : index < currentStep
                        ? 'bg-primary/20 text-primary'
                        : 'bg-background text-muted'
                  }`}
                >
                  {index < currentStep ? '✓' : index + 1}
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`ml-2 hidden h-0.5 w-8 sm:block ${
                      index < currentStep ? 'bg-primary' : 'bg-background'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
          {children}

          <span aria-live="assertive" aria-atomic="true" className="sr-only">
            {isUploading && progress
              ? `Enviando foto ${progress.current} de ${progress.total}`
              : ''}
          </span>

          <div className="mt-8 flex justify-between">
            <Link href="/" prefetch={false}>
              <Button
                type="button"
                variant="outline"
                className="border-input text-text hover:border-primary hover:text-primary"
              >
                Cancelar
              </Button>
            </Link>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="inline-flex items-center gap-2 border-input text-text hover:border-primary hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>

              {currentStep < WIZARD_STEP_COUNT - 1 ? (
                <Button
                  type="button"
                  onClick={() => void handleNext()}
                  className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isCreating || isUploading}
                  data-testid="submit-memory"
                  className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress
                        ? `Enviando foto ${progress.current} de ${progress.total}...`
                        : 'Enviando fotos...'}
                    </>
                  ) : (
                    'Criar Memória'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Layout, redirect e página de passo**

Crie `apps/web/src/app/(dashboard)/memories/new/layout.tsx`:

```tsx
'use client'

import { RequireAuth } from '@/components/require-auth'
import { WizardProvider } from '@/components/wizard-provider'

export default function NewMemoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth>
      <WizardProvider>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text">Nova Memória</h1>
            <p className="mt-2 text-muted">Registre um novo momento na sua timeline</p>
          </div>
          {children}
        </div>
      </WizardProvider>
    </RequireAuth>
  )
}
```

Substitua `apps/web/src/app/(dashboard)/memories/new/page.tsx` inteiro por (page server — só o redirect):

```tsx
import { redirect } from 'next/navigation'

export default function NewMemoryPage() {
  redirect('/memories/new/0')
}
```

Crie `apps/web/src/app/(dashboard)/memories/new/[step]/page.tsx`:

```tsx
'use client'

import { StepBasicInfo } from '@/components/steps/step-basic-info'
import { StepLocation } from '@/components/steps/step-location'
import { StepMusic } from '@/components/steps/step-music'
import { StepPeople } from '@/components/steps/step-people'
import { StepPhotos } from '@/components/steps/step-photos'
import { useWizard } from '@/components/wizard-provider'
import { WizardShell } from '@/components/wizard-shell'
import { notFound, useParams } from 'next/navigation'
import type { ReactNode } from 'react'

function StepContent({ step }: { step: number }) {
  const { form, photos, setPhotos, people, setPeople, tags, setTags } = useWizard()

  let content: ReactNode
  switch (step) {
    case 0:
      content = <StepBasicInfo form={form} />
      break
    case 1:
      content = <StepLocation form={form} />
      break
    case 2:
      content = <StepMusic form={form} />
      break
    case 3:
      content = <StepPhotos photos={photos} onPhotosChange={setPhotos} />
      break
    case 4:
      content = (
        <StepPeople
          form={form}
          people={people}
          onPeopleChange={setPeople}
          tags={tags}
          onTagsChange={setTags}
        />
      )
      break
    default:
      return notFound()
  }

  return <WizardShell>{content}</WizardShell>
}

export default function WizardStepPage() {
  const params = useParams<{ step: string }>()
  const step = Number(params.step)
  if (!Number.isInteger(step) || step < 0 || step > 4) notFound()
  return <StepContent step={step} />
}
```

Nota de divisão de código: cada page importa apenas o seu step — o bundler do Next cria um chunk por rota, então a divisão que o `dynamic()` fazia antes passa a virar splits por rota, semânticos e maiores.

- [ ] **Step 5: Remover o wizard monolítico**

Confirme que só a página antiga importava o componente:

Run: `grep -rn "create-memory-wizard" apps/web/src`
Expected (após o Step 4): apenas `apps/web/src/components/create-memory-wizard.tsx` (o próprio arquivo — nenhuma importação).

```bash
git rm apps/web/src/components/create-memory-wizard.tsx
```

- [ ] **Step 6: Corrigir `user-menu.spec.ts`**

O redirect faz a URL final ser `/memories/new/0`; `waitForURL('**/memories/new')` não casa mais. Em `apps/web/src/__tests__/user-menu.spec.ts`:

```ts
    await open()
    await authenticatedPage.locator('[data-testid="menu-nova"]').click()
    await authenticatedPage.waitForURL(/\/memories\/new/)
```

- [ ] **Step 7: Escrever o teste novo (failing primeiro — as rotas ainda não existem na forma esperada)**

Crie `apps/web/src/__tests__/wizard-pages.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Wizard em páginas separadas', () => {
  test('lands on step 0 and Próximo advances the URL', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new')
    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Informações Básicas' }),
    ).toBeVisible()

    await authenticatedPage.fill('[data-testid="title"]', 'Navegação de URL')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await authenticatedPage.getByRole('button', { name: 'Próximo' }).click()

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)
    await expect(authenticatedPage.getByRole('heading', { name: 'Localização' })).toBeFocused()
  })

  test('Enter in a text field advances the step', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    const title = authenticatedPage.locator('[data-testid="title"]')
    await title.fill('Enter avança')
    await title.press('Enter')

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)
    await expect(authenticatedPage.getByRole('heading', { name: 'Localização' })).toBeFocused()
  })

  test('reload restores the draft fields from sessionStorage', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="title"]', 'Rascunho persistente')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')

    await authenticatedPage.reload()

    await expect(authenticatedPage.locator('[data-testid="title"]')).toHaveValue(
      'Rascunho persistente',
    )
    await expect(authenticatedPage.locator('[data-testid="memoryDate"]')).toHaveValue('2026-09-24')
  })

  test('browser back returns to the previous step with values intact', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="title"]', 'Valores intactos')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await authenticatedPage.getByRole('button', { name: 'Próximo' }).click()
    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)

    await authenticatedPage.goBack()

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
    await expect(authenticatedPage.locator('[data-testid="title"]')).toHaveValue(
      'Valores intactos',
    )
  })

  test('an invalid step number is a 404', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/9')
    await expect(authenticatedPage.getByText('404')).toBeVisible()
  })
})
```

- [ ] **Step 8: Rodar o teste novo**

Run: `pnpm --filter web exec playwright test src/__tests__/wizard-pages.spec.ts --project=chromium`
Expected: 5/5 PASS.

- [ ] **Step 9: Regressão completa do fluxo de criação (protege a premissa do layout)**

Run: `pnpm --filter web exec playwright test src/__tests__/create-memory.spec.ts src/__tests__/wizard-upload.spec.ts src/__tests__/search-music.spec.ts src/__tests__/search-dialog.spec.ts src/__tests__/user-menu.spec.ts --project=chromium`
Expected: todos PASS. Estes specs falham se o layout do App Router NÃO persistir o contexto entre `/new/0` → `/new/1` (título/fotos perdidos no meio do fluxo) — é a prova de que a arquitetura escolhida funciona.

Obs.: `search-dialog.spec` navega para `/memories/new` e preenche o título — o redirect para `/new/0` acontece antes do `fill`; se o `fill` reclamar de timeout, usar `await expect(page).toHaveURL(/\/memories\/new\/0/)` antes do fill nesse trecho.

- [ ] **Step 10: Verificação de sanidade**

Run: `pnpm lint:fix && pnpm exec biome check . && pnpm --filter web typecheck && pnpm build`
Expected: 0 avisos biome, typecheck OK, build 6/6.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/wizard-provider.tsx apps/web/src/components/wizard-shell.tsx \
  apps/web/src/app/\(dashboard\)/memories/new/layout.tsx \
  apps/web/src/app/\(dashboard\)/memories/new/page.tsx \
  apps/web/src/app/\(dashboard\)/memories/new/\[step\]/page.tsx \
  apps/web/src/components/steps/step-basic-info.tsx apps/web/src/components/steps/step-location.tsx \
  apps/web/src/components/steps/step-music.tsx apps/web/src/components/steps/step-photos.tsx \
  apps/web/src/components/steps/step-people.tsx \
  apps/web/src/__tests__/user-menu.spec.ts apps/web/src/__tests__/wizard-pages.spec.ts
git commit -m "feat: split creation wizard into per-step routes"
```

(O `git rm` do Step 5 já stageou a remoção; se o `lefthook` reclamar de arquivo pendente, `git add -A apps/web/src/components/create-memory-wizard.tsx` antes do commit.)

---

### Task 5: Mobile — sem scroll horizontal e coluna única verificada

A timeline **já é coluna única** (verificado no spec §4); esta task a prova com teste e elimina overflows de 375px.

**Files:**
- Create: `apps/web/src/__tests__/mobile-layout.spec.ts`
- Modify (apenas se o teste apontar): `memory-card.tsx`, `wizard-shell.tsx` (progresso — já vem compacto do Task 4), outros apontados

- [ ] **Step 1: Escrever o teste (failing)**

Crie `apps/web/src/__tests__/mobile-layout.spec.ts`:

```ts
import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.use({ viewport: { width: 375, height: 812 } })

async function expectNoHorizontalScroll(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${url} must not scroll horizontally`).toBeLessThanOrEqual(clientWidth)
}

test.describe('Mobile 375px', () => {
  test('no horizontal scroll on home, wizard, retrospectivas and search', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, {
      title: 'Memória mobile com título longo para tentar estourar o layout da timeline',
      memoryDate: '2026-09-24',
      locationName: 'Praia do Rosa, Florianópolis, Santa Catarina, Brasil',
      people: ['Alice', 'Bob'],
      tags: ['viagem', 'praia', 'familia', 'amigos', 'verao'],
    })

    for (const url of [
      '/',
      '/memories/new/0',
      '/memories/new/4',
      '/retrospectivas',
      '/search?q=mobile',
    ]) {
      await expectNoHorizontalScroll(authenticatedPage, url)
    }
  })

  test('timeline cards stack in a single column', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Primeira coluna', memoryDate: '2026-09-20' })
    await createMemory(authenticatedPage, { title: 'Segunda coluna', memoryDate: '2026-09-21' })
    await authenticatedPage.goto('/')

    const xs = await authenticatedPage.locator('[data-memory-id]').evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    )
    expect(xs.length).toBeGreaterThanOrEqual(2)
    for (const x of xs) {
      expect(x).toBe(xs[0])
    }
  })
})
```

- [ ] **Step 2: Rodar e verificar**

Run: `pnpm --filter web exec playwright test src/__tests__/mobile-layout.spec.ts --project=chromium`
Se PASS: pule para o Step 4. Se FAIL: a mensagem diz qual URL estourou — siga o Step 3.

- [ ] **Step 3: Corrigir os overflows apontados (aplicar só os que falharem)**

Suspeitos já conferidos no código, com o fix exato:

1. **Título do card** (`memory-card.tsx` ~linha 183) — palavra longa sem quebra:

```tsx
            <h2 className="text-2xl font-bold break-words text-text group-hover:text-primary transition-colors">
              &ldquo;{memory.title}&rdquo;
            </h2>
```

2. **Progresso do wizard** — 5 círculos de 32px + 4 conectores de 40px = 320px + padding não cabe em 375px. O `wizard-shell.tsx` do Task 4 já veio com conectores `hidden sm:block`; se este Task rodar antes de o Task 4 existir, esta correção fica para o Task 4 (o teste de `/memories/new/0` entra no ar junto com ele).

3. **Elemento reportado que não está na lista**: aplicar a menor correção possível na classe do elemento — `break-words` para texto, `min-w-0` para filhos flex que não encolhem, `overflow-hidden` como último recurso. NUNCA `overflow-x-auto` em página inteira (isaria mascarar o problema).

- [ ] **Step 4: Rodar de novo + regressão de layout**

Run: `pnpm --filter web exec playwright test src/__tests__/mobile-layout.spec.ts src/__tests__/timeline.spec.ts src/__tests__/gallery.spec.ts --project=chromium`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__/mobile-layout.spec.ts
# se houve correções de layout:
git add apps/web/src/components/memory-card.tsx   # e os demais tocados
git commit -m "fix: prevent horizontal overflow on mobile viewports"
```

---

### Task 6: Gerenciamento de foco em dialogs abertos por estado

**Files:**
- Create: `apps/web/src/lib/use-dialog-focus-restore.ts`
- Create: `apps/web/src/__tests__/focus-management.spec.ts`
- Modify: `apps/web/src/components/confirm-dialog.tsx`, `share-dialog.tsx`, `search-dialog.tsx`

- [ ] **Step 1: Escrever o teste (failing)**

Crie `apps/web/src/__tests__/focus-management.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { addPhotos, createMemory } from './helpers'

async function focusIsInsideDialog(page: import('@playwright/test').Page) {
  return await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"], dialog') !== null,
  )
}

test.describe('Gerenciamento de foco', () => {
  test('confirm dialog gives focus back to the delete button', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Foco da confirmação', memoryDate: '2026-09-24' })
    await authenticatedPage.goto('/')

    const del = authenticatedPage.locator('[data-testid="card-delete"]')
    await del.click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect(await focusIsInsideDialog(authenticatedPage)).toBe(true)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0)
    await expect(del).toBeFocused()
  })

  test('share dialog gives focus back to the share button', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Foco do compartilhar', memoryDate: '2026-09-24' })
    await authenticatedPage.goto('/')

    const share = authenticatedPage.locator('[data-testid="card-share"]')
    await share.click()

    await expect(authenticatedPage.getByRole('dialog')).toBeVisible()
    expect(await focusIsInsideDialog(authenticatedPage)).toBe(true)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0)
    await expect(share).toBeFocused()
  })

  test('search dialog focuses the input and returns focus to the navbar button', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')

    const trigger = authenticatedPage.locator('[data-testid="search-button"]')
    await trigger.click()

    await expect(authenticatedPage.locator('[data-testid="search-dialog-input"]')).toBeFocused()

    // focus stays trapped while tabbing through the dialog
    for (let i = 0; i < 12; i++) {
      await authenticatedPage.keyboard.press('Tab')
    }
    expect(await focusIsInsideDialog(authenticatedPage)).toBe(true)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('lightbox gives focus back to the thumbnail', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Foco da galeria',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 2)
    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    const thumb = card.getByRole('button', { name: 'Abrir foto 1 de 2' })
    await thumb.click()

    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toBeVisible()
    expect(await focusIsInsideDialog(authenticatedPage)).toBe(true)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toHaveCount(0)
    await expect(thumb).toBeFocused()
  })
})
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `pnpm --filter web exec playwright test src/__tests__/focus-management.spec.ts --project=chromium`
Expected: FAIL nos casos de confirm/share (foco cai no `<body>` — `toBeFocused` falha). Caso o lightbox já passe (dialog nativo restaura), anotar e seguir — ele entra como regressão.

- [ ] **Step 3: Criar o hook**

Crie `apps/web/src/lib/use-dialog-focus-restore.ts`:

```ts
'use client'

import { useRef } from 'react'

/**
 * Radix Dialog only returns focus to a declared DialogTrigger. Dialogs opened
 * from state (open={...}) have none, so focus would land on <body> after
 * close. Snapshot document.activeElement before Radix moves focus, and hand
 * focus back once the content has left the DOM — onCloseAutoFocus runs in a
 * setTimeout after unmount, which is why this works.
 */
export function useDialogFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus: (event: Event) => {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const trigger = triggerRef.current
      triggerRef.current = null
      if (trigger?.isConnected) trigger.focus()
    },
  }
}
```

- [ ] **Step 4: Aplicar nos dialogs**

`apps/web/src/components/confirm-dialog.tsx`:

```tsx
'use client'

import { useDialogFocusRestore } from '@/lib/use-dialog-focus-restore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@chronicle/ui'
import { Button } from '@chronicle/ui'
import { Loader2 } from 'lucide-react'
```

dentro do componente:

```tsx
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  onConfirm,
  isPending = false,
}: ConfirmDialogProps) {
  const focusRestore = useDialogFocusRestore()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-card bg-card sm:max-w-md"
        onOpenAutoFocus={focusRestore.onOpenAutoFocus}
        onCloseAutoFocus={focusRestore.onCloseAutoFocus}
      >
```

(resto inalterado)

`apps/web/src/components/share-dialog.tsx` — mesmo padrão: importar o hook, `const focusRestore = useDialogFocusRestore()` no componente, e em `<DialogContent className="border-card bg-card sm:max-w-md">` adicionar `onOpenAutoFocus={focusRestore.onOpenAutoFocus}` e `onCloseAutoFocus={focusRestore.onCloseAutoFocus}`.

`apps/web/src/components/search-dialog.tsx` — substituir os handlers inline por combinação com o hook (mantém o foco no input):

```tsx
import { useDialogFocusRestore } from '@/lib/use-dialog-focus-restore'
```

dentro do componente:

```tsx
  const focusRestore = useDialogFocusRestore()
```

no `DialogContent`:

```tsx
        onOpenAutoFocus={(event) => {
          focusRestore.onOpenAutoFocus(event)
          event.preventDefault()
          inputRef.current?.focus()
        }}
        onCloseAutoFocus={focusRestore.onCloseAutoFocus}
```

Remova o `triggerRef` local (campo `triggerRef` e sua escrita/leitura antiga) — o hook cuida disso.

- [ ] **Step 5: Rodar e verificar que passa**

Run: `pnpm --filter web exec playwright test src/__tests__/focus-management.spec.ts --project=chromium`
Expected: 4/4 PASS.

- [ ] **Step 6: Regressão de specs que usam dialogs**

Run: `pnpm --filter web exec playwright test src/__tests__/delete-memory.spec.ts src/__tests__/share-link.spec.ts src/__tests__/search-dialog.spec.ts src/__tests__/gallery.spec.ts --project=chromium`
Expected: todos PASS.

- [ ] **Step 7: Verificação de sanidade + commit**

Run: `pnpm lint:fix && pnpm exec biome check . && pnpm --filter web typecheck`
Expected: 0 avisos, typecheck OK.

```bash
git add apps/web/src/lib/use-dialog-focus-restore.ts apps/web/src/__tests__/focus-management.spec.ts \
  apps/web/src/components/confirm-dialog.tsx apps/web/src/components/share-dialog.tsx \
  apps/web/src/components/search-dialog.tsx
git commit -m "fix: restore focus when state-opened dialogs close"
```

---

### Task 7: Varredura axe WCAG 2.1 AA

**Files:**
- Modify: `apps/web/package.json` (devDependency nova)
- Create: `apps/web/src/__tests__/a11y.spec.ts`
- Modify (apenas o que a varredura acusar)

- [ ] **Step 1: Instalar o pacote**

Run: `pnpm --filter web add -D @axe-core/playwright`
Expected: instalado em `apps/web/package.json` devDependencies (e lockfile atualizado).

- [ ] **Step 2: Escrever a spec (failing — deve acusar violações reais)**

Crie `apps/web/src/__tests__/a11y.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

async function scan(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa'])
  if (include) builder = builder.include(include)
  const results = await builder.analyze()
  return results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}\n` +
        violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
    )
    .join('\n')
}

test.describe('axe WCAG 2.1 AA', () => {
  test('home has no violations', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Memória para auditoria',
      memoryDate: '2026-09-24',
      locationName: 'São Paulo',
    })
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator('[data-memory-id]').first()).toBeVisible()

    expect(await scan(authenticatedPage), 'axe violations on home').toBe('')
  })

  test('open search dialog has no violations', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator('[data-testid="search-button"]').click()
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toBeVisible()
    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'inexistente zzzz')
    await expect(authenticatedPage.locator('[data-testid="search-empty"]')).toBeVisible()

    expect(await scan(authenticatedPage, '[role="dialog"]'), 'axe violations on search dialog').toBe(
      '',
    )
  })

  test('wizard step 0 has no violations', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/0')
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Informações Básicas' }),
    ).toBeVisible()

    expect(await scan(authenticatedPage), 'axe violations on wizard').toBe('')
  })

  test('login page has no violations', async ({ page }) => {
    await page.goto('/login')
    expect(await scan(page), 'axe violations on login').toBe('')
  })
})
```

- [ ] **Step 3: Rodar e listar as violações**

Run: `pnpm --filter web exec playwright test src/__tests__/a11y.spec.ts --project=chromium`
Expected: FAIL com a lista de violações. Salve a saída — é a lista de trabalho do Step 4.

- [ ] **Step 4: Corrigir cada violação reportada**

Violações previstas pelo levantamento (aplicar as que aparecerem):

1. **`select-name`** em `memory-filters.tsx` — selects sem nome acessível. Adicione `aria-label` em cada um:
   - year: `aria-label="Filtrar por ano"`
   - month: `aria-label="Filtrar por mês"`
   - hasArtwork: `aria-label="Filtrar por artwork"`
2. **`scrollable-region-focusable`** — a região de rolagem do strip já foi corrigida no Task 2; se aparecer em outro `overflow-x-auto` (ex.: chips de pessoas do card), adicionar `tabIndex={0}` + `role="region"` + `aria-label` descritivo naquele elemento.
3. **`color-contrast`** — a palette já passa pelo `verify-contrast.mjs`; se o axe apontar um par fora da palette (textos com `text-gray-*`, `text-amber-*` sobre `bg-*` translúcido), elevar o valor da cor literal para a variante seguinte que passe (ex.: `text-gray-300` → `text-gray-200`) mantendo o visual próximo.
4. **`button-name`** — botões de ícone sem `aria-label`: adicionar `aria-label` com o significado do controle (verificar primeiro `audio-player.tsx` e os controles do retrospect map).
5. **`aria-required-children` / `aria-hidden`** — ajustar a estrutura exatamente como o axe sugerir (nunca `aria-hidden` em elemento focável).

Depois de cada rodada, reexecutar o Step 3 até `4/4 PASS`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/__tests__/a11y.spec.ts
# mais os arquivos corrigidos no Step 4
git commit -m "test: add axe wcag aa scans for key pages"
```

---

### Task 8: Gates completos + atualização do `docs/tasks.md`

**Files:**
- Modify: `docs/tasks.md` (§7.5 com textos corrigidos + §7.6 completo)

- [ ] **Step 1: Gates na ordem**

```bash
pnpm lint:fix && pnpm exec biome check .
pnpm --filter web test:contrast
pnpm typecheck --force
pnpm build
pnpm test
pnpm --filter web exec playwright test --project=chromium
```

Expected:
- biome: **0 avisos** (registrar contagem de arquivos)
- contrast: `all contrast checks passed`
- typecheck: **10/10**
- build: **6/6**
- unit/integration: **8/8** (API 225, schemas 57, db 11, auth 3)
- Playwright chromium: **todos PASS**. Os 3 flakes pré-existentes em `search-dialog`/`search-navigation` podem falhar na primeira execução — o config já tem `retries: 1`; se persistirem, reexecutar a spec isolada antes de concluir (eles não são da 7.6).

- [ ] **Step 2: Corrigir os textos inexatos da 7.5 em `docs/tasks.md`**

Os textos do §7.5 foram escritos por um subagente com afirmações incorretas. Substitua as 5 linhas do item por:

```markdown
### 7.5 Retrospectivas
- [x] "Há um ano" na home, com memória do período — faixa `HomeRetrospectStrip` na home exibe memórias do mesmo mês/ano do ano anterior (janela em UTC); se não existir, a faixa fica oculta
- [x] Resumos por período e novos itens desde a última visita — `/retrospectivas` mostra contagem de memórias novas desde `lastVisitAt`, recorrências (pessoas, lugares, temas) e mapa de lugares; `lastVisitAt` gravado na tabela `users` e atualizado a cada visita autenticada via `POST /visit`
- [x] Mapa de lugares visitados a partir de `locationLat`/`locationLng` — mapa Leaflet com marcadores e clusters na página `/retrospectivas`
- [x] Recorrências: pessoas, lugares e temas mais frequentes — agregações SQL (`GROUP BY` + `COUNT`) sobre pessoas, tags e temas das memórias; top 5 de cada exibidos no overview
- [x] Mês/ano no formato "setembro de 2026" na timeline — marcadores em UTC (`getUTCMonth`/`getUTCFullYear`) em `timeline-marker.tsx`
```

- [ ] **Step 3: Marcar a 7.6 completa**

Substitua o bloco do §7.6 por (com os números reais observados no Step 1):

```markdown
### 7.6 Acessibilidade e Mobile
- [x] Auditoria de teclado em timeline, galeria, modal de busca e wizard — roving tabindex + setas/Home/End na timeline, `Enter` avança o wizard com foco no heading do novo passo, foco/trapping em lightbox, busca, confirmação e share cobertos por E2E
- [x] Contraste AA em todo o conjunto de cores atual — `--muted-foreground: #8888a8`, `--input`/`--border: #6a6a84`, `--accent-foreground`/`--secondary-foreground: #0a0a0f`, `--destructive: #dc2626`, `--text` definido; bordas de controles `border-card` → `border-input`; confirmação em `variant="destructive"`; `:focus-visible` em `@layer base`; gate ligado ao `pnpm test` (turbo `web#test`); verificado por `pnpm --filter web test:contrast`
- [x] Gerenciamento de foco em lightbox e dialogs — hook `useDialogFocusRestore` aplicado a Confirm/Share/Search; lightbox (`<dialog>` nativo) coberto por teste de restauração de foco
- [x] Timeline em coluna única no mobile — comportamento já single-column preservado; teste E2E em 375px garante empilhamento e zero scroll horizontal
- [x] Wizard em passos menores no mobile — uma rota por passo (`/memories/new/[step]` com `WizardProvider` no layout + rascunho em `sessionStorage`), card `p-4 sm:p-6` e progresso compacto (conectores só em `sm+`)
- [x] Landmarks e `aria-live` para resultados de busca e estado de upload — `<header>`/`<main>`/`<section id="timeline">`, `aria-live="polite"` na lista de busca, `role="status"` em vazio/loading, `aria-live="assertive"` no progresso de upload, região de rolagem do strip focável

#### Gates da 7.6
`pnpm build` 6/6 · `pnpm typecheck --force` 10/10 · `pnpm test` 8/8 (API 225, schemas 57, db 11, auth 3) · `pnpm --filter web test:contrast` pass · `biome check` <N> arquivos, 0 avisos · Playwright chromium **<N>/<N>**
```

(Observação de checklist manual — continuar valendo, fora dos gates automatizados: NVDA/VoiceOver na timeline e no wizard, e toque em dispositivo real; `docs/superpowers/specs/2026-10-01-phase-7-6-accessibility-mobile-design.md` tem o checklist completo.)

- [ ] **Step 4: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: mark 7.6 as complete"
```

- [ ] **Step 5: Encerramento**

Perguntar ao usuário sobre integração (padrão das fases anteriores: push para `origin/main`).

---

## Self-Review (executado na escrita)

1. **Cobertura do spec (§1-§6):** §1 → Tasks 3 (timeline), 4 (wizard/foco/Enter), 6 (galeria/busca por teste); §2 → Task 1 (+ `scripts/verify-contrast.mjs`); §3 → Task 6; §4 → Task 5; §5 → Task 4; §6 → Tasks 2 (landmarks/search/strip) e 4 (upload `aria-live`, dentro do shell). Gaps corrigidos durante a revisão: o spec §4 foi reescrito (a timeline já é single-column — o entregável é a garantia por teste) e o §2 ganhou os ratios reais.
2. **Placeholders:** nenhuma "TBD"/"implement later". O único passo orientado a descoberta é o Task 7 Step 4 (lista de fixes previstos com código exato + regra de execução até zerar), inevitável numa varredura de auditoria.
3. **Consistência de tipos/nomes:** `WIZARD_STEPS`/`WIZARD_STEP_COUNT`/`useWizard`/`WizardShell` iguais entre Tasks 1-4; `data-timeline-card` idêntico entre Task 3 e Task 5; `[data-testid="search-empty"][role="status"]` entre Tasks 2 e 7; `border-input` global (não `--input` cru) em todas as bordas.
