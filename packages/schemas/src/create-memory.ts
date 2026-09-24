import { z } from 'zod'
import { localDate } from './local-date'

const emptyToUndefined = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || undefined)

const coordinate = z
  .number()
  .min(-90)
  .max(90)
  .optional()
  .nullable()
  .transform((v) => v ?? undefined)

const nullableNumber = z
  .number()
  .optional()
  .nullable()
  .transform((v) => v ?? undefined)

export const createMemorySchema = z.object({
  title: z.string().min(1).max(255),
  content: emptyToUndefined,
  memoryDate: localDate,
  locationName: emptyToUndefined,
  locationLat: coordinate,
  locationLng: coordinate,
  weatherTemp: nullableNumber,
  weatherDesc: emptyToUndefined,
  weatherIcon: emptyToUndefined,
  musicTrack: emptyToUndefined,
  musicArtist: emptyToUndefined,
  musicUrl: z
    .string()
    .url()
    .or(z.literal(''))
    .optional()
    .nullable()
    .transform((v) => v || undefined),
  musicCover: z
    .string()
    .url()
    .or(z.literal(''))
    .optional()
    .nullable()
    .transform((v) => v || undefined),
  people: z.array(z.string().max(255)).optional(),
  tags: z.array(z.string().max(100)).optional(),
})

export type CreateMemoryInput = z.infer<typeof createMemorySchema>
