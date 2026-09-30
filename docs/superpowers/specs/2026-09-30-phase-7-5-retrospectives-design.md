# Fase 7.5 — Retrospectivas: Design

> Aprovado na sessão de brainstorming de 2026-09-30 (decisões de produto e de layout
> fechadas uma a uma; mockups no companion visual em `.superpowers/brainstorm/`).
> Itens do `docs/tasks.md` §7.5: "Há um ano" na home · resumos por período e novos
> itens desde a última visita · mapa de lugares · recorrências · formato
> "setembro de 2026" na timeline.

## Objetivo

Cinco entregas, todas do usuário logado, sem tocar no fluxo anônimo:

1. Bloco **"Há um ano"** na home: até 3 memórias do mesmo mês do ano passado.
2. **Resumos por período** + **novos itens desde a última visita** (requer
   `lastVisitAt`, a única migration nova da fase).
3. **Mapa de lugares visitados** a partir de `locationLat`/`locationLng`.
4. **Recorrências**: pessoas, lugares e temas mais frequentes (top 5).
5. **Marcador de mês na timeline** com o formato longo `setembro de 2026`.

## Decisões de produto (fechadas na sessão)

| # | Questão | Decisão |
|---|---------|---------|
| 1 | Onde vivem as retrospectivas | **Híbrido**: página nova `/retrospectivas` para mapa + recorrências + resumos; bloco enxuto "Há um ano" + "novos itens" só na home; formato de data na timeline |
| 2 | "Novos itens desde a última visita" | **Servidor**: coluna `lastVisitAt` em `users` (migration `0005`). Conta memórias **públicas de outras pessoas** criadas depois dela; funciona em qualquer dispositivo |
| 3 | Janela do "Há um ano" | **Mês do ano passado** (janela do mês corrente − 1 ano, em UTC), até 3 memórias; **some se vazio**. Só para logado |
| 4 | Formato "setembro de 2026" | **Marcadores de mês agrupando os cards** (reviver `timeline-marker.tsx`); card mantém a data cheia |
| 5 | Biblioteca de mapa | **Leaflet + tiles OSM/CARTO** (dep nova no web) |
| 6 | Conteúdo do resumo por período | **Números puros**: memórias, pessoas distintas, lugares distintos, top 3 tags |
| 7 | O que é "tema" nas recorrências | **`aiThemes`** (top 5), com nota de cobertura (memórias sem narrativa ficam de fora) |
| 8 | Onde aparecem os "novos itens" | **Bloco na home**, junto do "Há um ano"; `/retrospectivas` é análise |
| 9 | Layout da home (visual) | **A — faixa horizontal compacta**: contador à esquerda, mini-cards "Há um ano" à direita com scroll horizontal, uma faixa só |
| 10 | Layout de `/retrospectivas` (visual) | **B — dashboard 2 colunas**: esquerda = resumo + recorrências; direita = mapa sticky |
| 11 | Marcador da timeline (visual) | **C — rótulo simples à esquerda** em caixa-alta (`SETBRO` → `setembro de 2026`), sem régua; linhas de distância ("5 dias depois") **continuam** |

## Contexto verificado

- **Nenhuma query agregada existe** hoje na API (só `count(*)` de paginação em
  `memories.service.ts:330`); GROUP BY é padrão novo, começando neste módulo.
- **Não existe `lastVisitAt`/`last_seen`** em `users`, `sessions` ou qualquer lugar
  (`packages/db/src/schema/users.ts:3-11`).
- **`timeline-marker.tsx` é código morto** (nunca importado) e formata `set. 2026`
  via `toLocaleDateString` **local** — será reescrito em UTC longo.
- **Sem lib de mapa/gráfico** em nenhum `package.json` do monorepo.
- Dados prontos no schema: `locationLat`/`locationLng` (decimal) e `locationName`
  (`memories.ts:25-27`), `aiThemes` (text array, `:45`), `memory_people.name`,
  `memory_tags.name` (índice em `name`).
