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
  return {
    start: new Date(Date.UTC(year, month ? month - 1 : 0, 1)),
    end: new Date(Date.UTC(year, month ?? 12, 1)),
  }
}
```

Aplicado com `gte` / `lt` sobre `memories.memoryDate`.

> **`month ?? 12` é o ponto sensível deste trecho, e `month + 1` seria um bug silencioso.**
> `Date.UTC` normaliza mês fora de 0..11 somando anos, então o limite exclusivo de Dezembro
> precisa ser escrito `Date.UTC(year, 12, 1)` para cair em 1º de janeiro do ano seguinte.
> `Date.UTC(year, month + 1, 1)` também produz janeiro — e por isso passa em qualquer
> conferência de olho nu — mas só porque `month + 1` é `13` quando `month` é `12`, e
> `Date.UTC(year, 13, 1)` é **1º de fevereiro**: um intervalo de dezembro largo demais, que
> puxa janeiro para dentro sem erro nenhum. A Task 5 do plano trava os dois com
> `date '2027-01-01' - date '2026-12-01' = 31` contra `date '2027-02-01' - date '2026-12-01' = 62`.

> **`memoryDate` é `timestamp(..., { mode: 'date' })`, não `date`.** O `EXTRACT` que foi
> removido usava o `TimeZone` da sessão do Postgres, enquanto o intervalo usa UTC. A
> equivalência entre os dois predicados **não é um teste automatizado nesta fase**: nenhum
> teste do repo executa o serviço contra Postgres real (ver "Limitações conhecidas"), então a
> conferência é um SQL manual na Task 5 do plano, com `SHOW TimeZone` e dados cruzando
> 31/12 e 01/01. Se ela divergir, a correção é construir os limites no fuso da sessão em vez
> de UTC — o que é a mesma família do split UTC/local registrado abaixo.

### 1.2 Índices

Btree, declarados no schema Drizzle (surgem via `pnpm db:generate`):

```sql
CREATE INDEX memories_user_date_idx    ON memories (user_id, memory_date DESC);
CREATE INDEX memory_photos_memory_idx  ON memory_photos (memory_id);
CREATE INDEX memory_people_memory_idx  ON memory_people (memory_id);
CREATE INDEX memory_tags_memory_idx    ON memory_tags (memory_id);
CREATE INDEX memory_tags_name_idx      ON memory_tags (name);
```

Feed público: **índice btree completo** em `(is_public, memory_date DESC)`, e não o índice
parcial que esta seção propunha:

```sql
CREATE INDEX memories_public_date_idx ON memories (is_public, memory_date DESC);
```

> **Por que o parcial foi descartado.** Um índice parcial `WHERE is_public = true` só é usado
> quando o planner consegue provar que a consulta implica o predicado. O feed de quem está
> logado filtra `is_public = true OR user_id = $1` — e o Postgres não prova que um `OR`
> implica `is_public = true`, então o índice parcial seria ignorado exatamente na consulta
> mais importante, a que o navegador de qualquer visitante logado faz primeiro. Colocando
> `is_public` como **primeira coluna** de um índice completo, o planner usa os dois braços:
> o `OR` vira dois `Bitmap Index Scan` sobre o mesmo índice, um por `is_public` e um por
> `user_id`. O índice fica maior (inclui as memórias privadas) e paga isso em troca de servir
> as duas metades da consulta. `packages/db/src/schema/__tests__/memories.test.ts:86` fixa
> isso com `expect(found?.config.where).toBeUndefined()`: um `where` ali reprova o teste.

### 1.3 `pg_trgm` para busca com wildcard

`search`, `location` e `weather` casam com `ilike '%termo%'`. Wildcard à esquerda não usa btree,
então sem trigram a busca nova continua sendo seq scan — exatamente o custo que esta fase remove.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX memories_title_trgm_idx    ON memories USING gin (title gin_trgm_ops);
CREATE INDEX memories_content_trgm_idx  ON memories USING gin (content gin_trgm_ops);
CREATE INDEX memories_location_trgm_idx ON memories USING gin (location_name gin_trgm_ops);
CREATE INDEX memories_weather_trgm_idx  ON memories USING gin (weather_desc gin_trgm_ops);
CREATE INDEX memory_tags_name_trgm_idx  ON memory_tags  USING gin (name gin_trgm_ops);
```

