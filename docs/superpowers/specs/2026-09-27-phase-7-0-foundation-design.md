# Fase 7.0 — Fundação (performance, busca, qualidade): Design

Data: 2026-09-27

## Objetivo

Primeira das 7 fases derivadas das 11 melhorias propostas. Ataca o custo de leitura
da timeline, entrega a busca como recurso de primeira classe e resolve a dívida de qualidade
revelada pela auditoria.

Três frentes independentes, nenhuma bloqueia a outra:

| # | Frente | Entrega |
|---|--------|---------|
| A | Performance | Consultas sargáveis, índices, N+1 eliminado |
| B | Busca | Gramática de prefixos, modal no header, página `/search` |
| C | Qualidade | `any` eliminados, debounce extraído, E2E de busca realocado |

## Contexto verificado

Fatos levantados na auditoria, que motivam o desenho:

- `memories` só tem índice primário. As tabelas junction (`memory_photos`, `memory_people`,
  `memory_tags`) **também não têm índice em `memory_id`**, o que torna o N+1 pior do que parecia.
- `memories.service.ts` faz 3 queries por memória (fotos, pessoas, tags): `4 + 3N` no total.
- Filtros de ano e mês usam `EXTRACT(YEAR FROM memory_date) = 2026`, que **não é sargável** —
  um índice em `memory_date` nunca seria usado por eles.
- `navbar.tsx` faz `router.push('/search')`, mas **a rota `/search` não existe** (404).
- A página de detalhe foi removida na 6.3, então um resultado de busca não tem para onde navegar.
- O `useForm<any>` do wizard e dois outros pontos geram warnings `noExplicitAny` (lint passa,
  mas com 3 avisos).

## 1. Performance

### 1.1 Predicados de data sargáveis

Substituir `EXTRACT(...)` por intervalo semiaberto em `apps/api/src/modules/memories/memories.service.ts`:

```ts
function dateRange(year: number, month?: number) {
  const start = month ? Date.UTC(year, month - 1, 1) : Date.UTC(year, 0, 1)
  const end = month ? Date.UTC(year, month, 1) : Date.UTC(year + 1, 0, 1)
  return { start: new Date(start), end: new Date(end) }
}
```

Aplicado com `gte` / `lt` sobre `memories.memoryDate`.

> **`memoryDate` é `timestamp(..., { mode: 'date' })`, não `date`.** O `EXTRACT` atual usa o
> `TimeZone` da sessão do Postgres, enquanto o intervalo usa UTC. Antes de trocar, adicionar um
> teste que exija **conjunto de resultados idêntico** ao predicado atual para dados que cruzam
> 31/12 e 01/01. Se divergir, construir os limites no fuso da sessão em vez de UTC.

### 1.2 Índices

Btree, declarados no schema Drizzle (surgem via `pnpm db:generate`):

```sql
CREATE INDEX memories_user_date_idx    ON memories (user_id, memory_date DESC);
CREATE INDEX memory_photos_memory_idx  ON memory_photos (memory_id);
CREATE INDEX memory_people_memory_idx  ON memory_people (memory_id);
CREATE INDEX memory_tags_memory_idx    ON memory_tags (memory_id);
CREATE INDEX memory_tags_name_idx      ON memory_tags (name);
```

Feed público como índice parcial, que é menor e mais rápido que `(is_public, memory_date)`:

```sql
CREATE INDEX memories_public_date_idx ON memories (memory_date DESC) WHERE is_public = true;
```

### 1.3 `pg_trgm` para busca com wildcard

`search`, `location` e `weather` casam com `ilike '%termo%'`. Wildcard à esquerda não usa btree,
então sem trigram a busca nova continua sendo seq scan — exatamente o custo que esta fase remove.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX memories_title_trgm_idx    ON memories USING gin (title gin_trgm_ops);
CREATE INDEX memories_content_trgm_idx  ON memories USING gin (content gin_trgm_ops);
CREATE INDEX memories_location_trgm_idx ON memories USING gin (location_name gin_trgm_ops);
CREATE INDEX memories_weather_trgm_idx  ON memories USING gin (weather_desc gin_trgm_ops);
```

> **Esses quatro NÃO vão no schema Drizzle.** Os testes de DB usam SQLite in-memory e constroem as
> tabelas a partir do schema; `gin_trgm_ops` e `CREATE EXTENSION` não existem lá e o `db:push`
> quebraria. Fica só como SQL na migration, gerado à mão.

Divisão de responsabilidades: btree no schema (gerenciado pelo drizzle-kit, sobrevive a futuros
`db:generate`), trigram só na migration (depende da extensão).

### 1.4 Eliminar o N+1

Em `memories.service.ts`, trocar as 3 queries por memória por 3 queries no total da página,
usando `inArray` e agrupando em memória:

```ts
const ids = memories.map((m) => m.id)
const [photoRows, peopleRows, tagRows] = await Promise.all([
  db.select().from(memoryPhotos).where(inArray(memoryPhotos.memoryId, ids)),
  db.select().from(memoryPeople).where(inArray(memoryPeople.memoryId, ids)),
  db.select().from(memoryTags).where(inArray(memoryTags.memoryId, ids)),
])
```

De `4 + 3N` para **5 constantes**, independente do tamanho da página. Preservar a ordem original
das relações (por `createdAt`) dentro de cada grupo, senão a galeria embaralha.

## 2. Busca

### 2.1 Gramática

Um único input cobre todas as dimensões:

| Sintaxe | Casa |
|---------|------|
| `@bruce` | autor (`users.name` OU `users.email`) |
| `#festa` | tag |
| `ano:2026` | ano |
| `mes:9` \| `mes:setembro` | mês |
| `clima:sol` | clima |
| `local:praia` | localização |
| `"fase com espaço"` | frase exata em título/conteúdo |
| `praia sol` | texto solto em título OU conteúdo |

