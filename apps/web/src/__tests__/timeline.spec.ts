import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Visualizar timeline', () => {
  test('dashboard shows the created memory on the timeline', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Teste Timeline',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')

    await expect(authenticatedPage.getByRole('heading', { name: 'Sua Timeline' })).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)).toBeVisible()
  })
})
