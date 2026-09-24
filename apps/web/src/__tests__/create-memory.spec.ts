import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Criar memória completa', () => {
  test('can create a memory with people and tags', async ({ authenticatedPage }) => {
    const _url = await createMemory(authenticatedPage, {
      title: 'Teste E2E',
      content: 'Memória criada via teste E2E',
      memoryDate: '2026-09-24',
      people: ['Alice', 'Bob'],
      tags: ['teste', 'e2e'],
    })

    await expect(authenticatedPage.locator('text=Teste E2E')).toBeVisible({ timeout: 10000 })
  })
})
