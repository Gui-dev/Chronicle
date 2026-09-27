import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const PHOTO_FIXTURE = path.join(__dirname, 'photo-fixture.png')
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

test.describe('Editar memória', () => {
  test('can edit a memory', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Para Editar',
      content: 'Conteúdo original',
      memoryDate: '2026-09-24',
    })

    const memoryId = url.split('/').pop()!
    await authenticatedPage.goto(`/memories/${memoryId}/edit`)
    await expect(authenticatedPage.locator('[data-testid="save-button"]')).toBeVisible()
  })

  test('shows existing photos on the edit page', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Com Foto Existente',
      memoryDate: '2026-09-24',
    })
    const memoryId = url.split('/').pop()!

    const upload = await authenticatedPage.request.post(
      `${API_URL}/api/memories/${memoryId}/photos`,
      {
        multipart: {
          file: { name: 'photo.png', mimeType: 'image/png', buffer: readFileSync(PHOTO_FIXTURE) },
        },
      },
    )
    expect(upload.status()).toBe(201)

    await authenticatedPage.goto(`/memories/${memoryId}/edit`)
    await expect(authenticatedPage.locator('[data-testid="edit-photo"]')).toHaveCount(1)
  })

  test('removes an existing photo immediately', async ({ authenticatedPage }) => {
    const url = await createMemory(authenticatedPage, {
      title: 'Remover Foto',
      memoryDate: '2026-09-24',
    })
    const memoryId = url.split('/').pop()!

    const upload = await authenticatedPage.request.post(
      `${API_URL}/api/memories/${memoryId}/photos`,
      {
        multipart: {
          file: { name: 'photo.png', mimeType: 'image/png', buffer: readFileSync(PHOTO_FIXTURE) },
        },
      },
    )
    expect(upload.status()).toBe(201)

    await authenticatedPage.goto(`/memories/${memoryId}/edit`)
    await authenticatedPage.locator('[data-testid="edit-photo-remove"]').first().click()

    await expect(authenticatedPage.locator('[data-testid="edit-photo"]')).toHaveCount(0)
  })
})
