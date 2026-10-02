import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Tema', () => {
  test.use({ colorScheme: 'dark' })

  test('html carries data-theme resolved from the system preference', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
