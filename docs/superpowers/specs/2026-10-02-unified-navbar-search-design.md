# Chronicle — Unified Navbar Search Design

**Date:** 2026-10-02
**Status:** Draft

---

## 1. Resumo

Unificar a pesquisa em um único input na Navbar (substituindo o botão de lupa). O input abre um dropdown leve (combobox) com preview dos top 5 resultados; Enter ou "Ver todas" navega para a página completa `/search`. Remove o modal `SearchDialog` existente.

---

## 2. Arquitetura

### 2.1 Componentes

| Componente | Responsabilidade |
|------------|------------------|
| `Navbar` | Renderiza o input fixo (~320px) + abre/fecha dropdown via estado local |
| `SearchDropdown` (novo) | Popover ancorado ao input, busca debounced (limit: 5), renderiza lista + "Ver todas" |
| `/search` page | Mantida inalterada (resultados completos, chips, paginação) |

### 2.2 Fluxo de Dados

```
Navbar input (onChange)
  → setQuery local
  → debouncedQuery (useDebouncedValue, 300ms)
  → SearchDropdown recebe debouncedQuery
    → useMemories({ search: debouncedQuery, limit: 5 })
    → renderiza resultados no Popover
```

### 2.3 Estados

| Estado | Onde | Descrição |
|--------|------|-----------|
| `query` | Navbar | Valor bruto do input (sem debounce) |
| `debouncedQuery` | Navbar → passado ao Dropdown | Query após 300ms debounce |
| `isOpen` | Navbar | Controla Popover (aberto quando input focado E query tem resultados) |
| `selectedIndex` | Dropdown | Highlight keyboard navigation |

---

## 3. UI/UX

### 3.1 Navbar Input

- **Largura fixa:** `w-80` (320px) no desktop, `w-full` no mobile
- **Prefixo:** ícone `Search` (lucide) à esquerda
- **Placeholder:** "Buscar: #tag @pessoa ano:2026 local:praia"
- **Estados visuais:**
  - Default: `border-input`
  - Focus: `border-primary focus:ring-2 focus:ring-primary/30`
  - Com dropdown aberto: `border-primary`

### 3.2 SearchDropdown (Popover)

- **Anchor:** input da navbar (Radix Popover)
- **Largura:** igual ao input (`w-80`)
- **Altura máxima:** `max-h-80` com scroll
- **Conteúdo:**
  - Lista de até 5 resultados (title, date, location)
  - Divider + "Ver todas X memórias" (link para `/search?q=...`)
  - Empty state: "Nenhuma memória encontrada para '...'"
  - Loading: spinner discreto
- **Keyboard:** ArrowUp/Down, Enter (navega), Escape (fecha), Tab (fecha)

### 3.3 Mobile

- Input `w-full` abaixo do logo (ou inline com gap)
- Dropdown full-width abaixo do input

---

## 4. Comportamento

| Ação | Resultado |
|------|-----------|
| Digita no input | Atualiza `query`, após 300ms busca top 5 |
| Focus no input | Abre dropdown se houver query/resultados |
| ArrowUp/Down | Navega resultados no dropdown |
| Enter no input | `router.push('/search?q=...')` |
| Enter no resultado | `router.push('/memories/:id')` + fecha dropdown |
| Click "Ver todas" | `router.push('/search?q=...')` + fecha dropdown |
| Click fora / Escape | Fecha dropdown |
| Blur no input | Fecha dropdown (com delay p/ click no resultado) |

---

## 5. Limpeza (Remoções)

| Arquivo | Ação |
|---------|------|
| `search-dialog.tsx` | **Deletar** — modal substituído pelo dropdown |
| `navbar.tsx` | Remover `searchOpen`, `SearchDialog` import/render, atalhos `Ctrl+K` e `/` (dropdown abre no focus) |
| Testes `search-dialog.spec.ts` | Atualizar/remover testes do modal; adicionar testes do dropdown |

---

## 6. Testes

### 6.1 Novos testes (dropdown)

- Abre ao focar input com query
- Mostra top 5 resultados
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- "Ver todas" navega para `/search`
- Enter no input navega para `/search`
- Click fora fecha

### 6.2 Testes existentes a manter/atualizar

- `/search` page: chips, paginação, resultados completos
- Acessibilidade: landmarks, live regions
- Navegação: teclado, foco

---

## 7. Acessibilidade

- Input: `role="combobox"`, `aria-expanded`, `aria-controls`
- Dropdown: `role="listbox"`, itens `role="option"`
- `aria-live="polite"` no contador de resultados
- Focus management: input mantém foco, highlight move no dropdown

---

## 8. Gates de Qualidade

```bash
pnpm lint:fix && pnpm exec biome check .
pnpm --filter web typecheck
pnpm build
pnpm test
pnpm --filter web exec playwright test --project=chromium
```

---

## 9. Fora de Escopo

- Histórico de buscas recentes
- Sugestões de autocomplete (tags, pessoas)
- Salvar buscas favoritas