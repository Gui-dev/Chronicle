import { z } from 'zod'

function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0)
  }
  return new Date(value)
}

export const localDate: z.ZodType<Date, z.ZodTypeDef, string | Date> = z
  .union([z.string(), z.date()])
  .transform(parseLocalDate)
