import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory, recordMemoryRequests } from './helpers'

/**
 * A request that was going to be sent has been sent by the time the page has
 * painted and the assertion that follows has settled; this is the window a test
 * counts inside when it asserts that no request happened at all.
 */
const SETTLE_MS = 750

function searchUrl(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`
}

async function gotoSearch(page: Page, query: string) {
  await page.goto(searchUrl(query))
  await expect(page.getByRole('heading', { name: 'Busca', exact: true })).toBeVisible()
}

test.describe('Página de busca', () => {
  test('narrows by every dimension of the grammar', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Domingo no Porto',
      memoryDate: '2026-08-15',
      locationName: 'Porto de São João',
      weatherDesc: 'Ensolarado',
      tags: ['cronica'],
    })

    const outra = await createMemory(authenticatedPage, {
      title: 'Sopa de casa',
      memoryDate: '2026-01-10',
    })

    for (const query of ['#cronica', 'local:Porto', 'clima:Ensolarado', 'ano:2026', '@deb']) {
      await gotoSearch(authenticatedPage, query)
      await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    }

    await gotoSearch(authenticatedPage, '#cronica')
    await expect(authenticatedPage.locator(`[data-memory-id="${outra}"]`)).toHaveCount(0)
  })

  test('fires exactly one request for the query, with the query on it', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Diário de bordo',
      memoryDate: '2026-04-10',
      tags: ['bordo'],
    })

    // The fixture's login lands on the dashboard, and that page's own list
    // request can be issued after the first line of this test. A `/search` with
    // an empty query issues none of its own — the fetch is disabled for it — so
    // going there first retires the straggler and leaves the count to mean only
    // what this page sends.
    await authenticatedPage.goto('/search?q=')

    // A page that corrects itself in an effect fetches twice: once with the
    // filter state it already has — no `search` at all — and once with the
    // right one. Both renders end on the same DOM, so only the request count
    // and the request itself tell the two apart.
    const requests = recordMemoryRequests(authenticatedPage)
    await gotoSearch(authenticatedPage, '#bordo ano:2026')

    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toHaveText('1 memória')
    await authenticatedPage.waitForTimeout(SETTLE_MS)

    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain('search=')
  })

  test('removing a chip rewrites the query and the total', async ({ authenticatedPage }) => {
    // `search-count` is a total over everything the reader can see, and other
    // users' public memories are in scope, so an exclusive total needs a tag no
    // other memory carries. The reset only clears deb's rows, which is why the
    // name is spelled out rather than reused from the other specs.
    const na = await createMemory(authenticatedPage, {
      title: 'Romaria do ano',
      memoryDate: '2026-06-24',
      tags: ['romaria'],
    })
    const emOutroAno = await createMemory(authenticatedPage, {
      title: 'Romaria de outro ano',
      memoryDate: '2025-05-10',
      tags: ['romaria'],
    })

    await gotoSearch(authenticatedPage, '#romaria ano:2026')
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toHaveText('1 memória')
    await expect(authenticatedPage.locator(`[data-memory-id="${na}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${emOutroAno}"]`)).toHaveCount(0)

    await authenticatedPage.locator('[data-testid="search-chip-ano-2026"]').click()

    await expect(authenticatedPage).toHaveURL(/\/search\?q=%23romaria$/)
    await expect(authenticatedPage.locator('[data-testid="search-chip-ano-2026"]')).toHaveCount(0)
    // The tag chip is untouched, and the total is the thing that proves the
    // year really left the query rather than just leaving the chip row.
    await expect(authenticatedPage.locator('[data-testid="search-chip-romaria"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toHaveText('2 memórias')
    await expect(authenticatedPage.locator(`[data-memory-id="${emOutroAno}"]`)).toBeVisible()
  })

  test('removing one chip keeps the quoted value of another whole', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Fim de semana na serra',
      memoryDate: '2026-06-24',
      locationName: 'Chapada dos Veadeiros',
      tags: ['festa'],
    })

    await gotoSearch(authenticatedPage, 'local:"chapada dos veadeiros" #festa ano:2026')

    // Chip order is author, tags, year, month, weather, location, phrases, text.
    await expect(authenticatedPage.locator('[data-testid="search-chips"] > button')).toHaveCount(3)
    await expect(authenticatedPage.locator('[data-testid="search-chip-festa"]')).toBeVisible()
    await expect(
      authenticatedPage.locator('[data-testid="search-chip-local-chapada-dos-veadeiros"]'),
    ).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="search-chip-ano-2026"]')).toBeVisible()

    await authenticatedPage.locator('[data-testid="search-chip-ano-2026"]').click()

    // The location has to be written back quoted: the tokenizer splits a bare
    // value on whitespace, so an unquoted round trip re-parses as `local:chapada`
    // plus the free terms `dos` and `veadeiros` — and the memory, whose title
    // holds none of them, would drop out of the results.
    await expect(authenticatedPage).toHaveURL(
      /\/search\?q=%23festa%20local%3A%22chapada%20dos%20veadeiros%22$/,
    )
    await expect(
      authenticatedPage.locator('[data-testid="search-chip-local-chapada-dos-veadeiros"]'),
    ).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
  })

  test('removing the last chip empties the query and stops querying', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Sozinha no mapa',
      memoryDate: '2026-06-24',
      tags: ['mapa'],
    })

    await gotoSearch(authenticatedPage, '#mapa')
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()

    // Counted from here, so only what the removal causes is in scope.
    const requests = recordMemoryRequests(authenticatedPage)
    await authenticatedPage.locator('[data-testid="search-chip-mapa"]').click()

    await expect(authenticatedPage).toHaveURL(/\/search\?q=$/)
    await expect(authenticatedPage.locator('[data-testid="search-chips"]')).toHaveCount(0)
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toHaveCount(0)
    await expect(authenticatedPage.getByText('Nenhuma memória encontrada')).toBeVisible()
    await authenticatedPage.waitForTimeout(SETTLE_MS)

    // An empty query disables the fetch. A page that fetched anyway would show
    // the whole timeline again, and `?q=` alone would not have noticed.
    expect(requests).toEqual([])
  })

  test('an empty query reached from the dashboard shows no cached timeline rows', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Festa Junina da Vila',
      memoryDate: '2026-06-24',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()

    const input = authenticatedPage.locator('[data-testid="navbar-search-input"]')
    await input.click()
    await input.fill('Festa')

    await authenticatedPage.getByTestId('search-see-all').click()
    await expect(authenticatedPage).toHaveURL(/\/search\?q=Festa$/)
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()

    // Removing the last chip empties the query. The disabled fetch that
    // follows must show nothing — not the timeline's cached rows and total
    // masquerading as results.
    await authenticatedPage.locator('[data-testid="search-chip-festa"]').click()
    await expect(authenticatedPage).toHaveURL(/\/search\?q=$/)

    await expect(authenticatedPage.locator('[data-memory-id]')).toHaveCount(0)
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toHaveCount(0)
    await expect(authenticatedPage.getByText('Nenhuma memória encontrada')).toBeVisible()
  })

  test('removing one of two identical chips drops a single occurrence', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Passeio na praia do norte',
      memoryDate: '2026-06-24',
    })

    // The parser does not dedupe `text`, so this is two terms — and two chips
    // that slug to the same testid.
    await gotoSearch(authenticatedPage, 'praia praia')
    const chip = authenticatedPage.locator('[data-testid="search-chip-praia"]')
    await expect(chip).toHaveCount(2)

    await chip.first().click()

    // Not `q=`: dropping the term by value would have removed both, and an empty
    // query is what disabled the fetch and left the page dead. Nor do both chips
    // go. The one that is left is the other occurrence.
    await expect(authenticatedPage).toHaveURL(/\/search\?q=praia$/)
    await expect(chip).toHaveCount(1)
    // And the page is still live: the term survives in the query, so the
    // request it drives still returns the memory it was matching.
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="search-count"]')).toBeVisible()
  })

  test('a tag and a free term of the same name are two chips', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Sol de inverno',
      memoryDate: '2026-06-24',
      tags: ['sol'],
    })

    // The only collision the slug can produce: a tag and a loose term of the
    // same name, in that order.
    await gotoSearch(authenticatedPage, '#sol sol')
    const chip = authenticatedPage.locator('[data-testid="search-chip-sol"]')
    await expect(chip).toHaveCount(2)
    await expect(chip.nth(0)).toHaveText(/^#sol/)
    await expect(chip.nth(1)).toHaveText(/^sol/)

    await chip.nth(1).click()
    await expect(authenticatedPage).toHaveURL(/\/search\?q=%23sol$/)
    await expect(chip).toHaveCount(1)
    await expect(chip).toHaveText(/#sol/)
    await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
  })

  test('hides private memories from an anonymous search', async ({ authenticatedPage, page }) => {
    // Created through the authenticated session: POST /api/memories requires it.
    // Only the browsing side needs to be anonymous.
    const publica = await createMemory(authenticatedPage, {
      title: 'Dia do solstício',
      memoryDate: '2026-05-01',
      isPublic: true,
    })
    const privada = await createMemory(authenticatedPage, {
      title: 'Noite do eclipse',
      memoryDate: '2026-05-02',
      isPublic: false,
    })

    await page.goto(searchUrl('solstício'))
    await expect(page.locator(`[data-memory-id="${publica}"]`)).toBeVisible()

    await page.goto(searchUrl('eclipse'))
    // Proves the query ran, so a missing card cannot pass vacuously.
    await expect(page.locator('[data-testid="search-count"]')).toHaveText('0 memórias')
    await expect(page.locator(`[data-memory-id="${privada}"]`)).toHaveCount(0)
  })
})
