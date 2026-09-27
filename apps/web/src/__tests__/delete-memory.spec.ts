import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Deletar memória', () => {
  test('deletes a memory from the timeline card', async ({ authenticatedPage }) => {
    const title = 'Para Deletar'
    const memoryId = await createMemory(authenticatedPage, {
      title,
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')
    const card = authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)
    await expect(card).toBeVisible()

    await card.locator('[data-testid="card-delete"]').click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Deletar', exact: true }).click()

    await expect(authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)).toHaveCount(0)
    await expect(authenticatedPage.getByText(title)).toHaveCount(0)
  })
})
