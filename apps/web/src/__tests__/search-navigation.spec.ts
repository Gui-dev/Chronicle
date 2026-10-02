import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Navegação da busca', () => {
  test('clicking a search result shows the memory as a card, not the edit page', async ({
    authenticatedPage,
  }) => {
    // The spec owns its data: the search term has to match a memory the
    // signed-in user can see, and the per-test e2e:reset wipes this account's
    // rows between tests — so the row is created here, not assumed from the DB.
    const alvo = await createMemory(authenticatedPage, {
      title: 'Praia do Futuro',
      memoryDate: '2026-09-10',
    })

    await authenticatedPage.goto('/')
    // The navbar's Ctrl+K listener mounts with hydration; a card is the
    // cheapest proof it is attached, so the shortcut below is never a no-op.
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    await authenticatedPage.click('body')
    await authenticatedPage.keyboard.press('Control+k')
    await authenticatedPage.waitForSelector('[data-testid="search-dialog"]')

    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'praia')
    await authenticatedPage.waitForTimeout(1000)

    await authenticatedPage.locator('[data-testid^="search-result-"]').first().click()
    await authenticatedPage.waitForSelector('[data-testid^="memory-card-"]', { timeout: 10000 })

    await expect(authenticatedPage).toHaveURL(/\/memories\/[a-f0-9-]+$/)
    await expect(authenticatedPage.locator('[data-testid^="memory-card-"]')).toHaveCount(1)
    await expect(authenticatedPage.locator('text=Voltar para timeline')).toBeVisible()
  })

  test('the back link returns to the timeline', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Praia do Futuro',
      memoryDate: '2026-09-10',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    await authenticatedPage.click('body')
    await authenticatedPage.keyboard.press('Control+k')
    await authenticatedPage.waitForSelector('[data-testid="search-dialog"]')

    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'praia')
    await authenticatedPage.waitForTimeout(1000)

    await authenticatedPage.locator('[data-testid^="search-result-"]').first().click()
    await authenticatedPage.waitForSelector('[data-testid^="memory-card-"]', { timeout: 10000 })

    await authenticatedPage.locator('text=Voltar para timeline').click()
    await authenticatedPage.waitForURL('/')
    await expect(authenticatedPage.locator('[data-testid^="memory-card-"]').first()).toBeVisible()
  })
})
