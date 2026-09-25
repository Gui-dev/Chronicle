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
    await expect(authenticatedPage.locator('text=Memória 2026').first()).toBeVisible()
  })

  test('can search by title', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Festa Junina',
      memoryDate: '2026-06-24',
    })

    await createMemory(authenticatedPage, {
      title: 'Trilha na Serra',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')
    await authenticatedPage.fill('[data-testid="search"]', 'Festa')
    await expect(authenticatedPage.locator('text=Festa Junina').first()).toBeVisible()
    await expect(authenticatedPage.locator('text=Trilha na Serra').first()).toBeHidden()
  })
})