- `create-memory.ts:29-30` já valida `locationLat`/`locationLng` (o wizard envia) —
  o helper E2E `createMemory` é que não os passa ainda.
- Split UTC/local documentado na spec da 7.0: janelas de data em UTC (`dateRange`
  via `Date.UTC`), datas de entrada em local. **Todo cálculo desta fase é UTC.**
- Padrões a seguir: módulo `share` (rota pequena + `currentUserId` + `{ data }`),
  hook `use-shared-links`, `RequireAuth` + estados loading/error/empty com
  testid (lição da 7.4: **sempre ramo `isError`** — nunca mostrar vazio em falha).
- `reset-e2e-data.ts` só limpa memórias de `deb@test.com` + avatar — precisa
  passar a limpar também `lastVisitAt` e o segundo usuário de teste.

## 1. Modelo de dados

Uma coluna, uma migration:

```ts
// packages/db/src/schema/users.ts
lastVisitAt: timestamp('last_visit_at', { mode: 'date' }), // nullable, sem default
```

- Gerada com `pnpm db:generate` → migration `0005_*`, **aplicada via psql**
  (`pnpm db:migrate` continua quebrado no dev DB — fluxo da 0002/0003/0004).
- Teste de colunas de `users` em `packages/db/src/schema/__tests__/users.test.ts`
  ganha `['last_visit_at', 'PgTimestamp', false]`.
- Sem índice: a coluna é lida/escrita por usuário logado, escala de uma row.

## 2. API — módulo `retrospectives`

Novo módulo `apps/api/src/modules/retrospectives/` (`index.ts`,
`retrospectives.routes.ts`, `retrospectives.service.ts`), registrado em
`server.ts`. **Todas as 4 rotas exigem sessão** — sem sessão respondem
`401 { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }`
(mesmo helper `currentUserId(request)` do módulo `share`). Todas as leituras
filtram `deletedAt IS NULL`.

### 2.1 `GET /api/retrospectives/year-ago`

Faixa "Há um ano" da home.

- Query: sem parâmetros. Respeta a sessão.
- Seleciona as memórias **do próprio usuário** (`user_id = sessão`; qualquer
  visibilidade — é o dele), `deletedAt IS NULL`, cujo `memoryDate` cai no
  **mês corrente (UTC) do ano anterior**: janela
  `[Date.UTC(anoAtual − 1, mêsAtual, 1), Date.UTC(anoAtual − 1, mêsAtual + 1, 1))`.
  Fev/29 nunca aparece: o par (ano, mês) é sempre válido.
- Ordena `memoryDate DESC`, `limit 3`.
- **Implementação: reutilizar `memoriesService.findAll`** com
  `{ mine: true, year: anoAtual − 1, month: mêsAtual + 1, page: 1, limit: 3 }` —
  o `dateRange` da 7.0 já monta exatamente essa janela e os predicados
  (`mine` owner-scoped + `deletedAt IS NULL`) já estão testados. O serviço só
  envolve o resultado.
- Resposta: `{ data: MemoryCard[] }` — mesmo shape de item do feed (o strip
  mostra título + data; o mapper existente serve).

### 2.2 `GET /api/retrospectives/activity`

Contador "N memórias novas desde …".

- Resposta: `{ data: { count: number, since: string | null } }`
  (`since` = `lastVisitAt` em ISO 8601; `null` quando nunca visitou).
- Se `lastVisitAt IS NULL` → `{ count: 0, since: null }` (sem query de contagem).
- Contagem: memórias com
  `is_public = true AND user_id <> <sessão> AND created_at > <lastVisitAt>
  AND deleted_at IS NULL`.
  Estrictamente maiores que `since` (uma memória criada no mesmo instante da
  visita não conta — empate resolvido a favor de "não é nova").
- **Somente o número** — nenhum título/autor retorna aqui (nada de vazamento
  de conteúdo antes da visita ser "consumida").

### 2.3 `POST /api/retrospectives/visit`

