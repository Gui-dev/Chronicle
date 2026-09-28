# Fase 7.0 — Fundação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar o N+1 da timeline, tornar as consultas sargáveis e indexadas, entregar a busca em duas superfícies (modal no header + página `/search`) com gramática de prefixos, e zerar a dívida de qualidade auditada.

**Architecture:** Três frentes independentes, cada uma com testes e commit próprios. **A (performance)** reescreve predicados de data como intervalos e troca 3N queries por 5 constantes, adicionando índices btree via Drizzle e trigram via migration. **B (busca)** implementa um parser puro da gramática em `@chronicle/schemas` (importado tanto pela API quanto pelo web, sem duplicação), expondo as dimensões via um único parâmetro `search`. **C (qualidade)** remove os `any` e realoca o spec E2E de busca.

**Tech Stack:** Fastify 5, Drizzle ORM (PostgreSQL), Zod, React 19, Next.js 16 App Router, TanStack Query, shadcn/Radix via `@chronicle/ui`, Vitest, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-09-27-phase-7-0-foundation-design.md`

---

## Pré-requisitos descobertos na auditoria do código

Estes fatos mudam o desenho e **não** estão no spec. Cada task abaixo já os resolve:

1. `packages/db/src/index.ts:5` exporta apenas `{ eq, and, or, ilike, sql, desc, asc }` de `drizzle-orm`. **`gte`, `lt` e `inArray` não são exportados** — precisam ser adicionados (Task 1).
2. `memories.service.spec.ts` faz `vi.mock('@chronicle/db')` com um `SelectChain` fake. O mock **não expõe `inArray`, `gte`, `lt`, `leftJoin` nem a tabela `users`** — cada task que precisar disso estende o mock.
3. **Nenhum teste do repo roda `memoriesService` contra banco real.** `memories.integration.test.ts` é nome enganoso: mocka o service e testa só as rotas. Consequência: equivalência de predicado e uso de índice **não são automatizáveis** hoje e viram verificação manual (Task 5). Automatizar exigiria um harness de Postgres real, fora do escopo da 7.0.
4. `memoryDate` é `timestamp(..., { mode: 'date' })`, não `date`. O `EXTRACT` atual usa o `TimeZone` da sessão do Postgres; o intervalo usa UTC. Daí a verificação manual obrigatória da Task 5.
5. `useFilters` expõe `search` como chave comum de `MemoryFiltersInput`; o `MemoryTimeline` já resolve `isOwner` internamente (linha 110) e tem skeleton, erro com retry, vazio e paginação — a página `/search` reaproveita tudo.
6. `user-menu.spec.ts:21,43` dependem de `data-testid="menu-nova"` (o item "Nova Memória" do dropdown). **`search-button` não é usado por nenhum spec.** Só um spec quebra com a remoção do input de busca: `filter-memory.spec.ts:41`.
7. `MemoryData` em `helpers.ts` não aceita `weatherDesc`, mas `createMemorySchema:32` aceita. O helper precisa ser estendido para o E2E de `clima:`.
8. **Nomes dos pacotes de workspace:** `apps/api` chama-se `api` e `apps/web` chama-se `web` — **sem** o escopo `@chronicle/`, que só existe em `packages/*`. O filtro `pnpm --filter @chronicle/api` não casa com nada. Use `pnpm --filter api` e `pnpm --filter web`.
9. **`pnpm --filter api test -- -t 'nome'` não filtra.** O `--` é repassado literalmente e o vitest ignora o `-t`, rodando a suíte inteira — o passo "rodar para confirmar que falha" passaria à toa. A forma que filtra é `pnpm --filter api exec vitest run -t 'nome'`.
10. **Mês sem ano encolhe para o ano corrente, e isso é uma armadilha de UI.** O spec (linha 134) decide que `month` com `year` ausente usa o ano corrente, e é o que a Task 2 implementa. O comportamento antigo trazia setembro de *todos* os anos. Nos dois `mes:9` da busca isso é inofensivo, mas em `memory-filters.tsx` os `<select>` de ano e mês são independentes: escolher "Setembro" com "Ano" vazio passa a esconder todas as memórias de setembro dos anos anteriores, sem nenhuma indicação na UI. A Task 13 tem de fechar isso — ao escolher um mês, o ano tem de passar a corrente, ou o mês tem de ficar desabilitado até haver ano.
11. **Ano corrente em UTC no backend, ano local no cliente — split conhecido e não resolvido nesta fase.** O serviço usa `getUTCFullYear()` e o `memory-filters.tsx:14` monta a lista de anos com `getFullYear()`. No caminho dos parâmetros REST o ano explícito vence e o usuário vê um resultado coerente, mas no caminho da busca, `mes:1` digitado às 00:30 de 1º de janeiro em UTC-3 faz o backend escolher o ano **UTC**, um atrás do ano em que a memória foi vivida. A raiz disso é o mesmo item do `SHOW TimeZone` da Task 5: `localDate` grava meia-noite local e o intervalo compara instantes UTC, então uma memória criada exatamente à meia-noite local do último dia do mês cai no mês seguinte. Não é regressão — o `EXTRACT` tinha o mesmo corte — mas registrar aqui para a fase de busca por documentos decidir se quer corrigir.
12. `apps/web` **não tem** script `test`, só `test:e2e`. Por isso `pnpm test` na raiz roda 8 tarefas e o web não aparece entre elas. Baseline da API: 17 arquivos, 101 testes. `memories.service.spec.ts` sozinho tem 21.

## Desvios documentados do spec

Três pontos em que o plano diverge do spec, todos com razão:

1. **Parser em `@chronicle/schemas`, não em `apps/api`.** O spec §2.2 manda o parser morar na API. Mas a página `/search` precisa de `serializeSearchQuery` para reescrever a URL ao remover um chip, e o web não importa da `apps/api`. Colocar as duas funções em `@chronicle/schemas` mantém **uma** implementação servindo dois consumidores — o que é exatamente o que o spec quer ao dizer que a gramática não pode existir em dois lugares. A API continua sendo a única que *interpreta* a query; o web só serializa.
2. **CTA no header apenas para logados.** O spec manda mostrar para logado **e** anônimo (`/login`). Isso criaria dois botões indo para `/login` no header de anônimos, já que o header anônimo mostra "Entrar". O anônimo já tem "Entrar" persistente, que cobre o mesmo caminho.
3. **Resultado do modal navega para `/memories/[id]/edit`.** O spec não diz o que acontece ao clicar, porque a pergunta foi respondida com a decisão da página `/search`. Como a página de detalhe foi removida na 6.3, o modal leva à edição para o dono da memória e não faz nada para memórias públicas de terceiros — que continuam acessíveis pela timeline. Uma prévia dentro do modal é trabalho extra e fica de fora.

## Bugs evitados neste plano

Encontrados ao revisar o próprio plano antes de executar:

- O atalho `Cmd/Ctrl+K` não pode viver dentro do `SearchDialog`: o listener só existiria com a modal **aberta**, então nunca abriria a modal. Fica na `Navbar`, registrado sempre (Task 12).
- O `onQueryChange` do `SearchDialog` era um prop sem consumidor. Removido (Task 11).

---

# Frente A — Performance

### Task 1: Exportar `gte`, `lt`, `inArray` e os tipos de linha

**Files:**
- Modify: `packages/db/src/index.ts:1-5`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts` (mock)

- [ ] **Step 1: Exportar os operadores e os tipos**

`packages/db/src/index.ts` hoje exporta os operadores mas não os tipos, e `./schema` já os
declara. A Task 3 precisa de `Memory` e `MemoryPhoto` para anotar o lote:

```ts
// packages/db/src/index.ts
export { db } from './drizzle'
export { env } from './env'
export { users, memories, memoryPeople, memoryTags, memoryPhotos } from './schema'
export type { Memory, MemoryPhoto, MemoryPerson, MemoryTag } from './schema'
export { eq, and, or, ilike, sql, desc, asc, gte, lt, inArray } from 'drizzle-orm'
```

- [ ] **Step 2: Estender o mock do spec com `gte`, `lt` e `inArray`**

Em `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`, dentro do `vi.mock('@chronicle/db', ...)`, adicionar após a definição de `ilike`:

```ts
  const gte = (col: unknown, value: unknown) => ({ op: 'gte', col, value })
  const lt = (col: unknown, value: unknown) => ({ op: 'lt', col, value })
  const inArray = (col: unknown, values: unknown) => ({ op: 'inArray', col, values })
```

E adicionar `gte, lt, inArray` ao objeto retornado pelo mock:

```ts
  return { ...tables, eq, or, and, ilike, sql, desc, asc, gte, lt, inArray, db }
```

- [ ] **Step 3: Verificar que nada quebrou**

Run: `pnpm --filter api test`
Expected: PASS — todos os specs do módulo `memories` continuam verdes.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/index.ts apps/api/src/modules/memories/__tests__/memories.service.spec.ts
git commit -m "feat(db): export gte, lt and inArray for range and batch queries"
```

---

### Task 2: Predicados de data sargáveis

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts:105-111`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Adicionar um helper que achata as condicoes no mock**

O servico empurra todos os predicados num array e chama `and(...conditions)` uma vez so. O mock
registra apenas o topo da cadeia, ou seja `memoryConditions[0]` e `{ op: 'and', conds: [...] }`.
Filtrar `memoryConditions` por `op === 'gte'` no nivel de topo devolve `[]` - dai o helper, que
desce um nivel. Definir no escopo do modulo do spec, **depois** do `vi.hoisted`:

```ts
// The service wraps every predicate in a single and(...), and the mock records
// only the top of the chain, so assertions have to descend into `.conds`.
const memoryOps = (op?: string) => {
  const flat = mocks.state.memoryConditions.flatMap((c) => {
    const condition = c as { op: string; conds?: unknown[] }
    return condition.op === 'and' && condition.conds ? condition.conds : [c]
  })
  return op ? flat.filter((c) => (c as { op: string }).op === op) : flat
}
```

- [ ] **Step 2: Escrever o teste que falha**

Adicionar em `describe('findAll')`:

```ts
    it('uses a sargable range for the year filter instead of EXTRACT', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, year: 2026 })

      expect(JSON.stringify(memoryOps())).not.toContain('EXTRACT')

      const range = [...memoryOps('gte'), ...memoryOps('lt')]
      expect(range).toHaveLength(2)

      const [start, end] = range as Array<{ value: Date }>
      expect(start.value.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(end.value.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    })

    it('narrows the range to a single month when month is given', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, year: 2026, month: 9 })

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>

      expect(range[0].value.toISOString()).toBe('2026-09-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    })
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter api exec vitest run -t 'sargable'`
Expected: FAIL — `EXTRACT` ainda está nas condições.

- [ ] **Step 4: Implementar o intervalo**

Em `memories.service.ts`, adicionar `gte` e `lt` aos imports de `@chronicle/db` e substituir o bloco de `year`/`month`:

```ts
import {
  and,
  db,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  memories,
  memoryPeople,
  memoryPhotos,
  memoryTags,
  or,
  sql,
  users,
} from '@chronicle/db'
```

```ts
// A range predicate, not EXTRACT: `EXTRACT(YEAR FROM memory_date) = 2026` wraps
// the column in a function, so Postgres can never satisfy it with an index.
// A half-open interval over the raw column is sargable. Bounds are UTC because
// memoryDate is a `timestamp` fed by the localDate schema.
function dateRange(year: number, month?: number) {
  return {
    start: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
    end: new Date(Date.UTC(year, month ?? 12, 1)),
  }
}
```

Substituindo os blocos `if (year)` e `if (month)` por:

```ts
    const effectiveYear = year ?? (month ? new Date().getUTCFullYear() : undefined)

    if (effectiveYear) {
      const { start, end } = dateRange(effectiveYear, month ?? undefined)
      conditions.push(gte(memories.memoryDate, start), lt(memories.memoryDate, end))
    }
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter api test`
Expected: PASS — inclui os dois testes novos e os de privacidade existentes.

- [ ] **Step 6: Cobrir o padrão mês-sem-ano, que hoje não tem teste nenhum**

`effectiveYear` é a linha mais surpreendente do diff e é a única que muda comportamento, e
mesmo assim os dois testes novos passam `year`, então o ramo nunca é exercitado. Fixar o ano
com `vi.setSystemTime` para o teste não depender de quando roda:

```ts
    it('defaults the year to the current UTC year when only month is given', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2031-03-15T12:00:00Z'))
      try {
        await memoriesService.findAll({ page: 1, limit: 20, month: 9 })

        const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>
        expect(range[0].value.toISOString()).toBe('2031-09-01T00:00:00.000Z')
        expect(range[1].value.toISOString()).toBe('2031-10-01T00:00:00.000Z')
      } finally {
        vi.useRealTimers()
      }
    })
```

- [ ] **Step 7: Corrigir os comentários, que hoje justificam ao contrário**

O comentário do `dateRange` diz que os limites são UTC "porque `memoryDate` é `timestamp`
alimentado pelo schema `localDate`", mas `localDate` (`packages/schemas/src/local-date.ts:4-6`)
constrói `new Date(y, m-1, d, 0,0,0,0)`, isto é, **meia-noite local**. Citar `localDate`
justifica os limites locais, não os UTC — o comentário afirma uma coisa que o código não
entrega, e é justamente a crença que a sonda `SHOW TimeZone` da Task 5 existe para desafiar.
Trocar por:

```ts
// A range predicate, not EXTRACT: `EXTRACT(YEAR FROM memory_date) = 2026` wraps
// the column in a function, so Postgres can never satisfy it with an index.
// A half-open interval over the raw column is sargable. The bounds are UTC
// instants, while `localDate` stores a local wall clock, so this only matches
// the old EXTRACT when the server and the session run in UTC — checked by hand
// in Task 5.
```

E comentar o `effectiveYear`, que hoje não tem nenhum:

```ts
    // A month filter is only meaningful within a year, and the spec resolves
    // `month` without `year` to the current one. `memory-filters.tsx` sets the
    // year alongside the month so the UI never sends the bare case silently.
    const effectiveYear = year ?? (month ? new Date().getUTCFullYear() : undefined)
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/memories/memories.service.ts apps/api/src/modules/memories/__tests__/memories.service.spec.ts
git commit -m "perf(memories): use sargable date range instead of EXTRACT"
```

---

### Task 3: Eliminar o N+1

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts:147-160`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Instrumentar o mock para contar queries por tabela**

Dentro do `vi.mock`, adicionar em `mocks.state`:

```ts
    fromCalls: [] as string[],
```

E no `beforeEach` do describe, resetar `mocks.state.fromCalls = []`.

Modificar `SelectChain.from` para registrar:

```ts
    from(table: unknown) {
      this.fromTable = table
      mocks.state.fromCalls.push((table as { __table: string }).__table)
      return this
    }
```

- [ ] **Step 2: Escrever o teste que falha**

Adicionar em `describe('findAll')`:

```ts
    it('loads photos, people and tags once per page, not once per memory', async () => {
      mocks.state.rows = [
        { id: 'm1', userId: 'u1', isPublic: true },
        { id: 'm2', userId: 'u1', isPublic: true },
        { id: 'm3', userId: 'u1', isPublic: true },
        { id: 'm4', userId: 'u1', isPublic: true },
      ]

      await memoriesService.findAll({ page: 1, limit: 20 })

      const times = (table: string) =>
        mocks.state.fromCalls.filter((t) => t === table).length

      expect(times('memoryPhotos')).toBe(1)
      expect(times('memoryPeople')).toBe(1)
      expect(times('memoryTags')).toBe(1)
      // rows + count
      expect(times('memories')).toBe(2)
    })
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter api exec vitest run -t 'once per page'`
Expected: FAIL — `times('memoryPhotos')` é 4.

- [ ] **Step 4: Trocar por 3 queries em lote**

Primeiro, nos imports de `memories.service.ts`, os tipos reexportados pela Task 1:

```ts
import type { Memory, MemoryPerson, MemoryTag, MemoryPhoto } from '@chronicle/db'
```

No mock, `then()` de tabelas junction precisa devolver linhas configuráveis. Adicionar em `mocks.state`:

```ts
    junctionRows: {} as Record<string, Array<Record<string, unknown>>>,
```

E no `SelectChain.then`, antes do `return Promise.resolve([])`:

```ts
      if (this.fromTable === tables.memoryPhotos) {
        return Promise.resolve(mocks.state.junctionRows.photos ?? []).then(resolve, reject)
      }
      if (this.fromTable === tables.memoryPeople) {
        return Promise.resolve(mocks.state.junctionRows.people ?? []).then(resolve, reject)
      }
      if (this.fromTable === tables.memoryTags) {
        return Promise.resolve(mocks.state.junctionRows.tags ?? []).then(resolve, reject)
      }
```

Em `memories.service.ts`, substituir o bloco `enrichedResults` inteiro:

```ts
    // One query per relation for the whole page. The previous per-memory
    // version issued 3N queries on top of the rows and count, which made the
    // timeline cost grow with the page size.
    const enrichedResults: Array<
      Memory & { photos: MemoryPhoto[]; people: MemoryPerson[]; tags: MemoryTag[] }
    > = results.map((memory) => ({ ...memory, photos: [], people: [], tags: [] }))

    if (results.length > 0) {
      const ids = results.map((m) => m.id)
      const [photoRows, peopleRows, tagRows] = await Promise.all([
        db.select().from(memoryPhotos).where(inArray(memoryPhotos.memoryId, ids)),
        db.select().from(memoryPeople).where(inArray(memoryPeople.memoryId, ids)),
        db.select().from(memoryTags).where(inArray(memoryTags.memoryId, ids)),
      ])

      const groupByMemory = <T extends { memoryId: string }>(rows: T[]) => {
        const grouped = new Map<string, T[]>()
        for (const row of rows) {
          const bucket = grouped.get(row.memoryId)
          if (bucket) bucket.push(row)
          else grouped.set(row.memoryId, [row])
        }
        return grouped
      }

      const photoMap = groupByMemory(photoRows as MemoryPhoto[])
      const peopleMap = groupByMemory(peopleRows as MemoryPerson[])
      const tagMap = groupByMemory(tagRows as MemoryTag[])

      for (const memory of enrichedResults) {
        // inArray gives no ordering guarantee, so photos are sorted here to keep
        // the gallery in the order the user arranged them at upload time.
        const ordered = [...(photoMap.get(memory.id) ?? [])].sort(
          (a, b) => a.orderIndex - b.orderIndex,
        )
        memory.photos = ordered
        memory.people = peopleMap.get(memory.id) ?? []
        memory.tags = tagMap.get(memory.id) ?? []
      }
    }
```

Os tipos `Memory`, `MemoryPhoto`, `MemoryPerson` e `MemoryTag` vêm de `@chronicle/db`, reexportados
na raiz do pacote pela Task 1.

- [ ] **Step 5: Escrever o teste de ordenação das fotos**

Adicionar em `describe('findAll')`:

```ts
    it('keeps photos ordered by orderIndex after batching', async () => {
      mocks.state.rows = [{ id: 'm1', userId: 'u1', isPublic: true }]
      mocks.state.junctionRows.photos = [
        { id: 'p2', memoryId: 'm1', orderIndex: 2 },
        { id: 'p0', memoryId: 'm1', orderIndex: 0 },
        { id: 'p1', memoryId: 'm1', orderIndex: 1 },
      ]

      const result = await memoriesService.findAll({ page: 1, limit: 20 })

      expect(result.data[0].photos.map((p) => p.id)).toEqual(['p0', 'p1', 'p2'])
    })
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `pnpm --filter api test`
Expected: PASS — contagem constante e ordenação.

- [ ] **Step 7: Resetar `junctionRows` no `beforeEach`**

Adicionar `mocks.state.junctionRows = {}` ao `beforeEach` para isolar os testes.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/memories/memories.service.ts apps/api/src/modules/memories/__tests__/memories.service.spec.ts
git commit -m "perf(memories): batch relation queries to a constant instead of 3N"
```

---

### Task 4: Índices btree no schema

**Files:**
- Modify: `packages/db/src/schema/memories.ts:1-30`
- Modify: `packages/db/src/schema/memory-photos.ts:1-11`
- Modify: `packages/db/src/schema/memory-people.ts`
- Modify: `packages/db/src/schema/memory-tags.ts`
- Test: `packages/db/src/schema/__tests__/memories.test.ts` (já existe; não criar arquivo novo)

- [ ] **Step 1: Escrever o teste que falha**

`packages/db/src/schema/__tests__/memories.test.ts` já importa `getTableConfig` de
`drizzle-orm/pg-core` e usa `from '../index'`. Acrescentar ao final do arquivo, seguindo a
convenção de `as never` já presente nos testes do schema:

```ts
describe('Memories indexes', () => {
  const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
    getTableConfig(table).indexes.map((index) => index.config.name)

  it('indexes the owner timeline and the public feed', () => {
    expect(indexNames(memories as never)).toEqual(
      expect.arrayContaining(['memories_user_date_idx', 'memories_public_date_idx']),
    )
  })

  it('indexes every junction table by memory_id', () => {
    expect(indexNames(memoryPhotos as never)).toContain('memory_photos_memory_idx')
    expect(indexNames(memoryPeople as never)).toContain('memory_people_memory_idx')
    expect(indexNames(memoryTags as never)).toContain('memory_tags_memory_idx')
  })

  it('indexes tags by name for the #tag search', () => {
    expect(indexNames(memoryTags as never)).toContain('memory_tags_name_idx')
  })
})
```

E ampliar o import existente para incluir as tabelas junction:

```ts
import { memories, memoryPeople, memoryPhotos, memoryTags, users } from '../index'
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @chronicle/db test`
Expected: FAIL — nenhum índice declarado.

- [ ] **Step 3: Declarar os índices**

Em `packages/db/src/schema/memories.ts`:

```ts
import { sql } from 'drizzle-orm'
import { boolean, decimal, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const memories = pgTable(
  'memories',
  {
    // ... colunas inalteradas
  },
  (table) => [
    // Own timeline, already ordered newest-first by findAll.
    index('memories_user_date_idx').on(table.userId, table.memoryDate.desc()),
    // Public feed. Partial, so it stays small instead of indexing every private row.
    index('memories_public_date_idx')
      .on(table.memoryDate.desc())
      .where(sql`${table.isPublic} = true`),
  ],
)
```

Em `packages/db/src/schema/memory-photos.ts`, `memory-people.ts` e `memory-tags.ts`, trocar a chamada por forma com callback:

```ts
export const memoryPhotos = pgTable(
  'memory_photos',
  {
    // ... colunas inalteradas
  },
  (table) => [index('memory_photos_memory_idx').on(table.memoryId)],
)
```

```ts
export const memoryPeople = pgTable(
  'memory_people',
  {
    // ... colunas inalteradas
  },
  (table) => [index('memory_people_memory_idx').on(table.memoryId)],
)
```

```ts
export const memoryTags = pgTable(
  'memory_tags',
  {
    // ... colunas inalteradas
  },
  (table) => [
    index('memory_tags_memory_idx').on(table.memoryId),
    index('memory_tags_name_idx').on(table.name),
  ],
)
```

Adicionar `index` ao import de `drizzle-orm/pg-core` em cada arquivo.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @chronicle/db test`
Expected: PASS.

- [ ] **Step 5: Gerar a migration**

Run: `pnpm db:generate`
Expected: um novo arquivo em `packages/db/src/migrations/` com os cinco `CREATE INDEX`.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema packages/db/src/migrations
git commit -m "perf(db): index the timeline feeds and the junction memory_id lookups"
```

---

### Task 5: `pg_trgm` + índices GIN (verificação manual)

Esta task **não tem teste automatizável** (ver pré-requisito 3). O SQL de verificação no Step 4 é obrigatório e manual.

**Files:**
- Modify: o arquivo de migration mais recente em `packages/db/src/migrations/`

- [ ] **Step 1: Acrescentar extensão e índices GIN à migration**

Acrescentar ao final do arquivo `.sql` gerado na Task 4:

```sql
-- GIN trigram indexes: `search`, `location` and `weather` all match with
-- ilike '%term%'. A leading wildcard cannot use a btree, so without trigram the
-- new search is a sequential scan — the exact cost this phase exists to remove.
--
-- These live in the migration only, never in the Drizzle schema: the schema
-- tests build every table in SQLite in-memory, where gin_trgm_ops and
-- CREATE EXTENSION do not exist.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX memories_title_trgm_idx ON memories USING gin (title gin_trgm_ops);
CREATE INDEX memories_content_trgm_idx ON memories USING gin (content gin_trgm_ops);
CREATE INDEX memories_location_trgm_idx ON memories USING gin (location_name gin_trgm_ops);
CREATE INDEX memories_weather_trgm_idx ON memories USING gin (weather_desc gin_trgm_ops);
```

- [ ] **Step 2: Aplicar e confirmar que a extensão existe**

Run: `pnpm db:migrate`
Expected: aplicar sem erro.

Run: `docker exec chronicle-postgres psql -U chronicle -d chronicle -c "SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';"`
Expected: uma linha com `pg_trgm`.

> `CREATE INDEX` sem `CONCURRENTLY` porque o drizzle-kit roda migrations dentro de transação. Aceitável em dev; em produção avaliar `CONCURRENTLY` em migration separada.

- [ ] **Step 3: Verificar que o planner usa os índices**

Rodar com dados representativos já na base:

```sql
EXPLAIN ANALYZE SELECT * FROM memories WHERE is_public = true ORDER BY memory_date DESC LIMIT 20;
EXPLAIN ANALYZE SELECT * FROM memories WHERE user_id = 'x' ORDER BY memory_date DESC LIMIT 20;
EXPLAIN ANALYZE SELECT * FROM memories WHERE title ILIKE '%festa%';
EXPLAIN ANALYZE SELECT * FROM memory_photos WHERE memory_id IN ('00000000-0000-0000-0000-000000000000');
```

Expected: `Index Scan` ou `Bitmap Index Scan` nos quatro. `Seq Scan` nas tabelas pequenas é aceitável e esperado — o planner escolhe seq scan abaixo do limiar; o que invalida a task é `Seq Scan` **com filtro de índice disponível e tabela grande**, então repetir com a base de produção ou com `SET enable_seqscan = off` para forçar o planner:

```sql
SET enable_seqscan = off;
EXPLAIN ANALYZE SELECT * FROM memories WHERE title ILIKE '%festa%';
RESET enable_seqscan;
```

Expected: `Bitmap Index Scan on memories_title_trgm_idx`.

- [ ] **Step 4: Verificar equivalência do predicado de data**

O `EXTRACT` antigo e o intervalo novo precisam devolver o mesmo conjunto. `memoryDate` é `timestamp` e o `EXTRACT` usa o fuso da sessão:

```sql
SHOW TimeZone;

SELECT count(*) FILTER (
  WHERE EXTRACT(YEAR FROM memory_date) = 2026
) AS old_year,
       count(*) FILTER (
  WHERE memory_date >= '2026-01-01 00:00:00+00' AND memory_date < '2027-01-01 00:00:00+00'
) AS new_year,
       count(*) FILTER (
  WHERE EXTRACT(MONTH FROM memory_date) = 1
) AS old_jan,
       count(*) FILTER (
  WHERE memory_date >= '2026-01-01 00:00:00+00' AND memory_date < '2026-02-01 00:00:00+00'
) AS new_jan
FROM memories;
```

Dois casos que o SQL acima **nao** pega e que precisam ser conferidos, porque o intervalo
usa `Date.UTC` e tem um `month ?? 12` que e o unico jeito de Dezembro virar 2027:

```sql
-- Dezembro: o limite exclusivo tem de cair em janeiro do ano seguinte
SELECT count(*) FILTER (
  WHERE memory_date >= '2026-12-01 00:00:00+00' AND memory_date < '2027-01-01 00:00:00+00'
) AS dec_2026,
       count(*) FILTER (
  WHERE memory_date >= '2026-12-01 00:00:00+00' AND memory_date < '2026-12-01 00:00:00+00'
) AS dec_quebrado;

-- Mes sem ano: o spec diz que usa o ano corrente, entao precisa bater com EXTRACT
-- restrito ao mesmo ano, e NAO com "setembro de todos os anos"
SELECT count(*) FILTER (
  WHERE EXTRACT(YEAR FROM memory_date) = 2026 AND EXTRACT(MONTH FROM memory_date) = 9
) AS old_setembro,
       count(*) FILTER (
  WHERE memory_date >= '2026-09-01 00:00:00+00' AND memory_date < '2026-10-01 00:00:00+00'
) AS new_setembro;
```

Expected: `old_year = new_year`, `old_jan = new_jan`, `dec_quebrado = 0`,
`old_setembro = new_setembro`.

> `dec_quebrado = 0` e o alarme: se `month ?? 12` virar `month + 1` sem o `?? 12`, o fim
> do intervalo de Dezembro colide com o comeco e a query devolve zero silenciosamente.

> O `month` sem `year` **mudou de comportamento** de proposito (o spec, linha 134, decide
> assim): antes `EXTRACT(MONTH ...) = 9` trazia setembro de todos os anos, agora traz
> setembro do ano corrente. Ver pre-requisito 10 para o impacto na UI.

> Se `SHOW TimeZone` **não** for `UTC`, os dois lados divergem. Nesse caso, construir os limites com o offset da sessão em vez de `Date.UTC`, ajustar a Task 2 e o teste de equivalidade, e reexecutar.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations
git commit -m "perf(db): add pg_trgm and gin indexes for wildcard search"
```

---

# Frente B — Busca

### Task 6: Parser da gramática em `@chronicle/schemas`

O parser mora em `@chronicle/schemas` (e não em `apps/api`) porque **a API e o web precisam dele**: a API faz o parse, o web serializa para reescrever a URL ao remover um chip. Uma implementação, dois consumidores.

**Files:**
- Create: `packages/schemas/src/search-query.ts`
- Modify: `packages/schemas/src/index.ts`
- Test: `packages/schemas/src/__tests__/search-query.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `packages/schemas/src/__tests__/search-query.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isEmptySearch, parseSearchQuery, serializeSearchQuery } from '../search-query'

describe('parseSearchQuery', () => {
  it('treats bare words as title/content text', () => {
    expect(parseSearchQuery('praia sol').text).toEqual(['praia', 'sol'])
  })

  it('reads the author prefix', () => {
    expect(parseSearchQuery('@bruce').author).toBe('bruce')
  })

  it('collects every tag', () => {
    expect(parseSearchQuery('#festa #praia').tags).toEqual(['festa', 'praia'])
  })

  it('combines dimensions with AND semantics', () => {
    expect(parseSearchQuery('@bruce #festa local:praia ano:2026')).toEqual({
      text: [],
      phrases: [],
      author: 'bruce',
      tags: ['festa'],
      year: 2026,
      month: null,
      weather: null,
      location: 'praia',
    })
  })

  it('keeps quoted phrases intact and treats them as phrases', () => {
    const parsed = parseSearchQuery('"fase com espaço" sol')
    expect(parsed.phrases).toEqual(['fase com espaço'])
    expect(parsed.text).toEqual(['sol'])
  })

  it('accepts a month by number and by name', () => {
    expect(parseSearchQuery('mes:9').month).toBe(9)
    expect(parseSearchQuery('mes:setembro').month).toBe(9)
    expect(parseSearchQuery('março:9').month).toBe(9)
  })

  it('falls back to text for an out-of-range year or month', () => {
    expect(parseSearchQuery('ano:99').text).toEqual(['ano:99'])
    expect(parseSearchQuery('mes:44').text).toEqual(['mes:44'])
  })

  it('treats an unknown prefix as literal text instead of failing', () => {
    expect(parseSearchQuery('http://exemplo.com').text).toEqual(['http://exemplo.com'])
    expect(parseSearchQuery('foo:bar').text).toEqual(['foo:bar'])
  })

  it('ignores bare punctuation', () => {
    expect(parseSearchQuery('@# ""   ').author).toBeNull()
  })

  it('reads the weather and location prefixes', () => {
    const parsed = parseSearchQuery('clima:Sol local:Praia do Norte')
    expect(parsed.weather).toBe('Sol')
    expect(parsed.location).toBe('Praia')
    expect(parsed.text).toEqual(['do', 'Norte'])
  })

  it('keeps the first author and degrades the rest to text', () => {
    const parsed = parseSearchQuery('@bruce @deb')
    expect(parsed.author).toBe('bruce')
    expect(parsed.text).toEqual(['@deb'])
  })

  it('reports an empty query as empty', () => {
    expect(isEmptySearch(parseSearchQuery(''))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('   '))).toBe(true)
    expect(isEmptySearch(parseSearchQuery('#festa'))).toBe(false)
  })
})

describe('serializeSearchQuery', () => {
  it('round-trips every dimension', () => {
    const original = '@bruce #festa #praia ano:2026 mes:9 clima:sol local:praia "fase com espaço" sol'
    expect(parseSearchQuery(serializeSearchQuery(parseSearchQuery(original)))).toEqual(
      parseSearchQuery(original),
    )
  })

  it('emits prefixes, not raw values', () => {
    expect(serializeSearchQuery(parseSearchQuery('9'))).toBe('')
    expect(serializeSearchQuery(parseSearchQuery('mes:9'))).toBe('mes:9')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @chronicle/schemas test`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar o parser**

Criar `packages/schemas/src/search-query.ts`:

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

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
}

const PREFIXES = ['ano:', 'mes:', 'clima:', 'local:'] as const

interface Token {
  value: string
  quoted: boolean
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let current = ''
  let quoted = false
  let inQuotes = false

  for (const char of input) {
    if (char === '"') {
      if (inQuotes) {
        if (current) tokens.push({ value: current, quoted: true })
        current = ''
        inQuotes = false
      } else {
        if (current) tokens.push({ value: current, quoted: false })
        current = ''
        inQuotes = true
      }
      quoted = true
      continue
    }
    if (!inQuotes && /\s/.test(char)) {
      if (current) tokens.push({ value: current, quoted })
      current = ''
      quoted = false
      continue
    }
    current += char
  }

  if (current) tokens.push({ value: current, quoted })

  return tokens
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function parseMonthValue(raw: string): number | null {
  const asNumber = Number(raw)
  if (Number.isInteger(asNumber)) {
    return asNumber >= 1 && asNumber <= 12 ? asNumber : null
  }
  return MONTH_NAMES[normalize(raw)] ?? null
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const parsed: ParsedSearchQuery = {
    text: [],
    phrases: [],
    author: null,
    tags: [],
    year: null,
    month: null,
    weather: null,
    location: null,
  }

  for (const token of tokenize(input)) {
    if (token.quoted) {
      parsed.phrases.push(token.value)
      continue
    }

    if (token.value.startsWith('@') && token.value.length > 1) {
      const author = token.value.slice(1)
      if (parsed.author === null) parsed.author = author
      else parsed.text.push(token.value)
      continue
    }

    if (token.value.startsWith('#') && token.value.length > 1) {
      parsed.tags.push(token.value.slice(1))
      continue
    }

    const lowered = token.value.toLowerCase()
    const prefix = PREFIXES.find((p) => lowered.startsWith(p))

    if (prefix) {
      const rest = token.value.slice(prefix.length)
      if (rest) {
        if (prefix === 'ano:') {
          const year = Number(rest)
          if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
            parsed.year = year
            continue
          }
        } else if (prefix === 'mes:') {
          const month = parseMonthValue(rest)
          if (month !== null) {
            parsed.month = month
            continue
          }
        } else if (prefix === 'clima:') {
          parsed.weather = rest
          continue
        } else {
          parsed.location = rest
          continue
        }
      }
    }

    // An unknown prefix, an out-of-range value, or a bare word all land here as
    // text. The grammar never rejects input.
    parsed.text.push(token.value)
  }

  return parsed
}

export function serializeSearchQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = []
  if (parsed.author) parts.push(`@${parsed.author}`)
  for (const tag of parsed.tags) parts.push(`#${tag}`)
  if (parsed.year) parts.push(`ano:${parsed.year}`)
  if (parsed.month) parts.push(`mes:${parsed.month}`)
  if (parsed.weather) parts.push(`clima:${parsed.weather}`)
  if (parsed.location) parts.push(`local:${parsed.location}`)
  for (const phrase of parsed.phrases) parts.push(`"${phrase}"`)
  for (const term of parsed.text) parts.push(term)
  return parts.join(' ')
}

export function isEmptySearch(parsed: ParsedSearchQuery): boolean {
  return (
    parsed.text.length === 0 &&
    parsed.phrases.length === 0 &&
    parsed.author === null &&
    parsed.tags.length === 0 &&
    parsed.year === null &&
    parsed.month === null &&
    parsed.weather === null &&
    parsed.location === null
  )
}
```

> O regex de remoção de diacríticos em `normalize` é a faixa `\u0300-\u036f`. Escrever literalmente `\u0300-\u036f` no arquivo, não os caracteres combinantes.

- [ ] **Step 4: Exportar do índice do pacote**

Em `packages/schemas/src/index.ts`:

```ts
export { isEmptySearch, parseSearchQuery, serializeSearchQuery } from './search-query'
export type { ParsedSearchQuery } from './search-query'
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter @chronicle/schemas test`
Expected: PASS.

- [ ] **Step 6: Lint e commit**

```bash
pnpm lint
git add packages/schemas
git commit -m "feat(schemas): add the search query grammar parser"
```

---

### Task 7: Condições da busca no `findAll`

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts:84-135`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `describe('findAll')`:

```ts
    it('expands a bare term into a title/content OR condition', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: 'praia' })

      const serialized = JSON.stringify(memoryOps())
      expect(serialized).toContain('ilike')
    })

    it('ANDs multiple bare terms and ORs each across title and content', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: 'praia sol' })

      expect(memoryOps('ilike')).toHaveLength(4)
    })

    it('feeds ano: into the same date range as the year filter', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: 'ano:2026' })

      const range = [...memoryOps('gte'), ...memoryOps('lt')] as Array<{ value: Date }>

      expect(range[0].value.toISOString()).toBe('2026-01-01T00:00:00.000Z')
      expect(range[1].value.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    })

    it('turns a tag into an EXISTS subquery', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: '#festa' })

      const serialized = JSON.stringify(memoryOps())
      expect(serialized).toContain('EXISTS')
    })

    it('adds no condition for a query with no searchable token', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: '   ' })

      // Only the privacy filter survives; no ilike, no EXISTS, no range.
      expect(memoryOps()).toHaveLength(1)
    })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter api exec vitest run -t 'bare term'`
Expected: FAIL — o `search` atual monta um único `ilike` com a string inteira.

- [ ] **Step 3: Importar o parser e reescrever o bloco de `search`**

Em `memories.service.ts`:

```ts
import { isEmptySearch, parseSearchQuery, type ParsedSearchQuery } from '@chronicle/schemas'
```

Substituir os blocos `if (year)`, `if (month)`, `if (weather)`, `if (location)` e `if (search)` por um único bloco que faz o parse **uma vez** e alimenta todos os filtros. O bloco `if (tag)` original permanece intacto — o parâmetro `tag` da URL continua funcionando independente da gramática:

```ts
    const grammar: ParsedSearchQuery | null = search ? parseSearchQuery(search) : null
    const hasGrammar = grammar !== null && !isEmptySearch(grammar)

    const effectiveYear =
      grammar?.year ?? year ?? ((grammar?.month || month) ? new Date().getUTCFullYear() : undefined)
    const effectiveMonth = grammar?.month ?? month
    const effectiveWeather = grammar?.weather ?? weather
    const effectiveLocation = grammar?.location ?? location

    if (effectiveYear) {
      const { start, end } = dateRange(effectiveYear, effectiveMonth ?? undefined)
      conditions.push(gte(memories.memoryDate, start), lt(memories.memoryDate, end))
    }

    if (effectiveWeather) {
      conditions.push(ilike(memories.weatherDesc, `%${effectiveWeather}%`))
    }

    if (effectiveLocation) {
      conditions.push(ilike(memories.locationName, `%${effectiveLocation}%`))
    }

    if (hasGrammar) {
      const terms = [...grammar.text, ...grammar.phrases]
      // Bare terms are AND-ed with each other, OR-ed across title/content:
      // "praia sol" means both words are present, each in either column.
      for (const term of terms) {
        conditions.push(
          sql`(${ilike(memories.title, `%${term}%`)} OR ${ilike(memories.content, `%${term}%`)})`,
        )
      }

      for (const tag of grammar.tags) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${memoryTags}
            WHERE ${memoryTags.memoryId} = ${memories.id}
            AND ${ilike(memoryTags.name, `%${tag}%`)}
          )`,
        )
      }
    }
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter api test`
Expected: PASS — inclui os testes de ano/mês da Task 2.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/memories/memories.service.ts apps/api/src/modules/memories/__tests__/memories.service.spec.ts
git commit -m "feat(memories): map the search grammar to query conditions"
```

---

### Task 8: Busca por autor via join

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts:1-20, 139-170`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Estender o mock com `users` e `leftJoin`**

Em `memories.service.spec.ts`, adicionar `users` ao objeto `tables`:

```ts
    users: {
      __table: 'users',
      id: column('id'),
      name: column('name'),
      email: column('email'),
    },
```

Adicionar `leftJoins` ao `state` e o método ao chain:

```ts
    leftJoins: [] as unknown[],
```

```ts
    leftJoin(_table: unknown, condition: unknown) {
      mocks.state.leftJoins.push(condition)
      return this
    }
```

Resetar `mocks.state.leftJoins = []` no `beforeEach`.

- [ ] **Step 2: Escrever o teste que falha**

```ts
    it('joins users when the query names an author', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: '@bruce' })

      expect(mocks.state.leftJoins).toHaveLength(1)
    })

    it('does not join users when no author is named', async () => {
      await memoriesService.findAll({ page: 1, limit: 20, search: 'praia' })

      expect(mocks.state.leftJoins).toHaveLength(0)
    })
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `pnpm --filter api exec vitest run -t 'author'`
Expected: FAIL.

- [ ] **Step 4: Implementar o join**

`users` já é exportado por `@chronicle/db`; `leftJoin` vem de `drizzle-orm` como método do builder, sem novo export.

Dentro do bloco `if (hasGrammar)` da Task 7, logo antes do laço de `terms`:

```ts
      if (grammar.author) {
        conditions.push(
          or(ilike(users.name, `%${grammar.author}%`), ilike(users.email, `%${grammar.author}%`)),
        )
      }
```

E montar as duas queries com o join quando o autor estiver presente:

```ts
    const needsAuthorJoin = grammar?.author != null

    const baseRows = db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.memoryDate))
      .limit(limit)
      .offset(offset)

    const baseCount = db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(and(...conditions))

    const results = needsAuthorJoin
      ? await baseRows.leftJoin(users, eq(memories.userId, users.id))
      : await baseRows

    const [countResult] = needsAuthorJoin
      ? await baseCount.leftJoin(users, eq(memories.userId, users.id))
      : await baseCount
```

`userId` → `users.id` é muitos-para-um, então o join não multiplica linhas e `count(*)` continua correto.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter api test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/memories/memories.service.ts apps/api/src/modules/memories/__tests__/memories.service.spec.ts
git commit -m "feat(memories): search memories by author"
```

---

### Task 9: `searchMeta` na resposta

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts:172-183`
- Test: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
    it('returns the canonical parsed query so the client does not re-parse it', async () => {
      const result = await memoriesService.findAll({
        page: 1,
        limit: 20,
        search: '  #Festa   ano:2026  ',
      })

      expect(result.searchMeta).toEqual({
        text: [],
        phrases: [],
        author: null,
        tags: ['Festa'],
        year: 2026,
        month: null,
        weather: null,
        location: null,
      })
    })

    it('returns null searchMeta when no search was given', async () => {
      const result = await memoriesService.findAll({ page: 1, limit: 20 })

      expect(result.searchMeta).toBeNull()
    })
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter api exec vitest run -t 'searchMeta'`
Expected: FAIL — `searchMeta` é `undefined`.

- [ ] **Step 3: Implementar**

```ts
    return {
      data: enrichedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      searchMeta: grammar && !isEmptySearch(grammar) ? grammar : null,
    }
```

A rota em `memories.routes.ts:63-65` faz `reply.send(result)` e repassa o campo novo sem alteração.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter api test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/memories
git commit -m "feat(memories): return the canonical search meta in the response"
```

---

### Task 10: Hook `useDebouncedValue`

**Files:**
- Create: `apps/web/src/hooks/use-debounced-value.ts`

- [ ] **Step 1: Implementar**

```ts
'use client'

import { useEffect, useState } from 'react'

/**
 * Trails `value` by `delay` ms, cancelling the pending update whenever it
 * changes again. Used to keep the search dialog from firing a request per
 * keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-debounced-value.ts
git commit -m "feat(web): add useDebouncedValue hook"
```

---

### Task 11: Componente `SearchDialog`

**Files:**
- Create: `apps/web/src/components/search-dialog.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
'use client'

import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useMemories } from '@/hooks/use-memories'
import { Badge, Dialog, DialogContent, DialogDescription, DialogTitle, Input } from '@chronicle/ui'
import { Loader2, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SearchResultRow {
  id: string
  title: string
  memoryDate: string
  locationName: string | null
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const debouncedQuery = useDebouncedValue(query, 300)
  const router = useRouter()
  const listRef = useRef<HTMLUListElement | null>(null)

  const trimmed = debouncedQuery.trim()
  // `enabled` keeps a keystroke from firing a request for an empty or
  // prefix-only query; `limit` is a preview, the full result set lives on /search.
  const { data, isFetching } = useMemories(
    { page: 1, limit: 20, search: trimmed || undefined },
    { enabled: open && trimmed.length > 0 },
  )

  const results = (data?.data ?? []) as SearchResultRow[]
  const total = data?.pagination.total ?? 0

  useEffect(() => {
    if (open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    // Radix restores focus to the trigger on close, but the trigger is a plain
    // button and the search flow can move focus elsewhere first. Snapshotting
    // on open and restoring on close is what photo-gallery.tsx already does.
    const previous = document.activeElement
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
        return
      }
      if (event.key === 'ArrowDown' && results.length > 0) {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % results.length)
      }
      if (event.key === 'ArrowUp' && results.length > 0) {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + results.length) % results.length)
      }
      if (event.key === 'Enter' && results[activeIndex]) {
        event.preventDefault()
        router.push(`/memories/${results[activeIndex].id}/edit`)
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, results, activeIndex, onOpenChange, router])

  useEffect(() => {
    const node = listRef.current?.children[activeIndex]
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl border-card bg-card text-text"
        data-testid="search-dialog"
      >
        <DialogTitle className="sr-only">Buscar memórias</DialogTitle>
        <DialogDescription className="sr-only">
          Busca por título, conteúdo, pessoa, tag, ano, mês, clima e lugar.
        </DialogDescription>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar: #tag @pessoa ano:2026 local:praia"
            data-testid="search-dialog-input"
            className="h-11 rounded-lg border-2 border-card bg-background pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <ul ref={listRef} className="max-h-96 space-y-1 overflow-y-auto" data-testid="search-results">
          {results.map((memory, index) => (
            <li key={memory.id}>
              <button
                type="button"
                onClick={() => {
                  router.push(`/memories/${memory.id}/edit`)
                  onOpenChange(false)
                }}
                onMouseEnter={() => setActiveIndex(index)}
                data-testid={`search-result-${memory.id}`}
                className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  index === activeIndex ? 'bg-primary/10' : 'hover:bg-primary/5'
                }`}
              >
                <span className="block truncate text-sm font-medium text-text">{memory.title}</span>
                <span className="block text-xs text-muted">
                  {new Date(memory.memoryDate).toLocaleDateString('pt-BR')}
                  {memory.locationName ? ` · ${memory.locationName}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {trimmed.length > 0 && !isFetching && results.length === 0 && (
          <p className="py-6 text-center text-sm text-muted" data-testid="search-empty">
            Nenhuma memória encontrada para “{trimmed}”.
          </p>
        )}

        {isFetching && (
          <div className="flex justify-center py-4" data-testid="search-loading">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <div className="flex items-center justify-between border-t border-card pt-3">
          <p className="text-xs text-muted">
            <kbd className="rounded border border-card px-1">↑</kbd>{' '}
            <kbd className="rounded border border-card px-1">↓</kbd> para navegar,{' '}
            <kbd className="rounded border border-card px-1">Enter</kbd> para abrir
          </p>
          {trimmed.length > 0 && (
            <button
              type="button"
              onClick={() => {
                router.push(`/search?q=${encodeURIComponent(trimmed)}`)
                onOpenChange(false)
              }}
              data-testid="search-see-all"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todas as {total} memórias
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Estender `useMemories` com `enabled`**

`apps/web/src/hooks/use-memories.ts` precisa aceitar opções, senão o Step 1 não compila:

```ts
export function useMemories(filters: MemoryFiltersInput, options?: { enabled?: boolean }) {
  return useQuery<PaginatedResponse>({
    queryKey: ['memories', filters],
    queryFn: async () => {
      const queryString = buildQueryString(filters)
      const endpoint = `/api/memories${queryString ? `?${queryString}` : ''}`
      return api.get<PaginatedResponse>(endpoint)
    },
    enabled: options?.enabled ?? true,
  })
}
```

Adicionar também o campo novo ao `PaginatedResponse`:

```ts
interface PaginatedResponse {
  data: Memory[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  searchMeta: import('@chronicle/schemas').ParsedSearchQuery | null
}
```

- [ ] **Step 3: Typecheck e lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS. O `DialogContent` do Radix precisa aceitar `ref`; se o tipo reclamar, trocar por `aria-label` no `DialogTitle` e remover o `ref`/`triggerRef`, que só existia para o foco manual.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/search-dialog.tsx apps/web/src/hooks/use-memories.ts
git commit -m "feat(web): add the search dialog"
```

---

### Task 12: Ligar a busca e o CTA na navbar

**Files:**
- Modify: `apps/web/src/components/navbar.tsx:1-95`
- Test: `apps/web/src/__tests__/user-menu.spec.ts` (não deve quebrar)

- [ ] **Step 1: Trocar o 404 pelo modal**

Em `navbar.tsx`, substituir `router.push('/search')` pela abertura do modal:

```tsx
  const [searchOpen, setSearchOpen] = useState(false)
```

```tsx
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setSearchOpen(true)
              }}
              className="cursor-pointer text-muted transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
              aria-label="Buscar"
              data-testid="search-button"
            >
              <Search className="h-5 w-5" />
            </button>
```

- [ ] **Step 2: Adicionar o CTA de nova memória para logados**

Junto do `{isAuthenticated ? (` no header, antes do bloco do dropdown:

```tsx
            {isAuthenticated && (
              <Link href="/memories/new" className="hidden sm:block" data-testid="nav-nova">
                <Button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]">
                  <Plus className="h-4 w-4" />
                  Nova Memória
                </Button>
              </Link>
            )}
```

> O item "Nova Memória" do dropdown (`data-testid="menu-nova"`) **permanece**: `user-menu.spec.ts:21,43` depende dele e ele serve de destino redundante no mobile, onde o CTA do header some.

- [ ] **Step 3: Montar o diálogo e o atalho global**

Adicionar o import:

```tsx
import { SearchDialog } from '@/components/search-dialog'
```

Dentro do fragmento já retornado pelo componente:

```tsx
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
```

E o listener do atalho, registrado **sempre** — dentro dele o listener só existiria com a
modal aberta, então nunca abriria a modal:

```tsx
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMenuOpen(false)
        setSearchOpen(true)
        return
      }
      if (event.key === '/' && !searchOpen) {
        // Never steal the slash from a field the user is typing in.
        const target = event.target
        const typing =
          target instanceof HTMLElement &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        if (!typing) {
          event.preventDefault()
          setSearchOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [searchOpen])

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. `router` continua em uso por `useRouter()`; se ficar órfão com a mudança do Step 1, remover o import e a chamada.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/navbar.tsx
git commit -m "feat(web): open the search dialog from the navbar and add a header create action"
```

---

### Task 13: Remover a busca dos filtros da timeline

**Files:**
- Modify: `apps/web/src/components/memory-filters.tsx:1-70`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Remover o input e o effect de debounce**

Em `memory-filters.tsx`, apagar o bloco `const [searchInput, setSearchInput] = useState(...)` e o `useEffect` do `setTimeout`, e apagar o `<div className="relative flex-1 min-w-[200px]">` que contém o `Input` de busca.

**Fechar a armadilha de mês-sem-ano (pre-requisito 10).** Os dois `<select>` são independentes e
o serviço trata mês sem ano como "mês do ano corrente", o que esconderia as memórias dos anos
anteriores sem aviso. Escolher o mês com o ano vazio tem de normalizar o ano para o corrente:

```ts
// O serviço interpreta mês sem ano como o mês do ano corrente, então o filtro
// precisa mostrar o ano que ele realmente está aplicando.
const onMonthChange = (value: string) => {
  setMonth(value)
  if (value && !year) setYear(String(new Date().getFullYear()))
}
```

Confirmar no E2E da Task 16 que escolher só o mês traz um resultado só do ano corrente, e não
um conjunto vazio.

Atualizar `hasActiveFilters` para o que sobra:

```ts
  const hasActiveFilters = filters.year || filters.month || filters.weather || filters.location || filters.tag
```

Ajustar os imports: `Input` e `Search` saem de `lucide-react`; `useEffect` e `useState` saem de `react` se não restarem usos.

- [ ] **Step 2: Rodar o lint e o typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS ou aviso de import não usado — resolver removendo o import.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/memory-filters.tsx
git commit -m "refactor(web): drop the timeline search input in favour of the dialog"
```

> `search` **permanece** em `MemoryFiltersInput` e em `useFilters`: a página `/search` e o diálogo o usam. Só a barra de filtros para de editá-lo.

---

### Task 14: Página `/search` com chips removíveis

**Files:**
- Create: `apps/web/src/components/search-results.tsx`
- Create: `apps/web/src/app/(dashboard)/search/page.tsx`

- [ ] **Step 1: Criar o componente de resultados**

`apps/web/src/components/search-results.tsx`:

```tsx
'use client'

import { MemoryTimeline } from '@/components/memory-timeline'
import { useFilters } from '@/hooks/use-filters'
import { useMemories } from '@/hooks/use-memories'
import { serializeSearchQuery, type ParsedSearchQuery } from '@chronicle/schemas'
import { Badge } from '@chronicle/ui'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface SearchResultsProps {
  query: string
}

interface Chip {
  label: string
  remove: () => ParsedSearchQuery
}

function buildChips(meta: ParsedSearchQuery): Chip[] {
  const chips: Chip[] = []
  if (meta.author) chips.push({ label: `@${meta.author}`, remove: () => ({ ...meta, author: null }) })
  for (const tag of meta.tags) {
    chips.push({ label: `#${tag}`, remove: () => ({ ...meta, tags: meta.tags.filter((t) => t !== tag) }) })
  }
  if (meta.year) chips.push({ label: `ano: ${meta.year}`, remove: () => ({ ...meta, year: null }) })
  if (meta.month) chips.push({ label: `mês: ${meta.month}`, remove: () => ({ ...meta, month: null }) })
  if (meta.weather) chips.push({ label: `clima: ${meta.weather}`, remove: () => ({ ...meta, weather: null }) })
  if (meta.location) chips.push({ label: `local: ${meta.location}`, remove: () => ({ ...meta, location: null }) })
  for (const phrase of meta.phrases) {
    chips.push({ label: `"${phrase}"`, remove: () => ({ ...meta, phrases: meta.phrases.filter((p) => p !== phrase) }) })
  }
  for (const term of meta.text) {
    chips.push({ label: term, remove: () => ({ ...meta, text: meta.text.filter((t) => t !== term) }) })
  }
  return chips
}

export function SearchResults({ query }: SearchResultsProps) {
  const { filters, setFilter, setPage } = useFilters()
  const router = useRouter()

  useEffect(() => {
    setFilter('search', query || undefined)
    setPage(1)
  }, [query, setFilter, setPage])

  const { data, isLoading, error, refetch } = useMemories(filters, {
    enabled: query.trim().length > 0,
  })

  const meta = data?.searchMeta ?? null
  const chips = meta ? buildChips(meta) : []

  return (
    <div>
      {chips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2" data-testid="search-chips">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => router.replace(`/search?q=${encodeURIComponent(serializeSearchQuery(chip.remove()))}`)}
              data-testid={`search-chip-${chip.label}`}
              className="cursor-pointer"
            >
              <Badge className="flex cursor-pointer items-center gap-1.5 rounded-full border-primary/40 bg-primary/10 text-primary hover:bg-primary/20">
                {chip.label}
                <X className="h-3 w-3" />
              </Badge>
            </button>
          ))}
        </div>
      )}

      {data && (
        <p className="mb-4 text-sm text-muted" data-testid="search-count">
          {data.pagination.total} {data.pagination.total === 1 ? 'memória' : 'memórias'}
        </p>
      )}

      <MemoryTimeline
        memories={data?.data ?? []}
        pagination={data?.pagination}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onPageChange={setPage}
        emptyTitle="Nenhuma memória encontrada"
        emptyDescription="Tente outra combinação ou remova um filtro acima."
      />
    </div>
  )
}
```

- [ ] **Step 2: Criar a página**

`apps/web/src/app/(dashboard)/search/page.tsx`:

```tsx
import { SearchResults } from '@/components/search-results'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold text-text">Busca</h1>
      {q ? (
        <p className="mb-8 text-muted">
          Resultados para <span className="text-text">{q}</span>
        </p>
      ) : (
        <p className="mb-8 text-muted">
          Use a busca no topo da página: <code className="text-primary">#tag</code>,{' '}
          <code className="text-primary">@pessoa</code>, <code className="text-primary">ano:2026</code>,{' '}
          <code className="text-primary">mes:9</code>, <code className="text-primary">clima:sol</code>,{' '}
          <code className="text-primary">local:praia</code>.
        </p>
      )}

      <SearchResults query={q ?? ''} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck e lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/search-results.tsx 'apps/web/src/app/(dashboard)/search/page.tsx'
git commit -m "feat(web): add the search results page with removable query chips"
```

---

# Frente C — Qualidade

### Task 15: Eliminar os três `noExplicitAny`

**Files:**
- Modify: `apps/web/src/components/create-memory-wizard.tsx:58`
- Modify: `apps/api/src/server.ts:21`
- Modify: `apps/api/src/modules/auth/auth.routes.spec.ts:25`

- [ ] **Step 1: Tipar o `useForm` do wizard**

```ts
  const form = useForm<z.input<typeof createMemorySchema>>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: { ... },
  })
```

O `z.input` é o tipo do formulário (campos opcionais antes do refine); `z.output` é o tipo já validado.

- [ ] **Step 2: Tipar o error handler do Fastify**

Em `apps/api/src/server.ts`, trocar o `any` por `unknown` e narrow:

```ts
    const message = error instanceof Error ? error.message : 'Erro interno'
```

Se o `error` vier de `setErrorHandler` com tipo próprio, usar esse tipo em vez de `unknown`.

- [ ] **Step 3: Tipar o mock do spec de auth**

Em `auth.routes.spec.ts`, trocar o cast `as any` por `as unknown as <T>` do tipo real do `getSession`, seguindo o padrão já usado em `memories.integration.test.ts:41`.

- [ ] **Step 4: Confirmar que os avisos sumiram**

Run: `pnpm lint`
Expected: nenhum `noExplicitAny`. O lint deve sair com zero warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/create-memory-wizard.tsx apps/api/src/server.ts apps/api/src/modules/auth/auth.routes.spec.ts
git commit -m "refactor: remove the explicit any types flagged by biome"
```

---

### Task 16: E2E da busca

**Files:**
- Modify: `apps/web/src/__tests__/filter-memory.spec.ts:29-49`
- Modify: `apps/web/src/__tests__/helpers.ts:5-13, 26-46`
- Create: `apps/web/src/__tests__/search.spec.ts`

- [ ] **Step 1: Estender `MemoryData` com clima**

Em `helpers.ts`:

```ts
interface MemoryData {
  title: string
  content?: string
  memoryDate: string
  locationName?: string
  weatherDesc?: string
  people?: string[]
  tags?: string[]
  isPublic?: boolean
}
```

E no corpo de `createMemory`, adicionar ao `data`:

```ts
      ...(data.weatherDesc ? { weatherDesc: data.weatherDesc } : {}),
```

- [ ] **Step 2: Reescrever o teste de busca por título**

Substituir o corpo de `can search by title` em `filter-memory.spec.ts`:

```ts
  test('can search by title', async ({ authenticatedPage }) => {
    const festaId = await createMemory(authenticatedPage, {
      title: 'Festa Junina',
      memoryDate: '2026-06-24',
    })

    const trilhaId = await createMemory(authenticatedPage, {
      title: 'Trilha na Serra',
      memoryDate: '2026-09-24',
    })

    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator(`[data-memory-id="${trilhaId}"]`)).toBeVisible()

    await authenticatedPage.locator('[data-testid="search-button"]').click()
    await authenticatedPage.fill('[data-testid="search-dialog-input"]', 'Festa')

    await expect(
      authenticatedPage.locator(`[data-testid="search-result-${festaId}"]`),
    ).toBeVisible()
    await expect(
      authenticatedPage.locator(`[data-testid="search-result-${trilhaId}"]`),
    ).toHaveCount(0)
  })
```

- [ ] **Step 3: Criar o spec de busca**

`apps/web/src/__tests__/search.spec.ts`:

```ts
import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createMemory } from './helpers'

test.describe('Busca', () => {
  test('finds by tag, location, weather and author', async ({ authenticatedPage }) => {
    const alvo = await createMemory(authenticatedPage, {
      title: 'Domingo no Porto',
      content: 'Comemos polvo e andamos na orla.',
      memoryDate: '2026-08-15',
      locationName: 'Porto de São João',
      weatherDesc: 'Ensolarado',
      tags: ['viagem'],
    })

    const outra = await createMemory(authenticatedPage, {
      title: 'Sopa de casa',
      memoryDate: '2026-01-10',
    })

    for (const query of ['#viagem', 'local:Porto', 'clima:Ensolarado', 'ano:2026']) {
      await authenticatedPage.goto(`/search?q=${encodeURIComponent(query)}`)
      await expect(authenticatedPage.locator(`[data-memory-id="${alvo}"]`)).toBeVisible()
    }

    await authenticatedPage.goto('/search?q=%23viagem')
    await expect(authenticatedPage.locator(`[data-memory-id="${outra}"]`)).toHaveCount(0)
  })

  test('shows removable chips that rewrite the query', async ({ authenticatedPage }) => {
    await createMemory(authenticatedPage, {
      title: 'Festa Junina',
      memoryDate: '2026-06-24',
      tags: ['festa'],
    })

    await authenticatedPage.goto('/search?q=%23festa%20ano:2026')
    await expect(authenticatedPage.locator('[data-testid="search-chips"]')).toBeVisible()

    await authenticatedPage.locator('[data-testid="search-chip-ano: 2026"]').click()
    await expect(authenticatedPage).toHaveURL(/q=%23festa/)
  })

  test('hides private memories from anonymous search', async ({
    authenticatedPage,
    browser,
  }) => {
    // Created through the authenticated session: POST /api/memories requires it.
    // Only the browsing side needs to be anonymous.
    const publica = await createMemory(authenticatedPage, {
      title: 'Publica da crise',
      memoryDate: '2026-05-01',
      isPublic: true,
    })
    const privada = await createMemory(authenticatedPage, {
      title: 'Segredo da familia',
      memoryDate: '2026-05-02',
      isPublic: false,
    })

    const context = await browser.newContext()
    const anonymousPage = await context.newPage()

    await anonymousPage.goto('/search?q=crise')
    await expect(anonymousPage.locator(`[data-memory-id="${publica}"]`)).toBeVisible()

    await anonymousPage.goto('/search?q=familia')
    await expect(anonymousPage.locator(`[data-memory-id="${privada}"]`)).toHaveCount(0)

    await context.close()
  })

  test('keeps the create action in the header for a signed-in user', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')
    await authenticatedPage.evaluate(() => window.scrollTo(0, 2000))
    await expect(authenticatedPage.locator('[data-testid="nav-nova"]')).toBeVisible()
  })
})
```

> Se `anonymousPage` não existir como fixture em `fixtures.ts`, usar `test.use` com um `page` sem sessão — conferir o arquivo antes de rodar.

- [ ] **Step 4: Rodar a suíte E2E**

Run: `pnpm test:e2e` (o script raiz roda `turbo run test:e2e`; `apps/web` tem `test:e2e: playwright test`)
Expected: PASS.

> Só Chromium: não há Firefox instalado neste ambiente.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/__tests__
git commit -m "test(web): cover the search dialog, results page and query chips"
```

---

### Task 17: Verificação final

**Files:** nenhum

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: PASS com **zero** warnings.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Testes unitários e de integração**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 4: Suíte completa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: E2E**

Run: `pnpm test:e2e`
Expected: PASS em Chromium.

- [ ] **Step 6: Conferir a lista de tarefas**

Marcar em `docs/tasks.md` as checkboxes da seção 7.0 que foram concluídas. As três que exigem
ação manual (equivalência de predicado, `EXPLAIN`, e as de frontend) só são marcadas depois de
executadas no navegador ou no Postgres.

- [ ] **Step 7: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: mark the phase 7.0 tasks as done"
```

---

## Fora de escopo

- Processamento de imagem e validação de upload — Fase 7.1.
- Chips de tag/pessoa como filtro, drawer de detalhe — Fase 7.2.
- Harness de teste com Postgres real. Hoje nenhum teste executa o serviço contra banco
  real, então equivalência de predicado e uso de índice só são verificáveis manualmente
  (Task 5). Automatizar é candidato a fase própria.
