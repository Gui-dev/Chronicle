# Chronicle — Tasks de Implementação

## Fase 1: Fundação do Monorepo

### 1.1 Setup Inicial
- [x] Inicializar projeto com `pnpm init`
- [x] Configurar `turbo.json`
- [x] Configurar `biome.json` (lint + format)
- [x] Configurar `lefthook` (pre-commit: biome, pre-push: test)
- [x] Criar `compose.yml` (postgres, minio, mailpit)
- [x] Criar script `dev:infra` e `dev`
- [x] Criar `.env.example` e `.gitignore`

### 1.2 Package: DB
- [x] Setup Drizzle ORM com PostgreSQL
- [x] Criar schema `users` (Better Auth)
- [x] Criar schema `memories`
- [x] Criar schema `memory_photos`
- [x] Criar schema `memory_people`
- [x] Criar schema `memory_tags`
- [x] Configurar migrations
- [x] Testes unitários do schema (in-memory SQLite)

### 1.3 Package: Schemas
- [x] Criar Zod schema para `create-memory`
- [x] Criar Zod schema para `update-memory`
- [x] Criar Zod schema para `memory-filters`
- [x] Criar Zod schema para `auth` (register, login)
- [x] Testes dos schemas

### 1.4 Package: Auth
- [x] Configurar Better Auth com email/senha
- [x] Integrar com Drizzle
- [x] Testes de autenticação

### 1.5 Package: UI
- [x] Setup Shadcn UI
- [x] Configurar Storybook
- [x] Criar tokens de cores (paleta do layout)
- [x] Configurar globals.css com variáveis CSS
- [x] Componentes base: button, card, input, badge, avatar, dialog
- [x] Stories de cada componente

---

## Fase 2: API (Fastify)

### 2.1 Setup API
- [x] Inicializar Fastify
- [x] Integrar Better Auth
- [x] Configurar Swagger/Scalar
- [x] Configurar CORS
- [x] Configurar error handling padronizado
- [x] Testes de setup

### 2.2 Módulo: Auth
- [x] Rota POST /api/auth/register
- [x] Rota POST /api/auth/login
- [x] Rota GET /api/auth/me
- [x] Testes unitários (in-memory)
- [x] Testes de integração (MSW)

### 2.3 Módulo: Memories
- [x] Rota POST /api/memories (criar)
- [x] Rota GET /api/memories (listar com filtros)
- [x] Rota GET /api/memories/:id (detalhe)
- [x] Rota PUT /api/memories/:id (atualizar)
- [x] Rota DELETE /api/memories/:id (deletar)
- [x] Testes unitários (in-memory)
- [x] Testes de integração (MSW)

### 2.4 Módulo: Photos
- [x] Configurar MinIO client
- [x] Rota POST /api/memories/:id/photos (upload)
- [x] Rota DELETE /api/memories/:id/photos/:photoId
- [x] Testes unitários (in-memory)
- [x] Testes de integração (MSW)

### 2.5 Módulo: Integrations
- [x] Rota GET /api/spotify/search (proxy Spotify API)
- [x] Rota GET /api/weather (proxy Open-Meteo)
- [x] Rota GET /api/geocoding (proxy Open-Meteo)
- [x] Testes unitários (in-memory)
- [x] Testes de integração (MSW)

### 2.6 Módulo: AI Narrative
- [x] Rota POST /api/memories/:id/generate-narrative
- [x] Definir provedor AI (Google AI Studio - Gemini Flash)
- [x] Implementar geração de narrativa
- [x] Testes unitários (in-memory)
- [x] Testes de integração (MSW)

---

## Fase 3: Frontend (Next.js)

### 3.1 Setup Frontend
- [x] Inicializar Next.js (App Router)
- [x] Integrar Tanstack Query
- [x] Configurar API client (para Fastify)
- [x] Integrar Better Auth (client side)
- [x] Configurar estilos globais (paleta do layout)

### 3.2 Layout
- [x] Criar layout raiz (dark theme)
- [x] Criar navbar (logo, nav links)
- [x] Criar layout do dashboard (navbar + player fixo)
- [x] Criar componente audio-player (fixo no rodapé)

### 3.3 Páginas: Auth
- [x] Página de login
- [x] Página de registro
- [x] Proteção de rotas (auth guard)

### 3.4 Páginas: Timeline
- [x] Página principal (timeline cinematográfica)
- [x] Componente memory-card
- [x] Componente timeline-marker
- [x] Componente memory-filters (ano, clima, local, tag)
- [x] Hook use-memories (Tanstack Query)
- [x] Hook use-filters

