# Chronicle — Phase 7.7 Purple Theme Design

**Date:** 2026-10-02
**Status:** Draft

---

## 1. Resumo

Adicionar um quarto tema **"Roxo"** (purple dark) ao seletor de temas existente (Sistema/Escuro/Claro), resultando em 4 opções no menu do usuário. O tema é uma variante dark com paleta roxa/emerald baseada no design "Chronicle Soundtracks" fornecido.

---

## 2. Paleta de Cores — Tema "Roxo"

Bloco CSS a ser adicionado em `globals.css`:

```css
:root[data-theme="purple"] {
  --background: #0d0714;
  --foreground: #e2e8f0;
  --card: #160d26;
  --card-foreground: #e2e8f0;
  --primary: #a855f7;
  --primary-foreground: #0d0714;
  --secondary: #22c55e;
  --secondary-foreground: #0d0714;
  --muted: #6d5a8a;
  --muted-foreground: #a895c4;
  --accent: #22c55e;
  --accent-foreground: #0d0714;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --text: #e2e8f0;
  --border: #3d2a5c;
  --input: #3d2a5c;
  --ring: #a855f7;
  --radius: 0.5rem;
  --glow-rgb: 168, 85, 247;
  color-scheme: dark;
}
```

**Derivações:**
- `--muted` / `--muted-foreground`: tons de roxo intermediários para badges secundários
- `--border` / `--input`: roxo escuro (#3d2a5c) para bordas de inputs/cards
- `--glow-rgb`: RGB do `--primary` (168, 85, 247) para sombras/glows consistentes

---

## 3. Glows e Tokens

- **Um único `--glow-rgb`** (purple) — usado pelas 19 classes de glow existentes via `rgba(var(--glow-rgb), opacity)`
- **Emerald glows** (pontos da timeline): usam `--secondary` diretamente via inline style onde necessário (ex: `box-shadow: 0 0 20px rgba(34, 197, 94, 0.3)`). Não adiciona variável extra.

---

## 4. Alterações no Menu de Tema

### 4.1 `themeOptions` em `navbar.tsx`

```tsx
const themeOptions = [
  { value: 'system', label: 'Sistema', testId: 'menu-theme-system' },
  { value: 'dark', label: 'Escuro', testId: 'menu-theme-dark' },
  { value: 'light', label: 'Claro', testId: 'menu-theme-light' },
  { value: 'purple', label: 'Roxo', testId: 'menu-theme-purple' },
] as const
```

- Lista flat de 4 itens (sem submenu)
- `menuitemradio` com `aria-checked` controlado por `theme === option.value`
- `aria-label="Tema: ${option.label}"` → "Tema: Roxo"

### 4.2 Test IDs

- Novo: `menu-theme-purple`
- Existentes mantidos

---

## 5. Testes E2E (`theme-toggle.spec.ts`)

Adicionar ao `describe('Tema')`:

```ts
test('switching to purple applies the palette', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/')
  const toggle = authenticatedPage.locator(TOGGLE)
  await toggle.click()
  await authenticatedPage.getByTestId('menu-theme-purple').click()

  await expect(authenticatedPage.locator('html')).toHaveAttribute('data-theme', 'purple')
  await expect(authenticatedPage.locator('body')).toHaveCSS(
    'background-color',
    'rgb(13, 7, 20)'  // #0d0714
  )
  await expect(toggle).toBeFocused()
})
```

E ao `describe('Tema — sistema')` verificar que escolha manual "Roxo" persiste sobre preferência do sistema.

---

## 6. Gate de Contraste (`verify-contrast.mjs`)

O gate já itera sobre `blocks = { dark, light }`. Adicionar bloco `purple`:

```js
const blocks = {
  dark: { selector: ':root', label: 'dark' },
  light: { selector: ':root[data-theme="light"]', label: 'light' },
  purple: { selector: ':root[data-theme="purple"]', label: 'purple' },
}
```

- 20 checagens por paleta (mesmo array `checks`)
- Total: **60 checagens** (20 × 3 paletas)
- Valores da paleta purple devem passar AA (≥4.5 texto, ≥3 UI)

---

## 7. Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `apps/web/src/app/globals.css` | Adicionar bloco `:root[data-theme="purple"]` |
| `apps/web/src/components/navbar.tsx` | Adicionar opção "Roxo" ao `themeOptions` |
| `apps/web/src/__tests__/theme-toggle.spec.ts` | Adicionar teste purple + teste de persistência |
| `apps/web/scripts/verify-contrast.mjs` | Adicionar bloco `purple` ao loop de validação |

---

## 8. Gates de Qualidade

```bash
pnpm lint:fix && pnpm exec biome check .
pnpm --filter web test:contrast      # 60 PASS (20 dark + 20 light + 20 purple)
pnpm --filter web typecheck
pnpm build
pnpm --filter web exec playwright test src/__tests__/theme-toggle.spec.ts --project=chromium
```

---

## 9. Fora de Escopo

- Tema "Roxo Light" — não solicitado
- Submenu agrupado no dropdown — mantém flat list
- Novos componentes UI roxos — usa tokens existentes