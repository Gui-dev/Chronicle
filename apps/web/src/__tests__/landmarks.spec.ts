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

  test('navbar stays in the viewport after scrolling', async ({ authenticatedPage }) => {
    for (const memoryDate of ['2026-09-24', '2026-09-18', '2026-09-12', '2026-09-06']) {
      await createMemory(authenticatedPage, { title: 'Rolagem', memoryDate })
    }
    await authenticatedPage.goto('/')

    await authenticatedPage.evaluate(() => window.scrollBy(0, 600))
    // Proves the page really scrolled — otherwise toBeInViewport would pass
    // vacuously on a layout too short to leave the viewport.
    await expect.poll(() => authenticatedPage.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    await expect(authenticatedPage.getByRole('navigation')).toBeInViewport()
  })

  test('search results are announced politely', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator('[data-testid="search-button"]').click()

    const results = authenticatedPage.locator('[data-testid="search-results"]')
    await expect(results).toHaveAttribute('aria-live', 'polite')

    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'zzzznadaexiste')
    await expect(authenticatedPage.locator('[data-testid="search-empty"]')).toHaveRole('status')
  })

  test('retrospective strip is a live region with a focusable scroll area', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, { title: 'Faixa viva', memoryDate: YEAR_AGO })
    await authenticatedPage.goto('/')

    const strip = authenticatedPage.locator('[data-testid="retro-strip"]')
    await expect(strip).toBeVisible()
    await expect(strip).toHaveAttribute('aria-live', 'polite')

    const scroll = strip.getByRole('region')
    await expect(scroll).toHaveAttribute('aria-label', 'Memórias de um ano atrás')
    await expect(scroll).toHaveAttribute('tabindex', '0')
  })
})
