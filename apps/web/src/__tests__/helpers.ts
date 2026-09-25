import type { Page } from '@playwright/test'

export async function createMemory(
  page: Page,
  data: {
    title: string
    content?: string
    memoryDate: string
    locationName?: string
    people?: string[]
    tags?: string[]
  },
): Promise<string> {
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

  await goToStep(page, 3)

  if (data.people) {
    for (const person of data.people) {
      await page.fill('[data-testid="people-input"]', person)
      await page.click('[data-testid="people-add"]', { force: true, noWaitAfter: true })
    }
  }

  if (data.tags) {
    for (const tag of data.tags) {
      await page.fill('[data-testid="tags-input"]', tag)
      await page.click('[data-testid="tags-add"]', { force: true, noWaitAfter: true })
    }
  }

  let responseBody: { data: { id: string } } | undefined
  const onResponse = (r: {
    request: () => { method: () => string }
    url: () => string
    json: () => Promise<{ data: { id: string } }>
  }) => {
    if (r.request().method() === 'POST' && /\/api\/memories$/.test(r.url())) {
      void r.json().then((body) => {
        responseBody = body
      })
    }
  }

  page.on('response', onResponse)
  await page.click('[data-testid="submit-memory"]', { force: true, noWaitAfter: true })
  await page.waitForURL('/')
  page.off('response', onResponse)

  const memoryId = String(responseBody?.data.id ?? '')
  return `/memories/${memoryId}`
}

async function clickNext(page: Page) {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Próximo'),
    )
    button?.click()
  })
}

export async function goToStep(page: Page, step: number) {
  for (let i = 0; i < step; i++) {
    await clickNext(page)
    await page.waitForTimeout(300)
  }
}
