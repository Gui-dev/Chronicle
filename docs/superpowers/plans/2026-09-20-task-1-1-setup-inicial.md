# Task 1.1: Setup Inicial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar o monorepo com Turborepo, BiomeJS, Lefthook, Podman Compose e scripts de desenvolvimento.

**Architecture:** Monorepo com Turborepo gerenciando apps/web e apps/api. BiomeJS para lint/format. Lefthook para git hooks. Podman Compose para infraestrutura local (PostgreSQL, MinIO, Mailpit).

**Tech Stack:** pnpm, Turborepo, BiomeJS, Lefthook, Podman Compose

---

## File Structure

```
chronicle/
├── package.json              → Root package.json com scripts
├── pnpm-workspace.yaml       → Workspace config
├── turbo.json                → Turborepo config
├── biome.json                → BiomeJS config
├── lefthook.yml              → Git hooks config
├── podman-compose.yml        → Infraestrutura local
├── apps/
│   ├── web/                  → (criado na task 1.2)
│   └── api/                  → (criado na task 1.2)
└── packages/
    ├── ui/                   → (criado na task 1.5)
    ├── db/                   → (criado na task 1.2)
    ├── schemas/              → (criado na task 1.3)
    └── auth/                 → (criado na task 1.4)
```

---

### Task 1: Inicializar pnpm workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Criar package.json raiz**

```json
{
  "name": "chronicle",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm:dev:*\"",
    "dev:infra": "podman compose up -d",
    "dev:api": "pnpm --filter api dev",
    "dev:web": "pnpm --filter web dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:e2e": "turbo run test:e2e",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "concurrently": "^9.0.0",
    "lefthook": "^1.10.0",
    "turbo": "^2.3.0"
  }
}
```

- [ ] **Step 2: Criar pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Instalar dependências**

Run: `pnpm install`
Expected: Dependentças instaladas com sucesso

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace with turbo, biome, lefthook"
```

---

### Task 2: Configurar Turborepo

**Files:**
- Create: `turbo.json`

- [ ] **Step 1: Criar turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "test:unit": {
      "dependsOn": ["^build"]
    },
    "test:e2e": {
      "dependsOn": ["build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "lint:fix": {}
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: configure turborepo tasks"
```

---

### Task 3: Configurar BiomeJS

**Files:**
- Create: `biome.json`

- [ ] **Step 1: Criar biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "warn",
        "noUnusedVariables": "warn"
      },
      "style": {
        "noNonNullAssertion": "off"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "ignore": ["node_modules", ".next", "dist", "*.config.*"]
  }
}
```

- [ ] **Step 2: Testar lint no package.json**

Run: `pnpm lint`
Expected: Sem erros (pode ter warnings)

- [ ] **Step 3: Commit**

```bash
git add biome.json
git commit -m "chore: configure biomejs for lint and format"
```

---

### Task 4: Configurar Lefthook

**Files:**
- Create: `lefthook.yml`

- [ ] **Step 1: Criar lefthook.yml**

```yaml
pre-commit:
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx,json,css}"
      run: pnpm biome check --no-errors-on-unmatched --staged {staged_files}
      stage_fixed: true

pre-push:
  commands:
    test:
      run: pnpm test
```

- [ ] **Step 2: Instalar hooks**

Run: `pnpm lefthook install`
Expected: Hooks instalados com sucesso

- [ ] **Step 3: Commit**

```bash
git add lefthook.yml
git commit -m "chore: configure lefthook git hooks"
```

---

### Task 5: Configurar Podman Compose

**Files:**
- Create: `podman-compose.yml`

- [ ] **Step 1: Criar podman-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: chronicle-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: chronicle
      POSTGRES_USER: chronicle
      POSTGRES_PASSWORD: chronicle
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chronicle"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    container_name: chronicle-minio
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: chronicle
      MINIO_ROOT_PASSWORD: chronicle123
    volumes:
      - minio-data:/data

  mailpit:
    image: axllent/mailpit
    container_name: chronicle-mailpit
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres-data:
  minio-data:
```

- [ ] **Step 2: Testar infraestrutura**

Run: `pnpm dev:infra`
Expected: Containers iniciados com sucesso

- [ ] **Step 3: Verificar status**

Run: `podman ps`
Expected: 3 containers rodando (postgres, minio, mailpit)

- [ ] **Step 4: Commit**

```bash
git add podman-compose.yml
git commit -m "chore: add podman compose for local infrastructure"
```

---

### Task 6: Criar .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Criar .env.example**

```env
# Database
DATABASE_URL=postgresql://chronicle:chronicle@localhost:5432/chronicle

# MinIO (S3)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=chronicle
MINIO_SECRET_KEY=chronicle123
MINIO_BUCKET=chronicle-uploads

# Mailpit
SMTP_HOST=localhost
SMTP_PORT=1025

# Spotify
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

# Better Auth
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# AI Provider (definir depois)
# AI_API_KEY=
```

- [ ] **Step 2: Criar .gitignore**

```
# Dependencies
node_modules/
.pnpm-store/

# Build
dist/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test
coverage/

# Infra
postgres-data/
minio-data/
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add env example and gitignore"
```

---

## Self-Review

1. **Spec coverage:** ✅ Setup inicial cobre: pnpm, turbo, biome, lefthook, podman compose, scripts
2. **Placeholder scan:** ✅ Sem placeholders - todo o código está completo
3. **Type consistency:** ✅ N/A para esta task (sem types ainda)

---

## Execution Handoff

Plan completo e salvo em `docs/superpowers/plans/2026-09-20-task-1-1-setup-inicial.md`.

**Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — Disparo um subagent por task, reviso entre tasks, iteração rápida

**2. Inline Execution** — Executo as tasks nesta sessão usando executing-plans, execução em batch com checkpoints

Qual abordagem?