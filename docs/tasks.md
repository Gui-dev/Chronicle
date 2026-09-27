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
- [ ] `EXTRACT` de ano/mês reescrito como intervalo (predicado sargável)
- [ ] Teste de equivalência: intervalo == `EXTRACT` para dados cruzando 31/12 e 01/01
- [ ] Índices btree: `(user_id, memory_date DESC)`, `memory_date DESC WHERE is_public`,
      `memory_photos/people/tags(memory_id)`, `memory_tags(name)`
- [ ] `CREATE EXTENSION pg_trgm` + índices GIN em `title`, `content`, `location_name`, `weather_desc`
      (só na migration, nunca no schema — SQLite in-memory não suporta)
- [ ] N+1 eliminado: 3 queries em lote com `inArray` + agrupamento (`4 + 3N` → 5 constantes)
- [ ] Teste que trava a contagem constante de queries
- [ ] `search-query.ts`: parser da gramática de prefixos + testes unitários
- [ ] Busca na API: query parseada → condições Drizzle (AND entre dimensões)
- [ ] Busca por autor (`@user`) via join em `users`
- [ ] `searchMeta` na resposta (query canônica, para os chips virem do servidor)
- [ ] `SearchDialog` no header: debounce 300ms, `Cmd/Ctrl+K` e `/`, setas+Enter, foco restaurado
- [ ] Página `/search?q=` reaproveitando `MemoryTimeline` (conserta o 404 existente)
- [ ] Chips removíveis da query parseada reescrevendo a URL
- [ ] "Nova Memória" no header (logado → `/memories/new`, anônimo → `/login`)
- [ ] Input de busca sai dos filtros da timeline; `search` sai do `useFilters` da página
- [ ] `useDebouncedValue` extraído para `apps/web/src/hooks/`
- [ ] 3 `noExplicitAny` eliminados (wizard, `server.ts`, `auth.routes.spec.ts`)
- [ ] `EXPLAIN ANALYZE` confirmando Index/Bitmap Index Scan em vez de Seq Scan
- [ ] E2E: `filter-memory.spec.ts` reescrito + novo `search.spec.ts`

### 7.1 Uploads Resilientes
- [ ] Validação de MIME e assinatura de arquivo no módulo de fotos
- [ ] Normalização/processamento de imagem e extração de dimensões
- [ ] Feedback de progresso por arquivo e por memória
- [ ] Retry de upload individual com backoff
- [ ] Atomicidade: memórias com falha de foto não viram registro pela metade
- [ ] Testes de upload inválido, excedente de tamanho e falha parcial

### 7.2 Filtros e IA Editorial
- [ ] Inputs de clima, localização e tag na UI (estado já existe, falta renderizar)
- [ ] Filtro por artwork exposto no schema e na API
- [ ] Tono (`aiMood`) selecionável pelo usuário e aplicado à regeneração da narrativa
- [ ] Regeração parcial (só narrativa, sem tocar em data/fotos/pessoas)
- [ ] Versões da narrativa com histórico e restauração
- [ ] Chips de tag/pessoa clicáveis a partir do card

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
