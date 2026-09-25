# Task 5.2 — Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the performance task list (images, lazy loading, query cache, route prefetch) in the Chronicle monorepo per `docs/superpowers/specs/2026-09-25-performance-design.md`.

**Architecture:** Four independent workstreams touching the API (`image-size` dimension measurement) and the web app (`next/image` migration, `next/dynamic` lazy loading, TanStack Query tuning, loading boundaries + Link prefetch). No server-side data prefetch or `dehydrate` is added (out of scope per spec). Implementation proceeds task-by-task with commits and verification each step.

**Tech Stack:** Next.js 16.3.5 (App Router, `next/image`, `next/dynamic`, `loading.js` boundaries), TanStack Query 5, Drizzle ORM (PostgreSQL), Fastify, `image-size` v2, Vitest, Playwright.

---

### Task 1: Add `width`/`height` columns to `memory_photos`

**Files:**
- Modify: `packages/db/src/schema/memory-photos.ts`
- Modify (generated): `packages/db/src/migrations/*`

- [ ] **Step 1: Add the columns to the schema**

Edit `packages/db/src/schema/memory-photos.ts` so the table includes `width` and `height`:

```ts
import { integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryPhotos = pgTable('memory_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id')
    .notNull()
    .references(() => memories.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  filename: varchar('filename', { length: 255 }),
  mimetype: varchar('mimetype', { length: 100 }),
  size: integer('size'),
  width: integer('width'),
  height: integer('height'),
  orderIndex: integer('order_index').default(0).notNull(),
})
```

- [ ] **Step 2: Generate migration + apply**

Run (from repo root, with PostgreSQL up via `docker compose up -d`):

```bash
DATABASE_URL="postgresql://chronicle:chronicle@localhost:5432/chronicle" pnpm db:generate
DATABASE_URL="postgresql://chronicle:chronicle@localhost:5432/chronicle" pnpm db:push
```

Expected: `drizzle-kit` creates a migration file under `packages/db/src/migrations/` adding `width`/`height` integer columns, and `push` applies it to the local DB.

**Fallback if `db:generate`/`db:push` fail** (drizzle-kit/vitest gotcha): run the SQL manually against the `chronicle` DB:

```bash
docker exec -i $(docker ps -qf "name=chronicle" | head -1) psql -U chronicle -d chronicle \
  -c 'ALTER TABLE "memory_photos" ADD COLUMN "width" integer;' \
  -c 'ALTER TABLE "memory_photos" ADD COLUMN "height" integer;'
```

Verify with `\d memory_photos` that both columns exist. Verify API still boots (`curl -s http://localhost:3333/api/memories | head -c 200` — expect JSON).

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/memory-photos.ts packages/db/src/migrations
git commit -m "feat(db): add photo dimensions columns"
```

---

### Task 2: Measure image dimensions on photo upload

**Files:**
- Modify: `apps/api/package.json` (add dep)
- Modify: `apps/api/src/modules/photos/photos.service.ts`
- Test: `apps/api/src/modules/photos/__tests__/photos.service.spec.ts` (new)

- [ ] **Step 1: Add `image-size` dependency**

```bash
pnpm --filter api add image-size
```

Expected: `image-size@^2.0.4` added to `apps/api/package.json` and lockfile updated.

- [ ] **Step 2: Write the failing unit test**

Create `apps/api/src/modules/photos/__tests__/photos.service.spec.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { photosService } from '../photos.service'

// 1x1 red PNG
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const mocks = vi.hoisted(() => {
  const memoryRow = { id: 'mem-1', userId: 'user-1' }
  const inserted: Array<Record<string, unknown>> = []
  return { memoryRow, inserted }
})

vi.mock('@chronicle/db', () => ({
  eq: vi.fn(),
  memories: {},
  memoryPhotos: {},
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [mocks.memoryRow]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => ({
        returning: vi.fn(async () => {
          mocks.inserted.push(values)
          return [{ id: 'photo-1', ...values }]
        }),
      })),
    })),
  },
}))

vi.mock('../../../plugins/minio', () => ({
  s3Client: {
    send: vi.fn().mockResolvedValue({}),
  },
  BUCKET_NAME: 'chronicle-test',
}))

