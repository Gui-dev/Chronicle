# Social Reader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Chronicle into a public reading experience: public timeline (no login required to read), privacy toggle on memories (default public), logged-user menu in navbar, "Minhas Memórias" and "Perfil" pages, owner-only actions directly on timeline cards, richer photo gallery with lightbox arrows/keyboard/counter, and optional profile avatar uploaded to MinIO. The memory detail page is removed. Per `docs/superpowers/specs/2026-09-25-social-reader-design.md`.

**Architecture:** Backend-first (schema → Zod → API service/routes → avatar module), then frontend guard/routing, navbar, pages, memory card, gallery, hooks, then E2E. Task-by-task with TDD (write failing unit/integration/route test → implement → verify → commit). Each task lands independently and is individually verifiable.

**Tech Stack:** Drizzle ORM (PostgreSQL), Zod, Fastify + `@fastify/multipart`, MinIO (AWS SDK S3), Next.js 16.3.5 (App Router, client components), TanStack Query 5, Vitest, Playwright.

**Repo conventions:** all work on `main`; commits in English, conventional (`feat(db):`, `feat(api):`, `feat(web):`, `test(e2e):`). Verify with `pnpm --filter <pkg> typecheck`, `pnpm lint` (biome), `pnpm --filter api test`, and `pnpm exec playwright test --project=chromium`. DB creds: `postgresql://chronicle:chronicle@localhost:5432/chronicle`. Dev servers expected up (api :3333, web :3000, postgres + minio via `docker compose up -d`).

---

## Task 1: Add `isPublic` to memories schema + schema Zod

**Files:**
- Modify: `packages/db/src/schema/memories.ts`
- Modify: `packages/schemas/src/create-memory.ts`
- Modify: `packages/schemas/src/update-memory.ts`
- Modify: `packages/schemas/src/memory-filters.ts`
- Modify (generated): `packages/db/src/migrations/*`

- [ ] **Step 1: Add the column**

Edit `packages/db/src/schema/memories.ts` — add after `musicCover` (line 21):

```ts
isPublic: boolean('is_public').notNull().default(true),
```

- [ ] **Step 2: Generate migration + apply**

```bash
DATABASE_URL="postgresql://chronicle:chronicle@localhost:5432/chronicle" pnpm db:generate
DATABASE_URL="postgresql://chronicle:chronicle@localhost:5432/chronicle" pnpm db:push
```

**Fallback** if drizzle-kit fails (known vitest compat issue):

```bash
docker exec -i $(docker ps -qf "name=chronicle" | head -1) psql -U chronicle -d chronicle \
  -c "ALTER TABLE memories ADD COLUMN is_public boolean NOT NULL DEFAULT true;"
```

Verify: `\d memories` shows `is_public`.

- [ ] **Step 3: Extend Zod schemas**

`packages/schemas/src/create-memory.ts` — add to the object:

```ts
isPublic: z.boolean().optional(),
```

`packages/schemas/src/update-memory.ts` — unchanged file, gains `isPublic` automatically via `createMemorySchema.partial()`.

`packages/schemas/src/memory-filters.ts` — add:

```ts
mine: z.boolean().optional(),
```

(Note: query strings carry strings; the service will coerce `mine === 'true'`. Keep Zod loose — `z.boolean()` coerces `"true"` correctly, but to stay consistent with existing `coerce` usage, use `z.coerce.boolean().optional()`.)

- [ ] **Step 4: Verify + commit**

```bash
pnpm --filter db typecheck
pnpm --filter schemas typecheck
pnpm lint
```

```bash
git add packages/db/src/schema/memories.ts packages/db/src/migrations packages/schemas/src
git commit -m "feat(db): add is_public column and schemas"
```

---

## Task 2: Public-facing memories service + routes

**Files:**
- Modify: `apps/api/src/modules/memories/memories.service.ts`
- Modify: `apps/api/src/modules/memories/memories.routes.ts`
- Modify: `apps/api/src/modules/memories/__tests__/memories.spec.ts` (unit route tests — GET/mine no longer 401)
- Modify: `apps/api/src/modules/memories/__tests__/memories.integration.test.ts`
- Create: `apps/api/src/modules/memories/__tests__/memories.service.spec.ts` (findAll/findById privacy tests)

