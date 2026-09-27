import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const PHOTO_FIXTURE = path.join(__dirname, 'photo-fixture.png')

test.describe('Upload de fotos', () => {
  test('uploads a photo from the edit page', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Upload de Foto',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto(`/memories/${memoryId}/edit`)

    await authenticatedPage.locator('[data-testid="edit-photo-input"]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: readFileSync(PHOTO_FIXTURE),
    })
    await authenticatedPage.locator('[data-testid="edit-photo-add"]').click()

    await expect(authenticatedPage.locator('[data-testid="edit-photo"]')).toHaveCount(1)
  })
})
