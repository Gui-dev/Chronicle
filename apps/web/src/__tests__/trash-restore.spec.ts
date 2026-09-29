import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Lixeira', () => {
  test('moves a deleted memory to the trash and restores it', async ({ authenticatedPage }) => {
    const title = 'Para Restaurar'
    const memoryId = await createMemory(authenticatedPage, {
      title,
      memoryDate: '2026-09-25',
    })

    await authenticatedPage.goto('/')
    const card = authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)
    await expect(card).toBeVisible()
    await card.locator('[data-testid="card-delete"]').click()
    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Deletar', exact: true }).click()
    await expect(authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)).toHaveCount(0)

    // The link to the trash lives on the profile, next to privacy.
    await authenticatedPage.goto('/profile')
    await authenticatedPage.locator('[data-testid="profile-trash-link"]').click()
    await expect(authenticatedPage.getByTestId(`trash-title-${memoryId}`)).toHaveText(title)

    // Deleted means deleted: the timeline must not have it either.
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)).toHaveCount(0)

    await authenticatedPage.goto('/profile')
    await authenticatedPage.locator('[data-testid="profile-trash-link"]').click()
    await authenticatedPage.locator(`[data-testid="trash-restore-${memoryId}"]`).click()
    await expect(authenticatedPage.getByTestId(`trash-item-${memoryId}`)).toHaveCount(0)

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)).toBeVisible()
  })

  test('shows an empty state when nothing has been deleted', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/trash')

    await expect(authenticatedPage.getByTestId('trash-empty')).toBeVisible()
  })
})
