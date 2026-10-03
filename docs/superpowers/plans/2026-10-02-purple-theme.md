# Purple Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth "Roxo" (purple dark) theme to the existing theme system (System/Dark/Light), including CSS palette, menu option, E2E tests, and contrast gate validation.

**Architecture:** The purple theme is a dark variant with purple/emerald palette. It adds a `:root[data-theme="purple"]` block to globals.css, extends the `themeOptions` array in navbar.tsx, adds Playwright tests for theme switching and persistence, and extends the contrast verification script to validate the new palette.

**Tech Stack:** Next.js 16 (App Router), Tailwind v4, next-themes 0.4.6, Playwright, Vitest, Biome

---

### Task 1: Add Purple Palette to globals.css

**Files:**
- Modify: `apps/web/src/app/globals.css` (after line 70)

- [ ] **Step 1: Write the failing contrast test**

Run: `pnpm --filter web test:contrast`
Expected: Current 40 checks pass. After adding the purple block (but before updating verify-contrast.mjs), the test will still pass at 40 checks because the script doesn't yet read the purple block.

- [ ] **Step 2: Add the purple theme block to globals.css**

```css
:root[data-theme="purple"] {
  --background: #0d0714;
  --foreground: #e2e8f0;
  --card: #160d26;
  --card-foreground: #e2e8f0;
  --primary: #a855f7;
  --primary-foreground: #0d0714;
  --secondary: #22c55e;
  --secondary-foreground: #0d0714;
  --muted: #6d5a8a;
  --muted-foreground: #a895c4;
  --accent: #22c55e;
  --accent-foreground: #0d0714;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --text: #e2e8f0;
  --border: #3d2a5c;
  --input: #3d2a5c;
  --ring: #a855f7;
  --radius: 0.5rem;
  --glow-rgb: 168, 85, 247;
  color-scheme: dark;
}
```

Place this block after the light theme block (after line 70).

- [ ] **Step 3: Verify CSS compiles**

Run: `pnpm --filter web build`
Expected: Build succeeds (6/6)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: add purple theme palette to globals.css"
```

---

### Task 2: Extend Contrast Gate for Purple Palette

**Files:**
- Modify: `apps/web/scripts/verify-contrast.mjs`

- [ ] **Step 1: Run contrast test to see current state (40 checks)**

Run: `pnpm --filter web test:contrast`
Expected: 40 PASS (20 dark + 20 light)

- [ ] **Step 2: Add purple block to the `blocks` object**

In `verify-contrast.mjs`, change the `blocks` object (around line 11) from:

```js
const blocks = {
  dark: { selector: ':root', label: 'dark' },
  light: { selector: ':root[data-theme="light"]', label: 'light' },
}
```

to:

```js
const blocks = {
  dark: { selector: ':root', label: 'dark' },
  light: { selector: ':root[data-theme="light"]', label: 'light' },
  purple: { selector: ':root[data-theme="purple"]', label: 'purple' },
}
```

- [ ] **Step 3: Run contrast test — should fail (missing purple block in CSS)**

Run: `pnpm --filter web test:contrast`
Expected: FAIL with "no palette block found in globals.css for theme 'purple'" (if CSS not added yet) OR 60 PASS (if Task 1 CSS is already committed)

- [ ] **Step 4: Verify 60 checks pass**

Run: `pnpm --filter web test:contrast`
Expected: **60 PASS** (20 dark + 20 light + 20 purple), "all contrast checks passed"

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/verify-contrast.mjs
git commit -m "feat: extend contrast gate to validate purple palette"
```

---

### Task 3: Add "Roxo" Option to Theme Menu

**Files:**
- Modify: `apps/web/src/components/navbar.tsx`

- [ ] **Step 1: Write the failing Playwright test**

First, check current `theme-toggle.spec.ts` to understand test structure. Then add a test for purple theme switching.

- [ ] **Step 2: Add "Roxo" to `themeOptions` in navbar.tsx**

Locate the `themeOptions` constant (after `menuIconClass`, around line 104) and change from:

```tsx
const themeOptions = [
  { value: 'system', label: 'Sistema', testId: 'menu-theme-system' },
  { value: 'dark', label: 'Escuro', testId: 'menu-theme-dark' },
  { value: 'light', label: 'Claro', testId: 'menu-theme-light' },
] as const
```

to:

```tsx
const themeOptions = [
  { value: 'system', label: 'Sistema', testId: 'menu-theme-system' },
  { value: 'dark', label: 'Escuro', testId: 'menu-theme-dark' },
  { value: 'light', label: 'Claro', testId: 'menu-theme-light' },
  { value: 'purple', label: 'Roxo', testId: 'menu-theme-purple' },
] as const
```

