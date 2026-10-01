# Fase 7.6 — Acessibilidade e Mobile: Design

> Aprovado na sessão de brainstorming de 2026-10-01.

## Objetivo

Seis entregas para tornar o Chronicle acessível (WCAG AA) e mobile-first:

1. **Auditoria de teclado** com implementação de correções (timeline, galeria, modal de busca, wizard)
2. **Contraste AA** em todo o conjunto de cores (WCAG AA: 4.5:1 normal, 3:1 large)
3. **Gerenciamento de foco** em lightbox e dialogs (trapping, restore, aria-modal)
4. **Timeline em coluna única no mobile** (cards empilhados, marcadores adaptados)
5. **Wizard em passos menores no mobile** (páginas separadas por passo)
6. **Landmarks e `aria-live`** para resultados de busca e estado de upload

---

## Contexto Verificado

- **Globals.css** (`apps/web/src/app/globals.css:24-42`): Paleta definida em variáveis CSS
  - `--muted-foreground: #666680` sobre `--card: #1a1a2e` = 3.8:1 ✗ (precisa ≥ 4.5:1)
  - `--border: #2a2a3e` sobre `--card: #1a1a2e` = 2.3:1 ✗ (precisa ≥ 3:1 para UI)
  - `--input: #2a2a3e` sobre `--card: #1a1a2e` = 2.3:1 ✗
- **PhotoGallery** (`apps/web/src/components/photo-gallery.tsx`): Usa `<dialog>` nativo com `aria-modal`, foco restaurado no fechamento
- **SearchDialog** (`apps/web/src/components/search-dialog.tsx`): Usa Radix Dialog com `onOpenAutoFocus`/`onCloseAutoFocus`
- **Wizard** (`apps/web/src/components/create-memory-wizard.tsx`): 5 steps em um componente único, navegação Próximo/Anterior
- **Timeline** (`apps/web/src/components/memory-timeline.tsx`): Container horizontal com linha vertical e marcadores
- **Radix UI** já instalado para dialogs (SearchDialog, ShareDialog, ConfirmDialog)

---

## 1. Auditoria de Teclado + Correções

### Timeline (`memory-timeline.tsx`)
- **Atual**: Sem navegação por teclado
- **Meta**: 
  - `Tab` foca o primeiro card
  - `ArrowUp/Down` navega entre cards
  - `Enter/Space` abre ações do card (editar, deletar, share)
  - Marcadores de mês focáveis (`Tab` para)
- **Implementação**: Adicionar `tabIndex`, `onKeyDown` no container, gerenciar `activeCardIndex` via estado

### Galeria (`photo-gallery.tsx`)
- **Atual**: thumbnails já são `<button>` com `aria-label` (focáveis nativamente); lightbox tem `ArrowLeft/Right`, `Escape` e restauração de foco no thumbnail
- **Gaps**: nada estrutural — **cobrir com teste E2E de teclado** (Tab até thumb, Enter abre, Escape fecha e devolve foco)

### Search Modal (`search-dialog.tsx`)
- **Atual**: `ArrowUp/Down` nos resultados, `Enter` abre, `Escape` fecha
- **Gap**: `Tab` não foca o input ao abrir (Radix `onOpenAutoFocus` previne foco nativo mas foca via ref)
- **Verificação**: Confirmar que `Tab` navega input → resultados → botão "Ver todas"

### Wizard (`create-memory-wizard.tsx` + steps)
- **Atual**: Navegação Próximo/Anterior por botões, `Tab` percorre campos do step atual
- **Gaps**:
  - `Enter` não avança para próximo step (exceto no último)
  - Troca de step não foca primeiro campo do novo step
  - `Shift+Tab` no primeiro campo não vai para botão Anterior
- **Correção**: `onKeyDown` no form, `autoFocus` no primeiro campo de cada step

---

## 2. Contraste AA (WCAG AA)

