import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Auth', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveTitle(/Login/)
  })

  test('authenticated user can access dashboard', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard')
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
  })
})