São **cinco**, não quatro: `memory_tags_name_trgm_idx` entrou na `0001_superb_hellcat.sql`
depois que o filtro de tag da busca ficou claro. `#festa` e `?tag=` casam com
`ilike(memoryTags.name, '%festa%')`, com wildcard à esquerda, e o índice btree
`memory_tags_name_idx` desta seção só atende o caminho de igualdade exata — sozinho ele não
serve o `#tag`, que é metade da razão de a coluna `name` estar indexada.

> **Esses cinco NÃO vão no schema Drizzle.** Os testes de DB usam SQLite in-memory e constroem as
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

De `4 + 3N` para **5 constantes**, independente do tamanho da página.

**Ordenação das relações dentro de cada grupo.** A seção original pedia preservar a ordem
original "por `createdAt`". O que foi entregue é mais estreito, e a diferença importa:

- **Fotos: ordenadas por `orderIndex`.** É a única ordem que o schema garante. `inArray` não
  promete ordem de volta, então o agrupamento ordena explicitamente por `orderIndex` depois.
  Nada preenche `orderIndex` no upload ainda, então hoje a ordenação é um no-op estável — ela
  fica porque `inArray` não vai passar a prometer ordem.
- **`people` e `tags`: sem ordenação alguma.** Não há coluna de posição em
  `memory_people`/`memory_tags`, e as duas tabelas não têm `created_at`. A ordem de volta é
  a que o Postgres escolher, hoje consistente na prática por serem tabelas pequenas, mas
  **não é contrato**. A galeria não embaralha (foto tem `orderIndex`); a lista de pessoas e a
  de tags podem mudar de ordem entre duas respostas idênticas. Renderizá-las exige que a
  7.2 escolha uma ordem explícita — é a mesma coisa que o card de tag clicável vai precisar.

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

A gramática tem **uma implementação só**, em `packages/schemas` (§2.2). O web parseia com a
mesma função da API, então não há o que divergir. O que continua proibido é o web *decidir* o que
um prefixo significa.

### 2.3 Nenhum parâmetro novo na API

O campo `search` de `memoryFiltersSchema` continua sendo o único param de texto e agora aceita
a gramática inteira.

> **Correção de uma contradição interna.** Este parágrafo dizia antes que "texto solto mantém o
> comportamento atual, então a mudança é aditiva". Isso contradiz §2.1, e a Concrete é bem pior que
> uma nota de rodapé: `search=praia sol` hoje é **um** `ilike '%praia sol%'`, ou seja, só acha
> memória com as duas palavras **adjacentes, nesta ordem**. Depois desta fase passa a ser `praia` E
> `sol`, em qualquer ordem e em qualquer coluna. Ou seja, a busca de texto solto muda de
> comportamento — e muda para mais permissivo, o que é o que a §2.1 quer. Quem ler só este
> parágrafo vai achar que nada mudou e vai estranhar o timeline devolvendo mais coisa. A
> substitui por `filter-memory.spec.ts`, que vive em `apps/web/src/__tests__/`, continua fazendo
> sentido — no cliente, não no servidor.

**Precedência entre a gramática e os parâmetros de URL.** A search box e os selects de filtro
descrevem as mesmas dimensões, então os dois podem falar ao mesmo tempo. A regra é: **a gramática
vence o parâmetro de URL da mesma dimensão**, e o parâmetro é descartado sem vestígio. `?weather=Sol`
com `clima:chuva` busca só `chuva`. A exceção é `?tag=`, que **não** é uma dimensão da gramática — é
um filtro separado — então os dois se aplicam e viram dois `EXISTS` em AND: a memória precisa ter as
duas tags. Consequência de UI, e é a Task 13 que tem de honrar: quando a query traz `clima:` ou
`local:`, os selects têm que refletir a query (ou desabilitar), senão o dropdown continua dizendo
`Sol` enquanto a busca devolve `chuva` — a interface mente sobre o que está filtrando.

`@autor` exige join em `users` — nova condição, sem novo parâmetro.

#### A projeção `memoryColumns`, e os dois Bugs que ela previne

