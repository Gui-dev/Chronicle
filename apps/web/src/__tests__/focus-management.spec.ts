import { expect } from '@playwright/test'
import { test } from './fixtures'
import { addPhotos, createMemory } from './helpers'

async function focusIsInsideDialog(page: import('@playwright/test').Page) {
  return await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"], dialog') !== null,
  )
}

/** Retrying wrapper: a single evaluate() snapshot would flake on timing drift. */
async function expectFocusInsideDialog(page: import('@playwright/test').Page) {
  await expect.poll(() => focusIsInsideDialog(page)).toBe(true)
}

test.describe('Gerenciamento de foco', () => {
  test('confirm dialog gives focus back to the delete button', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Foco da confirmação',
      memoryDate: '2026-09-24',
    })
    await authenticatedPage.goto('/')

    const del = authenticatedPage.locator('[data-testid="card-delete"]')
    await del.click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expectFocusInsideDialog(authenticatedPage)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0)
    await expect(del).toBeFocused()
  })

  test('share dialog gives focus back to the share button', async ({ authenticatedPage }) => {
    // card-share only renders for private memories, and the API defaults
    // isPublic to true — so it has to be explicit here.
    await createMemory(authenticatedPage, {
      title: 'Foco do compartilhar',
      memoryDate: '2026-09-24',
      isPublic: false,
    })
    await authenticatedPage.goto('/')

    const share = authenticatedPage.locator('[data-testid="card-share"]')
    await share.click()

    await expect(authenticatedPage.getByRole('dialog')).toBeVisible()
    await expectFocusInsideDialog(authenticatedPage)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0)
    await expect(share).toBeFocused()
  })

  test('search dialog focuses the input and returns focus to the navbar button', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')

    const trigger = authenticatedPage.locator('[data-testid="search-button"]')
    await trigger.click()

    await expect(authenticatedPage.locator('[data-testid="search-dialog-input"]')).toBeFocused()

    // focus stays trapped while tabbing through the dialog
    for (let i = 0; i < 12; i++) {
      await authenticatedPage.keyboard.press('Tab')
    }
    await expectFocusInsideDialog(authenticatedPage)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('lightbox gives focus back to the thumbnail', async ({ authenticatedPage }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Foco da galeria',
      memoryDate: '2026-09-24',
    })
    await addPhotos(authenticatedPage, memoryId, 2)
    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    const thumb = card.getByRole('button', { name: 'Abrir foto 1 de 2' })
    await thumb.click()

    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toBeVisible()
    await expectFocusInsideDialog(authenticatedPage)

    await authenticatedPage.keyboard.press('Escape')
    await expect(authenticatedPage.locator('[data-testid="lightbox"]')).toHaveCount(0)
    await expect(thumb).toBeFocused()
  })

  test('deleting a card hands focus to the timeline instead of body', async ({
    authenticatedPage,
  }) => {
    const memoryId = await createMemory(authenticatedPage, {
      title: 'Foco pós-deletar',
      memoryDate: '2026-09-24',
    })
    await authenticatedPage.goto('/')

    const card = authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)
    await expect(card).toBeVisible()
    await card.locator('[data-testid="card-delete"]').click()

    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Deletar', exact: true }).click()

    await expect(authenticatedPage.locator(`[data-testid="memory-card-${memoryId}"]`)).toHaveCount(
      0,
    )
    await expect(authenticatedPage.getByRole('dialog')).toHaveCount(0)

    // The card the dialog used to restore focus to is gone. Focus must land on
    // something that outlived it — never <body>, where the next Tab would
    // restart from the top of the document.
    await expect
      .poll(() =>
        authenticatedPage.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? 'none'),
      )
      .toMatch(/^(li|section|main)$/)
  })
})
