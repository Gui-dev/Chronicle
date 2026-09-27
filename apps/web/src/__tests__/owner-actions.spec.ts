import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory, fetchMemory } from './helpers'

test.describe('Ações de dono no card', () => {
  test('exposes edit, narrative and privacy to the owner', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Minha memória',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await expect(card).toBeVisible()
    await expect(card.locator('[data-testid="card-edit"]')).toBeVisible()
    await expect(card.locator('[data-testid="card-narrative"]')).toBeVisible()
    await expect(card.locator('[data-testid="card-privacy"]')).toBeVisible()
    // Delete has its own spec, it only needs to be reachable here.
    await expect(card.locator('[data-testid="card-delete"]')).toBeVisible()
  })

  test('edit navigates to the edit page of that memory', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória editável',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await expect(card).toBeVisible()
    await card.locator('[data-testid="card-edit"]').click()

    await authenticatedPage.waitForURL(`**/memories/${memoryId}/edit`)
    await expect(authenticatedPage.locator('#title')).toHaveValue('Memória editável')
  })

  test('privacy toggle flips a public memory to private and persists it', async ({
    authenticatedPage,
  }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória pública',
      memoryDate: '2026-09-24',
      isPublic: true,
    })

    expect((await fetchMemory(authenticatedPage, memoryId)).isPublic).toBe(true)

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    const privacy = card.locator('[data-testid="card-privacy"]')
    await expect(privacy).toHaveAttribute('aria-label', 'Tornar memória privada')

    await privacy.click()

    await expect(privacy).toHaveAttribute('aria-label', 'Tornar memória pública')
    await expect
      .poll(async () => (await fetchMemory(authenticatedPage, memoryId)).isPublic)
      .toBe(false)
  })

  test('privacy toggle brings a private memory back to the public feed', async ({
    page,
    authenticatedPage,
  }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória escondida',
      memoryDate: '2026-09-24',
      isPublic: false,
    })

    // Invisible to an anonymous visitor first, so the flip is observable.
    await page.goto('/')
    await expect(page.locator(`[data-memory-id="${memoryId}"]`)).toHaveCount(0)

    await authenticatedPage.goto('/')
    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    const privacy = card.locator('[data-testid="card-privacy"]')
    await expect(privacy).toHaveAttribute('aria-label', 'Tornar memória pública')

    await privacy.click()
    await expect(privacy).toHaveAttribute('aria-label', 'Tornar memória privada')
    await expect
      .poll(async () => (await fetchMemory(authenticatedPage, memoryId)).isPublic)
      .toBe(true)

    await page.reload()
    await expect(page.locator(`[data-memory-id="${memoryId}"]`)).toBeVisible()
  })
})
