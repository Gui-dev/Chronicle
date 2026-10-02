import { expect } from '@playwright/test'
import { test } from './fixtures'

const TOGGLE = '[data-testid="user-menu-toggle"]'

test.describe('Tema', () => {
  test.use({ colorScheme: 'dark' })

  test('html carries data-theme resolved from the system preference', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('switching to light applies the palette and returns focus', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')
    const toggle = authenticatedPage.locator(TOGGLE)
    await toggle.click()
    await authenticatedPage.getByTestId('menu-theme-light').click()

    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(authenticatedPage.locator('body')).toHaveCSS(
      'background-color',
      'rgb(250, 248, 244)',
    )
    await expect(authenticatedPage.getByTestId('menu-theme-light')).toHaveCount(0)
    await expect(toggle).toBeFocused()
  })

  test('marks the active theme with aria-checked', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator(TOGGLE).click()
    const system = authenticatedPage.getByTestId('menu-theme-system')
    const dark = authenticatedPage.getByTestId('menu-theme-dark')
    const light = authenticatedPage.getByTestId('menu-theme-light')

    await expect(system).toHaveAttribute('aria-checked', 'true')
    await expect(dark).toHaveAttribute('aria-checked', 'false')
    await expect(light).toHaveAttribute('aria-checked', 'false')

    await light.click()
    await authenticatedPage.locator(TOGGLE).click()
    await expect(light).toHaveAttribute('aria-checked', 'true')
    await expect(system).toHaveAttribute('aria-checked', 'false')
    await expect(dark).toHaveAttribute('aria-checked', 'false')
  })

  test('the choice persists across a reload', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator(TOGGLE).click()
    await authenticatedPage.getByTestId('menu-theme-light').click()
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'light')

    await authenticatedPage.reload()
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(authenticatedPage.locator('body')).toHaveCSS(
      'background-color',
      'rgb(250, 248, 244)',
    )
  })
})
