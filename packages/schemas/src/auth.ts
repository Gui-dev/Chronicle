import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(255).optional(),
})

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