- `lastVisitAt = now()` (row do usuário da sessão). Responde `204`.
- Chamado **uma vez** pela home (ver §3), depois que `activity` teve sucesso —
  leitura sempre precede a escrita.

### 2.4 `GET /api/retrospectives/overview?year=&month=`

- Parâmetros: `year` **opcional** (default = ano corrente UTC), `month` opcional
  (1-12; ausente = ano inteiro). Zod valida → `400` em valor inválido.
- Resposta:

```jsonc
{ "data": {
  "period": { "year": 2026, "month": 9 },          // month: null se ano inteiro
  "years": [2024, 2025, 2026],                      // anos com memórias do usuário (popula o seletor)
  "summary": {
    "memories": 24,
    "people": 8,                                    // count(distinct memory_people.name)
    "places": 12,                                   // count(distinct location_name) não nulo
    "topTags": [{ "name": "praia", "count": 4 }, … ] // top 3, count desc, name asc no desempate
  },
  "recurrences": {
    "people":  [{ "name": "Ana", "count": 9 }, … ],  // top 5
    "places":  [{ "name": "Recife", "count": 12 }, … ],
    "themes":  [{ "name": "família", "count": 6 }, … ]
  },
  "places": [{ "name": "Recife", "lat": -8.05, "lng": -34.9, "count": 12 }, … ]
}}
```

- **Escopos**: `summary` e `recurrences` respeitam o período (`year`/`month`
  sobre `memory_date`, UTC, mesmo `dateRange`); `places` do mapa é
  **all-time** (o mapa é acumulativo e não tem seletor de período);
  `years` também é all-time. Tudo owner-scoped (`user_id = sessão`,
  `deleted_at IS NULL`) — é o próprio usuário.
- `recurrences.themes` = `unnest(ai_themes)` agrupado; memórias com
  `ai_themes IS NULL` simplesmente não entram.
- `recurrences.places` agrupa `location_name IS NOT NULL`; `summary.places`
  é o `count(distinct)` do mesmo recorte.
- `places` do mapa agrupa por `(location_name, location_lat, location_lng)` —
  o mesmo nome com coordenadas editadas vira dois pontos (documentado, §10).
- Ordenação determinística: `count DESC, name ASC`.
- Queries: ~6 GROUP BY em um request. Sem índice em `location`/`aiThemes` —
  seq scan aceitável (rows de um usuário; ver §10).

## 3. Home — faixa horizontal (layout visual A)

Componente `apps/web/src/components/home-retrospect-strip.tsx` (`'use client'`),
renderizado em `(dashboard)/page.tsx` **apenas quando `isAuthenticated`**, entre o
subtítulo e `<MemoryFilters>`.

- **Duas queries** (padrão da casa, com ramo de erro — lição da 7.4):
  - `['retro', 'year-ago']` → `GET /year-ago`, `staleTime: 0`.
  - `['retro', 'activity']` → `GET /activity`, `staleTime: 0`.
  - Ambas com estados: `retro-strip-loading` (esqueleto simples), `retro-strip-error`
    (texto discreto; **nunca cair no vazio**) e render final condicional.
- **Faixa** (um único `<div>` card, `data-testid="retro-strip"`):
  - Esquerda — só se `count > 0`: `“N memórias nova(s) desde <dia da semana>”`
    (`data-testid="retro-new"`; `since` formatado em PT com dia da semana em
    minúsculas, ex.: `desde terça`). Clicar faz scroll suave até o timeline
    (container ganha `id="timeline"` na própria página) — `retro-new-go`.
  - Divisória vertical.
  - Direita — só se `year-ago.data.length > 0`: até 3 mini-cards
    (`data-testid="retro-year-ago-<memoryId>"`): título (`retro-year-ago-title`)
    + `setembro de 2025` (`retro-year-ago-date`, helper UTC longo). Contêiner com
    `overflow-x-auto`. **Sem clique de navegação**: a página de detalhe de
    memória foi removida na 6.3 — o mini-card é informativo.
  - Se as duas queries vazias/ocultas → **faixa inteira não renderiza** (nada de
    card fantasma).
