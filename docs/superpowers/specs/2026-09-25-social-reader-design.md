# Chronicle — Timeline pública com privacidade, menu logado e galeria no card

Date: 2026-09-25
Status: Draft

## Contexto

Atualmente toda a área `(dashboard)` é protegida por `AuthGuard`, o `GET /api/memories` retorna apenas as memórias do usuário logado, o schema `memories` não tem coluna de privacidade, e a navbar logada mostra apenas nome + botão "Sair". A página de detalhe (`/memories/[id]`) concentra as ações de editar/deletar/narrativa e a galeria de fotos com lightbox.

Este spec transforma a Chronicle em uma experiência de leitura pública: qualquer pessoa vê a timeline (memórias públicas), usuários logados têm feed comunitário + as próprias privadas, e as ações de dono (editar, deletar, gerar narrativa, alternar privacidade) ficam diretamente no card da Home. A página de detalhe é removida.

## Decisões (confirmadas com o usuário)

1. **Home com sessão**: feed comunitário (públicas de todos) intercalado com as próprias privadas.
2. **Privacidade padrão**: nova memória nasce pública; usuário pode marcar como privada.
3. **Migração**: memórias existentes viram públicas (coluna `isPublic` default `true`).
4. **Minhas Memórias**: página separada logada (`/minhas-memorias`) listando apenas as do usuário (públicas + privadas).
5. **Perfil**: página simples logada (`/perfil`) com dados do usuário e contagem de memórias.
6. **Card deixa de ser link**; ações de dono como ícones (editar → página de edição; deletar e narrativa inline).
7. **Galeria**: reutilizar `PhotoGallery` no card (grid + lightbox), adicionando setas ←/→, navegação por teclado e contador.
8. **Proteção**: abordagem "guarda por página" (`RequireAuth`), removendo `AuthGuard` do layout do dashboard.

## Backend

### Schema (`packages/db`)

Adicionar em `packages/db/src/schema/memories.ts`:

```ts
isPublic: boolean('is_public').notNull().default(true),
```

Migração: `drizzle-kit generate` + push. As linhas existentes recebem `true` pelo default.

### Schemas Zod (`packages/schemas`)

- `create-memory.ts`: adicionar `isPublic: z.boolean().optional()`.
- `update-memory.ts`: adicionar `isPublic: z.boolean().optional()`.

### API (`apps/api`)

**`GET /api/memories` (memories.service.findAll)** — mudar o filtro de base:

- **Anônimo** (sem sessão): `WHERE isPublic = true`.
- **Logado** (`?mine=false` ou ausente): `WHERE (isPublic = true OR userId = :currentUser)`.
- **`?mine=true`** (página Minhas Memórias): `WHERE userId = :currentUser` (exige sessão — sem sessão responde `401`).
- Filtros existentes (year, month, weather, location, tag, search) permanecem.
- O count da paginação usa exatamente as mesmas condições de `WHERE` (como hoje).
- Retornar `userId` e `isPublic` no payload (o front usa para decidir ações de dono).
- A rota deixa de exigir sessão (remove o `401` de `memories.routes.ts`).

**`GET /api/memories/:id` (findById)** — sem exigir sessão obrigatória:

- Memória pública → qualquer um lê.
- Memória privada → somente o dono (`userId` da sessão).
- Seguir usando `AppError.notFound/forbidden` como hoje.

**`POST /api/memories` (create)** — manter exigência de sessão; aceitar `isPublic` no body (default `true`).

**`DELETE /api/memories/:id` e `PUT /api/memories/:id`** — já exigem sessão e checam dono via `findById(id, userId)`. Continuam. `update` passa a aceitar/setar `isPublic` (só o dono pode alterar).

**`POST /api/memories/:id/generate-narrative`** — já exige sessão e checa dono no service (`narrative.service.ts`). Sem mudanças funcionais; apenas manter.

### Testes de API

- Unit: `findAll` anônimo retorna só públicas; logado retorna públicas + próprias privadas; `findById` privada para não-dono → forbidden.
- Integration: rotas GET não exigem sessão para públicas; create/update com `isPublic`.

## Frontend

### Roteamento e guarda

- `(dashboard)/layout.tsx`: **remover `<AuthGuard>`**. Manter `Navbar` e `<LazyAudioPlayer>` para todos.
- Criar `apps/web/src/components/require-auth.tsx` (client): redireciona para `/login` se `!isAuthenticated` após `isLoading`; enquanto carrega renderiza spinner.
- **Remover** `apps/web/src/app/(dashboard)/memories/[id]/page.tsx` e `memories/[id]/loading.tsx`.
- Manter `memories/[id]/edit` (página de edição) protegida por `RequireAuth`. O ícone Editar no card aponta para `/memories/[id]/edit`.
- Páginas protegidas com `RequireAuth`: `memories/new`, `memories/[id]/edit`, `minhas-memorias` (nova), `perfil` (nova).
- Home (`/`) e `/memories` ficam públicas.
  - Nota: `/memories` (lista simples) permanece, mas ambas agora mostram o feed público logado.

### Navbar (`navbar.tsx`)

