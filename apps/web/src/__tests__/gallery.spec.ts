import { expect } from '@playwright/test'
import { test } from './fixtures'
import { addPhotos, createMemory } from './helpers'

test.describe('Galeria de fotos', () => {
  test('opens the lightbox and steps through photos with arrows, keys and the counter', async ({
    authenticatedPage,
  }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória com fotos',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 3)

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await expect(card.getByRole('button', { name: 'Abrir foto 1 de 3' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Abrir foto 3 de 3' })).toBeVisible()

    await card.getByRole('button', { name: 'Abrir foto 1 de 3' }).click()

    const lightbox = authenticatedPage.locator('[data-testid="lightbox"]')
    const counter = authenticatedPage.locator('[data-testid="lightbox-counter"]')
    await expect(lightbox).toBeVisible()
    await expect(counter).toHaveText('1 / 3')

    await authenticatedPage.locator('[data-testid="lightbox-next"]').click()
    await expect(counter).toHaveText('2 / 3')

    await authenticatedPage.keyboard.press('ArrowRight')
    await expect(counter).toHaveText('3 / 3')

    // Stepping past the ends wraps around instead of dead ending.
    await authenticatedPage.keyboard.press('ArrowRight')
    await expect(counter).toHaveText('1 / 3')

    await authenticatedPage.locator('[data-testid="lightbox-prev"]').click()
    await expect(counter).toHaveText('3 / 3')

    await authenticatedPage.keyboard.press('Escape')
    await expect(lightbox).toHaveCount(0)
  })

  test('jumps to a photo from the dot indicators', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória com indicador',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 3)

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await card.getByRole('button', { name: 'Abrir foto 1 de 3' }).click()

    const counter = authenticatedPage.locator('[data-testid="lightbox-counter"]')
    await expect(counter).toHaveText('1 / 3')

    await authenticatedPage.getByRole('button', { name: 'Ir para foto 3' }).click()
    await expect(counter).toHaveText('3 / 3')
  })

  test('hides the arrows and the counter for a single photo', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória com uma foto',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 1)

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await card.getByRole('button', { name: 'Abrir foto 1 de 1' }).click()

    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="lightbox-next"]')).toHaveCount(0)
    await expect(authenticatedPage.locator('[data-testid="lightbox-prev"]')).toHaveCount(0)
    await expect(authenticatedPage.locator('[data-testid="lightbox-counter"]')).toHaveCount(0)
  })

  test('closes on the close button and restores focus to the thumbnail', async ({
    authenticatedPage,
  }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Memória focada',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 2)

    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    const thumbnail = card.getByRole('button', { name: 'Abrir foto 1 de 2' })
    await thumbnail.click()

    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toBeVisible()
    await authenticatedPage.getByRole('button', { name: 'Fechar' }).click()

    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toHaveCount(0)
    // The dialog is modal, so focus can only come back once it left the DOM.
    await expect(thumbnail).toBeFocused()
  })
})
