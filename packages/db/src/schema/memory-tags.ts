import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryTags = pgTable(
  'memory_tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
  },
  (table) => [
    index('memory_tags_memory_idx').on(table.memoryId),
    index('memory_tags_name_idx').on(table.name),
  ],
)

export type MemoryTag = typeof memoryTags.$inferSelect
export type NewMemoryTag = typeof memoryTags.$inferInsert
