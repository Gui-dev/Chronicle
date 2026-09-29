# Fase 7.4 — Compartilhamento: Design

Data: 2026-09-29

## Objetivo

Quarta das 7 fases de "Produto Maduro". Transforma o binário público/privado em três
níveis de acesso e entrega compartilhamento por link temporário, com prévia redigida
e gestão/revogação:

| # | Item (tasks.md) | Entrega |
|---|-----------------|---------|
| 1 | Link privado com token expirável | `POST /api/memories/:id/share` → token de 7 dias em `/share/[token]` |
| 2 | Nível de acesso além de público/privado | Estado derivado `privado \| compartilhado \| público` + UI tri-state |
| 3 | Prévia redigida sem dados sensíveis do autor | Payload por whitelist: sem `email`, `userId`, lat/lng |
| 4 | Lista e revogação | Página `/share` com copiar/revogar + `DELETE .../share` |

## Decisões de produto (fechadas na sessão de design)

Registradas para não serem reabertas por engano:

1. **"Nível de acesso" = terceiro estado de visibilidade** (`privado | compartilhado |
   público`), não permissão por link (view/download). O link *é* o nível.
2. **TTL fixo de 7 dias**. "Gerar/Renovar" rotaciona o token e reinicia a validade —
   sem select de expiração na UI.
3. **Prévia = memória completa + identidade mínima do autor**: conteúdo integral (título,
   texto, data, local, clima, música, fotos, pessoas, tags, narrativa) e do autor só
   `name` + `image`. Nunca `email`, `userId` ou coordenadas exatas.
4. **Um link ativo por memória**. Rotacionar invalida o anterior; revogar mata o acesso.
5. **Lista em página nova `/share`** (`RequireAuth`), entrada pelo perfil
   (`profile-share-link`), no padrão de `/trash` e `/privacy`.
6. **Abordagem de modelo: colunas em `memories`** (`share_token`, `share_expires_at`),
   estado derivado. Recusadas: enum `visibility` substituindo `is_public` (churn no índice
   e na evidência da 7.0) e tabela `share_links` (join em todo acesso sem eliminar a
   derivação).

## Contexto verificado

- Visibilidade hoje é o boolean `is_public` (`packages/db/src/schema/memories.ts:33`,
  default `true`). O gate de detalhe é `memories.service.ts:426`
  (`!isPublic && memory.userId !== userId` → erro); o feed é
  `is_public = true OR user_id = $1`.
- **Não existe código de compartilhamento**: grep por `share|token` só acha o access
  token do Spotify. Zero tabelas, rotas ou UI.
- O feed público já serve fotos a visitantes anônimos pelo mesmo serializador — a prévia
  redigida reaproveita esse caminho de URL, sem mecanismo novo de storage.
- `RequireAuth` é por página (removido do layout na 6.3); rotas públicas existem
  (home). A página `/share/[token]` entra sem `RequireAuth`.
- O export da 7.3 estabeleceu o padrão de DTO por dono: campos sensíveis só quando o
  leitor é o dono da row.
- Migration `0003` (soft delete) foi aplicada via `psql`; `pnpm db:migrate` continua
  quebrado no dev DB. `0004` segue o mesmo caminho: `drizzle-kit generate` para produzir
  o SQL, `psql` para aplicar, journal atualizado pelo generate.

## 1. Modelo de dados

Migration `0004` — duas colunas e um índice:

```sql
ALTER TABLE memories ADD COLUMN share_token text;
ALTER TABLE memories ADD COLUMN share_expires_at timestamp;
CREATE UNIQUE INDEX memories_share_token_idx ON memories (share_token)
  WHERE share_token IS NOT NULL;
```

Sem backfill: token nulo + `is_public` como hoje descreve todo o dado existente.

**Estado derivado — regra fixa, uma só:**