- Logado: substituir nome + "Sair" por um **dropdown de usuário** acionado por click (avatar se `user.image`, senão iniciais/nome curto):
  - **Minhas Memórias** → `/minhas-memorias`
  - **Perfil** → `/perfil`
  - **Nova Memória** → `/memories/new`
  - **Sair** → `signOut()` + `invalidateSession()`
- Anônimo: manter link "Entrar" (`/login`).
- Fechar o dropdown ao navegar/clicar fora (uso de estado local; simples).
- O botão de busca `/search` (rota inexistente) permanece como está — fora de escopo.

### Home (`/`, `page.tsx`)

- Página pública; acessível sem login.
- CTA "Nova Memória":
  - Anônimo → `Link` para `/login`.
  - Logado → `Link` para `/memories/new`.
- Estado vazio: ajustar texto para o contexto (feed vazio / "nenhuma memória pública").
- Reusar `MemoryCardFull` (agora com ações) e `MemoryFilters`.

### Página Minhas Memórias

- `apps/web/src/app/(dashboard)/minhas-memorias/page.tsx` (client, `RequireAuth`).
- Chama `useMemories` com um parâmetro novo `mine: true` (query string).
- Lista os cards do usuário (públicas + privadas), reusando `MemoryCardFull`.
- Paginação idêntica à Home.

### Página Perfil

- `apps/web/src/app/(dashboard)/perfil/page.tsx` (client, `RequireAuth`).
- Mostra: avatar (se houver), nome, email, contagem de memórias do usuário (via query `?mine=true` ou endpoint simples), link para `/minhas-memorias`.
- Sem escopo de edição de perfil.

### Card da timeline (`memory-card.tsx` / `MemoryCardFull`)

- **Remover o `<Link>`** que envolve o card.
- Passar para o card uma flag `isOwner` (computada na página: `memory.userId === user?.id`) e seções de ação:
  - **Editar** (ícone lápis) → `Link` para `/memories/[id]/edit`.
  - **Deletar** (ícone lixeira) → dialog de confirmação → `DELETE /api/memories/:id` → invalidar query.
  - **Narrativa** (ícone ✨/Spakles):
    - Se não há `aiNarrative` e é dono → botão "Gerar narrativa" inline.
    - Se há → bloco expandível (como hoje), com "Regenerar" para o dono.
  - **Privacidade** (ícone lock/unlock) → `PUT /api/memories/:id` com `{ isPublic: !current }` inline, apenas dono.
- Manter exibição de metadados, música e narrativa como hoje.
- `MemoryCard` (lista simples em `/memories`): manter como está (sem ações de dono; opcional aplicar ações também — fora de escopo para manter simples).

### Galeria (`photo-gallery.tsx`)

- Aprimorar o lightbox existente:
  - Setas **‹ / ›** (prev/next) quando `photos.length > 1`.
  - Navegação por **teclado**: `Esc` fecha, `←`/`→` navega.
  - **Contador** "N de M" (ex.: 2/5).
  - Manter pontos de navegação e clique na foto.
- Usar `PhotoGallery` no lugar do grid de fotos atual do `MemoryCardFull`.
- Ajustar `aria-label`s e `data-testid`s para E2E (e.g. `photo-gallery`, `lightbox-prev`, `lightbox-next`).

### Hooks

- `use-memories.ts`: adicionar suporte a `mine?: boolean` no `buildQueryString` e no tipo `MemoryFiltersInput` (ou parâmetro do hook). Simplificação: extender `MemoryFiltersInput` em `@chronicle/schemas` com `mine` opcional, e o `findAll` do service aplica `userId` quando `mine=true`.
- `use-memory.ts` (detalhe/edição): continua (usado pela página de edição).

## Fora de escopo

- Rota `/search` morta na navbar (follow-up).
- Edição de fotos/música no card (editar só redireciona para a página de edição existente).
- Páginas de perfil com edição de dados; contagem precisa apenas de um valor simples.
- Storybook: atualizações de stories para `PhotoGallery` e `MemoryCardFull` ficam para o plano (cronograma) se houver stories existentes.

## Testes E2E (ajustes/aditivos)

- `timeline.spec` e `filter-memory.spec`: hoje exigem login para a Home — ajustar para o fluxo novo (Home pública), mantendo asserções de cards/filtros. Os helpers existentes podem precisar de parametrização.
- Novos specs:
  - Ver Home sem login (anônimo vê cards públicos, "Entrar" na navbar, CTA leva a `/login`).
  - Criar memória privada → não aparece para outro usuário; aparece em Minhas Memórias.
  - Menu logado: navega para Minhas Memórias e Perfil; logout.
  - Card: deletar com confirmação; gerar narrativa inline; toggle público/privado (ícones aparecem só para dono).
  - Galeria: abrir lightbox, navegar com setas e teclado, contador correto.

## Toggle de privacidade — decisão

O dono alterna público/privado pelo **`PUT /api/memories/:id`** existente (nenhuma rota nova). `update-memory.ts` ganha `isPublic` opcional; o service seta apenas os campos presentes (Drizzle ignora `undefined` no `.set()`). O card faz um `PUT` com `{ isPublic: !current }` (o Zod permite body parcial e o service não sobrescreve campos ausentes).