### 3.5 Páginas: Criar Memória
- [x] Formulário de criação
- [x] Upload de fotos
- [x] Busca de música (Spotify)
- [x] Busca de localização (geocoding)
- [x] Seleção de clima (auto-preenchimento)
- [x] Adição de pessoas e tags
- [x] Hook use-create-memory

### 3.6 Páginas: Detalhe Memória
- [x] Exibição completa da memória
- [x] Galeria de fotos
- [x] Player de música associada
- [x] Narrativa IA (gerar/exibir)
- [x] Edição de memória
- [x] Hook use-update-memory

### 3.7 Storybook
- [ ] Removido: stories e tsconfig sem Storybook instalado (2026-09-26)

---

## Fase 4: Testes E2E

### 4.1 Setup Playwright
- [x] Configurar Playwright
- [x] Criar fixtures de teste
- [x] Configurar variáveis de ambiente para E2E

### 4.2 Fluxos E2E
- [x] Teste: Registro + Login
- [x] Teste: Criar memória completa
- [x] Teste: Visualizar timeline
- [x] Teste: Filtrar memórias
- [x] Teste: Editar memória
- [x] Teste: Deletar memória
- [x] Teste: Upload de fotos
- [x] Teste: Buscar música

---

## Fase 5: Polish e Deploy

### 5.1 UX
- [x] Loading states (skeleton cards, spinners)
- [x] Error states (retry buttons on dashboard/memories)
- [x] Empty states (photo gallery, CTA buttons in empty states)
- [x] Toasts/notificações (sonner - create/delete success)
- [x] Responsividade mobile (navbar truncation, responsive padding)

### 5.2 Performance
- [x] Otimização de imagens (Next/Image)
- [x] Lazy loading
- [x] Cache de queries (Tanstack Query)
- [x] Prefeitura de rotas

### 5.3 Deploy
- [ ] Definir hospedagem (VPS/Railway/Fly.io)
- [ ] Configurar CI/CD
- [ ] Variáveis de ambiente em produção
- [ ] Domínio + SSL

---

## Fase 6: Timeline pública, perfil e privacidade

### 6.1 Privacidade (schema + API)
- [x] Coluna `is_public` no schema memories (+ migration)
- [x] Zod: `isPublic` em create/update, `mine` em memory-filters
- [x] Backend: feed público + `?mine=true` + findById pública
- [x] Backend: status 401 mantido nas ações de dono

### 6.2 Avatar
- [x] Backend: POST/DELETE /api/users/avatar (MinIO)

### 6.3 Guarda e navegação
- [x] RequireAuth por página (remover AuthGuard do layout)
- [x] Remover página de detalhe `/memories/[id]`
- [x] Dropdown de usuário na navbar (avatar/iniciais)

### 6.4 Páginas
- [x] Home pública (CTA anônimo → /login)
- [x] Página `/my-memories`
- [x] Página `/profile` (dados, contagem)
- [x] Perfil: upload/remoção de avatar (MinIO)

### 6.5 Card e galeria
- [x] Ações de dono no card (editar, deletar, narrativa, privacidade)
- [x] Galeria com setas, teclado e contador

### 6.6 E2E
- [x] Ajustar specs existentes (timeline, filtros, delete, edit, fotos)
- [x] Novos specs: home pública, menu logado, ações de dono, galeria, perfil

---

## Fase 7: Produto Maduro

Origem: auditoria de 11 melhorias propostas, agrupadas em 7 fases por faixa de risco.
Cada fase é autocontida e entregável; a ordem vai do que tem menor chance de retrabalho
para o que mexe em segurança e privacidade.

Spec detalhado da 7.0: `docs/superpowers/specs/2026-09-27-phase-7-0-foundation-design.md`

### 7.0 Fundação — performance, busca e qualidade
- [x] `EXTRACT` de ano/mês reescrito como intervalo (predicado sargável)
- [x] Equivalência de conjunto entre o intervalo e o `EXTRACT`, com dados cruzando 31/12 e 01/01
      — verificado em `docs/superpowers/evidence/7.0-index-plan.sql` (Parte 3), que roda as duas
      condições lado a lado sobre 8 linhas de fronteira e reporta `divergencias = 0` nas 6 janelas,
      incluindo `2025-12-31 23:59:59` (ainda dezembro) e `2026-01-01 00:00:00` (já janeiro).
      Segue **conferência manual**, não teste automatizado: nenhum harness do repo roda
      `memoriesService` contra Postgres real (`memories.integration.test.ts` é nome enganoso e
      mocka o service). **Vale só com `SHOW TimeZone` = UTC** — `dateRange` monta instantes UTC e
      `localDate` grava meia-noite local; com sessão fora de UTC os dois divergem, e isso é a
      limitação já registrada no fim desta seção. Exige harness de Postgres real para virar teste —
      candidato a fase própria.
