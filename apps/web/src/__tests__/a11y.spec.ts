// Axe WCAG 2.1 AA scans for the plan's 4 surfaces: home, search dialog, wizard
// step 0 and login (plus register, added when the audit caught it shipping the
// same violations as login). The dialog scan intentionally scopes to
// [role="dialog"] — the page behind it is covered by the home scan, and Radix's
// focus trap keeps interaction inside the dialog. Coverage gaps left for future
// scans: memory detail, retrospectivas, trash, wizard steps 1-4, photo lightbox.
import AxeBuilder from '@axe-core/playwright'
import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

// axe prefixes every failureSummary with a generic "Fix … of the following:"
// header; the first line under it is this node's actionable fix recipe.
function fixSuffix(failureSummary: string | undefined): string {
  const recipe = (failureSummary ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !/^Fix (any|all) of the following:$/.test(line))
  return recipe ? ` — ${recipe}` : ''
}

async function scan(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa'])
  if (include) builder = builder.include(include)
  const results = await builder.analyze()
  return results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}\n${violation.nodes
          .map((node) => `    ${node.target.join(' ')}${fixSuffix(node.failureSummary)}`)
          .join('\n')}`,
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
    // Guards the scan against matching nothing: an empty axe context reports
    // zero violations, so the toBeVisible wait above is not enough on its own.
    await expect(authenticatedPage.locator('[role="dialog"]')).toHaveCount(1)

    expect(
      await scan(authenticatedPage, '[role="dialog"]'),
      'axe violations on search dialog',
    ).toBe('')
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

  test('register page has no violations', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: 'Criar Conta' })).toBeVisible()
    expect(await scan(page), 'axe violations on register').toBe('')
  })
})

test.describe('axe WCAG 2.1 AA — light theme', () => {
  test.use({ colorScheme: 'light' })

  test('home has no violations', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Memória para auditoria no claro',
      memoryDate: '2026-09-24',
      locationName: 'São Paulo',
    })
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(authenticatedPage.locator('[data-memory-id]').first()).toBeVisible()

    expect(await scan(authenticatedPage), 'axe violations on home (light)').toBe('')
  })
})
