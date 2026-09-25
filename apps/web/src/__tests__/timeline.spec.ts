import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Visualizar timeline', () => {
  test('dashboard loads with memories', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Teste Timeline',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator('text=Memórias')).toBeVisible()
    await expect(authenticatedPage.locator('text=Teste Timeline').first()).toBeVisible()
  })
})
