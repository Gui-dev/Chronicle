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

  test('validation failures block Próximo and surface on submit', async ({ authenticatedPage }) => {
    // Próximo on step 0: an empty title keeps the URL put and shows the field error.
    await authenticatedPage.goto('/memories/new/0')
    await authenticatedPage.fill('[data-testid="memoryDate"]', '2026-09-24')
    await authenticatedPage.getByRole('button', { name: 'Próximo' }).click()

    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
    await expect(authenticatedPage.locator('p.text-red-500')).toContainText(
      'String must contain at least 1 character(s)',
    )

    // Submit from a URL-landed later step: without the onInvalid handler this
    // click would do nothing — no toast, no trip back to step 0.
    await authenticatedPage.goto('/memories/new/4')
    await authenticatedPage.getByTestId('submit-memory').click()

    await expect(authenticatedPage.locator('text=Preencha os campos obrigatórios')).toBeVisible()
    await expect(authenticatedPage).toHaveURL(/\/memories\/new\/0$/)
  })
})
