import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Filtrar memórias', () => {
  test('can filter by year', async ({ authenticatedPage }) => {
    const id2026 = await createMemory(authenticatedPage, {
      title: 'Memória 2026',
      memoryDate: '2026-09-24',
    })

    const id2025 = await createMemory(authenticatedPage, {
      title: 'Memória 2025',
      memoryDate: '2025-01-15',
    })

    await authenticatedPage.goto('/')
    // Wait for the timeline to render before touching the controls: interacting
    // before React hydrates dispatches events nothing is listening for yet, and
    // hydration then resets the filter back to its default.
    await expect(authenticatedPage.locator(`[data-memory-id="${id2025}"]`)).toBeVisible()
    await authenticatedPage.selectOption('[data-testid="year"]', '2026')

    await expect(authenticatedPage.locator(`[data-memory-id="${id2026}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${id2025}"]`)).toHaveCount(0)
  })

  test('can search by title', async ({ authenticatedPage }) => {
    const festaId = await createMemory(authenticatedPage, {
      title: 'Festa Junina',
      memoryDate: '2026-06-24',
    })

    const trilhaId = await createMemory(authenticatedPage, {
      title: 'Trilha na Serra',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${trilhaId}"]`)).toBeVisible()
    await authenticatedPage.fill('[data-testid="search"]', 'Festa')

    // Scoped to the memories this test created: the timeline also lists other
    // users' public memories, so a global card count is not ours to assert.
    await expect(authenticatedPage.locator(`[data-memory-id="${festaId}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${trilhaId}"]`)).toHaveCount(0)
  })
})
