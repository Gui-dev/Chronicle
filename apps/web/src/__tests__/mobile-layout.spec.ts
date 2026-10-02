import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.use({ viewport: { width: 375, height: 812 } })

async function expectNoHorizontalScroll(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth, `${url} must not scroll horizontally`).toBeLessThanOrEqual(clientWidth)
}

test.describe('Mobile 375px', () => {
  test('no horizontal scroll on home, wizard, retrospectivas and search', async ({
    authenticatedPage,
  }) => {
    await createMemory(authenticatedPage, {
      title: 'Memória mobile com título longo para tentar estourar o layout da timeline',
      memoryDate: '2026-09-24',
      locationName: 'Praia do Rosa, Florianópolis, Santa Catarina, Brasil',
      people: ['Alice', 'Bob'],
      tags: ['viagem', 'praia', 'familia', 'amigos', 'verao'],
    })

    for (const url of [
      '/',
      '/memories/new/0',
      '/memories/new/4',
      '/retrospectivas',
      '/search?q=mobile',
    ]) {
      await expectNoHorizontalScroll(authenticatedPage, url)
    }
  })

  test('timeline cards stack in a single column', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, { title: 'Primeira coluna', memoryDate: '2026-09-20' })
    await createMemory(authenticatedPage, { title: 'Segunda coluna', memoryDate: '2026-09-21' })
    await authenticatedPage.goto('/')

    // The timeline fetches after navigation resolves, so measuring right away
    // would assert against an empty page.
    const cards = authenticatedPage.locator('[data-memory-id]')
    await expect(cards.first()).toBeVisible()

    const xs = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    )
    expect(xs.length).toBeGreaterThanOrEqual(2)
    for (const x of xs) {
      expect(x).toBe(xs[0])
    }
  })
})
