import type { Browser } from '@playwright/test'
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const OTHER_EMAIL = 'other@test.com'
const OTHER_PASSWORD = 'E2E-password-123'

const PT_MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const PT_WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function utcNow() {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

function pad(month: number): string {
  return String(month).padStart(2, '0')
}

/**
 * Creates a public memory for the second E2E user in its own browser context,
 * so the cookies never touch the page under test (whose session belongs to
 * deb). Sign-up first, sign-in on later runs — the reset deletes the memories
 * but keeps the account.
 */
async function createOtherUserMemory(
  browser: Browser,
  data: { title: string; memoryDate: string },
): Promise<void> {
  const context = await browser.newContext()
  try {
    let response = await context.request.post(`${API_URL}/api/auth/sign-up/email`, {
      data: { name: 'Other User', email: OTHER_EMAIL, password: OTHER_PASSWORD },
    })
    if (!response.ok()) {
      response = await context.request.post(`${API_URL}/api/auth/sign-in/email`, {
        data: { email: OTHER_EMAIL, password: OTHER_PASSWORD },
      })
    }
    if (!response.ok()) {
      throw new Error(`other user auth failed: ${response.status()} ${await response.text()}`)
    }
    const created = await context.request.post(`${API_URL}/api/memories`, { data })
    if (!created.ok()) {
      throw new Error(`other memory failed: ${created.status()} ${await created.text()}`)
    }
  } finally {
    await context.close()
  }
}

test.describe('Retrospectivas', () => {
  test('shows the year-ago strip for memories from the same month last year', async ({
    authenticatedPage,
  }) => {
    const { year, month } = utcNow()
    const id = await createMemory(authenticatedPage, {
      title: 'Viagem do ano passado',
      memoryDate: `${year - 1}-${pad(month)}-15`,
    })

    await authenticatedPage.goto('/')

    await expect(authenticatedPage.getByTestId('retro-strip')).toBeVisible()
    await expect(authenticatedPage.getByTestId(`retro-year-ago-${id}`)).toBeVisible()
    await expect(authenticatedPage.getByTestId('retro-year-ago-title')).toHaveText(
      'Viagem do ano passado',
    )
    await expect(authenticatedPage.getByTestId('retro-year-ago-date')).toHaveText(
      `${PT_MONTHS[month - 1]} de ${year - 1}`,
    )
    // The reset clears last_visit_at → nothing counts as "new" yet.
    await expect(authenticatedPage.getByTestId('retro-new')).toHaveCount(0)
  })

  test('hides the strip entirely when there is nothing to show', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    // Wait for both queries before asserting absence — the loading skeleton is
    // not the strip, and asserting too early would pass vacuously. No error
    // either: an API failure must not masquerade as "nothing to show".
    await expect(authenticatedPage.getByTestId('retro-strip-loading')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-strip-error')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-strip')).toHaveCount(0)
  })

  test('counts public memories created since the last visit', async ({
    authenticatedPage,
    browser,
  }) => {
    // (a) Record the visit first: with a null stamp the count short-circuits.
    const visit = await authenticatedPage.request.post(`${API_URL}/api/retrospectives/visit`)
    expect(visit.status()).toBe(204)

    // The weekday comes from the stored stamp, not from a local clock read —
    // it is what the strip will render.
    const activity = await authenticatedPage.request.get(`${API_URL}/api/retrospectives/activity`)
    const activityBody = (await activity.json()) as { data: { count: number; since: string } }
    expect(activityBody.data.since).not.toBeNull()
    const weekday = PT_WEEKDAYS[new Date(activityBody.data.since).getUTCDay()]

    // (b) The predicate is strictly created_at > last_visit_at.
    await authenticatedPage.waitForTimeout(1100)

    // (c) Another user publishes a memory.
    const { year, month } = utcNow()
    await createOtherUserMemory(browser, {
      title: 'Memória de outra pessoa',
      memoryDate: `${year}-${pad(month)}-10`,
    })

    // (d) The home shows the counter; its mount bump is awaited so (e) cannot
    // race it.
    const bumped = authenticatedPage.waitForResponse(
      (response) =>
        response.url().includes('/api/retrospectives/visit') &&
        response.request().method() === 'POST' &&
        response.status() === 204,
    )
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.getByTestId('retro-new-count')).toHaveText(
      `1 memória nova desde ${weekday}`,
    )
    await bumped

    // (e) The bump wrote `now` after the other memory — nothing is new now.
    await authenticatedPage.reload()
    await expect(authenticatedPage.getByTestId('retro-strip-loading')).toHaveCount(0)
    await expect(authenticatedPage.getByTestId('retro-new')).toHaveCount(0)
  })

  test('groups the timeline under UTC month markers', async ({ authenticatedPage }) => {
    const { year, month } = utcNow()
    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1

    await createMemory(authenticatedPage, {
      title: 'Memória deste mês',
      memoryDate: `${year}-${pad(month)}-10`,
    })
    await createMemory(authenticatedPage, {
      title: 'Memória do mês passado',
      memoryDate: `${prevYear}-${pad(prevMonth)}-10`,
    })

    await authenticatedPage.goto('/')

    const markers = authenticatedPage.getByTestId('timeline-marker')
    await expect(markers).toHaveCount(2)
    // Newest first: current month, then previous month.
    await expect(markers.nth(0)).toHaveText(`${PT_MONTHS[month - 1]} de ${year}`)
    await expect(markers.nth(1)).toHaveText(`${PT_MONTHS[prevMonth - 1]} de ${prevYear}`)
    // The distance lines survive the markers (decision 11) — two memories a
    // month apart read "… depois", never "No mesmo dia".
    await expect(authenticatedPage.getByText(/depois/).first()).toBeVisible()
  })

  test('renders the overview dashboard with stats, recurrences and places', async ({
    authenticatedPage,
  }) => {
    const { year, month } = utcNow()
    await createMemory(authenticatedPage, {
      title: 'Férias no Recife',
      memoryDate: `${year}-${pad(month)}-15`,
      people: ['Ana', 'Bruno'],
      tags: ['família', 'praia'],
      locationName: 'Recife',
      locationLat: -8.05,
      locationLng: -34.9,
    })
    await createMemory(authenticatedPage, {
      title: 'Viagem de junho',
      memoryDate: `${year - 1}-06-20`,
      people: ['Ana'],
    })

    await authenticatedPage.goto('/')
    await authenticatedPage.getByTestId('user-menu-toggle').click()
    await authenticatedPage.getByTestId('menu-retrospectivas').click()
    await authenticatedPage.waitForURL('**/retrospectivas')

    // Current year: 1 memory, 2 distinct people, 1 place.
    // The seed universe is two memories, so every count is a single digit and
    // toContainText cannot be satisfied by a wrong multi-digit number.
    await expect(authenticatedPage.getByTestId('retro-stat-memories')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-stat-people')).toContainText('2')
    await expect(authenticatedPage.getByTestId('retro-stat-places')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-stat-top-tags')).toContainText('#família')
    await expect(authenticatedPage.getByTestId('retro-stat-top-tags')).toContainText('#praia')
    await expect(authenticatedPage.getByTestId('retro-rec-people')).toContainText('Ana ×1')
    await expect(authenticatedPage.getByTestId('retro-rec-places')).toContainText('Recife ×1')
    await expect(authenticatedPage.getByTestId('retro-rec-themes')).toContainText(
      'Sem dados no período',
    )
    await expect(authenticatedPage.getByTestId('retro-place-list')).toContainText('Recife')
    // Assert the container, never the tiles — CI may have no external network.
    await expect(authenticatedPage.getByTestId('retro-map')).toBeVisible()

    // Switching the year changes the served period (people 2 → 1 is the wait).
    await authenticatedPage.getByTestId('retro-year').selectOption(String(year - 1))
    await expect(authenticatedPage.getByTestId('retro-stat-people')).toContainText('1')
    await expect(authenticatedPage.getByTestId('retro-error')).toHaveCount(0)

    // A month without memories empties the period card but keeps the
    // all-time map visible (spec §5).
    const emptyMonth = month === 1 ? '2' : '1'
    await authenticatedPage.getByTestId('retro-month').selectOption(emptyMonth)
    await expect(authenticatedPage.getByTestId('retro-empty')).toBeVisible()
    await expect(authenticatedPage.getByTestId('retro-map')).toBeVisible()
  })

  test('never exposes lastVisitAt in the session payload', async ({ authenticatedPage }) => {
    // Spec §8: the stamp is internal bookkeeping, not profile data.
    const response = await authenticatedPage.request.get(`${API_URL}/api/auth/get-session`)
    expect(response.ok()).toBeTruthy()
    const text = await response.text()
    expect(text).not.toContain('lastVisitAt')
    expect(text).not.toContain('last_visit_at')
  })
})
