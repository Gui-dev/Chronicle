import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Editar memória', () => {
  test('can edit a memory', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Para Editar',
      content: 'Conteúdo original',
      memoryDate: '2026-09-24',
    })

    const memoryId = url.split('/').pop()!
    await authenticatedPage.goto(`/memories/${memoryId}/edit`)
    await expect(authenticatedPage.locator('[data-testid="save-button"]')).toBeVisible()
  })
})
