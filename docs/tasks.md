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
- [ ] Exibição completa da memória
- [ ] Galeria de fotos
- [ ] Player de música associada
- [ ] Narrativa IA (gerar/exibir)
- [ ] Edição de memória
- [ ] Hook use-update-memory

### 3.7 Storybook
- [ ] Documentar todos os componentes
- [ ] Criar stories para memory-card
- [ ] Criar stories para audio-player
- [ ] Criar stories para photo-gallery
- [ ] Criar stories para memory-filters
- [ ] Criar stories para timeline-marker

---

## Fase 4: Testes E2E

### 4.1 Setup Playwright
- [ ] Configurar Playwright
- [ ] Criar fixtures de teste
- [ ] Configurar variáveis de ambiente para E2E

### 4.2 Fluxos E2E
- [ ] Teste: Registro + Login
- [ ] Teste: Criar memória completa
- [ ] Teste: Visualizar timeline
- [ ] Teste: Filtrar memórias
- [ ] Teste: Editar memória
- [ ] Teste: Deletar memória
- [ ] Teste: Upload de fotos
- [ ] Teste: Buscar música

---

## Fase 5: Polish e Deploy

### 5.1 UX
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Toasts/notificações
- [ ] Responsividade mobile

### 5.2 Performance
- [ ] Otimização de imagens (Next/Image)
- [ ] Lazy loading
- [ ] Cache de queries (Tanstack Query)
- [ ] Prefeitura de rotas

### 5.3 Deploy
- [ ] Definir hospedagem (VPS/Railway/Fly.io)
- [ ] Configurar CI/CD
- [ ] Variáveis de ambiente em produção
- [ ] Domínio + SSL
