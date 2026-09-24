import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Filtrar memórias', () => {
  test('can filter by year', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Memória 2026',
      memoryDate: '2026-09-24',
    })

    await createMemory(authenticatedPage, {
      title: 'Memória 2025',
      memoryDate: '2025-01-15',
    })

    await authenticatedPage.goto('/')
    await authenticatedPage.selectOption('[data-testid="year"]', '2026')
    await expect(authenticatedPage.locator('text=Memória 2026')).toBeVisible()
  })
})