- **Bump da visita**: `useEffect` que dispara `POST /visit`
  (`useMutation`, `['retro','visit']`) **somente quando a query `activity` deu
  sucesso** — leitura → escrita, sempre nessa ordem (dois requests concorrentes
  poderiam gravar `now` antes de a contagem ser lida). É a **exceção
  deliberada** à regra "evite useEffect" do AGENTS: side effect de montagem,
  fire-and-forget, sem dado reativo — nenhuma query/action serve para isso.
  Repetição no StrictMode é idempotente (grava `now` duas vezes).
- Depois do bump, a próxima visita lê `count: 0` → faixa some; nada de
  invalidar no mesmo mount (evitaria mostrar o valor lido).

## 4. Timeline — marcadores de mês (layout visual C)

- `apps/web/src/components/timeline-marker.tsx` **reescrito**:
  - Formato: mês longo PT + ano, **UTC** (`setembro de 2026`), ex.:
    `const monthNames = ['janeiro', …]; \`${monthNames[d.getUTCMonth()]} de ${d.getUTCFullYear()}\``.
    Sai `toLocaleDateString` local/`set. 2026`.
  - Visual: rótulo à esquerda, `text-xs uppercase tracking-widest text-muted`,
    sem régua, sem pílula.
- `apps/web/src/components/memory-timeline.tsx` agrupa: antes do primeiro card
  de cada mês (comparação do `(ano, mês)` UTC do card com o anterior) renderiza
  `<TimelineMarker date={memory.memoryDate} />` com `data-testid="timeline-marker"`.
- **Linhas de distância ("5 dias depois") permanecem intactas** (decisão 11).
- Cards não mudam (data cheia continua).

## 5. Página `/retrospectivas` (layout visual B)

`apps/web/src/app/(dashboard)/retrospectivas/page.tsx` (`'use client'`),
`RequireAuth` (o dado todo é do dono; API devolve 401 sem sessão).

- **Cabeçalho**: título `Retrospectivas` + seletor de período à direita:
  - Ano: `<select>` populado por `overview.years` (desc, do mais recente),
    `data-testid="retro-year"`.
  - Mês: `<select>` `Todos os meses` + janeiro…dezembro (UTC),
    `data-testid="retro-month"`. Default: ano corrente, mês = todos.
