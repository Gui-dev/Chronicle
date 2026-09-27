import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { PHOTO_FIXTURE, createMemory } from './helpers'

test.describe('Perfil', () => {
  test('shows the account data', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile')

    await expect(authenticatedPage.getByRole('heading', { name: 'Perfil' })).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="profile-name"]')).toHaveText('DebUser')
    await expect(authenticatedPage.locator('[data-testid="profile-email"]')).toHaveText(
      'deb@test.com',
    )
  })

  test('counts only the memories of the signed-in user', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Uma', memoryDate: '2026-09-24' })
    await createMemory(authenticatedPage, { title: 'Duas', memoryDate: '2026-09-23' })

    await authenticatedPage.goto('/profile')

    await expect(authenticatedPage.locator('[data-testid="profile-memory-count"]')).toHaveText(
      '2 memórias',
    )
  })

  test('uses the singular form for a single memory', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Só uma', memoryDate: '2026-09-24' })

    await authenticatedPage.goto('/profile')

    await expect(authenticatedPage.locator('[data-testid="profile-memory-count"]')).toHaveText(
      '1 memória',
    )
  })

  test('links to my memories', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile')

    await authenticatedPage.locator('[data-testid="profile-my-memories-link"]').click()
    await authenticatedPage.waitForURL('**/my-memories')
    await expect(authenticatedPage.getByRole('heading', { name: 'Minhas Memórias' })).toBeVisible()
  })

  test('uploads and removes the avatar', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile')

    const avatar = authenticatedPage.locator('[data-testid="profile-avatar"]')
    const removeButton = authenticatedPage.locator('[data-testid="remove-avatar"]')

    // The reset clears users.image, so every run starts from the initials.
    await expect(avatar).toHaveText('DE')
    await expect(avatar.locator('img')).toHaveCount(0)
    await expect(removeButton).toHaveCount(0)

    await authenticatedPage.locator('[data-testid="avatar-input"]').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: readFileSync(PHOTO_FIXTURE),
    })

    await expect(avatar.locator('img')).toHaveCount(1)
    await expect(removeButton).toBeVisible()

    await removeButton.click()

    await expect(avatar.locator('img')).toHaveCount(0)
    await expect(avatar).toHaveText('DE')
    await expect(removeButton).toHaveCount(0)
  })

  test('shows the avatar in the navbar after an upload', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/profile')
    await authenticatedPage.locator('[data-testid="avatar-input"]').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: readFileSync(PHOTO_FIXTURE),
    })
    await expect(authenticatedPage.locator('[data-testid="profile-avatar"] img')).toHaveCount(1)

    await authenticatedPage.goto('/')

    await expect(authenticatedPage.locator('[data-testid="user-menu-toggle"] img')).toHaveCount(1)
  })
})