describe('PhotosService', () => {
  const baseFile = {
    filename: 'foto.png',
    mimetype: 'image/png',
  }

  beforeEach(() => {
    mocks.inserted.length = 0
  })

  afterAll(() => {
    vi.clearAllMocks()
  })

  it('persists width and height for a valid image', async () => {
    const photo = await photosService.upload('mem-1', 'user-1', {
      ...baseFile,
      buffer: PNG_1X1,
    })

    expect(photo.width).toBe(1)
    expect(photo.height).toBe(1)
    expect(mocks.inserted[0]).toMatchObject({ width: 1, height: 1 })
  })

  it('keeps width and height null for an unparseable buffer', async () => {
    const photo = await photosService.upload('mem-1', 'user-1', {
      ...baseFile,
      buffer: Buffer.from('not-an-image'),
    })

    expect(photo.width).toBeNull()
    expect(photo.height).toBeNull()
    expect(mocks.inserted[0]).toMatchObject({ width: null, height: null })
  })
})
```

Note: the mock factory must NOT import the real `@chronicle/db`; `mocks` must come from `vi.hoisted` (vitest hoists mock factories above imports).

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm --filter api test -- src/modules/photos/__tests__/photos.service.spec.ts
```

Expected: FAIL with `TypeError: photosService.upload(...)` returning `{ width: undefined }` / assertion failures (`expected null to be 1`), because dimensions are not yet measured.

- [ ] **Step 4: Implement dimension measurement**

Edit `apps/api/src/modules/photos/photos.service.ts`:

```ts
import { imageSize } from 'image-size'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { db, eq, memories, memoryPhotos } from '@chronicle/db'
import { AppError } from '../../errors/app-error'
import { BUCKET_NAME, s3Client } from '../../plugins/minio'
```

Inside `upload`, after the `key` is computed (before the `db.insert`), add:

```ts
    let width: number | null = null
    let height: number | null = null
    try {
      const dimensions = imageSize(file.buffer)
      width = dimensions.width ?? null
      height = dimensions.height ?? null
    } catch {
      // unsupported or invalid image format — keep null
    }
```

And extend the insert `.values({ ... })` with `width, height`.

The full updated method body (lines 28-51 of the file become):

```ts
    const ext = path.extname(file.filename)
    const key = `memories/${memoryId}/${randomUUID()}${ext}`

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    )

    let width: number | null = null
    let height: number | null = null
    try {
      const dimensions = imageSize(file.buffer)
      width = dimensions.width ?? null
      height = dimensions.height ?? null
    } catch {
      // unsupported or invalid image format — keep null
    }

    const [photo] = await db
      .insert(memoryPhotos)
      .values({
        memoryId,
        url: `/${BUCKET_NAME}/${key}`,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.buffer.length,
        width,
        height,
      })
      .returning()

    return photo
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm --filter api test -- src/modules/photos/__tests__/photos.service.spec.ts
```

Expected: PASS (both cases). Then run the whole API suite to confirm no regressions:

```bash
pnpm --filter api test
```