- [ ] **Step 1: Change service `findAll` for public + mine semantics**

Edit `apps/api/src/modules/memories/memories.service.ts`:

- Signature becomes `findAll(filters: MemoryFiltersInput, options?: { userId?: string })`.
- Build base conditions:
  - `mine === true` → require `userId`; if absent return empty (route enforces 401 before service).
  - `mine !== true`:
    - if `userId` present → `or(eq(memories.isPublic, true), eq(memories.userId, userId))`
    - if no `userId` → `eq(memories.isPublic, true)`
- Keep existing filters (year/month/weather/location/tag/search). The `count` query must reuse exactly the same `conditions` array (unchanged behavior).
- Ensure returned rows include `isPublic` (Drizzle select returns all columns automatically).

Important: import `or` from `@chronicle/db` (check it is exported; if not, `sql` string or `and(or(...), ...)`).

- [ ] **Step 2: Change service `findById` for public read**

Edit `findById(id, userId?)`:

```ts
async findById(id: string, userId?: string) {
  const [memory] = await db.select().from(memories).where(eq(memories.id, id)).limit(1)
  if (!memory) throw AppError.notFound('Memória não encontrada')
  if (!memory.isPublic && memory.userId !== userId) throw AppError.forbidden('Acesso negado')
  // ...people/tags/photos enrichment unchanged
}
```

- [ ] **Step 3: Change service `create`/`update` for `isPublic`**

- `create`: add `isPublic?: boolean` to the data type; pass `isPublic: data.isPublic ?? true` in `.values({ ... })`.
- `update`: add `isPublic?: boolean` to the data type; add `isPublic: data.isPublic` to `.set({ ... })` (Drizzle ignores `undefined`).

- [ ] **Step 4: Update routes**

`apps/api/src/modules/memories/memories.routes.ts`:

- **GET `/api/memories`**: resolve optional session (no 401 if absent). Parse filters. Compute:
  ```ts
  const result = filters.mine
    ? await memoriesService.findAll(filters, { userId: session?.user.id })
    : await memoriesService.findAll(filters, { userId: session?.user.id })
  ```
  When `mine === true` and no session → return 401 with the standard error shape.
- **GET `/api/memories/:id`**: optional session; call `findById(id, session?.user.id)`. No unconditional 401.
- **POST** (unchanged auth requirement): pass `body.isPublic` to create.
- **PUT**: pass `body.isPublic` to update.
- **DELETE**: unchanged.

- [ ] **Step 5: Write the failing unit tests (TDD)**

Create `apps/api/src/modules/memories/__tests__/memories.service.spec.ts` mocking `@chronicle/db` (pattern from `photos.service.spec.ts`) to assert:
- `findAll` with no session returns only public rows.
- `findAll` with `userId` returns public rows + own private rows.
- `findAll` with `mine=true` returns only `where userId = X`.
- `findById` public memory readable by non-owner; private memory by non-owner → throws `AppError.forbidden`.

Update existing route specs (`memories.spec.ts`, `memories.integration.test.ts`) — the "GET returns 401 unauthenticated" assertions must flip: GET list (no `mine`) and GET `/:id` no longer 401. Keep the 401 assertions for POST/PUT/DELETE and add a 401 assertion for `GET /api/memories?mine=true` without session.

- [ ] **Step 6: Run to verify**

```bash
pnpm --filter api test -- src/modules/memories
pnpm --filter api test
```

