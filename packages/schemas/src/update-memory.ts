import type { z } from 'zod'
import { createMemorySchema } from './create-memory'

export const updateMemorySchema = createMemorySchema.partial()

export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>