Expected: all API tests PASS (existing photo route tests are unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/modules/photos/photos.service.ts apps/api/src/modules/photos/__tests__/photos.service.spec.ts
git commit -m "feat(api): persist photo dimensions on upload"
```

---

### Task 3: Extend web `Photo` types with dimensions

**Files:**
- Modify: `apps/web/src/hooks/use-memories.ts`
- Modify: `apps/web/src/components/photo-gallery.tsx`

- [ ] **Step 1: Add `width`/`height` to the `Memory.photos` type**

Edit `apps/web/src/hooks/use-memories.ts`, `photos` array item (lines 28-35):

```ts
  photos: Array<{
    id: string
    url: string
    filename: string | null
    mimetype: string | null
    size: number | null
    width: number | null
    height: number | null
    orderIndex: number
  }>
```

- [ ] **Step 2: Add `width`/`height` to the local `Photo` interface**

Edit `apps/web/src/components/photo-gallery.tsx`:

```ts
interface Photo {
  id: string
  url: string
  filename: string | null
  width: number | null
  height: number | null
}
```

- [ ] **Step 3: Verify types**

```bash
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-memories.ts apps/web/src/components/photo-gallery.tsx
git commit -m "feat(web): type photo dimensions"
```

---

### Task 4: Allowlist Spotify cover host in `next.config.ts`

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add `i.scdn.co` remote pattern**

Edit `apps/web/next.config.ts` so `images.remotePatterns` includes the Spotify cover host:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/chronicle-uploads/:path*",
        destination: "http://localhost:9000/chronicle-uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify config loads**

```bash
pnpm dev:web
```

Expected: Next compiles without config errors. (The dev server is usually already running on :3000; if so, restart it so the config change is picked up.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "chore(web): allow spotify cover images"
```

---

### Task 5: Migrate photo gallery to `next/image`

**Files:**
- Modify: `apps/web/src/components/photo-gallery.tsx`

- [ ] **Step 1: Replace thumbnail and lightbox `<img>`**

Edit `apps/web/src/components/photo-gallery.tsx`:

- Add import at top: `import Image from 'next/image'`
- Thumbnails (lines 39-43): use `fill` inside the already-`relative` button, with `sizes`:

```tsx
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative cursor-pointer overflow-hidden rounded-lg aspect-square"
          >
            <Image
              src={photo.url}
              alt={photo.filename || 'Foto da memória'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              className="object-cover transition-transform group-hover:scale-105"
            />
          </button>
```

- Lightbox (lines 65-71): use explicit dimensions from the DB with a sane fallback:

```tsx
          <Image
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].filename || 'Foto da memória'}
            width={photos[lightboxIndex].width ?? 1200}
            height={photos[lightboxIndex].height ?? 800}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Manually open `/memories/<id>` for a memory with uploaded photos and confirm thumbnails and lightbox render through `/_next/image`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/photo-gallery.tsx
git commit -m "perf(web): use next/image in photo gallery"
```

---

### Task 6: Migrate timeline card photos to `next/image`

**Files:**
- Modify: `apps/web/src/components/memory-card.tsx`

- [ ] **Step 1: Replace card photo `<img>`**

Edit `apps/web/src/components/memory-card.tsx`:

- Add import at top: `import Image from 'next/image'`
- Photos block (lines 168-178): the parent `div` is `relative h-44`, so use `fill`:

```tsx
              {memory.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative h-44 overflow-hidden rounded-2xl border border-card group/img"
                >
                  <Image
                    src={photo.url}
                    alt={photo.filename || 'Foto da memória'}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover/img:scale-110"
                  />
                </div>
              ))}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Open the dashboard timeline and confirm cards render photos via `/_next/image`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/memory-card.tsx
git commit -m "perf(web): use next/image on memory cards"
```

---

### Task 7: Migrate music covers to `next/image`

**Files:**
- Modify: `apps/web/src/components/memory-music-player.tsx`
- Modify: `apps/web/src/components/steps/step-music.tsx`

- [ ] **Step 1: Cover in `memory-music-player`**

Edit `apps/web/src/components/memory-music-player.tsx`:

- Add import: `import Image from 'next/image'`
- Replace line 62:

```tsx
        {cover && (
          <Image
            src={cover}
            alt={track}
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg object-cover"
          />
        )}
```

- [ ] **Step 2: Cover in `step-music`**

Edit `apps/web/src/components/steps/step-music.tsx`:

- Add import: `import Image from 'next/image'`
- Replace lines 83-89:

```tsx
                {track.cover && (
                  <Image
                    src={track.cover}
                    alt={track.name}
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                )}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. (Manual check: search a track in the wizard and open a memory with music — covers render; they must resolve via `i.scdn.co`, which is why Task 4 must land first.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/memory-music-player.tsx apps/web/src/components/steps/step-music.tsx
git commit -m "perf(web): use next/image for music covers"
```

---

### Task 8: Fix blob URL leak in photo preview (`step-photos`)

**Files:**
- Modify: `apps/web/src/components/steps/step-photos.tsx`

- [ ] **Step 1: Extract a `PhotoPreview` component with cleanup**

Edit `apps/web/src/components/steps/step-photos.tsx`:

- Add a new component above `StepPhotos`:

```tsx
function PhotoPreview({ photo }: { photo: File }) {
  const [objectUrl, setObjectUrl] = useState<string>()

  useEffect(() => {
    const url = URL.createObjectURL(photo)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  if (!objectUrl) return null

  return <img src={objectUrl} alt={photo.name} className="h-full w-full object-cover" />
}
```

- Replace the inline `<img src={URL.createObjectURL(photo)} .../>` (lines 107-111) with:

```tsx
              <PhotoPreview photo={photo} />
```

- `useEffect` is already imported (`import { useCallback, useRef, useState } from 'react'` → add `useEffect`).

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/steps/step-photos.tsx
git commit -m "fix(web): revoke photo preview object urls"
```

---

### Task 9: Lazy-load wizard steps with `next/dynamic`

**Files:**
- Modify: `apps/web/src/components/create-memory-wizard.tsx`

- [ ] **Step 1: Convert step imports to dynamic**

Edit `apps/web/src/components/create-memory-wizard.tsx`:

- Remove the five static step imports (lines 14-18).
- Add:

```tsx
import dynamic from 'next/dynamic'
```

- Add a shared fallback and the dynamic step components after the `STEPS` constant:

```tsx
function StepFallback() {
  return (
    <div className="flex h-48 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

const StepBasicInfo = dynamic(
  () => import('./steps/step-basic-info').then((m) => m.StepBasicInfo),
  { loading: StepFallback },
)
const StepLocation = dynamic(
  () => import('./steps/step-location').then((m) => m.StepLocation),
  { loading: StepFallback },
)
const StepMusic = dynamic(
  () => import('./steps/step-music').then((m) => m.StepMusic),
  { loading: StepFallback },
)
const StepPhotos = dynamic(
  () => import('./steps/step-photos').then((m) => m.StepPhotos),
  { loading: StepFallback },
)
const StepPeople = dynamic(
  () => import('./steps/step-people').then((m) => m.StepPeople),
  { loading: StepFallback },
)
```

`Loader2` is already imported from `lucide-react` in this file. `renderStep` stays unchanged — the dynamic components receive the same props.

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Open `/memories/new` and step through the wizard; the stepping fallback flashes as each step chunk loads, then content renders.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/create-memory-wizard.tsx
git commit -m "perf(web): lazy load wizard steps"
```

---

### Task 10: Lazy-load the music players

**Files:**
- Modify: `apps/web/src/app/(dashboard)/memories/[id]/page.tsx`
- Create: `apps/web/src/components/lazy-audio-player.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Dynamic `MemoryMusicPlayer` in detail page**

Edit `apps/web/src/app/(dashboard)/memories/[id]/page.tsx`:

- Remove the static import `import { MemoryMusicPlayer } from '@/components/memory-music-player'` (line 4).
- Add:

```tsx
import dynamic from 'next/dynamic'

const MemoryMusicPlayer = dynamic(
  () => import('@/components/memory-music-player').then((m) => m.MemoryMusicPlayer),
  {
    loading: () => <div className="h-24 animate-pulse rounded-xl bg-card" />,
  },
)
```

The JSX usage at lines 125-130 stays unchanged.

- [ ] **Step 2: Create the lazy audio-player wrapper**

The dashboard layout is a Server Component. Per Next 16 docs, `next/dynamic` inside a Server Component does **not** split a Client Component — so the `dynamic()` call must live in a Client Component wrapper.

Create `apps/web/src/components/lazy-audio-player.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'

const AudioPlayer = dynamic(() => import('@/components/audio-player').then((m) => m.AudioPlayer))

export function LazyAudioPlayer() {
  return <AudioPlayer />
}
```

- [ ] **Step 3: Use the wrapper in the dashboard layout**

Edit `apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
import { AuthGuard } from '@/components/auth-guard'
import { LazyAudioPlayer } from '@/components/lazy-audio-player'
import { Navbar } from '@/components/navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <AuthGuard>
        <main className="flex-1 pb-24">{children}</main>
      </AuthGuard>
      <LazyAudioPlayer />
    </div>
  )
}
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Confirm the dashboard layout renders normally (the `AudioPlayer` returns `null` today since `currentTrack` is always `null`, so this is invisible behaviorally).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/memories/\[id\]/page.tsx apps/web/src/components/lazy-audio-player.tsx apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "perf(web): lazy load music players"
```

---

### Task 11: Debounce memory search filter

**Files:**
- Modify: `apps/web/src/components/memory-filters.tsx`

- [ ] **Step 1: Add debounced search with local state**

Edit `apps/web/src/components/memory-filters.tsx`:

- Add `'use client'` at the top (the component now uses hooks).
- Add imports:

```tsx
import { useEffect, useState } from 'react'
```

- Inside `MemoryFilters`, add state and a debounce effect (before the return):

```tsx
  const [searchInput, setSearchInput] = useState(filters.search || '')

  useEffect(() => {
    if (!filters.search && searchInput) {
      setSearchInput('')
      return
    }
    const timer = setTimeout(() => {
      const next = searchInput || undefined
      if (next !== filters.search) {
        onFilterChange('search', next)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, filters.search, onFilterChange])
```

- Replace the search `Input` (lines 43-49) to bind to `searchInput`:

```tsx
          <Input
            type="text"
            placeholder="Buscar memórias..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 rounded-lg border-2 border-card bg-card pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
```

- Ensure the reset (Limpar) button also clears the local input (lines 83-93):

```tsx
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              onReset()
            }}
            className="h-10 text-muted hover:text-primary"
          >
            <X className="mr-1 h-4 w-4" />
            Limpar
          </Button>
        )}
