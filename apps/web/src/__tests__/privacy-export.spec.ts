import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Exportação de dados', () => {
  test('starts the job and downloads the finished file', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Para Exportar',
      memoryDate: '2026-09-26',
    })

    await authenticatedPage.goto('/privacy')
    const button = authenticatedPage.getByTestId('export-start')
    await expect(button).toBeVisible()

    const downloadPromise = authenticatedPage.waitForEvent('download')
    await button.click()

    // The button stays disabled while the background job runs, so a second
    // click cannot start a second job on top of the first.
    await expect(button).toBeDisabled()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^chronicle-export-\d{4}-\d{2}-\d{2}\.json$/)

    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk))
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString()) as {
      user: { email: string }
      memories: Array<{ title: string }>
    }

    expect(payload.user.email).toBe('deb@test.com')
    expect(payload.memories.map((m) => m.title)).toContain('Para Exportar')
  })

  test('requires a session', async ({ page }) => {
    await page.goto('/privacy')
    await page.waitForURL('**/login**')

    expect(page.url()).toContain('/login')
  })
})
