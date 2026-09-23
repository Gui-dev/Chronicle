# Task 3.6: Páginas — Detalhe Memória

## Goal

Criar a página de detalhe de memória (`/memories/[id]`) com exibição completa, galeria de fotos, player de música inline, narrativa IA e edição via rota separada (`/memories/[id]/edit`).

## Architecture

### Backend — Enriquecer `findById`

O endpoint `GET /api/memories/:id` já existe. O `MemoriesService.findById` retorna apenas a row da tabela `memories`. Precisa ser enriquecido para incluir `people`, `tags` e `photos` via queries separadas (sem JOINs complexos com drizzle).

**Response atual:**
```json
{ "data": { "id": "...", "title": "...", ... } }
```

**Response enriquecido:**
```json
{
  "data": {
    "id": "...",
    "title": "...",
    ...memory fields...,
    "people": [{ "id": "...", "name": "Ana" }],
    "tags": [{ "id": "...", "name": "viagem" }],
    "photos": [{ "id": "...", "url": "/chronicle/memories/...", "filename": "foto.jpg", "orderIndex": 0 }]
  }
}
```

**Arquivo:** `apps/api/src/modules/memories/memories.service.ts` — método `findById`

### Frontend — Hooks

Dois novos hooks no padrão existente (`use-memories.ts`, `use-create-memory.ts`):

**`use-memory.ts`**
- `useQuery` com queryKey `['memory', id]`
- `GET /api/memories/:id`
- Retorna `{ data, isLoading, error }` com memória enriquecida

**`use-update-memory.ts`**
- `useMutation` com `PUT /api/memories/:id`
- Usa `updateMemorySchema` do `@chronicle/schemas` (já existe como `createMemorySchema.partial()`)
- Invalida `['memories']` e `['memory', id]` no `onSuccess`
- Redireciona para `/memories/[id]` após salvar

### Frontend — Páginas

#### `/memories/[id]/page.tsx` — Detalhe

Layout cinematográfico com seções:

```
┌─────────────────────────────────────────┐
│ [← Voltar]               [✏️ Editar] [🗑]│
├─────────────────────────────────────────┤
│  Título da Memória                      │
│  📅 22 de set de 2026  ☁️ 25°C Ensolarado│
│  📍 São Paulo, Brasil                   │
├─────────────────────────────────────────┤
│  [Conteúdo/texto da memória]            │
├─────────────────────────────────────────┤
│  ▶ 🎵 Song - Artist                    │
│  [═══════════════════] 3:42             │
├─────────────────────────────────────────┤
│  📷 Galeria de Fotos                    │
│  [foto1] [foto2] [foto3]               │
├─────────────────────────────────────────┤
│  👥 Pessoas: Ana, João, Maria           │
│  🏷️ Tags: viagem, praia, verão         │
├─────────────────────────────────────────┤
│  ✨ Narrativa IA                        │
│  "Naquela tarde dourada..."             │
│  [Gerar narrativa] (se não existe)      │
│  Mood: nostalgico | Temas: amizade...   │
└─────────────────────────────────────────┘
```

- Client component (usa hooks)
- Loading skeleton enquanto busca
- Error state com link volta
- Botão Editar → `/memories/[id]/edit`
- Botão Deletar com confirmação (modal)
- Player de música: mini player inline (não depende do audio-player global)
- Galeria: grid responsivo 2-4 colunas com lightbox simples
- Narrativa IA: exibe se existe, senão botão "Gerar narrativa"

#### `/memories/[id]/edit/page.tsx` — Edição

Formulário único pré-preenchido (sem steps):

- Pré-preenche com dados existentes via `use-memory`
- Campos: título, conteúdo, data, localização (nome), música (track, artist, url, cover), pessoas, tags
- Validação com `updateMemorySchema`
- Botões: Salvar + Cancelar (volta para detalhe)
- Sem upload de fotos na edição (fotos via galeria no detalhe)
- Redireciona para `/memories/[id]` após salvar

### Frontend — Componentes

| Componente | Responsabilidade |
|---|---|
| `photo-gallery.tsx` | Grid responsivo de fotos com lightbox |
| `memory-detail-header.tsx` | Título, data, localização, botões ação (editar/deletar/voltar) |
| `memory-music-player.tsx` | Mini player inline com play/pause, barra de progresso |
| `narrative-section.tsx` | Exibe narrativa IA + botão gerar + mood/themes |
| `memory-metadata.tsx` | Pessoas e tags como chips |

Todos são `'use client'` (usam hooks/interação).

### File Structure

```
apps/web/src/
├── app/(dashboard)/memories/[id]/
│   ├── page.tsx              → página detalhe
│   └── edit/page.tsx         → página edição
├── components/
│   ├── photo-gallery.tsx     → galeria de fotos
│   ├── memory-detail-header.tsx → header com botões
│   ├── memory-music-player.tsx  → mini player
│   ├── narrative-section.tsx    → narrativa IA
│   └── memory-metadata.tsx      → pessoas/tags chips
├── hooks/
│   ├── use-memory.ts         → query single
│   └── use-update-memory.ts  → mutation update

apps/api/src/modules/memories/
└── memories.service.ts       → enriquecer findById
```

## Data Flow

1. User clica em memory-card (timeline) → navega para `/memories/[id]`
2. `use-memory(id)` faz `GET /api/memories/:id` → retorna memória enriquecida
3. Página renderiza: header, conteúdo, player, galeria, metadata, narrativa
4. User clica "Gerar narrativa" → `POST /api/memories/:id/generate-narrative` → atualiza narrativa
5. User clica "Editar" → navega para `/memories/[id]/edit`
6. Edit page carrega dados via `use-memory(id)`, pré-preenche formulário
7. User salva → `PUT /api/memories/:id` via `use-update-memory` → volta para detalhe

## Testing

- `use-memory.test.ts` — testa hook de query (mock API response)
- `use-update-memory.test.ts` — testa hook de mutation (mock API)
- Componentes testados via render + assertions básicas

## Constraints

- Seguir padrões existentes: `'use client'`, `api` do `@/lib/api-client`, Tanstack Query
- Imports UI via `@chronicle/ui`
- kebab-case para arquivos
- BiomeJS lint/format
- Conventional Commits em inglês
- Sem `any` types
