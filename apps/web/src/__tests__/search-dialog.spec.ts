import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

/** Opens the dialog from the navbar and returns its input. */
async function openSearchDialog(page: Page): Promise<ReturnType<Page['locator']>> {
  await page.locator('[data-testid="search-button"]').click()
  const input = page.locator('[data-testid="search-dialog-input"]')
  await expect(page.locator('[data-testid="search-dialog"]')).toBeVisible()
  await expect(input).toBeFocused()
  return input
}

/**
 * Every spec here needs the navbar's keydown listener attached, and a listener
 * mounted by an effect is not there until React hydrates. A visible card is the
 * cheapest proof that happened; a shortcut pressed before it would silently do
 * nothing and the assertion below would pass for the wrong reason.
 */
async function gotoHydrated(page: Page, memoryId: string) {
  await page.goto('/')
  await expect(page.locator(`[data-memory-id="${memoryId}"]`)).toBeVisible()
}

test.describe('Diálogo de busca', () => {
  test('opens from the navbar and lists the matches as you type', async ({ authenticatedPage }) => {
    const festa = await createMemory(authenticatedPage, {
      title: 'Festa Junina da Vila',
      memoryDate: '2026-06-24',
    })

    const trilha = await createMemory(authenticatedPage, {
      title: 'Trilha na Serra',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, trilha)

    const input = await openSearchDialog(authenticatedPage)
    await input.fill('Festa Junina')

    await expect(authenticatedPage.locator(`[data-testid="search-result-${festa}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-testid="search-result-${trilha}"]`)).toHaveCount(
      0,
    )

    // `search-result-<id>` and `search-results` share a prefix but not a
    // hyphen, so this is the rows and not the list.
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]')).toHaveCount(1)
  })

  test('shows the loading state while the query is in flight', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Consulta Pendente',
      memoryDate: '2026-09-24',
    })

    // Held open for long enough that the spinner is a state a human would see,
    // instead of one that only a failed assertion would ever catch.
    await authenticatedPage.route(
      (url) => url.pathname === '/api/memories',
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.continue()
      },
    )

    await gotoHydrated(authenticatedPage, alvo)

    const input = await openSearchDialog(authenticatedPage)
    await input.fill('Consulta')

    await expect(authenticatedPage.locator('[data-testid="search-loading"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="search-loading"]')).toBeHidden()
    await expect(authenticatedPage.locator(`[data-testid="search-result-${alvo}"]`)).toBeVisible()
  })

  test('shows the empty state when the grammar matches nothing', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Consulta Pendente',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)

    const input = await openSearchDialog(authenticatedPage)
    await input.fill('quixabentestenadaoexiste')

    // The rows are empty *and* the request has settled: the empty copy is
    // behind `!isFetching`, so it is proof the query really returned nothing.
    await expect(authenticatedPage.locator('[data-testid="search-empty"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid^="search-result-"]')).toHaveCount(0)
  })

  test('moves the highlight with the arrows and opens the row with Enter', async ({
    authenticatedPage,
  }) => {
    // Descending date order, so the list position is the memory date order.
    const maisRecente = await createMemory(authenticatedPage, {
      title: 'Zarigato no parque',
      memoryDate: '2026-09-20',
    })
    const maisAntigo = await createMemory(authenticatedPage, {
      title: 'Zarigato na praça',
      memoryDate: '2026-01-10',
    })

    await gotoHydrated(authenticatedPage, maisRecente)

    const input = await openSearchDialog(authenticatedPage)
    await input.fill('Zarigato')

    const recente = authenticatedPage.locator(`[data-testid="search-result-${maisRecente}"]`)
    const antigo = authenticatedPage.locator(`[data-testid="search-result-${maisAntigo}"]`)
    await expect(recente).toBeVisible()
    await expect(antigo).toBeVisible()

    // The highlight is the only thing the arrows move, so it is what has to be
    // observed: the list itself is identical before and after.
    await expect(recente).toHaveClass(/bg-primary\/10/)
    await authenticatedPage.keyboard.press('ArrowDown')
    await expect(recente).not.toHaveClass(/bg-primary\/10/)
    await expect(antigo).toHaveClass(/bg-primary\/10/)

    // And the highlight is what Enter acts on, so it is the one that gets
    // opened — on the memory's own page, not the editor (phase 7.1).
    await authenticatedPage.keyboard.press('Enter')
    await authenticatedPage.waitForURL(`**/memories/${maisAntigo}`)
    await expect(authenticatedPage.locator('[data-testid^="memory-card-"]')).toHaveCount(1)
    await expect(authenticatedPage.locator('text=Voltar para timeline')).toBeVisible()
  })

  test('Escape closes the dialog and "see all" carries the query to /search', async ({
    authenticatedPage,
  }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Zarigato no parque',
      memoryDate: '2026-09-20',
    })

    await gotoHydrated(authenticatedPage, alvo)

    const input = await openSearchDialog(authenticatedPage)
    await input.fill('Zarigato')
    await expect(authenticatedPage.locator(`[data-testid="search-result-${alvo}"]`)).toBeVisible()

    await input.press('Escape')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)

    // Reopening starts from an empty query, so the shortcut path is exercised
    // twice rather than inheriting the first one.
    const reopened = await openSearchDialog(authenticatedPage)
    await expect(reopened).toHaveValue('')
    await reopened.fill('Zarigato')

    await authenticatedPage.locator('[data-testid="search-see-all"]').click()
    await authenticatedPage.waitForURL('**/search?q=Zarigato')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
  })
})

