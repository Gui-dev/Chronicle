import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemoryViaWizard } from './helpers'

test.describe('Criar memória completa', () => {
  test('can create a memory with people and tags', async ({ authenticatedPage }) => {
    await createMemoryViaWizard(authenticatedPage, {
      title: 'Teste E2E',
      content: 'Memória criada via teste E2E',
      memoryDate: '2026-09-24',
      people: ['Alice', 'Bob'],
      tags: ['teste', 'e2e'],
    })

    await expect(authenticatedPage.getByRole('heading', { name: 'Sua Timeline' })).toBeVisible()
    await expect(authenticatedPage.locator('[data-memory-id]').first()).toBeVisible()
  })
})
