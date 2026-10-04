# Chronicle

A full-stack memory timeline application for recording life moments with photos, locations, music, and people — built as a monorepo with modern TypeScript tooling.

## Screenshots

| Home (Dark) | Home (Purple Theme) | Wizard | Menu |
|:---:|:---:|:---:|:---:|
| ![Home Dark](docs/screens/home-dark.png) | ![Home Purple](docs/screens/home-purple.png) | ![Wizard](docs/screens/wizard.png) | ![Menu](docs/screens/menu.png) |

## Tech Stack

### Frontend (web)
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4 (with `@theme inline` CSS variables)
- **UI Components**: Radix UI primitives + custom components
- **Forms**: React Hook Form + Zod validation
- **State**: TanStack Query (React Query) + React Context
- **Auth**: Better Auth (email/password, session cookies)

### Backend (api)
- **Runtime**: Node.js + Fastify
- **Language**: TypeScript
- **ORM**: Drizzle ORM (PostgreSQL)
- **Auth**: Better Auth integration
- **Validation**: Zod schemas

### Shared
- **Database**: `@chronicle/db` — Drizzle schema + migrations
- **Schemas**: `@chronicle/schemas` — Zod validation schemas
- **Auth**: `@chronicle/auth` — Better Auth config
- **UI**: `@chronicle/ui` — Shared Radix-based components

### DevOps & Tooling
- **Monorepo**: pnpm workspaces + Turborepo
- **Lint/Format**: Biome
- **Git Hooks**: Lefthook (pre-commit)
- **Testing**: Vitest (unit), Playwright (E2E)
- **Database**: PostgreSQL (Docker Compose)

## Project Structure

```
chronicle/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # Next.js frontend
├── packages/
│   ├── auth/         # Better Auth configuration
│   ├── db/           # Drizzle ORM schema & migrations
│   ├── schemas/      # Zod validation schemas
│   └── ui/           # Shared Radix UI components
├── docs/
│   ├── screens/      # Application screenshots
│   ├── skills/       # Development guidelines
│   ├── superpowers/  # Specs & implementation plans
│   ├── tasks.md      # Task tracking
│   └── TESTING.md    # Testing guidelines
└── turbo.json        # Turborepo config
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 10+
- Docker & Docker Compose (for PostgreSQL)

### Installation

```bash
# Clone and install dependencies
git clone <repo-url>
cd chronicle
pnpm install

# Start PostgreSQL
docker compose up -d

# Run database migrations
pnpm db:migrate

# Start development servers (API + Web)
pnpm dev
```

### Environment Variables

Create `.env` files in each app:

**Root `.env`** (shared by API and DB):
```env
DATABASE_URL=postgresql://chronicle:chronicle@localhost:5432/chronicle
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3333
```

**apps/web/.env.local**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3333
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Available Commands

```bash
# Development
pnpm dev              # Start all apps (Turbo)
pnpm dev:api          # API only (port 3333)
pnpm dev:web          # Web only (port 3000)

# Database
pnpm db:generate      # Generate Drizzle migration
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema (dev only)
pnpm db:studio        # Open Drizzle Studio

# Code Quality
pnpm lint             # Biome check
pnpm lint:fix         # Biome check --write
pnpm format           # Biome format --write
pnpm typecheck        # TypeScript check (all packages)

# Testing
pnpm test             # All tests (unit + e2e)
pnpm test:unit        # Unit tests only (Vitest)
pnpm test:e2e         # E2E tests only (Playwright)
pnpm test:contrast    # WCAG AA contrast validation

# Build
pnpm build            # Build all packages
```

## Key Features

### Memory Timeline
- Chronological feed of memories with photos, location, weather
- Infinite scroll pagination
- Keyboard navigation (arrows, Home/End)
- Filter by year, month, weather, location, tags

### Memory Creation Wizard
- 5-step guided creation: Basic Info → Location → Music → Photos → People/Tags
- Draft persistence in `sessionStorage` (survives reload)
- Photo upload with progress tracking
- Spotify music search integration

### Themes
- **System** (respects OS preference)
- **Dark** (default, warm amber accents)
- **Light** (warm off-white, bronze/gold accents)
- **Purple** (dark violet, emerald accents)
- Persisted in `localStorage` per device

### Search
- Unified search input in navbar
- Live dropdown with top 5 results (debounced 300ms)
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- "Ver todas" navigates to full search page with chips/filters

### Sharing & Export
- Shareable links with redacted previews
- GDPR-compliant data export (JSON + photos)

## Database Schema (High-Level)

- **users** — Better Auth users, accounts, sessions
- **memories** — Core memory entries (title, content, date, location, weather)
- **photos** — Memory photos (URL, metadata, order)
- **people** — People tagged in memories
- **tags** — Custom tags for filtering
- **music** — Spotify track associations

## Development Guidelines

### Commits
Follow Conventional Commits:
```
feat: add search dropdown keyboard navigation
fix: fix purple theme button contrast
docs: update theme toggle documentation
```

### Code Style
- Biome for linting/formatting (single quotes, 2-space indent)
- No `any` types (Biome warns)
- Functional components, hooks for state/logic
- Server Components by default, `'use client'` only when needed

### Testing
- Unit: Vitest (API routes, hooks, utilities)
- E2E: Playwright (Chromium, authenticated fixtures)
- Contrast: Custom script validating WCAG AA (4.5:1 text, 3:1 UI)
- Axe-core for accessibility regression testing

## Database

### Migrations
```bash
# Create migration after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Quick schema push (development only)
pnpm db:push
```

### Drizzle Studio
```bash
pnpm db:studio  # Opens at http://localhost:4983
```

## Deployment

### Docker (Recommended)
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Environment Variables (Production)
- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — Strong random string (32+ chars)
- `BETTER_AUTH_URL` — Production API URL
- `NEXT_PUBLIC_API_URL` — Production API URL
- `NEXT_PUBLIC_APP_URL` — Production web URL

## Architecture Decisions

### Why Turborepo?
- Fast, cached builds across packages
- Parallel task execution
- Remote caching support

### Why Better Auth?
- Framework-agnostic, works with Next.js + Fastify
- Secure session handling (HTTP-only cookies)
- Built-in email/password, OAuth ready

### Why Drizzle ORM?
- Type-safe SQL with TypeScript inference
- Lightweight, fast, no runtime overhead
- Migration management built-in

### Why TanStack Query?
- Server state caching, deduplication
- Optimistic updates for mutations
- Devtools for debugging

### Why Radix UI?
- Unstyled, accessible primitives
- Composable, minimal bundle size
- Full keyboard/ARIA support out of box

## License

MIT License — see LICENSE file for details.