```

- Also clear `searchInput` when the year/month filters change (they reset the page but not the search): no change needed — `searchInput` only tracks the search field.

- [ ] **Step 2: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Manual: on the dashboard, typing in the search field fires a request only ~300ms after a pause; typing "espaço" vs "esp" then watching the network tab shows one request after the pause.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/memory-filters.tsx
git commit -m "perf(web): debounce memory search filter"
```

---

### Task 12: Tune TanStack Query cache

**Files:**
- Modify: `apps/web/src/lib/query-client.ts`
- Modify: `apps/web/src/hooks/use-update-memory.ts`

- [ ] **Step 1: Disable refetch on window focus**

Edit `apps/web/src/lib/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}
```

- [ ] **Step 2: Cancel + invalidate before navigating on update**

Edit `apps/web/src/hooks/use-update-memory.ts` so `onSuccess` awaits cancel/invalidate before `router.push` (avoids a stale refetch racing the navigation):

```ts
'use client'

import { api } from '@/lib/api-client'
import type { UpdateMemoryInput } from '@chronicle/schemas'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface UpdateMemoryResponse {
  data: {
    id: string
    title: string
  }
}

export function useUpdateMemory(id: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: UpdateMemoryInput) => {
      return api.put<UpdateMemoryResponse>(`/api/memories/${id}`, data)
    },
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: ['memories'] })
      await queryClient.cancelQueries({ queryKey: ['memory', id] })
      queryClient.invalidateQueries({ queryKey: ['memories'] })
      queryClient.invalidateQueries({ queryKey: ['memory', id] })
      router.push(`/memories/${id}`)
    },
  })
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Manual: edit a memory and save — it navigates to the detail page with the updated content and the `updatedAt` bumps once.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/query-client.ts apps/web/src/hooks/use-update-memory.ts
git commit -m "perf(web): tune react query cache freshness"
```