O join do autor obriga `findAll` a abandonar o `db.select()` cru da Task 8 do plano por uma
**projeção nomeada de 21 colunas** (`memories.service.ts:70-92`, consumida em `:297`):

```ts
const memoryColumns = { id: memories.id, userId: memories.userId, /* … 19 outras … */ } as const
// …
db.select(memoryColumns).from(memories)  // nunca db.select()
```

**Por que um `select()` puro não sobrevive ao join.** O `select()` do Drizzle vira `SELECT *`,
que o Postgres resolve para a lista totalmente qualificada das colunas **das duas** tabelas do
`FROM` — 21 de `memories` e 7 de `users`. Aí `mapResultRow` aninha cada linha pelo caminho da
tabela, e o que volta não é uma linha: é `{ memories: {...}, users: {...} }`. Vale dizer o que
isso **não** é: não é colisão de `id`, porque as duas chaves caem em caminhos diferentes. A
consequência é pior que um valor errado em dois lugares.

**Falha 1 — vazamento de privacidade.** O objeto `users` que volta aninhado carrega
`{ id, email, name, image, emailVerified, createdAt, updatedAt }` — o **email e a imagem reais
de todo autor**. O feed deste serviço é legível por qualquer pessoa (`is_public = true`), então
a versão com `select()` cru teria devolvido, em cada memória de um feed público, o email e o
avatar de quem a escreveu. Não é um campo a mais na resposta: é PII de terceiro em dado
público, e nada no tipo `Memory` teria dado pista disso, porque o tipo é declarado para a linha
plana.

**Falha 2 — 500 em toda busca por autor.** O mesmo aninhamento deixa `row.id` como `undefined`.
`results.map(r => r.id)` (`:319`) entregaria então `[undefined]` ao `inArray` das três queries
de relação, e o postgres.js rejeita com `UNDEFINED_VALUE: Undefined values are not allowed`.
Ou seja: `?search=@bruce` — a função que o join existe para servir — derruba a requisição.

Nomear as colunas devolve a linha exatamente no formato anterior ao join, então `Memory` continua
inferindo certo e o id que as três queries de lote usam é o da memória. O teste
`memories.service.spec.ts` fixa a lista de chaves campo a campo e tem um segundo caso
("selects the same columns when no author is named") que impede a lista de virar condicional:
se a projeção passasse a ser `needsAuthorJoin ? <estrela> : memoryColumns`, a forma da resposta
passaria a depender de qual busca rodou, e um cliente distinguiria uma busca por autor de uma
busca comum olhando uma linha. **Consequência de manutenção: uma coluna nova em `memories` quebra
esse teste de propósito e tem de ser listada em `memoryColumns` à mão.**

#### O predicado de autor fica **fora** do `if (hasGrammar)`

O plano (Task 8, Step 4) punha o predicado de autor dentro do bloco `if (hasGrammar)`, junto
dos laços de termos e tags. Foi implementado fora, em `memories.service.ts:240-244`:

```ts
const author = grammar?.author ?? null
if (author) {
  conditions.push(or(ilike(users.name, `%${author}%`), ilike(users.email, `%${author}%`)))
}
```

**A razão é o par predicado/join.** As duas queries só fazem `leftJoin(users)` quando
`author !== null` (`:293-294`, `:309`, `:344-346`). Um predicado sobre `users` e o join que o
sustenta têm de ser decididos no mesmo lugar, e o `if (hasGrammar)` não é esse lugar: ele
responde a "a query tem alguma condição?", não a "esta query faz join?". Deixá-lo lá dentro
tornaria o acordo entre os dois dependente de `isEmptySearch` contar `author` — que é verdade
hoje e não é a razão declarada de nada. Os dois erros possíveis são simétricos e ruins: um
`where` nomeando tabela ausente do `FROM` é 500, e um join sem predicado é uma query mais lenta
que devolve as linhas erradas. Vale notar que a query de contagem não é bookkeeping opcional:
ela divide `conditions` com a de linhas, então assim que o predicado de autor entra ali, uma
contagem sem o join é literalmente `where users.name ilike …` com `users` fora do `FROM`.

A resposta passa a incluir a query canônica parseada, para que os chips venham do servidor em
vez de reparseados no cliente:

```ts
{ data: Memory[], pagination: {...}, searchMeta: ParsedSearchQuery | null }
```

