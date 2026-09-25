# Task 5.2 — Performance: Design

Data: 2026-09-25

## Objetivo

Implementar a task 5.2 da `docs/tasks.md` (Fase 5 — Polish): otimização de imagens, lazy loading, cache de queries e prefetch de rotas. Sem mudanças de arquitetura; melhorias direcionadas em `apps/api` e `apps/web`.

## Escopo

- **Imagens**: persistir dimensões no upload; migrar de `<img>` cru para `next/image` onde há dimensões/vívia de rede.
- **Lazy loading**: `next/dynamic` para etapas do wizard, player de música do detalhe e player global do layout.
- **Cache**: debounce na busca de memórias; remover refetch desnecessário no update; evitar refetch ao trocar de aba.
- **Prefetch**: `loading.tsx` nos segmentos dinâmicos e ajuste da prop `prefetch` dos Links (sem `router.prefetch` manual, sem `dehydrate`/`HydrationBoundary`).

## 1. Otimização de imagens

### Backend (`apps/api`)

1. **Dependência**: adicionar `image-size` no workspace `@chronicle/tooling` de `apps/api` (ou `apps/api` como dependência direta) para extrair `width`/`height` de um `Buffer`. É puro JS, sem binários.

2. **Schema** (`packages/db/src/schema/memory-photos.ts`): adicionar
   - `width: integer('width')` (nullable)
   - `height: integer('height')` (nullable)
   Rodar `pnpm db:generate` + `pnpm db:push` (ou SQL manual, dado o gotcha de vitest/drizzle-kit).

3. **Upload** (`apps/api/src/modules/photos/photos.service.ts:upload`): antes de montar o `value` do insert, medir dimensões com `image-size` a partir de `file.buffer` (protegido por try/catch — imagem inválida não pode derrubar o upload):

   ```ts
   let width: number | null = null
   let height: number | null = null
   try {
     const dims = imageSize(file.buffer)
     width = dims.width ?? null
     height = dims.height ?? null
   } catch {
     // mantém null para formatos não suportados
   }
   ```

   Incluir `width`/`height` no `.values({ ... })`.

4. **Propagação automática**: `findById` e o enricher de listagem devolvem `photos: photoRows` diretamente — as novas colunas passam a aparecer na resposta sem tocar no serializer.

### Frontend (`apps/web`)

5. **Tipos** (`hooks/use-memories.ts` e `components/photo-gallery.tsx` `GalleryPhoto`): adicionar `width: number | null` e `height: number | null`.

6. **`next.config.ts`**: completar `remotePatterns` para hospedeiros externos de imagens:
   - capas de música do Spotify — host `i.scdn.co`, protocol https (as URLs vêm de `album.images[].url` no proxy `spotify.service.ts` e chegam como `musicCover`).
   - As fotos do MinIO são servidas por rewrite do Next para `localhost:9000` com URL relativa (`/chronicle-uploads/...`); manter o `remotePattern` de `localhost` já existente se necessário para o `next/image`.

7. **Migrations de componentes** para `next/image` (usando `Image` de `next/image`, `width`/`height` do banco e `sizes`):
   - `components/photo-gallery.tsx` — thumbnails (`aspect-square`) e lightbox.
   - `components/memory-card.tsx` — fotos na timeline (`h-44`).
   - `components/memory-music-player.tsx` — capa do álbum.
   - `components/steps/step-music.tsx` — capas dos resultados Spotify.
   - Sempre fornecer `width`/`height` (ou `fill` em containers com tamanho fixo). Para imagens sem dimensões persistidas (ex: dados antigos), definir fallback razoável ou `fill`.

8. **Exceções**:
   - `components/steps/step-photos.tsx` — preview usa `URL.createObjectURL` (blob): não usar `next/image`. Apenas corrigir o leak: chamar `URL.revokeObjectURL` (ex: em `useEffect` cleanup) em vez de criar a URL durante o render.
   - `components/audio-player.tsx` — `currentTrack` é sempre `null` hoje (componente não renderiza imagem); não alterar.

## 2. Lazy loading

1. **`components/create-memory-wizard.tsx`**: converter os imports das 5 etapas (`StepBasicInfo`, `StepLocation`, `StepMusic`, `StepPeople`, `StepPhotos`) para `next/dynamic` com `loading` fallback (spinner/skeleton). Apenas a etapa ativa é baixada.

2. **`app/(dashboard)/memories/[id]/page.tsx`**: `MemoryMusicPlayer` passa a ser `next/dynamic` (importado só quando a memória tem música).

3. **`app/(dashboard)/layout.tsx`**: `AudioPlayer` passa a ser `next/dynamic` — evita o peso do player no shared layout de todas as rotas do dashboard.

## 3. Cache de queries

1. **Debounce na busca** (`components/memory-filters.tsx:43-48`): o `onChange` do campo `search` dispara `onFilterChange('search', ...)` por tecla. Criar pequeno hook `use-debounced-value` (ou debounce inline ~300ms) para só atualizar o filtro após pausa de digitação. Isso elimina a avalanche de queries por tecla mantidas no cache (`gcTime` default 5min).

2. **Update sem refetch supérfluo** (`hooks/use-update-memory.ts:15-28`): hoje `onSuccess` invalida `['memory', id]` e `['memories']` e navega, mas o refetch da query de detalhe ativa pode acontecer antes do push. Ajustar ordem: `await queryClient.cancelQueries` das chaves afetadas e invalidar antes do `router.push`.

3. **Não refetch por foco de janela** (`lib/query-client.ts`): adicionar `refetchOnWindowFocus: false` às queries (mantendo `staleTime: 60s`). Evita refetch de listas ao alternar de aba. Não adicionar server-side.

## 4. Prefetch de rotas

1. **`loading.tsx`** nos três segmentos dinâmicos (Next só prefetcha rotas dinâmicas em produção se houver `loading.js`):
   - `app/(dashboard)/memories/[id]/loading.tsx`
   - `app/(dashboard)/memories/[id]/edit/loading.tsx`
   - `app/(dashboard)/memories/new/loading.tsx`
   Reutilizar o padrão de loading existente (`Loader2` central + card skeleton como no dashboard).

2. **Tuning da prop `prefetch` dos Links**:
   - Manter default (`auto`) nos caminhos principais: cards da timeline (`memory-card.tsx`), CTA "Nova memória". `auto` em produção prefetcha segmentos estáticos/dinâmicos com loading boundary.
   - `prefetch={false}` em links auxiliares/estáticos: login/register (rotas de auth), "Voltar"/"/" em headers e wizard — não precisam aquecer rota de dados.

## Fora de escopo

- `dehydrate`/`HydrationBoundary` ou prefetch de dados no servidor (Server Components).
- `router.prefetch()` manual no hover.
- Re-encode/redimensionamento server-side das fotos (apenas medir dimensões).
- Refactor do `audio-player` global (sem faixa definida hoje).

## Testes / verificação

- **API**: testes existentes de upload de fotos continuam verdes; adicionar caso onde `width`/`height` são retornados (ou validar que null quando formato inválido).
- **Web**: `pnpm typecheck` e `pnpm lint` verdes; rodar `pnpm --filter web test:e2e` ao final com servidores no ar para confirmar que timeline, detalhe, criação e edição seguem funcionais.
- **Manual**: subir app, abrir timeline/detalhe com memória que tem fotos; conferir que `next/image` renderiza e `loading.tsx` aparece em navegação.