---

### Task 13: Add `loading.tsx` boundaries and tune Link prefetch

**Files:**
- Create: `apps/web/src/app/(dashboard)/memories/[id]/loading.tsx`
- Create: `apps/web/src/app/(dashboard)/memories/[id]/edit/loading.tsx`
- Create: `apps/web/src/app/(dashboard)/memories/new/loading.tsx`
- Modify: `apps/web/src/components/memory-detail-header.tsx`
- Modify: `apps/web/src/components/create-memory-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx`
- Modify: `apps/web/src/components/navbar.tsx`

- [ ] **Step 1: Create the detail loading boundary**

Create `apps/web/src/app/(dashboard)/memories/[id]/loading.tsx`:

```tsx
export default function MemoryDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-5 w-24 animate-pulse rounded-full bg-card" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-card" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-card" />
        </div>
      </div>
      <div className="mb-6 h-4 w-1/2 animate-pulse rounded bg-card" />
      <div className="mb-6 h-9 w-2/3 animate-pulse rounded-lg bg-card" />
      <div className="mb-8 h-24 w-full animate-pulse rounded-xl bg-card" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-card" />
    </div>
  )
}
```

- [ ] **Step 2: Create the edit loading boundary**

Create `apps/web/src/app/(dashboard)/memories/[id]/edit/loading.tsx`:

