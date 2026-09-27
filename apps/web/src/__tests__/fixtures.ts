import { execFileSync } from 'node:child_process'
import { type Page, test as base } from '@playwright/test'

// Specs create fixed titles, so a per run reset is not enough: retries and
// repeat-each would leave a previous copy of the same title behind and make
// count assertions drift. Resetting before every test keeps each one isolated.
base.beforeEach(() => {
  execFileSync('pnpm', ['--filter', '@chronicle/db', 'e2e:reset'], {
    cwd: '../..',
    stdio: 'pipe',
  })
})

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', 'deb@test.com')
  await page.fill('[data-testid="password"]', 'senha12345')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/', { timeout: 10000 })
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
