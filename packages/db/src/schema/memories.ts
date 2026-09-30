import { sql } from 'drizzle-orm'
import {
  boolean,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content'),
    memoryDate: timestamp('memory_date', { mode: 'date' }).notNull(),
    locationName: varchar('location_name', { length: 255 }),
    locationLat: decimal('location_lat', { precision: 10, scale: 8 }),
    locationLng: decimal('location_lng', { precision: 11, scale: 8 }),
    weatherTemp: decimal('weather_temp', { precision: 5, scale: 2 }),
    weatherDesc: varchar('weather_desc', { length: 100 }),
    weatherIcon: varchar('weather_icon', { length: 50 }),
    musicTrack: varchar('music_track', { length: 255 }),
    musicArtist: varchar('music_artist', { length: 255 }),
    musicUrl: text('music_url'),
    musicCover: text('music_cover'),
    isPublic: boolean('is_public').notNull().default(true),
    // Share link (7.4). NULL means "no link". The shared state is derived, never
    // stored: `!is_public && share_token && share_expires_at > now()`. Rotation
    // replaces the token in place (one active link per memory, enforced by the
    // partial unique index below); any update that carries `isPublic` clears
    // both columns so a public → private toggle can never resurrect a link.
    shareToken: text('share_token'),
    shareExpiresAt: timestamp('share_expires_at', { mode: 'date' }),
    aiNarrative: text('ai_narrative'),
    aiMood: varchar('ai_mood', { length: 50 }),
    aiThemes: text('ai_themes').array(),
    deletedAt: timestamp('deleted_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    // Own timeline, already ordered newest-first by findAll.
    index('memories_user_date_idx').on(table.userId, table.memoryDate.desc()),
    // Public feed. NOT partial: the logged-in feed is
    // `is_public = true OR user_id = $1`, and Postgres will not use a partial
    // index for a query it cannot prove implies the index predicate — its
    // implication check does not reason through OR. Indexed on (is_public,
    // memory_date) instead, so it serves the is_public arm of that OR directly
    // and still keeps the DESC ordering the timeline wants.
    index('memories_public_date_idx').on(table.isPublic, table.memoryDate.desc()),
    // One active share token per memory. Partial: NULLs (the common no-link
    // case) stay out of the index entirely — fewer entries, and the predicate
    // documents the derived-state rule (a row is linkable iff token IS NOT
    // NULL). Postgres would not collide the NULLs anyway (NULLS DISTINCT is
    // the default); the WHERE matches the spec's SQL.
    uniqueIndex('memories_share_token_idx')
      .on(table.shareToken)
      .where(sql`${table.shareToken} is not null`),
  ],
)

export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert
