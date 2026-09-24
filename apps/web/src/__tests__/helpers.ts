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
) {
  await page.goto('/memories/new')
  await page.fill('[data-testid="title"]', data.title)

  if (data.content) {
    await page.fill('[data-testid="content"]', data.content)
  }

  await page.fill('[data-testid="memoryDate"]', data.memoryDate)

  if (data.locationName) {
    await page.fill('[data-testid="locationInput"]', data.locationName)
  }

  if (data.people) {
    for (const person of data.people) {
      await page.fill('[data-testid="people-input"]', person)
      await page.click('[data-testid="people-add"]')
    }
  }

  if (data.tags) {
    for (const tag of data.tags) {
      await page.fill('[data-testid="tags-input"]', tag)
      await page.click('[data-testid="tags-add"]')
    }
  }

  await page.click('[data-testid="submit-memory"]')
  await page.waitForURL(/\/memories\/\w+/, { timeout: 10000 })
}
