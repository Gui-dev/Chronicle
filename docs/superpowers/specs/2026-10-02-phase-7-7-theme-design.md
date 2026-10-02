# Fase 7.7 — Tema Dark/Light (next-themes): Design

Data: 2026-10-02 · Status: aprovado pelo usuário (seções 1 e 2, 2026-10-02)

## Objetivo

Adicionar um seletor de tema claro/escuro usando `next-themes`, com escolha dentro do menu do usuário, padrão "seguir o sistema", paleta light quente que mantém a identidade da marca, e arquitetura preparada para adicionar mais temas no futuro sem refatorar componentes.

## Decisões do Usuário (brainstorming)

1. **Visual companion:** recusado — tudo por texto.
2. **Abordagem:** A — troca de tokens via `data-theme` (aprovada sobre a alternativa shadcn `.dark` + utilitários `dark:`).
3. **Padrão da primeira visita:** `system` (`prefers-color-scheme`), escolha manual prevalece via localStorage.
4. **UX no menu:** lista de opções (Sistema / Escuro / Claro) — escalável para temas futuros.
5. **Direção da paleta light:** quente (bege quase-branco, cards brancos, dourado/laranja da marca; dourado escurecido onde for texto).
6. **Escopo:** toggle só no menu autenticado; visitantes deslogados seguem o sistema.
7. **Persistência:** por dispositivo (localStorage do next-themes), sem sync na conta.

## Contexto Verificado (2026-10-02)

- **`apps/web/src/app/globals.css` (73 linhas):** `@theme inline` L5–22 mapeia 17 tokens → utilitários Tailwind; `:root` L24–44 contém **a paleta escura atual em hex** (único bloco de cores); `body` L46–49 usa `var(--background)`/`var(--foreground)`; scrollbar L51–66 e `@layer base :focus-visible` L68–73 já consomem `var(--…)`.
- **Consumo por token:** 579 usos de utilitários (`bg-background`, `text-text`, `bg-card`…) em 40 arquivos; **zero** utilitários `dark:`; **zero** hex arbitrários em JSX. Exceções: `retrospect-map.tsx:43` (hex inline na string HTML do `divIcon` do Leaflet) e 19 glows `rgba(240,192,64,…)` em classes arbitrárias (navbar 5, register 4, login 4, memory-card 3, my-memories 2, profile 1) + 1 glow inline no mesmo `divIcon`.
- **`text-primary` = 90 usos** e **`text-muted` = 127 usos** — ambos são cores de **texto**; o gate já exige `--primary on --background` e `--muted on --background` ≥ 4.5:1, portanto no light esses tokens precisam ser escurecidos.
- **Layout raiz (`src/app/layout.tsx:19`):** `<html lang="pt-BR" className="dark">` hardcoded; nada consome a classe (não há regra `.dark` em lugar nenhum).
- **`src/app/providers.tsx`:** já existe, client component com `QueryClientProvider` + `Toaster` — ponto de montagem do `ThemeProvider`.
- **`next-themes` não está instalado** (nem em `package.json` nem no lockfile).
- **Navbar (`src/components/navbar.tsx`, client, 242 linhas):** dropdown hand-rolled (sem componente de menu no `@chronicle/ui`) — toggle `user-menu-toggle` L133–158 com `aria-haspopup="menu"`, itens L160–213 com `menuItemClass` L93–95, separador L201, Escape L25–35 devolve foco ao toggle, overlay L228–237 fecha. Convenção de testids: `user-menu-*`, `menu-*`.
- **Gate (`scripts/verify-contrast.mjs`):** lê o **primeiro** bloco `:root` (regex `[^}]*`, L10), extrai 15 tokens com literal `#rrggbb`, roda 16 checagens fixas (13 de texto ≥4.5:1, 3 de borda/UI ≥3:1) — L50–67. Roda como `test` do `apps/web` (ligado ao `pnpm test` via turbo).
- **Tailwind v4 puro:** `postcss.config.mjs` só com `@tailwindcss/postcss`; não há `darkMode`/`@custom-variant dark` no app (`packages/ui/tailwind.config.ts:4` tem `darkMode: 'class'` mas é legado inerte, fora do build — não tocar).
- **Testes:** Playwright é o runner do `apps/web` (`testDir: src/__tests__`, `workers: 1`, chromium+firefox); spec `user-menu.spec.ts` é o template de comportamento de menu; nenhum teste asserting cores hoje.

## 1. Arquitetura

### next-themes

Novo `ThemeProvider` do `next-themes` em `apps/web`:

```ts
attribute="data-theme"
themes={['light', 'dark']}
defaultTheme="system"
enableSystem
```

- Montado no topo de `Providers` (`src/app/providers.tsx`), envolvendo `QueryClientProvider`/children/`Toaster`.
- O script anti-FOUC do próprio next-themes resolve `system` → `dark|light` **antes da pintura** e escreve sempre um valor concreto em `<html data-theme="…">` (nunca fica sem tema).
- `layout.tsx`: remover `className="dark"` do `<html>` e adicionar `suppressHydrationWarning` (o atributo difere do SSR).
- Persistência: localStorage (`theme` = escolha, incluindo `system`) — padrão do next-themes, por dispositivo.