- [x] Índices btree: `(user_id, memory_date DESC)`, `(is_public, memory_date DESC)`,
      `memory_photos/people/tags(memory_id)`, `memory_tags(name)`.
      **O feed público é um btree completo, não o índice parcial que este item propunha.** Motivo:
      o feed de quem está logado filtra `is_public = true OR user_id = $1`, e o Postgres não prova
      que um `OR` implica `is_public = true` — um índice parcial seria ignorado justamente na
      consulta mais importante. Com `is_public` como primeira coluna de um índice completo, os
      dois braços do `OR` viram `Bitmap Index Scan` sobre o mesmo índice. Trava em
      `packages/db/src/schema/__tests__/memories.test.ts:86` (`expect(config.where).toBeUndefined()`).
- [x] `CREATE EXTENSION pg_trgm` + índices GIN em `title`, `content`, `location_name`, `weather_desc`
      e `memory_tags.name` (só na migration, nunca no schema — SQLite in-memory não suporta).
      São **cinco**, não quatro: `#tag` e `?tag=` casam com `ilike(name, '%tag%')`, com wildcard
      inicial, e o btree em `name` só atende igualdade exata.
- [x] N+1 eliminado: 3 queries em lote com `inArray` + agrupamento (`4 + 3N` → 5 constantes)
- [x] Teste que trava a contagem constante de queries
- [x] `search-query.ts`: parser da gramática de prefixos + testes unitários
- [x] Busca na API: query parseada → condições Drizzle (AND entre dimensões)
- [x] Busca por autor (`@user`) via join em `users`
- [x] `searchMeta` na resposta (query canônica, para os chips virem do servidor)
- [x] `SearchDialog` no header: debounce 300ms, `Cmd/Ctrl+K` e `/`, setas+Enter, foco restaurado
- [x] Página `/search?q=` reaproveitando `MemoryTimeline` (conserta o 404 existente)
- [x] Chips removíveis da query parseada reescrevendo a URL
- [x] "Nova Memória" no header — **somente para logado** → `/memories/new` (`nav-nova`, ícone-only
      abaixo de `sm`). Este item propunha também o anônimo → `/login`; isso foi revertido na
      execução porque o header anônimo já mostra "Entrar" apontando para a mesma página, e os dois
      botões teriam o mesmo destino. O item "Nova Memória" do dropdown (`menu-nova`) permanece e é
      o destino no mobile, onde `hidden sm:block` remove o CTA. Para anônimo o CTA não redireciona:
      ele não é renderizado (`navbar.tsx:122`).
- [x] Input de busca sai dos filtros da timeline; `search` sai do `useFilters` da página.
      sobra ano e mês na barra — mas `hasActiveFilters` (`memory-filters.tsx:41`) ainda testa
      `weather`, `location` e `tag`, que essa barra não renderiza. Deliberado: os três parâmetros
      continuam carregados na página, então "Limpar" aparece quando estão ativos. A lista volta a
      bater com a barra na 7.2, que é onde os controles de clima/local/tag voltam.
