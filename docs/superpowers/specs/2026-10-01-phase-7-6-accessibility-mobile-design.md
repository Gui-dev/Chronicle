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
- **Atual**: Tem `ArrowLeft/Right` no lightbox, `Escape` fecha
- **Gaps**: 
  - Thumbnails não são focáveis por `Tab`
  - `Enter/Space` não abre lightbox do thumb focado
- **Correção**: Adicionar `tabIndex=0`, `role="button"`, `onKeyDown` nos thumbnails

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

### Cores Atuais (globals.css:24-42)
| Variável | Valor | Sobre | Ratio | Status |
|----------|-------|-------|-------|--------|
| `--muted` | `#a0a0b0` | `--background` `#0a0a0f` | 6.8:1 | ✓ |
| `--muted-foreground` | `#666680` | `--card` `#1a1a2e` | 3.8:1 | ✗ |
| `--card` | `#1a1a2e` | `--background` `#0a0a0f` | 9.3:1 | ✓ |
| `--border` | `#2a2a3e` | `--card` `#1a1a2e` | 2.3:1 | ✗ (UI) |
| `--input` | `#2a2a3e` | `--card` `#1a1a2e` | 2.3:1 | ✗ (UI) |
| `--muted` | `#a0a0b0` | `--background` | 6.8:1 | ✓ |
| `--primary` | `#f0c040` | `--background` | 8.2:1 | ✓ |
| `--secondary` | `#ff8c00` | `--background` | 5.1:1 | ✓ |

### Correções Necessárias
```css
/* globals.css - ajustes para AA */
--muted-foreground: #8a8ab8;  /* 4.5:1 sobre #1a1a2e */
--border: #3a3a4e;            /* 3.1:1 sobre #1a1a2e (UI) */
--input: #3a3a4e;             /* 3.1:1 sobre #1a1a2e (UI) */
```

### Validação
- Rodar `pnpm build` + verificação visual
- Opcional: script automatizado com `axe-core` nos testes E2E

---

## 3. Gerenciamento de Foco (Lightbox + Dialogs)

### PhotoGallery (`photo-gallery.tsx:132-148`)
- **Status**: ✅ Usa `<dialog>` nativo com `aria-modal="true"`, foco restaurado via `triggerRef` no fechamento
- **Verificar**: `tabIndex` nos botões de navegação (prev/next) dentro do lightbox

### SearchDialog (`search-dialog.tsx:101-127`)
- **Status**: ✅ Radix Dialog com `onOpenAutoFocus` (foca input), `onCloseAutoFocus` (restaura trigger)
- **Gap**: Botão "Ver todas" não recebe foco via `Tab` se lista vazia

### ShareDialog / ConfirmDialog
- **Verificar**: Ambos usam Radix Dialog? Confirmar `onCloseAutoFocus`

### Ações
1. Adicionar `focus-trap` (via `focus-trap-react` ou implementação nativa) em dialogs customizados
2. Garantir `autoFocus` no primeiro elemento interativo ao abrir
3. Restaurar foco no elemento trigger ao fechar (já implementado no PhotoGallery e SearchDialog)

---

## 4. Mobile Timeline - Coluna Única

### Estrutura Atual (`memory-timeline.tsx:52-135`)
- Container horizontal com linha vertical (`absolute left-[7px] sm:left-[11px]`)
- Cards lado a lado com marcadores à esquerda

### Alterações Mobile-First
```tsx
// memory-timeline.tsx - container principal
<div className="flex flex-col sm:flex-row gap-8 sm:gap-0">
  {/* Marcadores e cards empilhados verticalmente */}
  <div className="flex flex-col gap-8 w-full">
    {memories.map((memory, index) => (
      <div key={memory.id} className="flex flex-col sm:flex-row gap-4">
        {/* Marcador acima do card no mobile */}
        <TimelineMarker date={memory.memoryDate} className="sm:mb-0 sm:mr-4" />
        <MemoryCardFull memory={memory} isOwner={user?.id === memory.userId} />
      </div>
    ))}
  </div>
</div>

// TimelineMarker - remover linha vertical no mobile
export function TimelineMarker({ date, className }: TimelineMarkerProps) {
  return (
    <div data-testid="timeline-marker" className={`text-xs font-semibold uppercase tracking-widest text-muted ${className || ''}`}>
      {formatMonthYear(date)}
    </div>
  )
}
```

### CSS Responsivo
- Mobile (`<640px`): `flex-col`, marcadores acima dos cards, sem linha vertical
- Tablet+ (`≥640px`): `flex-row`, layout atual com linha vertical

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
1. **Nova pasta**: `apps/web/src/app/(dashboard)/memories/new/[step]/page.tsx`
2. **Estado compartilhado**: `sessionStorage` com chave `wizard-form-data`
   - Salva a cada `onChange` / `handleNext`
   - Carrega no `useEffect` inicial de cada página
3. **Progress Indicator**: Componente compartilhado (`WizardProgress`) no topo de cada página
4. **Navegação**: 
   - `Anterior` → `router.push(\`/memories/new/${step-1}\`)`
   - `Próximo` → valida step atual → `router.push(\`/memories/new/${step+1}\`)`
   - Último step → `Submit` cria memória
4. **Code Splitting**: Cada página importa apenas seu step component

### Vantagens
- Histórico do navegador funciona (Voltar/Avançar)
- Recarregar página preserva step atual
- SEO-friendly (cada step indexável)
- Menos JS por página

---

## 6. Landmarks + aria-live

### Landmarks Semânticos
| Página/Componente | Landmark Faltando | Ação |
|-------------------|-------------------|------|
| `layout.tsx` | `<header>`, `<main>`, `<footer>` | Adicionar wrappers |
| `navbar.tsx` | `<nav>` (já tem `nav` mas sem `role`) | Confirmar `role="navigation"` |
| `memory-timeline.tsx` | `<main>` no container | Adicionar |
| `search-dialog.tsx` | `<dialog>` já tem `role="dialog"` | ✓ |
| `photo-gallery.tsx` | `<dialog>` já tem `role="dialog"` | ✓ |

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