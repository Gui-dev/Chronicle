# Chronicle — AGENTS.md

## Monorepo Overview

pnpm workspaces + Turborepo. Apps: `apps/web` (Next.js 16.3.5), `apps/api` (Fastify). Packages: `packages/ui`, `packages/db`, `packages/schemas`, `packages/auth`.

## Commands

```bash
pnpm dev          # Start all apps (turbo)
pnpm dev:api      # API on port 3333
pnpm dev:web      # Web on port 3000
pnpm build        # Build all
pnpm lint         # biome check
pnpm lint:fix     # biome check --write
pnpm format       # biome format --write
pnpm typecheck    # turbo run typecheck
pnpm test         # turbo run test
pnpm test:unit    # turbo run test:unit
pnpm db:generate  # drizzle-kit generate
pnpm db:push      # drizzle-kit push
```

Pre-commit: `lefthook` runs `biome check --no-errors-on-unmatched --staged {staged_files}` and stages fixes.

## Architecture

### API (`apps/api`)
- Fastify server on port **3333**, host `localhost`
- Env loaded from root `.env` via `dotenv.config({ path: '../../.env' })` in `apps/api/src/env.ts`
- Auth routes handled by `apps/api/src/plugins/auth.ts` — wraps Better Auth handler
- **CRITICAL**: The auth plugin must copy ALL response headers from `auth.handler(req)` including `Set-Cookie`. Only override `access-control-allow-origin`. Missing `Set-Cookie` means sessions don't work.
- CORS plugin (`apps/api/src/plugins/cors.ts`) explicitly sets `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`. Auth plugin must NOT overwrite these.
- Auth plugin catches errors and returns `{ error, code, details }` with CORS headers

### Web (`apps/web`)
- Next.js App Router on port **3000**
- `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:3333`
- `apps/web/src/lib/api-client.ts` — all API calls use `fetch` with `credentials: 'include'`
- `apps/web/src/lib/auth-client.ts` — Better Auth client with `fetchOptions: { credentials: 'include' }`
- `apps/web/src/hooks/use-auth.ts` — uses `useQuery` (Tanstack Query) to fetch `/api/auth/get-session` with `credentials: 'include'`. Uses `refetchOnMount: true`, `gcTime: 0` to ensure session state updates after login.

### Packages
- `@chronicle/db` — Drizzle ORM schema + migrations. Schema files in `packages/db/src/schema/`
- `@chronicle/schemas` — Zod validation schemas. Exports `createMemorySchema`, `updateMemorySchema`, `memoryFiltersSchema`, `registerSchema`, `loginSchema`
- `@chronicle/auth` — Better Auth config with `usePlural: true`. Tables are plural: `users`, `sessions`, `accounts`, `verifications`
- `@chronicle/ui` — Shadcn UI components. Entry point is `packages/ui/src/index.ts`. Import as `@chronicle/ui`, NOT `@chronicle/ui/components/ui/*`

## Database

- PostgreSQL via Docker (`compose.yml`). User: `chronicle` / password: `chronicle`
- **DATABASE_URL must be `postgresql://chronicle:chronicle@localhost:5432/chronicle`** (NOT `postgres:postgres`)
- Auth tables use **text IDs** (nanoid), NOT uuid. `users.id` is `varchar(255)`, `sessions.user_id` and `accounts.user_id` are `varchar(255)`
- If tables don't exist, sign-up returns 500. Run `drizzle-kit push` or manually create tables
- `drizzle-kit` has vitest compatibility issues — use `pnpm db:push` or manual SQL if needed

## Auth Flow

1. `signUp.email()` / `signIn.email()` from `@/lib/auth-client`
2. Better Auth returns `{ error }` object on failure (not thrown exception)
3. But `catch` block also handles errors — extract `err instanceof Error ? err.message : 'Erro...'`
4. After login/signup, `useQuery` in `use-auth.ts` must re-fetch session. `refetchOnMount: true` + `gcTime: 0` ensures this
5. **SESSION COOKIES**: Auth plugin MUST copy `Set-Cookie` from Better Auth response headers. If `Set-Cookie` is missing, session is lost and `isAuthenticated` stays false

## UI Conventions

- kebab-case for ALL files including React components (e.g., `memory-card.tsx`, `create-memory.ts`)
- Tailwind v4 uses `@theme inline` blocks in CSS, not `tailwind.config.ts`
- Color palette: `--background: #0a0a0f`, `--card: #1a1a2e`, `--primary: #f0c040`, `--secondary: #ff8c00`
- Import UI components from `@chronicle/ui`, NOT `@chronicle/ui/components/ui/*`
- UI package internal imports use relative paths (`../../lib/utils`), NOT `@/lib/utils`

## Code Style

- BiomeJS: `pnpm lint` / `pnpm lint:fix` / `pnpm format`
- No `any` types (biome warns)
- Single quotes, semicolons as needed, 2-space indent
- Conventional Commits (English, imperative mood, lowercase, no period)

## Testing

- Vitest for unit/integration tests (in-memory SQLite for DB tests, MSW for API integration tests)
- Playwright for E2E (not yet configured)
- Tests in `packages/*/src/__tests__/` and `apps/*/src/__tests__/`

## Important Gotchas

- `drizzle-kit v0.30.6` has vitest compatibility issues — use manual SQL or upgrade if needed
- `useSession` from Better Auth React client may not properly sync session state after login. Use `useQuery` fetching `/api/auth/get-session` instead
- CORS preflight (OPTIONS) works, but actual POST responses need CORS headers explicitly set in auth plugin
- `.env` is gitignored — never commit credentials
- `apps/web/AGENTS.md` and `apps/web/CLAUDE.md` contain Next.js-specific rules
