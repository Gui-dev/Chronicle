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
  isPublic: z.boolean().optional(),
  // The select renders an empty option ("Deixar a IA decidir"), and an empty
  // string is not a member of the enum — without the `or(z.literal(''))` the
  // wizard's default submit 400s before anything is saved. Same shape as the
  // music URLs above.
  aiMood: z
    .enum(['nostalgic', 'joyful', 'melancholic', 'energetic', 'peaceful', 'romantic'])
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
})

export type CreateMemoryInput = z.infer<typeof createMemorySchema>

export type CreateMemoryFormValues = z.input<typeof createMemorySchema>
