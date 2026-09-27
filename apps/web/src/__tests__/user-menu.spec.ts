import { expect } from '@playwright/test'
import { test } from './fixtures'

const TOGGLE = '[data-testid="user-menu-toggle"]'

test.describe('Menu do usuário logado', () => {
  test('opens on click and shows the avatar initials', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    const toggle = authenticatedPage.locator(TOGGLE)
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // DebUser has no avatar, so the toggle falls back to initials.
    await expect(toggle).toHaveText('DE')

    await toggle.click()

    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(authenticatedPage.locator('[data-testid="menu-my-memories"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="menu-profile"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="menu-nova"]')).toBeVisible()
    await expect(authenticatedPage.locator('[data-testid="menu-sair"]')).toBeVisible()
  })

  test('navigates to each destination', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    const open = async () => {
      const toggle = authenticatedPage.locator(TOGGLE)
      await expect(toggle).toBeVisible()
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    }

    await open()
    await authenticatedPage.locator('[data-testid="menu-profile"]').click()
    await authenticatedPage.waitForURL('**/profile')

    await open()
    await authenticatedPage.locator('[data-testid="menu-my-memories"]').click()
    await authenticatedPage.waitForURL('**/my-memories')

    await open()
    await authenticatedPage.locator('[data-testid="menu-nova"]').click()
    await authenticatedPage.waitForURL('**/memories/new')
  })

  test('closes on Escape and gives focus back to the toggle', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    const toggle = authenticatedPage.locator(TOGGLE)
    await toggle.click()
    await expect(authenticatedPage.locator('[data-testid="menu-profile"]')).toBeVisible()

    await authenticatedPage.keyboard.press('Escape')

    await expect(authenticatedPage.locator('[data-testid="menu-profile"]')).toHaveCount(0)
    await expect(toggle).toBeFocused()
  })

  test('closes when clicking the overlay', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    await authenticatedPage.locator(TOGGLE).click()
    const overlay = authenticatedPage.locator('[data-testid="user-menu-overlay"]')
    await expect(overlay).toBeAttached()

    // The navbar is z-50 and the overlay z-40, so a click near the top hits
    // the navbar instead. Aim below it, at the timeline area.
    await overlay.click({ position: { x: 200, y: 400 } })

    await expect(authenticatedPage.locator('[data-testid="menu-profile"]')).toHaveCount(0)
  })

  test('signs out and falls back to the login link', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/')

    await authenticatedPage.locator(TOGGLE).click()
    await authenticatedPage.locator('[data-testid="menu-sair"]').click()

    await expect(authenticatedPage.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await expect(authenticatedPage.locator(TOGGLE)).toHaveCount(0)

    // The session really is gone: the private page bounces to login.
    await authenticatedPage.goto('/my-memories')
    await authenticatedPage.waitForURL('**/login')
  })
})
