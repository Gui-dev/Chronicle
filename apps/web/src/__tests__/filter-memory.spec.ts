import { type Page, expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory, recordMemoryRequests } from './helpers'

/**
 * A month is only meaningful inside a year, and the API resolves a bare month
 * against the *UTC* year, so the year select and the value `onMonthChange`
 * writes both have to come from the UTC clock. The two only disagree in the few
 * hours a year where the local year has already turned and UTC has not, so both
 * clocks are pinned instead of trusting the day the suite happens to run.
 *
 * `setFixedTime` rather than `install`: it fakes `Date` and leaves timers and
 * `requestAnimationFrame` alone, which is all the component needs and is what
 * keeps React and the dev overlay running. It is applied before the navigation,
 * at an instant that is still inside 2026, because the server renders the
 * client component's `<option>` list with the server's real clock and a
 * different year would be a hydration mismatch rather than a test.
 */
const MID_YEAR = '2026-12-15T12:00:00.000Z'

/** 2027-01-01T00:00Z, which is still 2026-12-31 21:00 in a zone behind UTC. */
const YEAR_BOUNDARY = '2027-01-01T00:00:00.000Z'
const UTC_YEAR_AT_BOUNDARY = '2027'
const LOCAL_YEAR_AT_BOUNDARY = '2026'
const BEHIND_UTC = 'America/Sao_Paulo'

/**
 * A year the two clocks at `YEAR_BOUNDARY` disagree about would hide the
 * regression: preserving 2026 looks identical to overwriting it with the local
 * year. This one is in neither the year the option list is built from, so an
 * unconditional write is visible.
 */
const PRESERVED_YEAR = '2025'

/**
 * Only the year of a frozen instant is a fact about the code under test; the
 * year the *page* sees also depends on the browser's zone, so the whole file is
 * pinned to one that is behind UTC. Under a zone at or ahead of UTC the two
 * clocks agree at the boundary and the normalisation assertions pass vacuously.
 */
test.use({ timezoneId: BEHIND_UTC })

/** A timeline card is the cheapest proof that the filter bar is hydrated. */
async function waitForHydration(page: Page, memoryId: string) {
  await page.goto('/')
  await expect(page.locator(`[data-memory-id="${memoryId}"]`)).toBeVisible()
}

test.describe('Filtrar memórias', () => {
  test('can filter by year', async ({ authenticatedPage }) => {
    await authenticatedPage.clock.setFixedTime(new Date(MID_YEAR))

    const id2026 = await createMemory(authenticatedPage, {
      title: 'Memória 2026',
      memoryDate: '2026-09-24',
    })

    const id2025 = await createMemory(authenticatedPage, {
      title: 'Memória 2025',
      memoryDate: '2025-01-15',
    })

    // Wait for the timeline to render before touching the controls: interacting
    // before React hydrates dispatches events nothing is listening for yet, and
    // hydration then resets the filter back to its default.
    await waitForHydration(authenticatedPage, id2025)
    await authenticatedPage.selectOption('[data-testid="year"]', '2026')

    await expect(authenticatedPage.locator(`[data-memory-id="${id2026}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${id2025}"]`)).toHaveCount(0)
  })

  test('can filter by month', async ({ authenticatedPage }) => {
    await authenticatedPage.clock.setFixedTime(new Date(MID_YEAR))

    const setembro = await createMemory(authenticatedPage, {
      title: 'Filtro Setembro',
      memoryDate: '2026-09-24',
    })

    const junho = await createMemory(authenticatedPage, {
      title: 'Filtro Junho',
      memoryDate: '2026-06-24',
    })

    // The year is picked explicitly so the pair does not depend on which year
    // the run happens to be in; picking it first also keeps `onMonthChange` from
    // filling the year in, which is the subject of the next two tests.
    await waitForHydration(authenticatedPage, junho)
    await authenticatedPage.selectOption('[data-testid="year"]', '2026')
    await authenticatedPage.selectOption('[data-testid="month"]', '9')

    await expect(authenticatedPage.locator(`[data-memory-id="${setembro}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${junho}"]`)).toHaveCount(0)
  })

  test('picking a month with no year fills in the current year', async ({ authenticatedPage }) => {
    const marco = await createMemory(authenticatedPage, {
      title: 'Filtro Março',
      memoryDate: '2026-03-10',
    })

    await waitForHydration(authenticatedPage, marco)
    expect(await authenticatedPage.locator('[data-testid="year"]').inputValue()).toBe('')

    // Moved *after* hydration, and not before the navigation: the option list is
    // rebuilt on the next render, so crossing the boundary here is what makes
    // the year the component writes and the year the select offers the same one.
    await authenticatedPage.clock.setFixedTime(new Date(YEAR_BOUNDARY))

    const requests = recordMemoryRequests(authenticatedPage)
    await authenticatedPage.selectOption('[data-testid="month"]', '3')

    // The whole of the fix in one line: `getUTCFullYear()`, not `getFullYear()`.
    // At this instant the local year is 2026 and the UTC year is 2027, and the
    // API resolves a bare month against the UTC one.
    await expect(authenticatedPage.locator('[data-testid="year"]')).toHaveValue(
      UTC_YEAR_AT_BOUNDARY,
    )

    // The select's own value is not proof that both parameters were sent.
    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain(`year=${UTC_YEAR_AT_BOUNDARY}`)
    expect(requests[0]).toContain('month=3')
  })

  test('picking a month keeps a year that is already selected', async ({ authenticatedPage }) => {
    const marco = await createMemory(authenticatedPage, {
      title: 'Filtro Março',
      memoryDate: `${PRESERVED_YEAR}-03-10`,
    })

    const marcoDoOutroAno = await createMemory(authenticatedPage, {
      title: 'Filtro Março de Outro Ano',
      memoryDate: `${LOCAL_YEAR_AT_BOUNDARY}-03-10`,
    })

    await waitForHydration(authenticatedPage, marco)

    await authenticatedPage.clock.setFixedTime(new Date(YEAR_BOUNDARY))

    // 2025 is in the list the page rendered before the clock moved (2026…2017)
    // and in the one it rebuilds after (2027…2018), so this selection survives
    // both rebuilds — a year outside either list would blank the control.
    await authenticatedPage.selectOption('[data-testid="year"]', PRESERVED_YEAR)
    await expect(authenticatedPage.locator('[data-testid="year"]')).toHaveValue(PRESERVED_YEAR)

    const requests = recordMemoryRequests(authenticatedPage)
    await authenticatedPage.selectOption('[data-testid="month"]', '3')

    // `onMonthChange` only fills the year in when there is none. Nothing in the
    // component stops that guard from regressing into an unconditional write,
    // and at this instant an unconditional write lands on 2026.
    await expect(authenticatedPage.locator('[data-testid="year"]')).toHaveValue(PRESERVED_YEAR)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toContain(`year=${PRESERVED_YEAR}`)
    expect(requests[0]).toContain('month=3')

    // And the pair still narrows: the other year's March is not in the range.
    await expect(authenticatedPage.locator(`[data-memory-id="${marco}"]`)).toBeVisible()
    await expect(authenticatedPage.locator(`[data-memory-id="${marcoDoOutroAno}"]`)).toHaveCount(0)
  })
})