### Tokens (globals.css)

- O bloco `:root` atual **permanece como o tema escuro** — nenhuma mudança de valor, nenhum componente alterado.
- Novo bloco irmão com a paleta light (Seção 2).
- Cada bloco define `color-scheme` (`dark` no `:root`, `light` no bloco light) para scrollbar/controles nativos acompanharem.
- **Nenhum utilitário `dark:` e nenhum `@custom-variant dark`** — tema inteiro = swap de variáveis CSS (princípio da abordagem A). Um tema futuro = 1 bloco de tokens + 1 entrada no array `themes`.

### Layout raiz

```tsx
<html lang="pt-BR" suppressHydrationWarning>
```

`suppressHydrationWarning` é requisito do next-themes (o atributo é injetado no cliente).

## 2. Paleta Light (quente)

`:root[data-theme='light'] { … }` — todas as 16 checagens do gate calculadas em 2026-10-02 e **todas passam**:

| Token | Valor | Ratio verificado |
|---|---|---|
| `--background` | `#faf8f4` | `--text` 17.22:1 |
| `--foreground` | `#14141f` | body sobre background |
| `--card` | `#ffffff` | `--text` 18.27:1 |
| `--card-foreground` | `#14141f` | — |
| `--text` | `#14141f` | — |
| `--primary` | `#8a6d00` (dourado escurecido) | 4.64:1 bg · 4.92:1 card |
| `--primary-foreground` | `#ffffff` | 4.92:1 sobre primary |
| `--secondary` | `#c2410c` (laranja escurecido) | 4.88:1 sobre bg |
| `--secondary-foreground` | `#ffffff` | 5.18:1 sobre secondary |
| `--muted` | `#6e6e85` (texto legível) | 4.68:1 bg · 4.96:1 card |
| `--muted-foreground` | `#5f5f78` | 5.83:1 bg · 6.19:1 card |
| `--accent` | `#ff8c00` (mantido) | — |
| `--accent-foreground` | `#0a0a0f` (mantido) | 8.47:1 |
| `--destructive` / `--destructive-foreground` | `#dc2626` / `#ffffff` (mantidos) | 4.83:1 |
| `--border` | `#948e82` | 3.26:1 vs card (gate) · 3.07:1 vs bg (não gateado) |
| `--input` | `#8f897d` | 3.48:1 vs card · 3.28:1 vs bg |
| `--ring` | `#8a6d00` (foco acompanha o primary) | — |
| `--radius` | `0.5rem` (compartilhado) | — |
| `--glow-rgb` | `154,109,0` (componentes RGB do dourado escurecido; ver §3) | — |

Os valores são ancorados nos ratios acima; a implementação ajusta fino para dar margem se alguma checagem ficar apertada (critério: ≥4.5 com folga nos textos; nos pares de borda gateados, ≥3.2). **Critério de aceite: o gate estendido (§4) passa com as duas paletas.**

## 3. Exceções (o que foge dos tokens)

1. **Glows dourados** — 19 usos em 7 arquivos (navbar 5, register 4, login 4, memory-card 3, my-memories 2, profile 1) com **opacidades 0.8/0.5/0.4/0.15/0.1 e raios 8px/20px**. Como as variações são intencionais, tokeniza-se **só a cor**: novo token `--glow-rgb` (`240,192,64` no dark, `154,109,0` no light) e as classes mantêm opacidade/raio, ex.: `drop-shadow-[0_0_8px_rgba(var(--glow-rgb),0.8)]` e `shadow-[0_0_20px_rgba(var(--glow-rgb),0.1)]` — visual dark idêntico ao atual. Verificação visual no light: se o âmbar sujar o fundo claro, trocar o valor light por neutro (`100,95,80`) mantendo as opacidades.
2. **Marcador Leaflet** (`retrospect-map.tsx:43`) — string HTML inline com `background:#f0c040; border:2px solid #0a0a0f; box-shadow:0 0 6px rgba(240,192,64,0.8)` (a borda é a cor de fundo da página). Passa a montar o estilo lendo `--primary`, `--background` e `--glow-rgb` via `getComputedStyle(document.documentElement)`, e a re-monta quando `resolvedTheme` muda (refs de markers; `marker.setIcon`).
3. **`AvatarFallback`** (`packages/ui/src/components/ui/avatar.tsx:37`) — hoje `bg-muted` sem cor de texto (no dark, iniciais herdam `--foreground` branco sobre `#a0a0b0` ≈ 2.15:1). Ganha `text-background`: no dark `#0a0a0f` sobre `#a0a0b0` = **7.67:1**; no light `#faf8f4` sobre `#6e6e85` = **4.68:1**.
4. **Que herda sozinho (sem código):** scrollbar (globals.css L51–66), `:focus-visible` (L68–73), `body`, Toaster (`toastOptions` usa classes de token), todos os componentes (579 usos por token).

