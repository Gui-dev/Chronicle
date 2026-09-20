import { z } from 'zod'

export const createMemorySchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  memoryDate: z.coerce.date(),
  locationName: z.string().max(255).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  weatherTemp: z.number().min(-50).max(60).optional(),
  weatherDesc: z.string().max(100).optional(),
  weatherIcon: z.string().max(50).optional(),
  musicTrack: z.string().max(255).optional(),
  musicArtist: z.string().max(255).optional(),
  musicUrl: z.string().url().optional(),
  musicCover: z.string().url().optional(),
  people: z.array(z.string().max(255)).optional(),
  tags: z.array(z.string().max(100)).optional(),
})

export type CreateMemoryInput = z.infer<typeof createMemorySchema>
