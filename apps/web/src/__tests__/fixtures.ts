import { execFileSync } from 'node:child_process'
import { type Page, test as base } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('[data-testid="email"]', 'deb@test.com')
  await page.fill('[data-testid="password"]', 'senha12345')
  await page.click('[data-testid="login-button"]')
  await page.waitForURL('/', { timeout: 10000 })
}

function resetTestData() {
  execFileSync('pnpm', ['--filter', '@chronicle/db', 'e2e:reset'], {
    cwd: '../..',
    stdio: 'pipe',
  })
}

export const test = base.extend<{ resetData: undefined; authenticatedPage: Page }>({
  // Specs share one account and create fixed titles, so a per run reset is not
  // enough: a leftover from a previous spec would satisfy a count assertion.
  //
  // This has to be an auto fixture rather than a beforeEach hook. A hook
  // registered on `base` at the top of a shared module only reached the first
  // spec file that imported it, so every other file ran against whatever the
  // previous one left behind. Fixtures live on the exported `test`, so every
  // spec that imports this module gets it.
  resetData: [
    // Playwright requires the destructuring pattern here, so the empty object
    // it complains about is mandatory rather than accidental.
    // biome-ignore lint/correctness/noEmptyPattern: mandated by Playwright
    async ({}, use) => {
      resetTestData()
      await use(undefined)
    },
    { auto: true },
  ],

  // Declared only to order this after the reset, so a test never logs in
  // against an account the reset has not cleaned yet.
  //
  // `contextOptions` is passed through so a spec can pin browser-level context
  // options — `timezoneId` above all, which decides what year a client component
  // sees — with `test.use()` in a nested describe, instead of opening a second
  // context by hand.
  // biome-ignore lint/correctness/noUnusedVariables: ordering dependency
  authenticatedPage: async ({ browser, resetData, contextOptions }, use) => {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    await login(page)
    await use(page)
    await context.close()
  },
})

export { login }