### Cores Atuais (globals.css:24-42) — ratios calculados (2026-10-01)
| Variável / par | Valor | Sobre | Ratio | Status |
|----------|-------|-------|-------|--------|
| `--muted` | `#a0a0b0` | `--background` `#0a0a0f` | 7.67:1 | ✓ |
| `--muted` | `#a0a0b0` | `--card` `#1a1a2e` | 6.62:1 | ✓ |
| `--muted-foreground` | `#666680` | `--card` `#1a1a2e` | 3.07:1 | ✗ texto (precisa 4.5) |
| `--muted-foreground` | `#666680` | `--background` | 3.55:1 | ✗ texto |
| `--card` | `#1a1a2e` | `--background` | 1.16:1 | ✓ (decorativo) |
| `--border` | `#2a2a3e` | `--card` | 1.22:1 | ✗ (só usado como `bg-border` divisor) |
| `--input` | `#2a2a3e` | `--background` | 1.22:1 | ✗ UI (precisa 3:1) |
| `border-card` em inputs | `#1a1a2e` | `--background` | 1.16:1 | ✗ UI |
| `--primary` | `#f0c040` | `--background` | 11.59:1 | ✓ |
| `--primary` | `#f0c040` | `--card` | 10.01:1 | ✓ |
| `--secondary` | `#ff8c00` | `--background` | 8.47:1 | ✓ |
| `--secondary-foreground` | `#ffffff` | `--secondary` `#ff8c00` | 2.33:1 | ✗ texto (variante `secondary` do Button) |
| `--accent-foreground` | `#ffffff` | `--accent` `#ff8c00` | 2.33:1 | ✗ texto (hover outline/ghost) |
| `--destructive-foreground` | `#ffffff` | `--destructive` `#ef4444` | 3.76:1 | ✗ texto |
| `bg-red-500 text-white` (ConfirmDialog) | `#ffffff` on `#ef4444` | — | 3.76:1 | ✗ texto |
| `text-red-500` erros | `#ef4444` | `--background` | 5.25:1 | ✓ |
| `text-red-500` erros | `#ef4444` | `--card` | 4.53:1 | ✓ (limítrofe) |
| `--text` | **indefinida** | — | — | ⚠ `text-text` resolve por herança acidental (`--foreground`) |

### Correções Necessárias (globals.css `:root`)
```css
--text: #ffffff;             /* definir de fato; hoje é undefined e só funciona por fallback */
--muted-foreground: #8888a8;  /* 4.98 sobre card, 5.77 sobre background (≥4.5) */
--input: #6a6a84;             /* 3.26 sobre card, 3.77 sobre background (≥3) */
--border: #6a6a84;            /* mesmo valor; é o divisor `bg-border` do menu */
--accent-foreground: #0a0a0f; /* hover outline/ghost: 8.47 sobre accent (era 2.33) */
--secondary-foreground: #0a0a0f; /* variante secondary: 8.47 sobre secondary */
--destructive: #dc2626;       /* white-on-destructive: 4.83 (era 3.76) */
```

### Correções fora do `:root`
- Trocar `border-card` → `border-input` nos **controles de formulário** (inputs, textareas, selects): steps 0–2, chip-input, search dialog, memory-filters, página de edição. `border-card` decorativo (cards, divisores, kbd) permanece.
- `confirm-dialog.tsx`: `bg-red-500 text-white hover:bg-red-600` → `bg-red-600 text-white hover:bg-red-700` (4.83:1).
- `globals.css`: regra global `:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px }` — elementos customizados (nav search, retro strip, chips, thumbnails de persona) hoje não têm anel de foco visível.

### Validação
- Rodar `pnpm build` + verificação visual
- Opcional: script automatizado com `axe-core` nos testes E2E

---

## 3. Gerenciamento de Foco (Lightbox + Dialogs)

### PhotoGallery (`photo-gallery.tsx:132-148`)
- **Status**: ✅ Usa `<dialog>` nativo com `aria-modal="true"`, `showModal()` (trapping nativo), foco restaurado via `triggerRef` no fechamento
- **Ação**: apenas teste E2E de foco (não há código a mudar)

### SearchDialog (`search-dialog.tsx:101-127`)
- **Status**: ✅ Radix Dialog aberto por estado (sem `DialogTrigger`) + `onOpenAutoFocus`/`onCloseAutoFocus` manuais — é o padrão correto
- **Ação**: extrair para hook compartilhado `useDialogFocusRestore` (DRY)

### ShareDialog / ConfirmDialog
- **Gap real**: abertos por estado (`open={confirmOpen}`) **sem** `DialogTrigger` e **sem** `onCloseAutoFocus` → Radix só devolve foco para um trigger declarado; aqui o foco cai no `<body>` ao fechar
- **Ação**: aplicar `useDialogFocusRestore` nos dois

### Ações
1. Criar `apps/web/src/lib/use-dialog-focus-restore.ts` e aplicar em ConfirmDialog, ShareDialog e SearchDialog
2. Testar lightbox, busca, confirmação e share: foco entra ao abrir, Tab fica preso, foco volta ao gatilho ao fechar

---

## 4. Mobile Timeline - Coluna Única

### Verificação (2026-10-01)
A timeline **já é coluna única em todas as viewport** (`memory-timeline.tsx` renderiza `space-y-8` vertical com linha à esquerda e `pl-6 sm:pl-10`; não existe variante horizontal). O entregável da 7.6 é, portanto, **garantir e proteger** o comportamento mobile:

1. Teste E2E em viewport 375×812 que falha se houver scroll horizontal (`documentElement.scrollWidth > clientWidth`) nas páginas home, wizard, retrospectivas e busca.
2. Teste E2E que afirma que os cards empilham (mesmo `x` de bounding box) em 375px.
3. Correções de overflow encontradas com código exato (título do card `break-words`, progresso do wizard compacto, etc. — ver plano).

### CSS responsivo (mantido)
- Mobile (`<640px`): marcadores acima dos cards, `pl-6`, linha vertical continua.
- `≥640px`: `pl-10`, layout atual inalterado.

