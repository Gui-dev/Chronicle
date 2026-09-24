import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Upload de fotos', () => {
  test('can view photos section in memory detail', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Com Fotos',
      memoryDate: '2026-09-24',
    })
    const memoryId = url.split('/').pop()!
    await authenticatedPage.goto(`/memories/${memoryId}`)
    await expect(authenticatedPage.locator('text=Fotos')).toBeVisible({ timeout: 10000 })
  })
})
