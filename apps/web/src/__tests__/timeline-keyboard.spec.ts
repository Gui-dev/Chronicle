import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Timeline por teclado', () => {
  test('arrows move between cards and Home/End jump to the ends', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Primeira pelo teclado',
      memoryDate: '2026-09-20',
    })
    await createMemory(authenticatedPage, {
      title: 'Segunda pelo teclado',
      memoryDate: '2026-09-21',
    })
    await authenticatedPage.goto('/my-memories')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards).toHaveCount(2)

    await cards.first().focus()
    await expect(cards.first()).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(cards.nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowUp')
    await expect(cards.first()).toBeFocused()

    await authenticatedPage.keyboard.press('End')
    await expect(cards.nth(1)).toBeFocused()

    await authenticatedPage.keyboard.press('Home')
    await expect(cards.first()).toBeFocused()
  })

  test('only the active card sits in the tab order', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Roving um', memoryDate: '2026-09-20' })
    await createMemory(authenticatedPage, { title: 'Roving dois', memoryDate: '2026-09-21' })
    await authenticatedPage.goto('/my-memories')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards.first()).toHaveAttribute('tabindex', '0')
    await expect(cards.nth(1)).toHaveAttribute('tabindex', '-1')

    await authenticatedPage.locator('[data-timeline-card]').nth(1).focus()
    await expect(cards.first()).toHaveAttribute('tabindex', '-1')
    await expect(cards.nth(1)).toHaveAttribute('tabindex', '0')
  })

  test('arrow keys clamp at both bounds of a single-card list', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Card unico', memoryDate: '2026-09-20' })
    await authenticatedPage.goto('/my-memories')

    const card = authenticatedPage.locator('[data-timeline-card]')
    await expect(card).toHaveCount(1)

    await card.focus()
    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(card).toBeFocused()

    await authenticatedPage.keyboard.press('ArrowUp')
    await expect(card).toBeFocused()
  })

  test('Tab from the filter bar enters the list at the active card', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, { title: 'Entrada por Tab', memoryDate: '2026-09-20' })
    await authenticatedPage.goto('/my-memories')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards).toHaveCount(1)

    // The artwork select is the last focusable before the timeline, so one Tab
    // crosses straight into the list — which the roving slot must own.
    await authenticatedPage.locator('[data-testid="hasArtwork"]').focus()
    await authenticatedPage.keyboard.press('Tab')

    await expect(cards.first()).toBeFocused()
    await expect(cards.first()).toHaveAttribute('tabindex', '0')
  })

  test('pagination moves the roving entry point back to the first card', async ({
    authenticatedPage,
  }) => {
    // 22 memories over the 20-per-page limit gives page 2 exactly 2 cards: an
    // unreset index of 19 clamps to 1, handing tabindex="0" to the last card.
    for (let i = 1; i <= 22; i++) {
      await createMemory(authenticatedPage, {
        title: `Paginada ${i}`,
        memoryDate: `2026-08-${String((i % 28) + 1).padStart(2, '0')}`,
      })
    }
    await authenticatedPage.goto('/my-memories')

    const cards = authenticatedPage.locator('[data-timeline-card]')
    await expect(cards).toHaveCount(20)

    await cards.last().focus()
    await expect(cards.last()).toBeFocused()
    await authenticatedPage.keyboard.press('Home')
    await expect(cards.first()).toBeFocused()
    await authenticatedPage.keyboard.press('End')
    await expect(cards.last()).toBeFocused()

    await authenticatedPage.getByRole('button', { name: 'Próxima' }).click()
    await expect(cards).toHaveCount(2)
    await expect(cards.first()).toHaveAttribute('tabindex', '0')
    await expect(cards.nth(1)).toHaveAttribute('tabindex', '-1')
  })
})
