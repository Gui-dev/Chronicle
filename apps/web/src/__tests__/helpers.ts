import { readFileSync } from 'node:fs'
import path from 'node:path'
import { type Page, type Response, expect } from '@playwright/test'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const PHOTO_FIXTURE = path.join(__dirname, 'photo-fixture.png')

interface MemoryData {
  title: string
  content?: string
  memoryDate: string
  locationName?: string
  weatherDesc?: string
  people?: string[]
  tags?: string[]
  isPublic?: boolean
}

/**
 * Creates a memory through the API and returns its id.
 *
 * Specs that need a memory to exist are not testing the creation wizard, so
 * they should not pay for it: the wizard walks four steps, each one a dynamic
 * import that has to compile on demand in dev. Only create-memory.spec.ts
 * drives the wizard itself, through createMemoryViaWizard.
 */
export async function createMemory(page: Page, data: MemoryData): Promise<string> {
  const response = await page.request.post(`${API_URL}/api/memories`, {
    data: {
      title: data.title,
      memoryDate: data.memoryDate,
      content: data.content,
      locationName: data.locationName,
      weatherDesc: data.weatherDesc,
      people: data.people,
      tags: data.tags,
      isPublic: data.isPublic,
    },
  })

  if (!response.ok()) {
    throw new Error(`POST /api/memories failed with ${response.status()}: ${await response.text()}`)
  }

  const body = (await response.json()) as { data: { id: string } }
  return body.data.id
}

/**
 * Records every list request the page makes, returned as a live array.
 *
 * A test can only assert that a request did *not* happen by counting the ones
 * that did, and the count is the whole point: a page that fetched twice, or
 * fetched once with the wrong filter, renders the same DOM as a page that
 * fetched once correctly — until you count.
 *
 * `page.on` is attached synchronously, unlike `waitForRequest`, whose listener
 * is armed over an async round trip and misses a request the app fires during
 * the navigation that follows.
 */
export function recordMemoryRequests(page: Page): string[] {
  const urls: string[] = []

  page.on('request', (request) => {
    if (request.method() !== 'GET') return
    // The trailing `?` keeps `/api/memories/<id>` out: that is the detail read
    // the edit page does, not the list.
    if (!/\/api\/memories(\?|$)/.test(request.url())) return
    urls.push(request.url())
  })

  return urls
}

/** Reads a memory back, to assert what a UI action actually persisted. */
export async function fetchMemory(
  page: Page,
  id: string,
): Promise<{ isPublic: boolean; photos: { id: string; filename: string | null }[] }> {
  const response = await page.request.get(`${API_URL}/api/memories/${id}`)

  if (!response.ok()) {
    throw new Error(`GET /api/memories/${id} failed with ${response.status()}`)
  }

  const body = (await response.json()) as {
    data: { isPublic: boolean; photos: { id: string; filename: string | null }[] }
  }
  return body.data
}

/**
 * Attaches photos to a memory through the API, so gallery specs do not have to
 * drive the wizard's photo step. `page` must be authenticated: the route 401s
 * without a session.
 */
export async function addPhotos(page: Page, memoryId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const response = await page.request.post(`${API_URL}/api/memories/${memoryId}/photos`, {
      multipart: {
        file: {
          name: `foto-${i + 1}.png`,
          mimeType: 'image/png',
          buffer: readFileSync(PHOTO_FIXTURE),
        },
      },
    })

    if (!response.ok()) {
      throw new Error(`POST photos failed with ${response.status()}: ${await response.text()}`)
    }
  }
}

export { PHOTO_FIXTURE }

const STEP_HEADINGS = [
  'Informações Básicas',
  'Localização',
  'Trilha Sonora',
  'Fotos',
  'Pessoas e Tags',
] as const

/** Drives the real creation wizard. Slow, so only use it to test the wizard. */
export async function createMemoryViaWizard(page: Page, data: MemoryData): Promise<string> {
  await page.goto('/memories/new')
  await page.fill('[data-testid="title"]', data.title)

  if (data.content) {
    await page.fill('[data-testid="content"]', data.content)
  }

  await page.fill('[data-testid="memoryDate"]', data.memoryDate)

  await goToStep(page, 1)

  if (data.locationName) {
    await page.fill('[data-testid="locationInput"]', data.locationName)
  }

  await goToStep(page, 4)

  for (const [testid, values] of [
    ['people', data.people],
    ['tags', data.tags],
  ] as const) {
    for (const value of values ?? []) {
      // Enter would implicitly submit the surrounding form, so use the button.
      // force is needed because adding a chip re-renders and detaches it.
      await page.fill(`[data-testid="${testid}-input"]`, value)
      await page.click(`[data-testid="${testid}-add"]`, { force: true })
    }
  }

  // page.on is attached synchronously, unlike waitForResponse, whose listener
  // is armed over an async round trip and misses instant localhost replies.
  let created: Promise<{ data: { id: string } }> | undefined

  const onResponse = (r: Response) => {
    if (r.request().method() === 'POST' && /\/api\/memories$/.test(r.url())) {
      created = r.json() as Promise<{ data: { id: string } }>
    }
  }

  page.on('response', onResponse)

  const submit = page.locator('[data-testid="submit-memory"]')
  await expect(submit).toBeEnabled()

  // The wizard is a client side app: a real click makes Playwright wait for the
  // navigation the submit triggers, then reject because the button unmounted,
  // even though the POST already went through. waitForURL is the real signal.
  await submit.click({ force: true, noWaitAfter: true }).catch(() => {})

  await page.waitForURL('/')
  page.off('response', onResponse)

  if (!created) {
    throw new Error(`POST /api/memories was never observed on ${page.url()}`)
  }

  const body = await created
  return body.data.id
}

export async function goToStep(page: Page, target: number) {
  let step = await currentStep(page)

  while (step < target) {
    // dispatchEvent, not click: the wizard swaps "Próximo" for the submit
    // button in the same spot, and a coordinate based click that lands during
    // the transition submits the form instead of advancing the step.
    await page.getByRole('button', { name: 'Próximo' }).dispatchEvent('click')

    const next = step + 1
    await expect(
      page.getByRole('heading', { name: STEP_HEADINGS[next], exact: true }),
    ).toBeVisible()
    step = next
  }
}

async function currentStep(page: Page): Promise<number> {
  for (let i = 0; i < STEP_HEADINGS.length; i++) {
    const visible = await page
      .getByRole('heading', { name: STEP_HEADINGS[i], exact: true })
      .isVisible()

    if (visible) return i
  }

  throw new Error(`no wizard step heading is visible: ${STEP_HEADINGS.join(', ')}`)
}