`searchMeta` é `null` quando `search` não foi enviado **e** quando a query parseou para nada —
`search=!!!` é uma query que não produz condição nenhuma, e um meta que a anunciasse estaria
prometendo um filtro que não está no `where`. É a mesma regra (`hasGrammar`) que o filtro usa.
O campo entrou como `searchMeta: ParsedSearchQuery | null` em `PaginatedResponse`, que é o tipo
de retorno de `useMemories` (`apps/web/src/hooks/use-memories.ts:42`) — não há um
`PaginatedResponse` em `packages/schemas`; a resposta é montada no service e consumida pelo hook.
Note que `searchMeta` é a **gramática crua**, não os valores `effective*` que absorvem parâmetro
de URL: reportar `effectiveWeather` poria `Sol` na resposta de uma busca que filtrou `chuva`.

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
- "Nova Memória" entra no header **apenas para logado** → `/memories/new`, `nav-nova`, ícone-only
  abaixo de `sm`. Esta seção original mandava mostrá-lo também para anônimo, apontando para
  `/login`; isso foi revertido na execução. O header anônimo já tem "Entrar" persistente
  apontando para a mesma página, então a versão original colocaria dois botões com o mesmo
  destino no mesmo header. O item "Nova Memória" do dropdown do usuário
  (`data-testid="menu-nova"`) permanece, e é o destino no mobile, onde `hidden sm:block`
  remove o CTA do header. `navbar.tsx:122` é o `{isAuthenticated && (` que decide isso — para
  anônimo o CTA não é redirecionado, é **ausente**.
- Timeline perde o `<Input>` de busca e o `search` sai do `useFilters` da página; sobram ano e mês.
  Os dois `<select>` que sobram é o que a barra **renderiza** — mas `hasActiveFilters`
  (`memory-filters.tsx:41`) ainda testa `weather`, `location` e `tag` também. Isso é
  deliberado, não resto: a página e o `useFilters` continuam sendo a única coisa que carrega
  esses três parâmetros, então o botão "Limpar" aparece quando eles estão ativos mesmo com
  nada visível na barra que os tenha posto ali. Os controles de clima, local e tag voltam na
  7.2, e é lá que a lista volta a bater com o que a barra renderiza.

## 3. Qualidade

- `apps/web/src/components/create-memory-wizard.tsx:58` — `useForm<any>` →
  tipo derivado do schema Zod.
- `apps/api/src/server.ts:21` — error handler sem `any` explícito.
- `apps/api/src/modules/auth/auth.routes.spec.ts:25` — cast do mock.
- `useDebouncedValue` extraído para `apps/web/src/hooks/`; usado pelo `SearchDialog`.
  O effect artesanal de debounce saiu de `memory-filters.tsx` (que agora só tem ano/mês, sem
  input de texto — de fato não precisa mais dele).
- `apps/web/src/__tests__/filter-memory.spec.ts:41` era o **único** spec que preenchia
  `[data-testid="search"]` e precisou ser reescrito para o modal.

**Adição que o plano não previa:** `CreateMemoryFormValues` em
`packages/schemas/src/create-memory.ts:57` — `z.input<typeof createMemorySchema>`, não
`z.output`. Isso é deliberado e é o que conserta um bug: `zodResolver` entrega o **output
parseado** do schema, e `localDate` já devolve um `Date`. Com `useForm<CreateMemoryInput>`
(input), o `memoryDate` do formulário é uma **string** `'YYYY-MM-DD'` e a linha que consome
isso — `new Date(\`${data.memoryDate}T00:00:00\`)` — funciona. Com o tipo errado, o valor
vira `Date`, o template monta `Invalid Date`, o `JSON.stringify` manda `null` e o `localDate`
do servidor transforma em `new Date()`: **o seletor de data do wizard não funcionava, e toda
memória criada por ele era salva com o instante da criação**. Os quatro `step-*.tsx`
(`basic-info`, `location`, `music`, `people`) foram retipados para
`UseFormReturn<CreateMemoryFormValues, unknown, CreateMemoryInput>`, porque o `form` que
recebem é o mesmo objeto. Ver "Limitações conhecidas" para o bug que sobrou dele.

## Fora de escopo

