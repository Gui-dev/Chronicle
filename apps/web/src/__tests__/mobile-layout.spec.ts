import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.use({ viewport: { width: 375, height: 812 } })

async function expectNoHorizontalScroll(page: Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')

  // goto follows redirects, so a renamed route or expired session would land
  // on /login or a soft-404 with no overflow and pass silently. Assert after
  // networkidle so client-side redirects (Next redirect() in a page) count
  // too; compare pathname+search (not host) so a same-path auth redirect
  // still passes — the content check below is what matters there.
  const landed = new URL(page.url())
  const intended = new URL(url, 'http://localhost')
  expect(`${landed.pathname}${landed.search}`, `landed on the wrong page for ${url}`).toBe(
    `${intended.pathname}${intended.search}`,
  )

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
    // Space-separated words wrap anywhere; this URL-shaped title is one
    // unbroken token, the only shape that exercises h2 word-breaking.
    await createMemory(authenticatedPage, {
      title: `https://example.com/${'a'.repeat(110)}`,
      memoryDate: '2026-09-25',
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
    expect(new Set(xs).size, 'cards must share one x').toBe(1)
  })
})
