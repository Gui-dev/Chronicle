import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Home pública', () => {
  test('shows the public feed and sends the CTA to login when anonymous', async ({
    page,
    authenticatedPage,
  }) => {
    const publicId = await createMemory(authenticatedPage, {
      title: 'Memória pública',
      memoryDate: '2026-09-24',
      isPublic: true,
    })

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Sua Timeline' })).toBeVisible()
    await expect(page.getByText('Memórias públicas compartilhadas pela comunidade')).toBeVisible()
    await expect(page.locator(`[data-memory-id="${publicId}"]`)).toBeVisible()

    // Anonymous visitors get the login link instead of the user menu.
    await expect(page.locator('[data-testid="user-menu-toggle"]')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

    // The timeline CTA is gone (phase 7.1): no creation entry point at all
    // for an anonymous visitor, and the login link is the way in.
    await expect(page.getByRole('link', { name: 'Nova Memória' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Entrar' }).click()
    await page.waitForURL('**/login')
  })

  test('hides private memories from anonymous visitors', async ({ page, authenticatedPage }) => {
    // isPublic defaults to true on the API, so the private one is explicit.
    const privateId = await createMemory(authenticatedPage, {
      title: 'Segredo do Deb',
      memoryDate: '2026-09-24',
      isPublic: false,
    })

    const publicId = await createMemory(authenticatedPage, {
      title: 'Memória visível',
      memoryDate: '2026-09-23',
      isPublic: true,
    })

    await page.goto('/')

    // Proves the feed loaded, so a missing private card cannot pass vacuously.
    await expect(page.locator(`[data-memory-id="${publicId}"]`)).toBeVisible()
    await expect(page.locator(`[data-memory-id="${privateId}"]`)).toHaveCount(0)
  })

  test('keeps owner actions off the cards of other users', async ({ page, authenticatedPage }) => {
    const publicId = await createMemory(authenticatedPage, {
      title: 'Memória de outro usuário',
      memoryDate: '2026-09-24',
      isPublic: true,
    })

    await page.goto('/')

    const card = page.locator(`[data-testid="memory-card-${publicId}"]`)
    await expect(card).toBeVisible()
    await expect(card.locator('[data-testid="card-edit"]')).toHaveCount(0)
    await expect(card.locator('[data-testid="card-delete"]')).toHaveCount(0)
    await expect(card.locator('[data-testid="card-privacy"]')).toHaveCount(0)
    await expect(card.locator('[data-testid="card-narrative"]')).toHaveCount(0)
  })

  test('sends anonymous visitors to login instead of the private pages', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForURL('**/login')

    await page.goto('/my-memories')
    await page.waitForURL('**/login')
  })
})