- [x] `useDebouncedValue` extraído para `apps/web/src/hooks/`
- [x] 3 `noExplicitAny` eliminados (wizard, `server.ts`, `auth.routes.spec.ts`)
- [x] `EXPLAIN ANALYZE` confirmando Index/Bitmap Index Scan — artefato em
      `docs/superpowers/evidence/7.0-index-plan.sql` (60k memórias, 50 usuários, tudo em transação
      com `ROLLBACK`; o dev DB fica intacto). **Confirmado, com uma ressalva importante:**
      - ✅ **Feed logado** (`is_public = true OR user_id = $1`, a consulta mais importante) →
         `BitmapOr` com **os dois** braços em `Bitmap Index Scan`, um em `memories_public_date_idx` e
         outro em `memories_user_date_idx`. É a prova de que o btree completo em
         `(is_public, memory_date DESC)` faz o que a spec previa: um índice parcial nunca entraria no
         `OR`.
      - ✅ Trigram (`content ILIKE '%viagem%'`, ~1% das linhas) → `Bitmap Index Scan` em
         `memories_content_trgm_idx`.
      - ✅ `user_id = $1` isolado → `Bitmap Index Scan` em `memories_user_date_idx`.
      - ✅ **Filtro de ano/mês, nos três formatos que o serviço emite** → todos indexados.
        `findAll` sempre começa com `user_id` ou `is_public` (`memories.service.ts:166-185`), então a
        data **nunca aparece sozinha**, e `memory_date` é coluna não-liderante nos dois btree — o que
        não impede o uso. Medido com 2% e com 20% de memórias públicas: feed anônimo + ano →
        `Index Scan` em `memories_public_date_idx` (0.22ms); feed logado + ano → `BitmapOr` com os
        dois braços (0.31ms); minhas memórias + ano → `Bitmap Index Scan` em
        `memories_user_date_idx` (0.26ms).
      - ⚠️ **Um range de data puro daria `Seq Scan`** — e é uma armadilha, não uma dívida. Nenhum
        índice começa por `memory_date`, então `WHERE memory_date BETWEEN ...` sem nenhum outro
        predicado varre a tabela, e um `CREATE INDEX (memory_date DESC)` mediria 4.01ms → 1.46ms.
        **Essa query não é executada por ninguém.** Ela não tem `is_public` nem `user_id`, e o
        serviço sempre põe um dos dois. O índice pagaria escrita e disco para servir nada. O
        contraexemplo está no artefato (1F) justamente para ninguém "consertar" isso depois.
      - Registrar também o caso em que o `Seq Scan` é a decisão **correta**: com 20% de memórias
        públicas e **sem** filtro de ano, o planner prefere varrer a tabela, porque 12k de 60k linhas
        casam e ele quer só as 20 mais recentes. Não é índice falhando.
- [x] E2E: `filter-memory.spec.ts` reescrito (sem o caso de input de busca) + **dois** specs novos,
      `search-dialog.spec.ts` (10 casos) e `search-page.spec.ts` (8 casos). O `search.spec.ts`
      único que este item propunha não existe: modal e página compartilham quase nada, e um
      arquivo só não diria o que quebrou. O caso "Nova Memória no header para anônimo" saiu junto
      com o CTA.

**A 7.0 não deixou nenhuma dívida de índice.** Havia uma candidata — `memories (memory_date DESC)` —
que foi registrada aqui antes e **está errada**: a medição que a motivava usava um range de data
puro, e nenhuma query do serviço é assim. Ver a nota ⚠️ do item do `EXPLAIN` acima. O plano de
índices da 7.0 está fechado e verificado.

> **Ações manuais desta fase que continuam abertas**, todas registradas em "Limitações conhecidas"
> na spec: `pnpm db:migrate` não roda contra o dev DB (bookkeeping vazio, `0000` tenta recriar
> tabelas existentes); o split UTC/local, cujo resíduo é o inverso do que o plano dizia —
> `memory-filters.tsx:20` é `getUTCFullYear()`, então para cliente a leste do UTC às 00:30 de 1º de
> janeiro a lista de anos termina no ano anterior e o novo só fica selecionável à meia-noite UTC;
> e o wizard de criação perde um dia para cliente a leste do UTC (+1..+14), porque o `JSON.stringify`
> renderiza o `Date` em UTC.

### 7.1 Uploads Resilientes
- [x] Validação de MIME e assinatura de arquivo no módulo de fotos — o mimetype
      declarado pelo cliente nunca é confiado. O serviço fareja os magic bytes do
      buffer (PNG, JPEG, GIF, WebP) e rejeita o que não corresponder a nenhum formato
      conhecido. O tipo detectado é o que vai para o banco, não o declarado — um JPEG
      chamado `.png` é armazenado como JPEG. Extensão do objeto no MinIO também vem do
      tipo detectado, nunca do nome do arquivo.
- [x] Normalização/processamento de imagem e extração de dimensões — `sharp` processa
      todo upload: aplica orientação EXIF, redimensiona para no máximo 2048px no maior
      lado (sem ampliar) e **remove todos os metadados** (EXIF, GPS, ICC) por padrão —
      foto não pode carregar localização do aparelho para o storage. Dimensões são
      extraídas do output processado. `sharp` já estava no store do pnpm como dependência
      transitiva do Next; foi promovido a dependência direta da API.
- [x] Feedback de progresso por arquivo e por memória — o wizard usa `XMLHttpRequest`
      (não `fetch`, que não expõe progresso de upload) e exibe "Enviando foto N de M..."
      no botão de submit, com o nome do arquivo atual. O botão fica desabilitado durante
      o upload.
