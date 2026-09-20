import { integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { memories } from './memories'

export const memoryPhotos = pgTable('memory_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id')
    .notNull()
    .references(() => memories.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
})

export type MemoryPhoto = typeof memoryPhotos.$inferSelect
export type NewMemoryPhoto = typeof memoryPhotos.$inferInsert
