import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const narrativeVersions = pgTable(
  'narrative_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    narrative: text('narrative').notNull(),
    mood: varchar('mood', { length: 50 }),
    themes: text('themes').array(),
    version: integer('version').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('narrative_versions_memory_idx').on(table.memoryId)],
)

export type NarrativeVersion = typeof narrativeVersions.$inferSelect
export type NewNarrativeVersion = typeof narrativeVersions.$inferInsert
