import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryPeople = pgTable('memory_people', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id')
    .notNull()
    .references(() => memories.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
})

export type MemoryPerson = typeof memoryPeople.$inferSelect
export type NewMemoryPerson = typeof memoryPeople.$inferInsert