test.describe('Atalhos de teclado', () => {
  test('Ctrl+K opens the dialog', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Atalho Ctrl K',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)

    await authenticatedPage.keyboard.press('Control+k')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toBeVisible()
  })

  test('/ opens the dialog', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Atalho Barra',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)

    await authenticatedPage.keyboard.press('/')
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toBeVisible()
  })

  test('/ typed into a text field is left to the field', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Atalho em Campo',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)
    await authenticatedPage.goto('/memories/new')

    const title = authenticatedPage.locator('[data-testid="title"]')
    // `fill` also proves the wizard is interactive, so the assertion below is
    // about the shortcut and not about a field that was never wired up.
    await title.fill('Sem atalho')
    await authenticatedPage.keyboard.press('/')

    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    // The slash is appended rather than swallowed: no `preventDefault`, so the
    // field behaves exactly as it would with the shortcut absent.
    await expect(title).toHaveValue('Sem atalho/')

    const content = authenticatedPage.locator('[data-testid="content"]')
    await content.fill('Texto')
    await authenticatedPage.keyboard.press('/')

    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    await expect(content).toHaveValue('Texto/')
  })

  test('/ typed into a contenteditable is left to the editor', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Atalho em Editável',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)

    // The app has no contenteditable of its own, so the guard is exercised
    // against one synthesised in place. What is under test is the shortcut
    // handler's tag check, not any editing behaviour.
    await authenticatedPage.evaluate(() => {
      const editor = document.createElement('div')
      editor.id = 'e2e-editable'
      editor.setAttribute('contenteditable', 'true')
      document.body.append(editor)
      editor.focus()
    })

    await authenticatedPage.keyboard.press('/')

    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    await expect(authenticatedPage.locator('#e2e-editable')).toHaveText('/')
  })

  test('/ pressed on a select is left to the select', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Atalho em Select',
      memoryDate: '2026-09-24',
    })

    await gotoHydrated(authenticatedPage, alvo)

    const year = authenticatedPage.locator('[data-testid="year"]')
    await year.focus()
    await authenticatedPage.keyboard.press('/')

    // A native select is never typed into, but it does own the keyboard, and
    // Chromium runs its own type-ahead on it — so it counts as a control the
    // user is working in. Nothing observable happens to the value; what is
    // pinned is that the dialog did not steal the key.
    await expect(authenticatedPage.locator('[data-testid="search-dialog"]')).toHaveCount(0)
    await expect(year).toHaveValue('')
  })
})