```tsx
export default function EditMemoryLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 h-5 w-24 animate-pulse rounded-full bg-card" />
      <div className="mb-8 h-9 w-48 animate-pulse rounded-lg bg-card" />
      <div className="space-y-4">
        <div className="h-24 w-full animate-pulse rounded-xl bg-card" />
        <div className="h-4 w-full animate-pulse rounded bg-card" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-card" />
        <div className="h-40 w-full animate-pulse rounded-xl bg-card" />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create the new-memory loading boundary**

Create `apps/web/src/app/(dashboard)/memories/new/loading.tsx`:

```tsx
export default function NewMemoryLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 h-9 w-48 animate-pulse rounded-lg bg-card" />
      <div className="h-4 w-64 animate-pulse rounded bg-card" />
      <div className="mt-8 h-96 w-full animate-pulse rounded-xl bg-card" />
    </div>
  )
}
```

- [ ] **Step 4: Tune `prefetch` on auxiliary Links**

In `apps/web/src/components/memory-detail-header.tsx`, the "Voltar" link (line 31-37) gets `prefetch={false}`:

```tsx
        <Link
          href="/"
          prefetch={false}
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
```

In `apps/web/src/components/create-memory-wizard.tsx`, the "Cancelar" link (line 156) gets `prefetch={false}`:

```tsx
          <Link href="/" prefetch={false}>
```

In `apps/web/src/app/(dashboard)/memories/[id]/edit/page.tsx`:
- "Voltar à memória" (line 121): add `prefetch={false}`
- "Voltar ao início" (line 111): add `prefetch={false}`
- "Cancelar" (line 355): add `prefetch={false}`

In `apps/web/src/components/navbar.tsx`, the "Entrar" link (line 74) gets `prefetch={false}`:

```tsx
            <Link
              href="/login"
              prefetch={false}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)] sm:px-4"
            >
              Entrar
            </Link>
```

Leave default (`auto`) prefetch on: timeline cards (`memory-card.tsx`), "Nova Memória" CTAs, and "Editar" buttons — these are primary data routes with loading boundaries now in place, so `auto` prefetches down to the boundary in production.

- [ ] **Step 5: Verify**

```bash
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS. Confirm `loading.tsx` files appear in the route tree by navigating between dashboard / detail / edit / new and seeing the skeleton flash during SPA navigation (hard reloads may show them only in production builds — toggle `next build && next start` for full confirmation).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/memories/\[id\]/loading.tsx apps/web/src/app/\(dashboard\)/memories/\[id\]/edit/loading.tsx apps/web/src/app/\(dashboard\)/memories/new/loading.tsx apps/web/src/components/memory-detail-header.tsx apps/web/src/components/create-memory-wizard.tsx apps/web/src/app/\(dashboard\)/memories/\[id\]/edit/page.tsx apps/web/src/components/navbar.tsx
git commit -m "perf(web): add loading boundaries and tune prefetch"
```

---

### Task 14: Full verification and optional tweaks

**Files:**
- Modify: `docs/tasks.md`

- [ ] **Step 1: Run the full verification suite**

With dev servers up (API on :3333, web on :3000, PostgreSQL + MinIO via `docker compose up -d`):

```bash
pnpm typecheck
pnpm lint
pnpm --filter api test
```

Expected: all PASS (10 typecheck tasks, lint clean apart from the pre-existing `useForm<any>` warning, API tests green).

- [ ] **Step 2: Run the web E2E suite**

```bash
pnpm --filter web test:e2e
```

Expected: PASS against `http://localhost:3000` with the API at :3333 (existing specs: auth-flow, timeline, create/delete/edit memory, filter, upload photos, search music). If a spec fails, confirm it is unrelated to these changes before adjusting.

- [ ] **Step 3: Manual smoke test**

1. Dashboard timeline → cards render photos through `/_next/image`; cards link to `/memories/<id>`.
2. Open a memory with photos → thumbnails + lightbox render; memory with music shows cover from `i.scdn.co`.
3. `/memories/new` → wizard steps lazy-load (fallback flashes), search music shows covers, photo upload previews render and revoke URLs.
4. Create a memory with a photo — upload returns `width`/`height`; the DB row has them (`SELECT width, height FROM memory_photos;`).
5. Search field on dashboard: typing pauses ~300ms before the request fires (check Network tab).
6. SPA navigation between routes shows loading skeletons.

- [ ] **Step 4: Update task tracker**

Edit `docs/tasks.md`, task 5.2 section (lines ~177-181):

```markdown
### 5.2 Performance
- [x] Otimização de imagens (Next/Image)
- [x] Lazy loading
- [x] Cache de queries (Tanstack Query)
- [x] Prefeitura de rotas
```

- [ ] **Step 5: Commit**

```bash
git add docs/tasks.md
git commit -m "docs: mark task 5.2 complete"
```

---