Combina com AND **entre dimensões distintas**: `#festa local:praia ano:2026`.

Decisões de parsing:

- **Prefixo desconhecido** (`foo:bar`) é tratado como texto literal. A gramática nunca falha.
- **Termos soltos são AND entre si**, OR dentro de cada termo (título OU conteúdo).
  `"praia sol"` = as duas palavras presentes; cada uma em título ou conteúdo.
- **Validação:** `ano:` entre 2000–2100, `mes:` entre 1–12 ou nome em pt-BR. Valor inválido vira texto.
  O valor tem de ser um inteiro de dígitos simples — `ano:2e3` e `ano:0x7d2` viram texto.
- **`month` com `year` ausente** usa o ano corrente.
- Query vazia ou só com pontuação → sem condições (não é erro).
- **Valor sem caractere de palavra não é um valor.** `clima:#` e `clima:---` não viram condição nem
  texto: são descartados. É a regra que faz uma query só com pontuação não produzir condição
  nenhuma.
- **Valor de dimensão é um token só.** `local:praia do norte` é `local:praia` **AND** texto
  `do norte`, que é quase sempre zero resultado. Valor com espaço precisa de aspas:
  `local:"praia do norte"`. Mesma convenção de busca do GitHub e do Slack.
- **Dentro de uma dimensão, o último valor ganha.** `@bruce @deb` é `author: deb`;
  `clima:sol clima:chuva` é `clima: chuva`; `ano:2026 ano:2020` é `2020`. O perdedor **não** vira
  texto solto — autor mora em `users.name`/`users.email`, então um `ilike '%@deb%'` em
  `title`/`content` nunca casaria e só estreitaria o resultado em silêncio. Tags repetidas
  colapsam; tags distintas continuam sendo AND.

### 2.2 Parser puro, compartilhado

`packages/schemas/src/search-query.ts`, sem dependência de Drizzle nem de Fastify.

> **Emenda ao spec original**, que previa `apps/api/src/modules/memories/search-query.ts` e uma
> gramática "só no servidor". A razão declarada aqui era impedir divergência entre o web e a
> API, e uma implementação única em pacote compartilhado serve essa razão melhor do que uma
> cópia no servidor que o web reimplementaria por conta. O web precisa parsear de verdade, porque
> a página de resultados renderiza chips a partir dos campos parseados e a remoção de chip muta o
> objeto parseado. O que segue proibido é o web *decidir* o que um prefixo significa.

```ts
export interface ParsedSearchQuery {
  text: string[]
  phrases: string[]
  author: string | null
  tags: string[]
  year: number | null
  month: number | null
  weather: string | null
  location: string | null
}

export function parseSearchQuery(input: string): ParsedSearchQuery
export function serializeSearchQuery(q: ParsedSearchQuery): string
```

`serialize` existe porque é o que permite os chips removíveis reescrevendo a URL.

A gramática vive **só no servidor**. O cliente nunca interpreta prefixo, o que impede a
divergência entre web e qualquer consumidor futuro da API.

### 2.3 Nenhum parâmetro novo na API

O campo `search` de `memoryFiltersSchema` continua sendo o único param de texto e agora aceita
a gramática inteira. Texto solto mantém o comportamento atual, então a mudança é aditiva e
`filter-memory.spec.ts` continua fazendo sentido no servidor.

`@autor` exige join em `users` — nova condição, sem novo parâmetro.

A resposta passa a incluir a query canônica parseada, para que os chips venham do servidor em
vez de reparseados no cliente:

```ts
{ data: Memory[], pagination: {...}, searchMeta: ParsedSearchQuery | null }
```

`searchMeta` é `null` quando `search` não foi enviado. Adicionar como campo opcional em
`PaginatedResponse` — mudança compatível.

### 2.4 Modal = descoberta

