import { index, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryPeople = pgTable(
  'memory_people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memoryId: uuid('memory_id')
      .notNull()
      .references(() => memories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
  },
  (table) => [index('memory_people_memory_idx').on(table.memoryId)],
)

export type MemoryPerson = typeof memoryPeople.$inferSelect
export type NewMemoryPerson = typeof memoryPeople.$inferInsert