| Estado | Condição |
|--------|----------|
| público | `is_public = true` |
| compartilhado | `!is_public` **e** `share_token != null` **e** `share_expires_at > now()` |
| privado | todo o resto (inclui token expirado) |

**Matriz de transição (invariantes travadas por teste):**

- `share(token)` — gira token (`crypto.randomBytes(32).toString('base64url')`) e põe
  `expires_at = now + 7d`. Se já havia token, o anterior morre no mesmo UPDATE
  (rotacionar é substituir, nunca acumular).
- `update` **com o campo `isPublic` presente no body (true ou false) limpa
  `share_token`/`share_expires_at`** — qualquer mudança explícita de visibilidade
  encerra o ciclo de compartilhamento vigente. Uma regra simétrica, sem ramo: "Privado"
  mata o link, "Público" também, e não há zumbi compartilhado que ressuscita numa
  alternância público → privado. `update` **sem** o campo `isPublic` (edição de título,
  texto etc.) não toca no token.
- Revogar (`DELETE share`) = setar as duas colunas para `NULL`. Estado volta a
  privado no mesmo commit.
- Expiração é checada com o relógio da aplicação (`new Date()` em JS), nunca com
  `now()` do Postgres — consistente com o resto do serviço e testável sem SQL.

**Por que derivado e não coluna explícita:** uma coluna `visibility` duplicaria o que
duas colunas já determinam e criaria duas fontes de verdade para divergir (ex.:
`visibility = 'shared'` com token nulo). A derivação é uma função pura
`row → estado`, unitariamente testável, e a UI recebe os campos brutos
(`shareToken`, `shareExpiresAt`, `isPublic`) para calcular o mesmo resultado.

## 2. API

Módulo novo `apps/api/src/modules/share/` (`share.routes.ts`, `share.service.ts`,
registrado em `server.ts` como `exportRoutes`/`userRoutes` já são). O endpoint de lista
de compartilhadas mora no módulo de memories (mesma service de feed).

### 2.1 `POST /api/memories/:id/share` — criar ou rotacionar (dono)

- **401** sem sessão. **404** para id inexistente ou não-dono (não revela existência,
  mesmo critério do export da 7.3). Memória soft-deletada → 404.
- Sucesso **201** com `{ token, expiresAt }`. `token` é o valor que vai na URL;
  `expiresAt` é ISO UTC.
- Não exige `!is_public` — evita um ramo de erro sem benefício. Se a memória é
  pública, o token criado é **inerte**: o estado derivado continua "público" e a
  próxima transição de visibilidade limpa o token antes que ele possa virar ativo.
  A UI não oferece a ação em memória pública; o caminho existe só para não ter
  condicional no serviço.

### 2.2 `DELETE /api/memories/:id/share` — revogar (dono)

- Mesmos códigos de erro do POST. **204** mesmo quando não havia link (idempotente:
  revogar duas vezes não é erro).

### 2.3 `GET /api/share/:token` — prévia pública

Rota pública (sem sessão). Lookup por token no índice parcial único.

- **404** com corpo genérico `{ error: 'Link inválido ou expirado' }` para qualquer
  falha: token desconhecido, `share_expires_at <= now()`, memória soft-deletada.
  **Um único código e uma única mensagem** — distinguir "existe mas expirou" de
  "  nunca existiu" daria um oráculo para enumerar tokens.
- Sucesso **200** com a prévia redigida (payload por whitelist, seção 3).
- `is_public` **não é checado**: se a memória é pública, o conteúdo já é público por
  outra porta, então servir a prévia é inofensivo — e manter o acesso em uma linha
  (token + expiração + não-deletada) evita ramo que ninguém precisa.

### 2.4 `GET /api/memories/shared` — lista para o dono

- **401** sem sessão (mesmo tratamento do filtro `deleted=true` da 7.3: owner-scoped
  por construção, sem depender de query param).
