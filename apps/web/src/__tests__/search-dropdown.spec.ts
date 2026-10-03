import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Search Dropdown', () => {
  test.use({ colorScheme: 'dark' })

  test('opens on focus and shows top 5 results', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Dia na praia',
      memoryDate: '2026-09-15',
      locationName: 'Praia de Copacabana',
    })
    await createMemory(authenticatedPage, {
      title: 'Pôr do sol na praia',
      memoryDate: '2026-08-20',
      locationName: 'Praia de Ipanema',
    })
    await createMemory(authenticatedPage, {
      title: 'Caminhada na praia',
      memoryDate: '2026-07-10',
      locationName: 'Praia do Forte',
    })

    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')
    // Wait for debounce and search to complete
    await authenticatedPage.waitForTimeout(1000)

    // Wait for search results to appear
    await expect
      .poll(async () => {
        const results = authenticatedPage.locator('[data-testid^="search-result-"]')
        return await results.first().isVisible()
      })
      .toBeTruthy()

    // Should show max 5 results
    const results = authenticatedPage.locator('[data-testid^="search-result-"]')
    const count = await results.count()
    expect(count).toBeLessThanOrEqual(5)
  })

  test('keyboard navigation works', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Dia na praia',
      memoryDate: '2026-09-15',
      locationName: 'Praia de Copacabana',
    })
    await createMemory(authenticatedPage, {
      title: 'Pôr do sol na praia',
      memoryDate: '2026-08-20',
      locationName: 'Praia de Ipanema',
    })

    await authenticatedPage.goto('/')
    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('praia')

    // Wait for search results to appear (debounced query)
    await expect
      .poll(async () => {
        const results = authenticatedPage.locator('[data-testid^="search-result-"]')
        return await results.count()
      })
      .toBeGreaterThan(0)

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(
      authenticatedPage.locator('[data-testid^="search-result-"]').first(),
    ).toHaveAttribute('aria-selected', 'true')

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
