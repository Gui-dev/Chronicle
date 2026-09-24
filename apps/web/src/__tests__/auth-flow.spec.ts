import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Registro + Login', () => {
  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('[data-testid="email"]')).toBeVisible()
    await expect(page.locator('[data-testid="password"]')).toBeVisible()
    await expect(page.locator('[data-testid="login-button"]')).toBeVisible()
  })

  test('authenticatedPage is redirected to dashboard', async ({ authenticatedPage }) => {
    await expect(authenticatedPage).toHaveURL(/\/dashboard/)
  })

  test('register page is accessible', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('[data-testid="register-name"]')).toBeVisible()
    await expect(page.locator('[data-testid="register-email"]')).toBeVisible()
    await expect(page.locator('[data-testid="register-password"]')).toBeVisible()
    await expect(page.locator('[data-testid="register-button"]')).toBeVisible()
  })
})
