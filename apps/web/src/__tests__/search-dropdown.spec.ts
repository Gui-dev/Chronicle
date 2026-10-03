import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Search Dropdown', () => {
  test.use({ colorScheme: 'dark' })

  test('opens on focus and shows top 5 results', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await expect(authenticatedPage.locator('[data-testid="search-dropdown"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').first()).toBeVisible()
    // Should show max 5 results
    const results = authenticatedPage.locator('[data-testid^="search-result-"]')
    const count = await results.count()
    expect(count).toBeLessThanOrEqual(5)
  })

  test('keyboard navigation works', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').first()).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]').nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('Enter')
    await expect(authenticatedPage).toHaveURL(/\/memories\//)
  })

  test('Enter in input navigates to /search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')
    await input.press('Enter')

    await expect(authenticatedPage).toHaveURL(/\/search\?q=praia/)
  })

  test('clicking "Ver todas" navigates to /search', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.getByTestId('search-see-all').click()

    await expect(authenticatedPage).toHaveURL(/\/search\?q=praia/)
  })

  test('closes on Escape', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    await authenticatedPage.keyboard.press('Escape')

    await expect(authenticatedPage.locator('[data-testid="search-dropdown"]')).toBeHidden()
  })
})