## 4. Gate de Contraste Estendido

`apps/web/scripts/verify-contrast.mjs`:

- Extrair **ambos** os blocos: `:root { … }` e `:root[data-theme='light'] { … }` (cada bloco sem chaves aninhadas — regex atual `[^}]*` continua válida por bloco).
- `readVar(name, block)` parametrizado; lançar erro claro se um token faltar em um dos blocos.
- Rodar as **mesmas 16 checagens em cada paleta** (32 no total); qualquer falha → `exit(1)` com o nome da paleta na linha.
- Continua sendo o script `test`/`test:contrast` do `apps/web` — coberto pelo `pnpm test`.

## 5. UI no Menu do Usuário

Dentro do dropdown existente (`navbar.tsx`), **após os itens de navegação e antes do separador de logout** (L201):

- Separador novo + rótulo de grupo **"Tema"** (text-xs, visualmente discreto, `aria-hidden="true"` — puramente decorativo).
- 3 itens com `role="menuitemradio"` + `aria-checked` + `aria-label` explícito (`"Tema: Sistema"`, `"Tema: Escuro"`, `"Tema: Claro"` — o texto visível é prefixo do rótulo, satisfazendo WCAG 2.5.3 label-in-name):
  - **Sistema** (visível: "Sistema", `data-testid="menu-theme-system"`)
  - **Escuro** (visível: "Escuro", `data-testid="menu-theme-dark"`)
  - **Claro** (visível: "Claro", `data-testid="menu-theme-light"`)
- Ícone `Check` (lucide) no item ativo; mesmas classes `menuItemClass`/`menuIconClass` dos demais itens.
- Ao selecionar: `setTheme('system'|'dark'|'light')`, **fecha o menu** e devolve o foco ao toggle (mesmo fluxo do Escape, L25–35).
- Itens visíveis apenas no estado autenticado (o dropdown inteiro já é).
- Comportamento herdado sem alteração: Escape, overlay, `aria-expanded`, navegação por Tab.

## 6. Plano de Testes

### E2E (novo `src/__tests__/theme-toggle.spec.ts`, template do `user-menu.spec.ts`)

1. **Trocar para Claro:** menu → "Claro" → `html` tem `data-theme="light"`, `background-color` computada = `rgb(250, 248, 244)`, menu fechado, foco no toggle.
2. **Persistência:** após "Claro", reload → continua `data-theme="light"`.
3. **Sistema segue o SO:** contexto com `colorScheme: 'dark'`, escolher "Sistema" → `data-theme="dark"`; `page.emulateMedia({ colorScheme: 'light' })` → `data-theme="light"` (sem recarregar, se suportado pelo next-themes; senão após reload).
4. **Rádio a11y:** item ativo tem `aria-checked="true"`, demais `false`.
5. **Escuro restaura a paleta original:** voltar para "Escuro" → `background-color` = `rgb(10, 10, 15)`.

### Gate/estáticos

- `pnpm --filter web test:contrast` (estendido) — 32 checagens passando.
- `a11y.spec.ts` — os 5 scans continuam verdes no tema claro (executar pelo menos a home/login com `colorScheme: 'light'` no contexto).

### Regressão

- `user-menu.spec.ts` (o dropdown mudou), `landmarks.spec.ts`, `mobile-layout.spec.ts`, `public-home.spec.ts`, `auth-flow.spec.ts` — verdes.
- Gates completos: biome 0, typecheck 10/10, build 6/6, `pnpm test` (9 tasks), Playwright chromium completa.

### Checklist manual (fora dos gates, como na 7.6)

- NVDA/VoiceOver: anúncio do grupo "Tema" e do rádio marcado.
- Troca de tema com diálogo/lightbox aberto (sem perda de foco).
- Toque em dispositivo real no iOS Safari/Android Chrome.

## 7. Fora de Escopo

- Temas adicionais (só preparamos: bloco + entrada no array).
- Toggle nas páginas deslogadas.
- Sync da escolha na conta (schema/API).
- Utilitários `dark:`/`@custom-variant dark`.
- Tiles do Leaflet (permanecem OSM claros nos dois temas).
- Limpeza do `packages/ui/tailwind.config.ts` legado.

## 8. Riscos Conhecidos

1. **Flash inicial para usuários de sistema light:** o script do next-themes é renderizado onde o provider está (início do `body`); o paint do `body` pode ocorrer antes do script em conexões muito lentas — aceito como comportamento padrão da lib; se provar-se problemático, mover o provider para o `layout.tsx` (um client boundary a mais).
2. **Hex literal no futuro:** qualquer novo hex fora dos blocos foge do gate — mantidos os 16 hexes atuais + os do bloco light, todos sob validação.
3. **`--muted` dual-use:** é texto (127 usos) e fundo (2 usos: fallback do avatar, dot da galeria). O valor light `#6e6e85` serve os dois; se algum uso visual ficar estranho, corrigir o componente (não o token).
