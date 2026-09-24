import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Buscar música', () => {
  test('music search input is visible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new')
    await expect(authenticatedPage.locator('[data-testid="musicInput"]')).toBeVisible()
  })
})