- [x] Retry de upload individual com backoff — cada arquivo é enviado com até 3 tentativas
      e backoff exponencial (500ms, 1s, 2s). O retry é por arquivo: se um falha, os
      seguintes ainda são tentados. No backend, o `PutObjectCommand` também tem retry com
      backoff (3 tentativas, 100ms base).
- [x] Atomicidade: memórias com falha de foto não viram registro pela metade — se qualquer
      foto falhar após todas as tentativas, o wizard **deleta a memória recém-criada** via
      `DELETE /api/memories/:id` e mostra erro. A memória nunca aparece na timeline como um
      registro pela metade. No backend, se o insert no banco falha após o objeto já estar
      no MinIO, o objeto é deletado (compensação) para não deixar órfão.
- [x] Testes de upload inválido, excedente de tamanho e falha parcial — 10 testes de
      serviço (validação de assinatura, tamanho, processamento, retry, compensação), 4 de
      integração (400 para não-imagem, 201 com tipo sniffado) e 3 E2E (upload com progresso,
      rejeição de não-imagem, deleção da memória em falha parcial).

### 7.2 Filtros e IA Editorial
- [x] Inputs de clima, localização e tag na UI — `memory-filters.tsx` agora renderiza
      `weather`, `location` e `tag` além de ano e mês. O estado já existia no schema e na
      API; faltava renderizar os controles.
- [x] Filtro por artwork exposto no schema e na API — `hasArtwork` adicionado ao
      `memoryFiltersSchema` e à `findAll`. Filtra por `music_cover IS NOT NULL` (ou `IS
      NULL` quando `false`). Select na UI com "Com artwork" / "Sem artwork".
- [x] Tono (`aiMood`) selecionável pelo usuário e aplicado à regeneração da narrativa —
      `aiMood` adicionado ao `createMemorySchema` (enum: nostalgic, joyful, melancholic,
      energetic, peaceful, romantic). Select no wizard (`step-basic-info.tsx`) com "Deixar
      a IA decidir" como default. O serviço de narrativa aceita `mood` e injeta a instrução
      de tom no prompt.
- [x] Regeração parcial (só narrativa, sem tocar em data/fotos/pessoas) — o serviço de
      narrativa aceita `partial: boolean`. Quando `true`, o update só toca
      `aiNarrative`/`aiMood`/`aiThemes`. O flag é explícito para não acidentalmente
      reescrever a row inteira.
- [x] Versões da narrativa com histórico e restauração — nova tabela `narrative_versions`
      (migration `0002_productive_mongu.sql`). A cada regeneração, a narrativa atual é
      salva como versão antes de ser sobrescrita. Novas rotas: `GET
      /api/memories/:id/narrative-versions` (lista) e `POST
      /api/memories/:id/narrative-versions/:versionId/restore` (restaura).
- [x] Chips de tag/pessoa clicáveis a partir do card — tags e pessoas no card agora são
      `<button>` que navegam para `/search?q=#tag` ou `/search?q=@pessoa`. O card usa
      `useRouter` do Next.js.

### 7.3 Confiança do Usuário
- [ ] Exportação dos dados (JSON + mídia) com request autenticado e job assíncrono
- [ ] Lixeira com `deletedAt` e restauração, em vez de hard delete
- [ ] Exclusão de conta com confirmação e limpeza de MinIO
- [ ] Tela de privacidade e gestão de dados

### 7.4 Compartilhamento
- [ ] Link privado com token expirável para memórias não públicas
- [ ] Nível de acesso por memória além de público/privado
- [ ] Prévia redigida para memória compartilhada (sem dados sensíveis do autor)
- [ ] Lista de memórias compartilhadas e revogação de acesso

### 7.5 Retrospectivas
- [ ] "Há um ano" na home, com memória do período
- [ ] Resumos por período e novos itens desde a última visita
- [ ] Mapa de lugares visitados a partir de `locationLat`/`locationLng`
- [ ] Recorrências: pessoas, lugares e temas mais frequentes
- [ ] Mês/ano no formato "setembro de 2026" na timeline

### 7.6 Acessibilidade e Mobile
- [ ] Auditoria de teclado em timeline, galeria, modal de busca e wizard
- [ ] Contraste AA em todo o conjunto de cores atual
- [ ] Gerenciamento de foco em lightbox e dialogs
- [ ] Timeline em coluna única no mobile
- [ ] Wizard em passos menores no mobile
- [ ] Landmarks e `aria-live` para resultados de busca e estado de upload
