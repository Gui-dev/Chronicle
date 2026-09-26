import { z } from 'zod'

export const memoryFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  weather: z.string().optional(),
  location: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  mine: z.coerce.boolean().optional(),
})

export type MemoryFiltersInput = z.infer<typeof memoryFiltersSchema>
