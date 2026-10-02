import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

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

  test('arrow keys rove focus through the open menu', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const toggle = authenticatedPage.locator(TOGGLE)
    await toggle.click()
    await toggle.press('ArrowDown')
    await expect(authenticatedPage.getByTestId('menu-my-memories')).toBeFocused()
    await authenticatedPage.keyboard.press('ArrowUp')
    await expect(authenticatedPage.getByTestId('menu-sair')).toBeFocused()
    await authenticatedPage.keyboard.press('Home')
    await expect(authenticatedPage.getByTestId('menu-my-memories')).toBeFocused()
    await authenticatedPage.keyboard.press('End')
    await expect(authenticatedPage.getByTestId('menu-sair')).toBeFocused()
    await authenticatedPage.keyboard.press('Escape')
    await expect(toggle).toBeFocused()
  })
})

test.describe('Tema — marcador do mapa', () => {
  test.use({ colorScheme: 'dark' })

  test('map marker follows the selected theme', async ({ authenticatedPage }) => {
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    await createMemory(authenticatedPage, {
      title: 'Marcador para o tema',
      memoryDate: `${year}-${month}-15`,
      locationName: 'Recife',
      locationLat: -8.05,
      locationLng: -34.9,
    })

    await authenticatedPage.goto('/retrospectivas')
    const marker = authenticatedPage.locator('.leaflet-marker-icon span').first()
    await expect(marker).toBeVisible()
    // System preference is dark, so the marker starts on the dark gold.
    await expect(marker).toHaveCSS('background-color', 'rgb(240, 192, 64)')

    await authenticatedPage.getByTestId('user-menu-toggle').click()
    await authenticatedPage.getByTestId('menu-theme-light').click()
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'light')

    await expect(marker).toHaveCSS('background-color', 'rgb(117, 91, 0)')
  })
})

test.describe('Tema — sistema', () => {
  test.use({ colorScheme: 'light' })

  test('follows the system preference and reacts to changes', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('a manual choice beats the system preference', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.locator('[data-testid="user-menu-toggle"]').click()
    await authenticatedPage.getByTestId('menu-theme-dark').click()
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'dark')

    await authenticatedPage.emulateMedia({ colorScheme: 'light' })
    await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
