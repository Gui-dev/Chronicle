import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Navegação da busca', () => {
  test('clicking a search result shows the memory as a card, not the edit page', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')
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
    await authenticatedPage.goto('/')
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