Novo `apps/web/src/components/search-dialog.tsx` ('use client'), reusando `Dialog` do
`@chronicle/ui`. Resultados **compactos** (título, data, local, contagem de fotos), não
`MemoryCardFull` — card completo dentro de modal é pesado e duplica a timeline.

- Ícone de busca no header abre (conserta o 404); `Cmd/Ctrl+K` e `/` também.
- Debounce de 300ms, `limit: 20`, sem paginação dentro do modal.
- Setas navegam, `Enter` abre, `Esc` fecha. Foco restaurado ao fechar (mesmo cuidado do
  `photo-gallery.tsx`, que teve esse problema).
- Rodapé "Ver todas as N memórias" → `/search?q=<texto original>`.
- Anônimo pode buscar: vê apenas memórias públicas, mesma regra do feed.

### 2.5 `/search?q=` = página de verdade

`apps/web/src/app/(dashboard)/search/page.tsx`, Server Component que lê `searchParams.q` e
renderiza o client component `SearchResults`.

Reaproveita `MemoryTimeline` quase sem código novo — ele já resolve `isOwner` internamente
(linha 110), skeleton, erro com retry, estado vazio e paginação. Passa a receber a query da
URL em vez do estado local.

`MemoryTimeline` hoje assume que a lista vem do feed: o componente `SearchResults` só troca a
origem dos dados e os textos de vazio.

**Chips removíveis** no topo, derivados de `searchMeta` (portanto canônicos):

```
[ @bruce × ] [ #festa × ] [ ano:2026 × ]        14 memórias
```

Remover um chip = `serializeSearchQuery` sem aquela dimensão → `router.replace('/search?q=…')`.
Isso torna a linguagem de prefixos **visível e editável sem digitá-la** — quem não sabe que
`#festa` existe descobre olhando. É o que justifica a página existir em vez de só o modal.

A página é pública (o feed é público); logado vê públicas + as próprias.

### 2.6 Header

- Busca: ícone abre o modal, em vez de `router.push('/search')`.
- "Nova Memória" entra no header: logado → `/memories/new`; anônimo → `/login`, mesma regra do
  CTA da home. Ícone-only abaixo de `sm`.
- Timeline perde o `<Input>` de busca e o `search` sai do `useFilters` da página; sobram ano e mês.

## 3. Qualidade

- `apps/web/src/components/create-memory-wizard.tsx:58` — `useForm<any>` →
  tipo derivado do schema Zod.
- `apps/api/src/server.ts:21` — error handler sem `any` explícito.
- `apps/api/src/modules/auth/auth.routes.spec.ts:25` — cast do mock.
- `useDebouncedValue` extraído para `apps/web/src/hooks/`; usado pelo `SearchDialog`.
  O effect artesanal de debounce sai de `memory-filters.tsx` (que agora só tem ano/mês, sem
  input de texto — pode nem precisar mais dele).
- `apps/web/src/__tests__/filter-memory.spec.ts:41` é o **único** spec que preenche
  `[data-testid="search"]` e precisa ser reescrito para o modal.

## Fora de escopo

- Processamento/normalização de imagem — é da 7.1.
- Chips de tag/pessoa como filtro, reflow da timeline, drawer de detalhe — 7.2.
- Busca por `weatherTemp`, `musicTrack`/`musicArtist` (existe spec E2E de música): a gramática
  não ganha token novo agora, texto solto já casa o título/conteúdo.
- Índice trigram em `users.name`: poucas linhas, ganho desprezível.

## Testes / verificação

**Unitário (novo, puro)**
- `search-query.spec.ts`: tabela de casos — cada dimensão isolada, combinações, frase com
  espaço, prefixo desconhecido, acento/caixa, ano e mês inválidos, query vazia, mês por nome.
  Round-trip `parse → serialize → parse`.

**Unitário (serviço)**
- Contagem de queries **constante** com página de 20 memórias (instrumentar o drizzle ou
  contar via mock) — trava o N+1.
- Igualdade de conjunto entre `EXTRACT` e o intervalo, com dados cruzando 31/12 e 01/01.
- Busca por autor, tag, local e clima; texto solto; combinação AND.

**Integração**
- `memories.integration.test.ts`: `GET /api/memories?search=…` para cada dimensão, `searchMeta`
  correto, paginação preservada.

**E2E (Chromium)**
- `filter-memory.spec.ts` reescrito: abre modal, digita, vê resultado.
- Novo `search.spec.ts`: modal, chips removíveis alterando a URL, `/search` renderizando cards,
  busca anônima só com públicas, "Nova Memória" no header para logado e anônimo.

**Verificação de índice**
- `EXPLAIN ANALYZE` da timeline e de `search=#festa` confirmando Index Scan / Bitmap Index Scan
  em vez de Seq Scan.

**Gates:** `pnpm lint` sem avisos novos, `pnpm typecheck`, `pnpm test:unit`, `pnpm test` completo.
