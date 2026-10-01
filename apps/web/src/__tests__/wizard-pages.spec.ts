import { expect } from '@playwright/test'
import { test } from './fixtures'

test.describe('Wizard em páginas separadas', () => {
  test('lands on step 0 and Próximo advances the URL', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new')
    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
    await expect(
      authenticatedPage.getByRole('heading', { name: 'Informações Básicas' }),
    ).toBeVisible()

    await authenticatedPage.fill('[data-testid="title"]', 'Navegação de URL')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await authenticatedPage.getByRole('button', { name: 'Próximo' }).click()

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)
    await expect(authenticatedPage.getByRole('heading', { name: 'Localização' })).toBeFocused()
  })

  test('Enter in a text field advances the step', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    const title = authenticatedPage.locator('[data-testid="title"]')
    await title.fill('Enter avança')
    await title.press('Enter')

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)
    await expect(authenticatedPage.getByRole('heading', { name: 'Localização' })).toBeFocused()
  })

  test('reload restores the draft fields from sessionStorage', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="title"]', 'Rascunho persistente')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')

    await authenticatedPage.reload()

    await expect(authenticatedPage.locator('[data-testid="title"]')).toHaveValue(
      'Rascunho persistente',
    )
    await expect(authenticatedPage.locator('[data-testid="memoryDate"]')).toHaveValue('2026-09-24')
  })

  test('browser back returns to the previous step with values intact', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="title"]', 'Valores intactos')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await authenticatedPage.getByRole('button', { name: 'Próximo' }).click()
    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/1$/)

    await authenticatedPage.goBack()

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
    await expect(authenticatedPage.locator('[data-testid="title"]')).toHaveValue('Valores intactos')
  })

  test('an invalid step number is a 404', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/memories/new/9')
    await expect(authenticatedPage.getByText('404')).toBeVisible()
  })
})