Expected: new tests pass, existing routes green (with flipped 401 expectations).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/memories apps/api/src/modules/memories/__tests__
git commit -m "feat(api): public timeline and privacy-scoped reads"
```

---

## Task 3: Owner-only narrative + privacy confirmation (API already covers)

Narrative route (`POST /api/memories/:id/generate-narrative`) already requires session + owner check in `narrative.service.ts`. No code change needed. Skip commit-less — verify only:

```bash
pnpm --filter api test -- src/modules/narrative
```

Mark done when green.

---

## Task 4: Avatar module (`apps/api/src/modules/users/`)

**Files:**
- Create: `apps/api/src/modules/users/users.routes.ts`
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/__tests__/users.routes.spec.ts`
- Modify: `apps/api/src/server.ts` (register routes)
- Reference: `apps/api/src/plugins/minio.ts` (`s3Client`, `BUCKET_NAME`), `apps/api/src/modules/photos/photos.service.ts` (multipart + MinIO pattern)

- [ ] **Step 1: Service**

Create `users.service.ts`:

```ts
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { db, eq, users } from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'

const ALLOWED_MIMETYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export class UsersService {
  async uploadAvatar(userId: string, file: { filename: string; mimetype: string; buffer: Buffer }) {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) throw AppError.badRequest('Formato de imagem inválido')
    if (file.buffer.length > MAX_SIZE) throw AppError.badRequest('Imagem muito grande (máx. 5MB)')

    const key = `users/${userId}/${randomUUID()}${path.extname(file.filename)}`
    await s3Client.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: file.buffer, ContentType: file.mimetype }))

    const image = `/${BUCKET_NAME}/${key}`
    await db.update(users).set({ image }).where(eq(users.id, userId))
    return image
  }

  async deleteAvatar(userId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user?.image) return
    const key = user.image.replace(`/${BUCKET_NAME}/`, '')
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
    await db.update(users).set({ image: null }).where(eq(users.id, userId))
  }
}

export const usersService = new UsersService()
```

Check `messages/error-handler` exports `AppError.badRequest` — if not, use the existing pattern (e.g. `AppError.forbidden`/`notFound` exist; verify badRequest availability, otherwise construct a `new AppError(400, ...)` or reuse whatever helper exists). Inspect `apps/api/src/errors/app-error.ts` first.

- [ ] **Step 2: Routes**

Create `users.routes.ts`:

```ts
import { auth } from '@chronicle/auth'
import type { FastifyInstance } from 'fastify'
import { usersService } from './users.service'

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.post('/api/users/avatar', async (request, reply) => {
    const session = await auth.api.getSession({ headers: request.headers as Record<string, string> })
    if (!session) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: 'No file uploaded' } })

    try {
      const image = await usersService.uploadAvatar(session.user.id, {
        filename: data.filename,
        mimetype: data.mimetype,
        buffer: await data.toBuffer(),
      })
      return reply.send({ data: { image } })
    } catch (err) {
      return handleError(err) // reuse existing error plumbing — mirror memories.routes error handling
    }
  })

  fastify.delete('/api/users/avatar', async (request, reply) => {
    const session = await auth.api.getSession({ headers: request.headers as Record<string, string> })
    if (!session) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } })

    await usersService.deleteAvatar(session.user.id)
    return reply.status(204).send()
  })
}
```

Register in `server.ts`:
```ts
import { usersRoutes } from './modules/users'
server.register(usersRoutes)
```

Check how other modules export their routes (e.g. `apps/api/src/modules/memories/index.ts`) and mirror the module index file pattern.

- [ ] **Step 3: Write failing tests**

Create `users.routes.spec.ts` (pattern from `photos.service.spec.ts` + route specs): mock `@chronicle/auth` `getSession`, mock `@chronicle/db` and minio plugin. Assert:
- POST without session → 401.
- POST with invalid mimetype → 400.
- POST with valid mimetype → 201/200 and `users.image` updated via `db.update(...).set({ image }).where(eq(users.id, userId))`.
- DELETE → 204; other user's path not implicated.

- [ ] **Step 4: Verify + commit**

```bash
pnpm --filter api test -- src/modules/users
pnpm --filter api test
pnpm --filter api typecheck
pnpm lint
```

```bash
git add apps/api/src/modules/users apps/api/src/server.ts
git commit -m "feat(api): profile avatar upload and removal"
```

---

## Task 5: Replace layout AuthGuard with per-page RequireAuth + remove detail page

