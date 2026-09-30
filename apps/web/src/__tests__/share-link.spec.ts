import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

test.describe('Compartilhamento', () => {
  test('generates a link, shows the redacted preview anonymously, and revokes it', async ({
    authenticatedPage,
    browser,
  }) => {
    const title = 'Churrasco na casa da vó'
    const memoryId = await createMemory(authenticatedPage, {
      title,
      memoryDate: '2026-09-20',
      content: 'Todo mundo cantou junto.',
      isPublic: false,
    })

    await authenticatedPage.goto('/')
    const card = authenticatedPage.locator(`[data-memory-id="${memoryId}"]`)
    await expect(card).toBeVisible()
    await card.locator('[data-testid="card-share"]').click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('share-none')).toBeVisible()

    await dialog.getByTestId('share-generate').click()
    await expect(dialog.getByTestId('share-active')).toBeVisible()

    const urlText = (await dialog.getByTestId('share-url').textContent()) ?? ''
    expect(urlText).toContain('/share/')
    const token = urlText.trim().split('/share/')[1]
    expect(token).toBeTruthy()

    // Fresh context = no cookies: the visitor is anonymous.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/share/${token}`)

    await expect(anonPage.getByTestId('share-title')).toHaveText(title)
    await expect(anonPage.getByText('Todo mundo cantou junto.')).toBeVisible()
    await expect(anonPage.getByTestId('share-author')).toContainText('DebUser')
    // Shared pages must never be indexed (spec §4).
    expect(await anonPage.locator('meta[name="robots"]').getAttribute('content')).toContain(
      'noindex',
    )
    // The redaction is the whole point of the preview: no author PII, ever.
    await expect(anonPage.locator('body')).not.toContainText('deb@test.com')
    await expect(anonPage.locator('body')).not.toContainText('locationLat')
    await anonContext.close()

    // Revoke from the still-open dialog, then the same URL must be dead.
    await dialog.getByTestId('share-revoke').click()
    await expect(dialog.getByTestId('share-none')).toBeVisible()

    const afterContext = await browser.newContext()
    const afterPage = await afterContext.newPage()
    await afterPage.goto(`/share/${token}`)
    await expect(afterPage.getByTestId('share-invalid')).toBeVisible()
    await expect(afterPage.getByText('Link inválido ou expirado')).toBeVisible()
    await afterContext.close()
  })

  test.describe('lista de compartilhamentos', () => {
    // Clipboard permissions have to be on the context before it opens, and the
    // fixture builds that context from `contextOptions`.
    test.use({ contextOptions: { permissions: ['clipboard-read', 'clipboard-write'] } })

    test('lists shared links with copy and revoke', async ({ authenticatedPage }) => {
      const memoryId = await createMemory(authenticatedPage, {
        title: 'Segredo compartilhado',
        memoryDate: '2026-09-21',
        isPublic: false,
      })
      const shareResponse = await authenticatedPage.request.post(
        `${API_URL}/api/memories/${memoryId}/share`,
      )
      expect(shareResponse.ok()).toBe(true)
      const { data } = (await shareResponse.json()) as { data: { token: string } }

      await authenticatedPage.goto('/profile')
      await authenticatedPage.locator('[data-testid="profile-share-link"]').click()
      await expect(authenticatedPage.getByTestId(`share-item-${memoryId}`)).toBeVisible()
      await expect(authenticatedPage.getByTestId(`share-expires-${memoryId}`)).toContainText(
        'expira em',
      )

      const expectedUrl = `${authenticatedPage.url().split('/share')[0]}/share/${data.token}`
      await authenticatedPage.locator(`[data-testid="share-copy-${memoryId}"]`).click()
      await expect
        .poll(() => authenticatedPage.evaluate(() => navigator.clipboard.readText()))
        .toBe(expectedUrl)

      await authenticatedPage.locator(`[data-testid="share-revoke-${memoryId}"]`).click()
      await expect(authenticatedPage.getByTestId(`share-item-${memoryId}`)).toHaveCount(0)
      await expect(authenticatedPage.getByTestId('share-list-empty')).toBeVisible()
    })
  })
})
