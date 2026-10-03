import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Navegação da busca', () => {
  test('clicking a search result shows the memory as a card, not the edit page', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Praia do Futuro',
      memoryDate: '2026-09-10',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()

    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.waitForSelector('[data-testid^="search-result-"]')

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

    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.waitForSelector('[data-testid^="search-result-"]')

    await authenticatedPage.locator('[data-testid^="search-result-"]').first().click()
    await authenticatedPage.waitForSelector('[data-testid^="memory-card-"]', { timeout: 10000 })

    await authenticatedPage.locator('text=Voltar para timeline').click()
    await authenticatedPage.waitForURL('/')
    await expect(authenticatedPage.locator('[data-testid^="memory-card-"]').first()).toBeVisible()
  })
})
