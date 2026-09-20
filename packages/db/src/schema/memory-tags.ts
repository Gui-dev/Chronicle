import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryTags = pgTable('memory_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id')
    .notNull()
    .references(() => memories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
})

export type MemoryTag = typeof memoryTags.$inferSelect
export type NewMemoryTag = typeof memoryTags.$inferInsert
