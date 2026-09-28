import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { PHOTO_FIXTURE, createMemoryViaWizard } from './helpers'

test.describe('Upload de fotos no wizard', () => {
  test('uploads photos and shows progress', async ({ authenticatedPage }) => {
    const buffer = readFileSync(PHOTO_FIXTURE)

    await createMemoryViaWizard(authenticatedPage, {
      title: 'Upload com Progresso',
      memoryDate: '2026-09-24',
      photos: [
        { name: 'foto-1.png', mimeType: 'image/png', buffer },
        { name: 'foto-2.png', mimeType: 'image/png', buffer },
      ],
    })

    await expect(authenticatedPage.locator('text=Upload com Progresso')).toBeVisible()
  })

  test('rejects a non-image file', async ({ authenticatedPage }) => {
    const notAnImage = Buffer.from('this is not an image at all, just text')

    await createMemoryViaWizard(
      authenticatedPage,
      {
        title: 'Upload Invalido',
        memoryDate: '2026-09-24',
        photos: [{ name: 'fake.png', mimeType: 'image/png', buffer: notAnImage }],
      },
      { expectFailure: true },
    )

    await expect(authenticatedPage.locator('text=Não foi possível salvar as fotos')).toBeVisible()
  })

  test('deletes the memory when a photo upload ultimately fails', async ({ authenticatedPage }) => {
    await authenticatedPage.route('**/api/memories/*/photos', (route) => {
      route.abort('failed')
    })

    const buffer = readFileSync(PHOTO_FIXTURE)

    await createMemoryViaWizard(
      authenticatedPage,
      {
        title: 'Falha Parcial',
        memoryDate: '2026-09-24',
        photos: [{ name: 'foto.png', mimeType: 'image/png', buffer }],
      },
      { expectFailure: true },
    )

    await expect(authenticatedPage.locator('text=Não foi possível salvar as fotos')).toBeVisible()

    const response = await authenticatedPage.request.get(
      'http://localhost:3333/api/memories?search=Falha Parcial',
    )
    const body = (await response.json()) as { data: Array<{ title: string }> }
    expect(body.data).toHaveLength(0)
  })
})
