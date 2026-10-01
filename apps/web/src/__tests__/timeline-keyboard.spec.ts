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
})
