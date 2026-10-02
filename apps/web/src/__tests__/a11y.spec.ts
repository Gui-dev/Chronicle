import AxeBuilder from '@axe-core/playwright'
import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

async function scan(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa'])
  if (include) builder = builder.include(include)
  const results = await builder.analyze()
  return results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}\n${violation.nodes
          .map((node) => `    ${node.target.join(' ')}`)
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
})