- Processamento/normalização de imagem — é da 7.1.
- Chips de tag/pessoa como filtro, reflow da timeline, drawer de detalhe — 7.2.
- Busca por `weatherTemp`, `musicTrack`/`musicArtist` (existe spec E2E de música): a gramática
  não ganha token novo agora, texto solto já casa o título/conteúdo.
- Índice trigram em `users.name`: poucas linhas, ganho desprezível.

## Limitações conhecidas (aceitas na 7.0, não resolvidas)

Nenhum item desta lista foi corrigido nesta fase. Estão aqui para que ninguém leia o diff e
conclua o contrário, e para que a fase que pegar cada um saiba de onde começar.

**1. `pnpm db:migrate` não roda contra o banco de desenvolvimento.** O dev DB foi provisionado
com `db:push`, então `drizzle.__drizzle_migrations` nunca existiu e a `0000` não está registrada.
O comando cria a tabela de bookkeeping, não acha migração registrada, e tenta reaplicar a `0000`
contra tabelas que já existem: `ERROR: relation "accounts" already exists`. Não é corrigível pelo
arquivo de migration. Para verificar a 7.0 contra Postgres, aplicar o SQL do próprio arquivo via
`psql` numa transação, ou `db:push` num banco descartável. **Não mexer no bookkeeping de `0000` no
dev DB:** consertá-lo faz a `0001` falhar em seguida, porque os índices dela já estão lá.

**2. O split UTC/local, e o resíduo é o _inverso_ do que o plano dizia.** O serviço usa
`getUTCFullYear()` e o `memoryDate` é `timestamp`, enquanto `localDate` grava meia-noite **local**.
Um `EXTRACT` sobre a coluna respeitava o `TimeZone` da sessão; o intervalo compara instantes UTC, então
uma memória criada exatamente à meia-noite local do último dia do mês cai no mês seguinte. Não é
regressão — o `EXTRACT` tinha o mesmo corte — mas é um corte diferente.

O plano esperava que o resíduo fusse "o backend escolhe o ano UTC, um atrás do ano em que a memória
foi vivida". O que o código entregue faz é o contrário: `memory-filters.tsx:20` é
**`getUTCFullYear()`**, deliberadamente, para que a lista de anos e o ano que `onMonthChange` escreve
venham do mesmo relógio do backend — o comentário nas linhas 14-19 explica que um relógio local
colocaria um ano fora de lugar no select nas horas ao redor do Ano Novo. A consequência é que, para
um cliente **a leste do UTC**, às 00:30 de 1º de janeiro, a lista de opções **termina no ano
anterior**: `years` é `currentYear - i` para `i` em 0..9, e `currentYear` ainda é o ano UTC. O ano
novo não é selecionável até a meia-noite UTC. Correção de raiz: derivar a lista de anos da data que o
usuário escolheu, ou mandar o ano explicitamente com o mês, em vez de reconciliar dois relógios.

**3. O wizard de criação perde um dia para cliente a leste do UTC (+1..+14).** O `parseLocalDate` faz
match em `^(\d{4})-(\d{2})-(\d{2})` e descarta hora e offset, então o servidor fica com o dia
**escrito na string**; e o `JSON.stringify` renderiza o `Date` em UTC, logo a parte de data é o dia
UTC, não o dia local. Medido em browser real:

| fuso do cliente | vai pelo fio | guardado |
|---|---|---|
| UTC | `2026-09-27T00:00:00Z` | `2026-09-27` certo |
| America/Los_Angeles (UTC−7) | `2026-09-27T07:00:00Z` | `2026-09-27` certo |
| Asia/Tokyo (UTC+9) | `2026-09-26T15:00:00Z` | `2026-09-26` **um dia antes** |

A dependência é do offset do *cliente*, não do servidor. É estritamente melhor do que antes (todo
mundo ganhava o dia de hoje), mas continua sendo bug: a entrada do formulário é um dia civil e não
deveria cruzar o fio como um instante. Correção de raiz: mandar `'YYYY-MM-DD'` pelo wire e deixar o
`localDate` do servidor montar a meia-noite local, em vez de mandar um `Date`.