- **Query**: `['retro', 'overview', { year, month }]` → `GET /overview?year=&month=`,
  `staleTime: 0`. Estados: `retro-loading`, **`retro-error`** (ramo próprio,
  nunca vazio), `retro-empty` quando `summary.memories === 0` ("Nenhuma memória
  no período.") — nesse caso recorte e recorrências viram o vazio, **mas o mapa
  continua** quando houver `places` (ele é all-time, não pertence ao período).
- Seletor de ano: opções = `overview.years`; se o `period.year` pedido não
  estiver na lista (usuário sem memórias no ano corrente), ele é prependido —
  o `<select>` sempre reflete o período servido.
- **Grid 2 colunas** (`lg:grid-cols-2`, empilha abaixo de `lg`):
  - **Esquerda**:
    - Resumo: 4 cards de números (`retro-stat-memories` / `-people` / `-places`
      / `-top-tags`): contagens + top 3 tags como `#tag` (não clicável — a busca
      por tag já existe e este card é leitura).
    - 3 cards de recorrências (`retro-rec-people` / `-places` / `-themes`):
      top 5 como `Nome ×N`. Card de temas com nota discreta:
      *“contagem só de memórias com narrativa gerada”*; sem dados → "Sem dados
      no período".
  - **Direita**: mapa + lista de lugares, `sticky lg:top-24`
    (§6). Sem `places` → em vez do mapa, nota `retro-map-empty`
    ("Nenhum lugar com localização registrada.") — não carrega Leaflet à toa.
- Ordem mobile: resumo → recorrências → mapa+lista (fiel ao DOM do layout B).

## 6. Mapa — Leaflet + tiles escuros

- **Lib**: `leaflet` **puro** (sem `react-leaflet` — evita checagem de peer
  dependency com React 19; Leaflet puro é ~40KB e framework-agnostic).
- Componente `apps/web/src/components/retrospect-map.tsx` (`'use client'`):
  montagem em `useEffect` sobre uma `div` com `data-testid="retro-map"`.
- **SSR**: carregado com `next/dynamic(..., { ssr: false })` — o import do
  Leaflet toca `window` e a página é prerenderizada.
- **Tiles**: CARTO dark (`dark_all`) — combina com a paleta dark do Chronicle
  (OSM padrão é claro). Atribuição `© OpenStreetMap © CARTO` obrigatória.
  Tiles caem/offline → retângulo cinza, **a lista continua funcional** (fallback
  já previsto).
- **Pins**: `L.divIcon` com pin customizado em `--primary` (`#f0c040`) — não
  depender dos PNGs do Leaflet no bundle. Tooltip: `Recife — 12 memórias`.
- `fitBounds` no mount cobrindo todos os places; um place → `setView(zoom 10)`.
- **Lista ao lado** (sempre renderizada): `data-testid="retro-place-list"`, cada
  lugar um `<button>` (`retro-place-<i>`) `nome — N`; clicar → `map.flyTo` na
  coordenada (caminho de acessibilidade: quem não usa mouse/mapa alcança o lugar
  pela lista). Container do mapa: `h-96 lg:h-[480px]`, borda `border-card`,
  `rounded-xl overflow-hidden`.

## 7. Navegação

- Dropdown do usuário (`navbar.tsx`): novo item **`Retrospectivas`**
  (`data-testid="menu-retrospectivas"`, ícone `History` do lucide) entre
  `menu-my-memories` e `menu-profile`. Coberto pelo dropdown já existente no
  mobile (nenhum ajuste extra).
- Perfil: sem link extra (o dropdown basta — decisão 1: entrada pela nav).

## 8. Segurança / privacidade

- 4 rotas com sessão obrigatória; tudo owner-scoped — nenhuma rota desta fase
  lê memória de terceiros (o `activity` devolve **só um número**).
- Não expor `lastVisitAt` em nenhum outro payload (não entra no `users` mapper
  de perfil — conferir `profile`/`auth` ao implementar).
- Mapa e recorrências só agregam dados do próprio usuário; o mapa não tem
  coordenadas de ninguém além do dono.

## 9. Testes

**`packages/db`**
- `users.test.ts`: coluna `last_visit_at` no array exato de colunas.

**API — `retrospectives.service.spec.ts`** (mock de db no padrão da casa)
- year-ago: janela correta (fronteira `31/01` e `01/03` no ano anterior
  **fora**; `01/02`…`28/02` **dentro**), `mine` owner-scoped, `deletedAt IS NULL`,
  `limit 3`, delega a `findAll` com os filtros certos (parâmetros gravados).
- activity: `lastVisitAt` null → `count 0` sem query; predicados
  (`is_public`, `user_id <> sessão`, `created_at >`, `deleted_at IS NULL`).
- visit: grava `now()` na row certa.
- overview: `default year` = ano corrente; recortes de ano/mês; top 3 tags e
  top 5×3 ordenação (`count DESC, name ASC`); `places` **ignora** o período;
  `summary`/`recurrences` respeitam; `themes` sobre `unnest`; escopo do dono.

**API — `retrospectives.integration.test.ts`** (`buildServer` + inject)
- 401 nas 4 rotas sem sessão; 200 com shapes exatos (`data` envelope); `400` em
  `year=abc`; `204` no `POST /visit`.

**E2E — `apps/web/src/__tests__/retrospectives.spec.ts`**
- Helper `createMemory` ganha `locationLat?`/`locationLng?` (o schema de create
  já aceita); `MemoryData` estende com eles.
- **Reset**: `reset-e2e-data.ts` passa a (a) fazer `last_visit_at = NULL` de
  `deb@test.com` e (b) apagar memórias de `other@test.com` (segundo usuário
  usado no teste de activity).
- Casos:
  1. **Faixa "Há um ano"**: seed com `memoryDate` = mesmo mês do ano anterior
     (computado no teste) → `retro-strip` e `retro-year-ago-<id>` visíveis;
     `retro-new` **ausente** (reset zera `last_visit_at` → count 0). Sem seed
     no mês anterior → faixa inteira não renderiza.
  2. **Novos itens** (sequência importa — `lastVisitAt` null curta a contagem):
     (a) deb `POST /retrospectives/visit` via API; (b) esperar ~1.1s (o
     predicado é `created_at > lastVisitAt`, estrito); (c) registrar
     `other@test.com` via API e criar memória **pública** dele; (d) home →
     `retro-new` com "1 memória nova"; (e) reload (o bump de montagem gravou
     `now` > `created_at`) → `retro-new` ausente.
  3. **Marcador da timeline**: dois seeds em meses diferentes → dois
     `timeline-marker` com `setembro de 2026`/`agosto de 2026` (computados dos
     seeds, UTC); linhas de distância ainda presentes.
  4. **`/retrospectivas`**: seed com pessoa/lugar/tag → stats com os números,
     recorrências de pessoas/lugares preenchidas, card de temas com "Sem dados
     no período" (**sem gerar narrativa** — `aiThemes` só vem da IA, que o E2E
     não chama), `retro-place-list` com o lugar, mapa com `retro-map` (assertar
     o **container**, não os tiles — CI pode estar sem rede externa); seletor
     de ano troca o período sem erro.