**Files:**
- Create: `apps/web/src/components/require-auth.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Delete: `apps/web/src/app/(dashboard)/memories/[id]/page.tsx`
- Delete: `apps/web/src/app/(dashboard)/memories/[id]/loading.tsx`
- Modify: `apps/web/src/app/(dashboard)/memories/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx`

- [ ] **Step 1: Create `require-auth.tsx`**

`'use client'`; mirror `auth-guard.tsx` logic but as a named export and without redirecting the layout — redirect to `/login` when `!isAuthenticated` after loading; render spinner while loading; render children when authenticated.

- [ ] **Step 2: Update layout**

Remove `<AuthGuard>` wrapper; render `Navbar` + `<main className="flex-1 pb-24">{children}</main>` + `<LazyAudioPlayer />` directly. Keep the layout a Server Component (it only composes client components). Delete the now-unused `auth-guard.tsx` import.

- [ ] **Step 3: Protect sensitive pages with `RequireAuth`**

- `memories/new/page.tsx`: wrap with `<RequireAuth>`.
- `memories/[id]/edit/page.tsx`: wrap with `<RequireAuth>`.

- [ ] **Step 4: Delete detail page + fix edit-page/detail dependent links**

- Delete `memories/[id]/page.tsx` and `memories/[id]/loading.tsx`.
- In `memories/[id]/edit/page.tsx`: change "Voltar à memória" link (`/memories/${id}`) → `/` (Home), and "Cancelar" button link → `/`.
- `use-update-memory.ts`: change `router.push(\`/memories/${id}\`)` → `router.push('/')` (detail no longer exists).

- [ ] **Step 5: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm lint
```

Manually: `/` loads without login; `/memories/new` and `/memories/<id>/edit` redirect anon → `/login`; `/memories/<id>` 404s.

```bash
git add apps/web/src/components/require-auth.tsx apps/web/src/components/auth-guard.tsx \
  apps/web/src/app/\(dashboard\)/layout.tsx apps/web/src/app/\(dashboard\)/memories \
  apps/web/src/hooks/use-update-memory.ts
git commit -m "feat(web): per-page auth guard and remove detail route"
```

---

## Task 6: Navbar user dropdown with avatar/initials

**Files:**
- Modify: `apps/web/src/components/navbar.tsx`

- [ ] **Step 1: Replace logged-in name+Saír with dropdown**

`'use client'` (already). Add local state for `menuOpen`. Trigger: avatar `<img>` (if `user.image`, via `next/image` with existing `localhost:9000` remotePattern) or initials circle (`user.name` initials, uppercase, `bg-primary/20 text-primary rounded-full h-8 w-8 grid place-items-center`). Add `data-testid="user-menu-toggle"`.

Menu items (buttons/links):
- **Minhas Memórias** → `Link href="/minhas-memorias"` (`data-testid="menu-minhas-memorias"`)
- **Perfil** → `Link href="/perfil"` (`data-testid="menu-perfil"`)
- **Nova Memória** → `Link href="/memories/new"` (`data-testid="menu-nova"`)
- **Sair** → button calling `signOut()` + `invalidateSession()` (`data-testid="menu-sair"`), reusing existing `handleSignOut`.

Close dropdown: track an overlay click (transparent fixed div) and close on navigation (wrap menu items, and on click set `menuOpen(false)`). Keep "Buscar" button and anonymous "Entrar" link as-is.

- [ ] **Step 2: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm lint
```

Manual: logged in → initials/avatar show; click opens 4 items; Sair logs out; anonymous → Entrar unchanged.

```bash
git add apps/web/src/components/navbar.tsx
git commit -m "feat(web): user dropdown menu in navbar"
```

---

## Task 7: Public Home + new Minhas Memórias + Perfil pages

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Create: `apps/web/src/app/(dashboard)/minhas-memorias/page.tsx`
- Create: `apps/web/src/app/(dashboard)/perfil/page.tsx`
- Modify: `apps/web/src/hooks/use-memories.ts` (support `mine`)

- [ ] **Step 1: `use-memories.ts` — support `mine`**

`buildQueryString`: add `if (filters.mine) params.set('mine', 'true')`. `MemoryFiltersInput` already includes `mine` from schemas (Task 1). `useMemories(filters)` unchanged otherwise; if `mine` present in filters it flows to query key + query string automatically.

- [ ] **Step 2: Home page — public semantics**

In `page.tsx`:
- Import `useAuth()`; compute `isAuthenticated`.
- CTA "Nova Memória" (`Link`) → `href={isAuthenticated ? '/memories/new' : '/login'}`.
- Follow-up verify: `useMemories(filters)` — when logged in the API already returns public + own private; when anonymous, public only. No extra logic needed beyond the CTA, since `useAuth` drives it. Heading: keep "Sua Timeline" — adjust empty state copy to cover the anonymous feed ("Nenhuma memória pública encontrada").
- `MemoryCardFull` is rendered; it will receive `isOwner` from this page (Task 8). Anonymous/other users' cards show no owner actions.

- [ ] **Step 3: Minhas Memórias page**

Create `(dashboard)/minhas-memorias/page.tsx` (`'use client'`, wrapped in `RequireAuth`):
- `useFilters()` + `useMemories({ ...filters, mine: true })`.
- Title "Minhas Memórias".
- CTA "Nova Memória" → `/memories/new`.
- Render `MemoryFilters` (is it useful here? It filters by year etc. — keep it) and the timeline list (copy the card/timeline markup from `page.tsx`, or extract a shared `MemoryTimeline` component).

**Refactor note:** To avoid duplicating the timeline markup (pagination, elapsed divider, empty/loading states), extract a server-irrelevant layout component `apps/web/src/components/memory-timeline.tsx` (client) that takes `memories`, `pagination`, and render prop for children. If extraction adds complexity, duplicating the ~90 lines is acceptable (the perf spec already has this layout wired for loading skeletons). Prefer extraction if clean; otherwise duplicate. Keep it consistent with `page.tsx` styling.

- [ ] **Step 4: Perfil page**

Create `(dashboard)/perfil/page.tsx` (`'use client'`, wrapped in `RequireAuth`):
- `useAuth()` → `user`, `invalidateSession`.
- Avatar block: large (h-24 w-24 rounded-full) `next/image` if `user.image`, else initials circle. `data-testid="profile-avatar"`.
- Upload: hidden `<input type="file" accept="image/png,image/jpeg,image/webp">`, label/button "Alterar foto". On change:
  ```ts
  const fd = new FormData()
  fd.append('file', file)
  await fetch('http://localhost:3333/api/users/avatar', { method: 'POST', credentials: 'include', body: fd })
  await invalidateSession()
  ```
  (mirror the memory-photo upload fetch pattern in `create-memory-wizard.tsx` — the `api` client JSON-stringifies bodies, so use raw `fetch` for FormData.)
- Remove button (`data-testid="remove-avatar"`): `DELETE /api/users/avatar` (via `api.delete`), then `invalidateSession()`. Show only when `user.image`.
- Info: name, email. Memory count: `useMemories({ page:1, limit:1, mine:true })` → `pagination.total`. Link "Ver minhas memórias" → `/minhas-memorias`.
- Upload state (loading) + sonner toasts for success/error.

- [ ] **Step 5: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm lint
```

Manual: anonymous Home loads public memories, CTA → /login; logged Home shows own private; `/minhas-memorias` lists only own; `/perfil` shows avatar upload/remove working.

```bash
git add apps/web/src/app/\(dashboard\)/page.tsx apps/web/src/app/\(dashboard\)/minhas-memorias apps/web/src/app/\(dashboard\)/perfil apps/web/src/hooks/use-memories.ts apps/web/src/components
git commit -m "feat(web): public home, my memories and profile pages"
```

---

## Task 8: Owner actions on the memory card

**Files:**
- Modify: `apps/web/src/components/memory-card.tsx`
- Modify: `apps/web/src/components/narrative-section.tsx` (reuse inline, or inline simple generate button)
- Reference: `apps/web/src/components/confirm-dialog.tsx`, `apps/web/src/components/memory-detail-header.tsx`

- [ ] **Step 1: Add `isOwner` prop + remove `<Link>` wrapper**

- `MemoryCardFull({ memory, isOwner = false })`.
- Remove the outer `<Link href={`/memories/${memory.id}`}>`; replace with plain `<div>` (keep `space-y-6 rounded-3xl ...` classes and group/hover on the article; hover title color only when owner? Keep simple — keep `group` on article).
- Keep inner content (music toggle button `preventDefault` no longer strictly needed but harmless).

- [ ] **Step 2: Owner action toolbar**

When `isOwner`, render a row of icon buttons (top-right of card), with `data-testid`s:
- **Editar** (`lucide Pencil`) → `Link href={`/memories/${memory.id}/edit`}`.
- **Deletar** (`Trash2`) → open `ConfirmDialog` (reuse component); on confirm perform `api.delete('/api/memories/'+id)` then `queryClient.invalidateQueries({ queryKey: ['memories'] })`; sonner success/error. (Extract a `useDeleteMemory` hook or inline — prefer a small hook `apps/web/src/hooks/use-delete-memory.ts` for reuse in `minhas-memorias` too.)
- **Narrativa** (`Sparkles`):
  - If no `aiNarrative` → button "Gerar narrativa" (inline) that calls `POST /api/memories/:id/generate-narrative` (reuse `narrative-section.tsx`-style logic or inline) and invalidates.
  - If `aiNarrative` exists → expandable block (existing narrative button/section) with a "Regenerar" affordance for the owner.
- **Privacidade** (`Lock`/`Unlock` icon reflecting `memory.isPublic`):
  - `api.put(\`/api/memories/${id}\`, { isPublic: !memory.isPublic })`, then `queryClient.invalidateQueries({ queryKey: ['memories'] })`.
  - Small toast "Memória agora é pública/privada".

For non-owners: no toolbar; card is purely a reader view.

- [ ] **Step 3: Photos — use `PhotoGallery`**

Replace the current card photo grid (`memory.photos.map(...)`) with `<PhotoGallery photos={memory.photos} />` (PhotoGallery is enhanced in Task 9). Keep the photos section conditional on `memory.photos.length > 0`. If PhotoGallery renders a heading "Fotos" and empty state conflicting with card layout, add a `title`-optional prop (default "Fotos") and pass `title="Fotos"` + the grid CSS overridden via className or keep the current grid inside PhotoGallery for the card. Prefer: PhotoGallery gains optional `className`/`heading` props; card passes a compact variant. Confirm visuals in dev.

- [ ] **Step 4: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm lint
```

Manual: logged owner sees edit/delete/narrative/privacy icons; delete confirms and removes card; privacy toggles and stays after reload; narrative generates inline; anonymous/other user sees plain card without icons.

```bash
git add apps/web/src/components/memory-card.tsx apps/web/src/components/memory-detail-header.tsx apps/web/src/components/narrative-section.tsx apps/web/src/hooks apps/web/src/components/confirm-dialog.tsx
git commit -m "feat(web): owner actions on timeline cards"
```

---

## Task 9: Enhance PhotoGallery (arrows, keyboard, counter)

**Files:**
- Modify: `apps/web/src/components/photo-gallery.tsx`

- [ ] **Step 1: Add lightbox controls**

Inside the open lightbox (already fixed overlay), add:
- **Prev/Next arrows**: two buttons `<button data-testid="lightbox-prev"/"lightbox-next">` positioned left/right (ChevronLeft / ChevronRight icons). Wrap index: `(lightboxIndex + dir + photos.length) % photos.length`. Render when `photos.length > 1`.
- **Keyboard navigation**: on overlay `onKeyDown` (already Escape) add `ArrowLeft`/`ArrowRight` handlers. To capture key events, the overlay button should have `tabIndex={-1}` focus or add a `window` keydown listener via `useEffect` when lightbox open. Prefer `useEffect` with `window.addEventListener('keydown', ...)` cleanup — reliable for Playwright `page.keyboard.press('ArrowRight')`.
- **Counter**: `<span data-testid="lightbox-counter">{lightboxIndex + 1} / {photos.length}</span>` bottom-center near dots.
- Keep dots; ensure respond to new index.

- [ ] **Step 2: Optional heading/props for card reuse**

Add optional `heading?: string` (default 'Fotos') that renders only when `photos.length > 0`; and `className` passthrough on the grid container. Keep existing empty state ("Nenhuma foto ainda") only when the component is used standalone — for the card, we already gate on `photos.length > 0`, so the empty branch is fine.

- [ ] **Step 3: Verify + commit**

```bash
pnpm --filter web typecheck
pnpm lint
```

Manual: open gallery on a memory with many photos — arrows cycle, Esc closes, ←/→ cycle, counter correct, dots reflect index.

```bash
git add apps/web/src/components/photo-gallery.tsx
git commit -m "feat(web): lightbox arrows, keyboard nav and counter"
```

---

## Task 10: E2E adjustments + new specs

**Files:**
- Modify: `apps/web/src/__tests__/timeline.spec.ts`
- Modify: `apps/web/src/__tests__/filter-memory.spec.ts`
- Modify: `apps/web/src/__tests__/delete-memory.spec.ts`
- Modify: `apps/web/src/__tests__/edit-memory.spec.ts`
- Modify: `apps/web/src/__tests__/upload-photos.spec.ts`
- Modify: `apps/web/src/__tests__/helpers.ts`
- Create: `apps/web/src/__tests__/public-home.spec.ts`
- Create: `apps/web/src/__tests__/social-menu.spec.ts`
- Create: `apps/web/src/__tests__/owner-actions.spec.ts`
- Create: `apps/web/src/__tests__/gallery.spec.ts`
- Create: `apps/web/src/__tests__/perfil.spec.ts`
- Reference: `apps/web/src/__tests__/fixtures.ts`

- [ ] **Step 1: Adjust helpers**

`createMemory` returns `/memories/${memoryId}` today. Since the detail page is gone, change it to return just the `memoryId` string (or a detail URL to `/` — keep an object `{ id, homeUrl }`). Update callers:
- `timeline.spec`: after create, `goto('/')`, wait for title card visible.
- `delete-memory.spec`: delete via card — goto `/`, wait for card, click the card's delete icon (`data-testid` suggested: `delete-button` on each card, scoped via card container `data-testid="memory-card-<id>"`), handle confirm dialog, assert redirected/removed.
- `edit-memory.spec`: goto `/memories/<id>/edit` directly (edit page remains); assert `save-button` visible.
- `upload-photos.spec`: "can view photos section in memory detail" — no detail page now. Rewrite: create memory, goto `/`, assert the card's photos section visible (`data-testid` on `PhotoGallery` grid) — keep a thumbs-up if a memory with no photos shows empty state on card.
- `filter-memory.spec`: filters remain on public/logged Home — add `await authenticatedPage.goto('/')` before filtering (already does). It calls `createMemory` twice; keep, but the assertions on visibility hold.

- [ ] **Step 2: New specs**

- `public-home.spec.ts`: anonymous `page` (fixture `test({ page })`): Home shows "Entrar" in navbar; card titles visible (seeded public memories); CTA button label ("Nova Memória") links to `/login` (assert href).
- `social-menu.spec.ts`: `authenticatedPage`: click `user-menu-toggle`; assert menu items `minhas-memorias`, `perfil`, `nova` present; click `menu-minhas-memorias` → URL `/minhas-memorias`; click back; `menu-sair` → URL `/login` or anonymous navbar shows "Entrar".
- `owner-actions.spec.ts`: `authenticatedPage` creates a memory, `goto('/')`; assert the card (data-testid `memory-card-<id>`) shows `edit-button`, `delete-button`, `privacy-toggle`, narrative. Click `delete-button` → confirm dialog → card disappears. Also assert privacy toggle: create two memories, toggle one to private, assert it still shows for owner on Home (or in Minhas Memórias) and hides in a separate anonymous session? Simpler within logged scope: private memory visible at `/` for owner; verify a second anonymous context does not see it (new `context` in the same spec via `browser`).
- `gallery.spec.ts`: `authenticatedPage` creates memory with photos (upload 2 files) — reuse existing upload code — goto `/`, click first card photo (`data-testid="photo-gallery"` first thumbnail), assert lightbox open (`lightbox-next` visible), click next → counter "2 / 2", press ArrowLeft → "1 / 2", press Escape → closes.
- `perfil.spec.ts`: `authenticatedPage` goto `/perfil`; assert name/email; upload a small PNG (`setInputFiles('[data-testid="avatar-input"]', { name:'a.png', mimeType:'image/png', buffer })`); assert navbar avatar `img` appears after `invalidateSession`; click `remove-avatar`; assert returns to initials.

- [ ] **Step 3: Run E2E**

Dev servers up + `docker compose up -d`:

```bash
pnpm --filter web test:e2e -- --project=chromium
```

Expected: all existing + new specs pass. (`firefox` project has no browsers installed → use chromium only.)

- [ ] **Step 4: Full gate + commit**

```bash
pnpm typecheck
pnpm lint
pnpm --filter api test
pnpm --filter web test:e2e -- --project=chromium
```

```bash
git add apps/web/src/__tests__
git commit -m "test(e2e): public home, social menu and owner actions"
```

---

## Task 11: Final manual smoke + docs update

**Files:**
- Modify: `docs/tasks.md`

- [ ] **Step 1: Manual smoke**

1. Anonymous `/` → public memories, Entrar visible, CTA → /login.
2. Login → navbar initials/avatar dropdown → Minhas Memórias / Perfil / Nova Memória / Sair.
3. Create memory → defaults public; toggle private via card → disappears from anonymous Home, stays for owner.
4. `/minhas-memorias` shows only own (public + private).
5. `/perfil`: upload avatar → appears in navbar + profile; remove → initials back.
6. Card owner actions: edit navigates to edit page; delete works; narrative generates inline.
7. Gallery: lightbox arrows/keyboard/counter on a memory with 2+ photos.
8. `/memories/<id>` (old detail) → 404/not found; no lingering links to it.

- [ ] **Step 2: Update task tracker**

Append a new phase to `docs/tasks.md` after Fase 5 (incremental tasks as decided):

```markdown
## Fase 6: Timeline pública, perfil e privacidade

### 6.1 Privacidade (schema + API)
- [ ] Coluna `is_public` no schema memories (+ migration)
- [ ] Zod: `isPublic` em create/update, `mine` em memory-filters
- [ ] Backend: feed público + `?mine=true` + findById pública
- [ ] Backend: status 401 mantido nas ações de dono

### 6.2 Avatar
- [ ] Backend: POST/DELETE /api/users/avatar (MinIO)
- [ ] Página Perfil: upload/remoção de avatar

### 6.3 Guarda e navegação
- [ ] RequireAuth por página (remover AuthGuard do layout)
- [ ] Remover página de detalhe `/memories/[id]`
- [ ] Dropdown de usuário na navbar (avatar/iniciais)

### 6.4 Páginas
- [ ] Home pública (CTA anônimo → /login)
- [ ] Página `/minhas-memorias`
- [ ] Página `/perfil` (dados, contagem, avatar)

### 6.5 Card e galeria
- [ ] Ações de dono no card (editar, deletar, narrativa, privacidade)
- [ ] Galeria com setas, teclado e contador

### 6.6 E2E
- [ ] Ajustar specs existentes (timeline, filtros, delete, edit, fotos)
- [ ] Novos specs: home pública, menu logado, ações de dono, galeria, perfil
```

- [ ] **Step 3: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: add task phase 6 timeline publica"
```

---

## Out of scope (deferred)

- Fix `/search` dead navbar route (follow-up).
- Edit photos/music directly on the card.
- Profile data editing beyond avatar.
- Storybook story updates for `PhotoGallery`/`MemoryCardFull`.