---

## 5. Mobile Wizard - Páginas Separadas por Passo

### Nova Estrutura de Rotas
```
/memories/new/0  → Informações Básicas
/memories/new/1  → Localização  
/memories/new/2  → Música
/memories/new/3  → Fotos
/memories/new/4  → Pessoas e Tags
/memories/new    → Redirect para /memories/new/0
```

### Implementação
1. **Nova rota**: `apps/web/src/app/(dashboard)/memories/new/[step]/page.tsx` (padrão `useParams` client, como `memories/[id]/page.tsx`); `page.tsx` vira `redirect('/memories/new/0')`
2. **Estado compartilhado**: `WizardProvider` no **layout** `memories/new/layout.tsx`
   - O layout do App Router persiste entre navegações irmãs (`/new/0` → `/new/1`), então contexto (form do react-hook-form, `photos: File[]`, `people`, `tags`) sobrevive aos cliques Próximo/Anterior e ao botão Voltar do navegador
   - Reload duro: escalar/people/tags restaurados via `sessionStorage`; **`File[]` não é serializável — fotos são perdidas em reload** (limitação documentada)
3. **`currentStep` vem da URL** (`useParams` no provider) — fonte única de verdade, sem estado duplicado
4. **Progress Indicator + botões**: `WizardShell` consome o contexto e continua visível em todas as páginas (o indicador fica no layout)
5. **Code Splitting**: cada página importa apenas o seu step component
6. **Teclado**: `Enter` em campo de texto avança (com validação); foco vai para o heading (`h2 tabIndex={-1}`) a cada troca de página
7. **Mobile "passos menores"**: uma página = um passo; Card `p-4 sm:p-6`; progresso compacto no mobile (conectores `hidden sm:block`)

### Vantagens
- Histórico do navegador funciona (Voltar/Avançar)
- Recarregar página preserva step atual
- SEO-friendly (cada step indexável)
- Menos JS por página

---

## 6. Landmarks + aria-live

### Landmarks Semânticos (verificado no código)
| Página/Componente | Situação atual | Ação |
|-------------------|----------------|------|
| `app/layout.tsx` | `<html lang="pt-BR">` ✓, sem header/main de nível raiz | manter (o layout `(dashboard)` cobre) |
| `(dashboard)/layout.tsx` | tem `<main>` ✓; `<Navbar>` sem `<header>` | envolver Navbar em `<header>` |
| `(auth)/layout.tsx` | só `<div>` | trocar por `<main>` |
| home `(dashboard)/page.tsx` | `<div id="timeline">` sem landmark | virar `<section id="timeline" aria-label="Linha do tempo">` |
| `navbar.tsx` | `<nav>` ✓ | manter |

### aria-live Regions
| Conteúdo Dinâmico | Região | Politeness | Implementação |
|-------------------|--------|------------|---------------|
| Resultados de busca | `<ul data-testid="search-results">` | `polite` | Adicionar `aria-live="polite"` |
| Progresso de upload | Botão submit wizard | `assertive` | `aria-live="assertive"` no span de progresso |
| Toasts (sonner) | Toast container | `polite` | ✓ (sonner já faz) |
| Contador "novas memórias" | Home strip | `polite` | Adicionar `aria-live="polite"` |

### Implementação
```tsx
// search-dialog.tsx - results list
<ul 
  ref={listRef}
  aria-live="polite"
  aria-label="Resultados da busca"
  ...
>

// create-memory-wizard.tsx - upload progress
<span aria-live="assertive" aria-atomic="true">
  {isUploading ? `Enviando foto ${progress.current} de ${progress.total}...` : ''}
</span>
```

---

## Plano de Testes

### Automatizados
- **axe-core** nos testes E2E (Playwright) para regressão de contraste/landmarks
- Testes unitários de componentes com `@testing-library/react` + `jest-axe`

### Manuais (Checklist)
- [ ] Navegação só por teclado em todas as páginas
- [ ] Contraste verificado com ferramenta (ex: WAVE, axe DevTools)
- [ ] Foco visível em todos os elementos interativos
- [ ] Screen reader (NVDA/VoiceOver) anuncia mudanças dinâmicas
- [ ] Mobile: timeline single column, wizard pages, touch targets ≥ 44px

---

## Limitações Conhecidas

- `pnpm db:migrate` continua quebrado no dev DB (não afeta esta fase)
- Split UTC/local permanece: `memory-filters.tsx` usa `getUTCFullYear()` — cliente a leste do UTC vê ano anterior à meia-noite
- Wizard `JSON.stringify` de `Date` em UTC perde um dia para clientes a leste do UTC (+1..+14h) — registrado na 7.0

---

## Gates da 7.6

- `pnpm build` 6/6
- `pnpm typecheck --force` 10/10
- `pnpm test` 8/8
- `biome check` 0 avisos
- Playwright chromium: todos passam + axe-core smoke test passa
- Checklist manual de acessibilidade completo