**4. Nenhum valor de dimensão da gramática pode conter `"`.** O tokenizer não tem sintaxe de escape
— a barra é um caractere comum — então `local:"a\"b"` quebra em `local: 'a'` mais a frase `b"`. É
deliberado: o serializer **não** inventa um escape, porque um escape falso é pior que o wrap
— `local:"a\"b"` reinterpretaria como `a\` mais a frase `b"`, que parece correto e não é. O teste
`has no way to represent a double quote inside a dimension value` fixa a invariante; se alguém
adicionar escape, é o sinal de que o serializer precisa ser revisitado. `parse → serialize → parse`
é sem perda em tudo que a gramática consegue expressar.

**5. `/search` lê só `q`, e `searchMeta` é a gramática crua.** `page.tsx` desestrutura apenas `q` e
`SearchResults` monta `filters` do zero (`{ page, limit, search }`), então `?year=` ou `?tag=` digitados
na URL de `/search` **são descartados pela página** e nunca chegam à API — não é que se apliquem sem
chip, é que não se aplicam. Separadamente, e por outro motivo, `searchMeta` é a gramática crua e não
os valores `effective*` que absorvem parâmetro de URL (§2.3: onde a gramática fala, o parâmetro é
descartado), então uma dimensão aplicada só por parâmetro **nunca** viraria chip. Na timeline isso é
invisível, porque a timeline não tem chips. Se a página `/search` um dia repassar `?year=`/`?tag=`, a
correção é na página — mexer em `searchMeta` para incluir parâmetros colidiria com a precedência do
§2.3.

**6. A verificação de `EXPLAIN ANALYZE` continua manual e sem resultado registrado.** Os índices estão
declarados e testados no schema (coluna a coluna, e `config.where` ausente para o feed público), e
`memories.service.sql.spec.ts` fixa o SQL que o serviço emite — mas o `memories.service.spec.ts`
inteiro roda contra um mock, e nenhuma suíte toca um planner. Nenhum artefato de `EXPLAIN` foi
colado em lugar nenhum do repositório, então a caixa correspondente em `docs/tasks.md` fica aberta.

**7. `people` e `tags` não têm ordem garantida** (ver §1.4). A galeria não embaralha porque foto tem
`orderIndex`; a ordem de volta de pessoas e tags é a que o Postgres escolher.

## Testes / verificação

**Unitário (novo, puro)**
- `search-query.spec.ts`: tabela de casos — cada dimensão isolada, combinações, frase com
  espaço, prefixo desconhecido, acento/caixa, ano e mês inválidos, query vazia, mês por nome.
  Round-trip `parse → serialize → parse`.

**Unitário (serviço)**
- Contagem de queries **constante** com página de 20 memórias (instrumentar o drizzle ou
  contar via mock) — trava o N+1.
- Busca por autor, tag, local e clima; texto solto; combinação AND.

> **A igualdade de conjunto entre `EXTRACT` e o intervalo não está aqui porque não pode
> estar.** Ela exigiria rodar `memoriesService` contra Postgres de verdade, e nenhum teste do
> repo faz isso: `memories.integration.test.ts` é nome enganoso e mocka o service;
> `packages/db/src/schema/__tests__/` é introspecção de `getTableConfig`, sem conexão e sem
> rows. A equivalência ficou como **conferência manual em SQL**, na Task 5 do plano, com
> `SHOW TimeZone`, dados cruzando 31/12 e 01/01, e as bordas de Dezembro pelo `month ?? 12`.
> Automatizá-la é candidato a fase própria ("Harness de teste com Postgres real"), fora do
> escopo da 7.0.

**Verificação de índice**
- `EXPLAIN ANALYZE` da timeline e de `search=#festa` confirmando Index Scan / Bitmap Index Scan
  em vez de Seq Scan. Manual, pelo mesmo motivo da nota acima, e ainda sem resultado registrado —
  ver limitação 6.

**Integração**
- `memories.integration.test.ts` cobre as rotas com o service mockado: 401 sem sessão, 400 de
  payload e de query param inválido, `mine` sem dono, e a página de detalhe pública. O que esta
  fase **prometia** aqui e **não** entregou — `GET /api/memories?search=…` para cada dimensão,
  `searchMeta` correto, paginação preservada — não existe nesse arquivo nem em outro: com o
  service mockado, um teste de rota não tem como afirmar nada sobre o SQL que ele gera. A
  cobertura de dimensão e de `searchMeta` ficou no nível de serviço, em
  `memories.service.spec.ts`. É a mesma lacuna de harness da nota acima, vista por outro ângulo.

