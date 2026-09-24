import { type Page, test as base } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', 'deb@test.com')
  await page.fill('[data-testid="password"]', 'senha12345')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/dashboard', { timeout: 10000 })
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await login(page)
    await use(page)
    await context.close()
  },
})

export { login }
