import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/__tests__',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  // Both servers are declared here, and both commands are written to work with
  // Playwright's cwd (`apps/web`). Two things that made this block a no-op:
  //
  // - It used to start only `pnpm dev:web`, and `dev:web` is a ROOT script, not
  //   one of `apps/web`'s — so it exited with "Command dev:web not found". The
  //   web app here is just `pnpm dev`, which is `next dev --port 3000`. With
  //   the API missing too, a run on a fresh checkout failed every test that
  //   needed data, and because `reuseExistingServer` silently adopted whatever
  //   dev servers were already up, the config was never actually exercised.
  // - The API runs `tsx src/index.ts`, NOT the package's `dev` script
  //   (`tsx watch src/index.ts`). A leftover watcher force-kills whatever starts
  //   next ("Previous process hasn't exited yet. Force killing..."), taking down
  //   the server Playwright just started and surfacing as an exit 254 that
  //   points at nothing. A test-managed server must not be watching.
  //
  // Health is `/health`, not `/api/health` — the route has no prefix.
  webServer: [
    {
      command: 'pnpm --dir ../.. --filter api exec tsx src/index.ts',
      url: 'http://localhost:3333/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
})
