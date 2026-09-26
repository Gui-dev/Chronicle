import { boolean, decimal, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const memories = pgTable('memories', {
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
  aiNarrative: text('ai_narrative'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
})

export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert
