import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Deletar memória', () => {
  test('can delete a memory', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Para Deletar',
      memoryDate: '2026-09-24',
    })

    const memoryId = url.split('/').pop()!
    await authenticatedPage.goto(`/memories/${memoryId}`)
    await authenticatedPage.click('[data-testid="delete-button"]')
    await expect(authenticatedPage).toHaveURL(/\//)
  })
})
