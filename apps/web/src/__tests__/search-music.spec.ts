import { expect } from '@playwright/test'
import { test } from './fixtures'
import { goToStep } from './helpers'

test.describe('Buscar música', () => {
  test('music search input is visible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new')
    await authenticatedPage.fill('[data-testid="title"]', 'Busca Música')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await goToStep(authenticatedPage, 2)
    await expect(authenticatedPage.locator('[data-testid="musicInput"]')).toBeVisible()
  })
})