- **Suite existente**: marcadores adicionam nós de texto na timeline — rodar a
  suíte completa e ajustar specs que contarem elementos, se algum falhar
  (produto/spec, nunca "afrouxar" asserção sem reportar).

## 10. Fora de escopo e limitações conhecidas

- **`aiThemes` esparsa**: recorrência de temas subconta memórias sem narrativa
  gerada; a nota no card é o tratamento (escolha 7 — não é bug).
- **Tiles externos**: mapa depende de rede externa (CARTO); offline fica cinza e
  a lista assume — sem retry agressivo.
- **Sem índice** em `location_*`/`ai_themes`: GROUP BY é seq scan no escopo de
  um usuário; revisar só se a fase 7.x de performance reclamar.
- **Places duplicados**: mesmo `location_name` com coordenadas editadas gera
  dois pontos (agrupamento por `(name, lat, lng)` é proposital — não se mexe em
  geocodificação nesta fase).
- **Sem web unit test** (o web não tem vitest): verificação web = typecheck +
  biome + build + E2E.
- **`lastVisitAt` é granularidade de visita, não de leitura**: não há polling da
  faixa (sem `refetchInterval`); a home só atualiza ao montar.
- **Faixa informativa sem navegação**: mini-cards do "Há um ano" não clicam
  (não existe página de detalhe desde a 6.3).
- **Anos do seletor** = anos com memórias (`overview.years` — sem endpoint
  dedicado); seed artificial de ano futuro não aparece (aceito).
- `pnpm db:migrate` segue quebrado no dev DB; `0005` aplicada via psql
  (mesma nota manual das fases anteriores).

## 11. Gates e atualização do `docs/tasks.md`

- Gates como na 7.4: `pnpm lint:fix` + `biome check .` 0 avisos ·
  `pnpm typecheck --force` 10/10 · `pnpm build` 6/6 · `pnpm test` 8/8 ·
  Playwright chromium (contagem nova, reportar o valor real).
- Ao fim: marcar os **5 itens** de `### 7.5 Retrospectivas` como `[x]` com
  texto resumo (padrão das fases) + bloco `#### Gates da 7.5` com números
  reais — pedido explícito do usuário.