**Adição que o plano não previa: `memories.service.sql.spec.ts`.** A suíte com mock que trava a
busca **não consegue ver agrupamento de parênteses**, e isso acabou importando. O `or` do mock
é `{ op: 'or', conds }` — não há lugar nessa forma de registrar se o grupo está parenthesado, e a
forma é justamente o que aquele arquivo afirma. Medido: reescrever o predicado de autor como
template `sql` deixa o teste vermelho, mas pela afirmação "o predicado não é mais um nó `or`", que
é outra coisa de "a cláusula renderiza sem parênteses", e é uma afirmação sobre um mock em vez de
sobre SQL. O achado por trás: com `drizzle-orm` os parênteses **são** a estrutura de nós —
`and`/`or` sempre envolve dois ou mais operandos —, então não há edição do serviço que perca o
agrupamento mantendo o nó. A única rota que o drizzle deixa aberta é o template `sql`, cujo texto
é emitido verbatim, e é por ali que o teste contra-exemplo constrói o vazamento.

O arquivo novo usa **`drizzle-orm/pg-proxy`**, cujo "driver" é um callback: o serviço roda o
caminho de código real — schema real, operadores reais, builder real, `leftJoin` real — e o que
chega ao array `executed` é exatamente o texto que o postgres.js receberia. Foi preferido a
`postgres('postgres://', { max: 0 })` + `.toSQL()` porque não há cliente nenhum ali, então não há
nada que *possa* conectar: sem socket, sem DNS, sem porta. O output é byte-idêntico ao
`.toSQL()` de `drizzle-orm/postgres-js` para a mesma query (verificado à mão), então nenhuma das
asserções depende de qual driver está trocado. O schema vem de `@chronicle/db/src/schema` e não do
barrel `@chronicle/db`, que reexporta `db` — um cliente postgres de verdade construído a partir do
`DATABASE_URL` de `env.ts`, e `env.ts` lança sem um. O caminho profundo é só definição de tabela,
então o arquivo não precisa de banco, `.env` nem rede, que é o único motivo de rodar em CI.

**E2E (Chromium)**
- `filter-memory.spec.ts` reescrito: sem o caso de input de busca (esse caminho virou o modal).
  Restam ano, mês, e o par mês-sem-ano, que é onde estava a armadilha do §2.1.
- **Dois** specs novos, não um: `search-dialog.spec.ts` (10 casos — o modal em si: abrir, digitar,
  setas, Enter, foco, debounce) e `search-page.spec.ts` (8 casos — chips removíveis alterando a
  URL, `/search` renderizando cards, busca anônima só com públicas). O nome `search.spec.ts` que
  esta seção propunha não existe em lugar nenhum. A divisão não é cosmética: o modal e a página
  compartilham quase nada, e um arquivo só seria grande demais para dizer o que quebrou.
- "Nova Memória" no header: coberto **para logado** (`nav-nova`). O caso anônimo que esta seção
  listava foi removido junto com o CTA — o que restou para o anônimo é a busca, que é pública.
- **Adição que o plano não previa: `contextOptions` atravessando `authenticatedPage`** em
  `apps/web/src/__tests__/fixtures.ts`. A fixture agora repassa `contextOptions` para
  `browser.newContext()`, para que um spec possa fixar opções de contexto de browser —
  `timezoneId` acima de tudo, que decide **que ano** um componente de cliente acha que é. Sem
  isso, qualquer spec de data herda o fuso da máquina que rodou o E2E, e o split UTC/local do §2
  é invisível em CI e visível no laptop de alguém, que é a pior das duas direções.

**Gates.** O comando que vale é **`pnpm exec biome check .` a partir da raiz**, não
`pnpm lint`: só `apps/web` define script `lint`, então `pnpm lint` — que é `turbo run lint` —
não olha `apps/api` nem `packages/*`, que é onde está quase todo o código desta fase, e sai 0
mesmo com avisos. Typecheck (`pnpm typecheck`), testes (`pnpm test:unit`, `pnpm test`) e E2E
(`pnpm test:e2e`) são gates de verdade e passaram todos.