- [ ] **Step 3: Run theme tests to verify menu item appears**

Run: `pnpm --filter web exec playwright test src/__tests__/theme-toggle.spec.ts --project=chromium`
Expected: Tests pass (existing 7 tests + new purple test if added in Step 1)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/navbar.tsx
git commit -m "feat: add Roxo option to theme menu"
```

---

### Task 4: Add Purple Theme E2E Tests

**Files:**
- Modify: `apps/web/src/__tests__/theme-toggle.spec.ts`

- [ ] **Step 1: Add purple theme switching test**

Add to the `describe('Tema')` block:

```ts
test('switching to purple applies the palette', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/')
  const toggle = authenticatedPage.locator(TOGGLE)
  await toggle.click()
  await authenticatedPage.getByTestId('menu-theme-purple').click()

  await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'purple')
  await expect(authenticatedPage.locator('body')).toHaveCSS(
    'background-color',
    'rgb(13, 7, 20)'  // #0d0714
  )
  await expect(toggle).toBeFocused()
})
```

- [ ] **Step 2: Add purple persistence test**

Add to the `describe('Tema — sistema')` block:

```ts
test('a manual purple choice beats the system preference', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/')
  await authenticatedPage.locator('[data-testid="user-menu-toggle"]').click()
  await authenticatedPage.getByTestId('menu-theme-purple').click()
  await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'purple')

  await authenticatedPage.emulateMedia({ colorScheme: 'light' })
  await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'purple')
})
```

- [ ] **Step 3: Run theme tests**

Run: `pnpm --filter web exec playwright test src/__tests__/theme-toggle.spec.ts --project=chromium`
Expected: **9 passed** (7 existing + 2 new purple tests)

- [ ] **Step 4: Run full Playwright suite to check for regressions**

Run: `pnpm --filter web exec playwright test --project=chromium`
Expected: All tests pass (113+ from before + 2 new = ~115)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__/theme-toggle.spec.ts
git commit -m "test: add purple theme switching and persistence tests"
```

---

### Task 5: Verify All Gates and Update Docs

**Files:**
- Modify: `docs/tasks.md` (add §7.7 Purple Theme section)

- [ ] **Step 1: Run all gates**

```bash
pnpm lint:fix && pnpm exec biome check .
pnpm --filter web test:contrast      # 60 PASS
pnpm --filter web typecheck
pnpm build
pnpm test
pnpm --filter web exec playwright test --project=chromium
```

Expected: All gates green.

- [ ] **Step 2: Update docs/tasks.md**

Add after §7.7 Tema Dark/Light section (around line 510):

```markdown
### 7.7 Tema Dark/Light (+ Roxo)
- [x] Seletor de tema no menu do usuário — itens Sistema/Escuro/Claro/**Roxo** com `role="menuitemradio"`/`aria-checked`, seleção fecha o menu e devolve foco ao toggle; roles `menu`/`menuitem` no dropdown existente
- [x] next-themes com `data-theme` resolvido (`defaultTheme="system"`), persistência por dispositivo via localStorage
- [x] Paleta light quente AA (`:root[data-theme='light']`) + paleta roxa dark (`:root[data-theme='purple']`) — gate de contraste estendido valida 20 checagens em cada paleta (60 total)
- [x] Exceções por token — glows dourados/roxos via `--glow-rgb` (19 classes), marcador do mapa Leaflet lê `--primary`/`--background`/`--glow-rgb` e re-estiliza na troca; `AvatarFallback` com `text-background`
- [x] Cobertura E2E nos dois temas — troca, persistência, `aria-checked`, sistema (incl. mudança ao vivo), marcador do mapa e axe na home sob `colorScheme: 'light'`

#### Gates da 7.7 (com Roxo)
`pnpm build` 6/6 · `pnpm typecheck --force` 10/10 · `pnpm test` 9/9 (API 225, schemas 57, db 11, auth 3) · `pnpm --filter web test:contrast` pass (60 checagens) · `biome check` 235 arquivos, 0 avisos · Playwright chromium **115/115**
```

- [ ] **Step 3: Commit docs**

```bash
git add docs/tasks.md
git commit -m "docs: mark purple theme as complete in tasks.md"
```

---

### Task 6: Final Code Review and Push

**Files:** (none)

- [ ] **Step 1: Run final verification**

```bash
pnpm --filter web exec playwright test src/__tests__/theme-toggle.spec.ts --project=chromium
pnpm --filter web test:contrast
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