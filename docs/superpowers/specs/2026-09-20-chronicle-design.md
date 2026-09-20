# Chronicle — Soundtrack da Sua Vida

## Visão Geral

App de registro de memórias com timeline cinematográfica. O usuário registra momentos e o sistema associa data, localização, clima, música, fotos, texto, pessoas e acontecimentos. A navegação é uma linha do tempo cinematográfica, não uma lista de registros. IA transforma registros em memórias narrativas.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | Turborepo |
| Frontend | Next.js + Shadcn + Tanstack Query |
| Backend | Fastify |
| DB | PostgreSQL + Drizzle ORM |
| Auth | Better Auth (email/senha) |
| Storage | MinIO (S3-compatível) |
| Email | Mailpit (dev) |
| Clima | Open-Meteo (grátis, sem API key) |
| Geocoding | Open-Meteo (grátis, sem API key) |
| Música | Spotify API |
| AI | Definir depois |
| Validação | Zod |
| Lint/Format | BiomeJS |
| Git hooks | Lefthook (pre-commit, pre-push) |
| Testes | Vitest + Playwright + MSW (TDD, in-memory) |
| Docs | Swagger/Scalar (API) + Storybook (UI) |

## Convenções

- Arquivos: `kebab-case` em tudo (API e Web)
- Componentes React: `kebab-case` (ex: `memory-card.tsx`)
- Tests: `*.test.ts` / `*.test.tsx` co-located
- E2E: `*.spec.ts` em pasta `e2e/`
- Princípios: SOLID

## Estrutura do Monorepo

```
chronicle/
├── apps/
│   ├── web/                    → Next.js (SSR + Client Components)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx          → Navbar + Player fixo
│   │   │   │   ├── page.tsx            → Timeline principal
│   │   │   │   └── memories/
│   │   │   │       ├── new/page.tsx    → Criar memória
│   │   │   │       └── [id]/page.tsx   → Detalhe memória
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── memory-card.tsx
│   │   │   ├── audio-player.tsx
│   │   │   ├── photo-gallery.tsx
│   │   │   ├── memory-filters.tsx
│   │   │   └── timeline-marker.tsx
│   │   ├── hooks/
│   │   │   ├── use-memories.ts
│   │   │   ├── use-spotify.ts
│   │   │   └── use-weather.ts
│   │   └── lib/
│   │       ├── api-client.ts
│   │       └── query-config.ts
│   └── api/                    → Fastify (REST API)
│       └── src/
│           ├── modules/
│           │   └── memories/
│           │       ├── create-memory.ts
│           │       ├── create-memory.test.ts
│           │       ├── get-memories.ts
│           │       └── get-memories.test.ts
│           └── tests/
│               ├── memories.e2e.ts
│               └── fixtures/
├── packages/
│   ├── ui/                     → Shadcn + Storybook
│   │   ├── src/components/
│   │   ├── stories/
│   │   └── .storybook/
│   ├── db/                     → Drizzle schema + migrations
│   ├── schemas/                → Zod schemas (compartilhados)
│   └── auth/                   → Better Auth config
├── turbo.json
├── biome.json
├── package.json
└── podman-compose.yml
```

## Modelo de Dados

```sql
-- Usuários (Better Auth)
users (
  id            UUID PRIMARY KEY
  email         VARCHAR(255) UNIQUE
  name          VARCHAR(255)
  password_hash VARCHAR(255)
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
)

-- Memórias
memories (
  id            UUID PRIMARY KEY
  user_id       UUID REFERENCES users(id)
  title         VARCHAR(255)
  content       TEXT
  memory_date   TIMESTAMP
  location_name VARCHAR(255)
  location_lat  DECIMAL
  location_lng  DECIMAL
  weather_temp  DECIMAL
  weather_desc  VARCHAR(100)
  weather_icon  VARCHAR(50)
  music_track   VARCHAR(255)
  music_artist  VARCHAR(255)
  music_url     TEXT
  music_cover   TEXT
  ai_narrative  TEXT
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
)

-- Fotos (1:N)
memory_photos (
  id          UUID PRIMARY KEY
  memory_id   UUID REFERENCES memories(id)
  url         TEXT
  order_index INTEGER
)

-- Pessoas (N:N)
memory_people (
  id          UUID PRIMARY KEY
  memory_id   UUID REFERENCES memories(id)
  name        VARCHAR(255)
)

-- Tags (N:N)
memory_tags (
  id          UUID PRIMARY KEY
  memory_id   UUID REFERENCES memories(id)
  name        VARCHAR(100)
)
```

## API (Fastify)

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Registro |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuário atual |

### Memórias
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/memories | Criar memória |
| GET | /api/memories | Listar (filtros: ano, clima, local, tag) |
| GET | /api/memories/:id | Detalhe |
| PUT | /api/memories/:id | Atualizar |
| DELETE | /api/memories/:id | Deletar |

### Fotos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/memories/:id/photos | Upload foto (MinIO) |
| DELETE | /api/memories/:id/photos/:photoId | Deletar foto |

### Integrações
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/spotify/search?q= | Buscar música |
| GET | /api/weather?lat=&lng= | Clima atual |
| GET | /api/geocoding?q= | Buscar localização |
| POST | /api/memories/:id/generate-narrative | Gerar narrativa IA |

### Padrão de Resposta
```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 50 }
}
```

### Erros
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Memória não encontrada"
  }
}
```

## Paleta de Cores

```css
--background:       #0a0a0f;
--card:             #1a1a2e;
--card-border:      #2a2a3e;
--primary:          #f0c040;
--primary-hover:    #d4a830;
--secondary:        #ff8c00;
--text:             #ffffff;
--text-muted:       #a0a0b0;
--timeline-line:    linear-gradient(#f0c040, #ff8c00);
```

## Testes

| Tipo | Ferramenta | O que testa | DB |
|------|-----------|-------------|-----|
| Unit | Vitest | Lógica pura, services, utils | In-memory (SQLite) |
| Integration | Vitest + MSW | API routes com mocks externos | In-memory |
| Component | Vitest + Testing Library | Componentes React | N/A |
| E2E | Playwright | Fluxo completo no browser | Postgres real |

## Infraestrutura (Podman Compose)

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    env:
      POSTGRES_DB: chronicle
      POSTGRES_USER: chronicle
      POSTGRES_PASSWORD: chronicle

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    env:
      MINIO_ROOT_USER: chronicle
      MINIO_ROOT_PASSWORD: chronicle123

  mailpit:
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]
```
