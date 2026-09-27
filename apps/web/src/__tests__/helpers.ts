import { type Page, type Response, expect } from '@playwright/test'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

interface MemoryData {
  title: string
  content?: string
  memoryDate: string
  locationName?: string
  people?: string[]
  tags?: string[]
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
      people: data.people,
      tags: data.tags,
    },
  })

  if (!response.ok()) {
    throw new Error(`POST /api/memories failed with ${response.status()}: ${await response.text()}`)
  }

  const body = (await response.json()) as { data: { id: string } }
  return body.data.id
}

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