- Linhas: `!is_public AND share_token IS NOT NULL AND share_expires_at > now()`
  (apenas links **ativos** — expirados somem da lista; "Gerar/Renovar" num card volta
  a criar. Registrado como limitação conhecida na seção 6).
- Resposta por linha: `{ id, title, memoryDate, token, expiresAt }`. Token **só**
  existe no DTO do dono.

### 2.5 Detalhe da memória (`GET /api/memories/:id`)

`findById` passa a expor `shareToken` e `shareExpiresAt` **apenas quando
`session.user.id === memory.userId`**. O mapper de resposta nunca faz spread da row:
campos são nomeados um a um (já é o padrão), e feeds públicos/não-dono não incluem os
dois campos. Teste de serviço trava a ausência no DTO de leitor anônimo.

## 3. Prévia redigida (o payload)

**Whitelist, nunca blacklist.** O mapper da prévia monta o objeto campo a campo; o que
não está na lista não existe na resposta — um campo novo adicionado à tabela não vaza
por esquecimento.

```ts
{
  memory: {
    id, title, content, memoryDate,
    locationName,            // NUNCA locationLat/locationLng
    weatherDesc, weatherIcon,
    music: { title, artist, url, coverUrl },   // dados públicos do Spotify
    photos: [{ id, url, width, height }],
    people: [{ id, name }],
    tags:   [{ id, name }],
    aiNarrative,             // narrativa sim; aiMood/aiThemes não (metadados internos)
  },
  author: { name, image },   // NUNCA email, NUNCA userId
}
```

**Proibidos, por teste de integração que varre a resposta:**
`email`, `userId`, `locationLat`, `locationLng`, `shareToken`, `aiMood`,
`aiThemes`, `isPublic`, `deletedAt`, `createdAt`/`updatedAt` (datas de criação
internal — a data da memória basta).

Fotos usam o mesmo serviço/serializador de URL que o feed público já entrega a
anônimos.

## 4. Página pública `/share/[token]`

- `apps/web/src/app/share/[token]/page.tsx` — **fora** de `(dashboard)`, sem
  `RequireAuth`.
- `generateMetadata`: `robots: { index: false, follow: false }`. Um link temporário
  não pode aparecer em busca (não substitui revogação, mas fecha a porta óbvia).
- Busca `GET /api/share/:token`; **404 → estado de erro próprio** ("Link inválido ou
  expirado"), nunca redirect para home (o visitante precisa saber que o link morreu).
- Renderiza o mesmo card de detalhe da timeline com cabeçalho de autor redigido
  (nome + avatar), data, local, fotos, música, pessoas, tags e narrativa.
- Cliente usa `API_URL` como o resto do app; token nunca é logado além da URL.

## 5. UI do dono

### 5.1 Card da memória — ação "Compartilhar"

- Nova ação nos botões de dono, **renderizada somente quando `!isPublic`** (memória
  pública não precisa de link — o próprio endereço já é o compartilhamento).
- Dialog (mesmo componente de diálogo do app) com:
  - estado atual: **"Link ativo — expira em {data}"** (com token vigente) ou
    **"Sem link ativo"**;
  - **Gerar/Renovar link** (POST; rotaciona), **Copiar link** (clipboard, com toast de
    confirmação), **Revogar** (DELETE; volta a "Sem link ativo").
- O toggle público/privado existente **permanece binário e não vira tri-state** — ele
  só mexe em `isPublic`, e pela invariante da seção 1 virar "Privado" já revoga.
  O estado "compartilhado" é sinalizado pela ação/dialog, não por um terceiro ícone.

### 5.2 Página `/share` — lista e revogação

- `apps/web/src/app/(dashboard)/share/page.tsx` com `RequireAuth`.
- Alimentada por `GET /api/memories/shared`. Linha: título, data da memória,
  "Expira em {data}", botões **Copiar** e **Revogar** (confirmação inline simples:
  o item some da lista após 204).
- Estado vazio no padrão de `/trash`.
- Link `profile-share-link` no perfil, ao lado de Lixeira e Privacidade.
- Ações usam hooks no padrão `use-restore-memory.ts` (mutation + invalidação de
  `['memories', 'shared']`).

## 6. Fora de escopo e limitações conhecidas

**Fora de escopo** (decidido nas perguntas, não reabrir sem nova decisão):

- Senha no link; permissão por link (view vs download); múltiplos tokens por memória;
  auditoria/log de quem acessou; escolha de expiração pelo usuário; QR code;
  compartilhamento de álbum/lista (só memória individual).

**Limitações aceitas nesta fase:**

- **Links expirados somem da lista `/share`** sem aviso prévio — o card continua
  mostrando "Sem link ativo" e o dono gera de novo. Custa um teste de "revogação de
  link expirado" a menos na UI; a expiração em si é travada em serviço/integração.
- **`noindex` é cortesia, não garantia** — não protege contra alguém republicar o
  conteúdo; a revogação é a garantia real.
- **Token no mesmo pool de dados, sem RLS** — irrelevante num app com uma Postgres e
  autorização na aplicação; se um dia houver acesso direto ao banco, o token é
  segredo junto com o resto.
- **Estado derivado não é CHECK constraint** — o banco aceitaria `share_token`
  preenchido com `is_public = true`, estado que o serviço nunca produz (invariante da
  seção 1). As regras vivem no serviço e nos testes, não no DDL.
- **Sem índice em `share_expires_at`** — a lista é `WHERE user_id = $1 AND ...` já
  liderada por `memories_user_date_idx`; volume de compartilhadas por usuário é
  pequeno.

## 7. Testes / verificação

**Serviço (`share.service` + `memories.service`):**

1. gerar cria token e expiração em +7d;
2. rotacionar substitui o token (anterior invalidado) e renova expiração;
3. revogar limpa as duas colunas; revogar sem link é no-op sem erro;
4. `update(isPublic: false)` limpa o token (invariante anti-zumbi);
5. acesso por token válido entrega payload;
6. token expirado → 404; token desconhecido → 404; memória soft-deletada → 404;
7. lista: owner-scoped, só ativos, 401 sem sessão;
8. DTO: `shareToken` presente só no dono; ausente no leitor anônimo.

**Integração (rotas):**

9. POST 201/401/404 (id inexistente, não-dono);
10. DELETE 204/401;
11. `GET /api/share/:token` 200 **varrendo o corpo em busca dos proibidos**
    (`email`, `userId`, `locationLat`, `locationLng`, `shareToken`) e confirmando
    `author.name` presente;
12. 404 genérico idêntico para expirado e desconhecido (corpo igual);
13. `GET /api/memories/shared` 200 com campos do dono / 401 sem sessão.

**Schema (SQLite in-memory):**

14. colunas `share_token`/`share_expires_at` presentes e nullable;
15. índice único parcial — se o SQLite do teste não expressar `.where()` na asserção,
    segue o precedente de `memories_public_date_idx`: asserir a definição do índice no
    config (colunas + predicado), como `memories.test.ts:88` já faz.

**E2E (Playwright, chromium):**

16. dono com memória privada → Compartilhhar → Gerar → Copiar → **contexto anônimo
    novo** abre a URL → vê título/conteúdo/nome do autor e **não** vê email;
17. revogar → recarregar a URL pública → estado "Link inválido ou expirado";
18. lista `/share` mostra a linha, copia e revoga (item some).

**Gates da fase** (mesmos de 7.1–7.3): `pnpm build` 6/6 · `pnpm typecheck --force`
10/10 · `pnpm test` 8/8 · `biome check` 0 avisos · Playwright chromium verde.

**Pós-implementação manual:** aplicar `0004` no dev DB via `psql` (mesmo fluxo do
`0003`) e conferir `share_token` no `\d memories`.
