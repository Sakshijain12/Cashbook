import { z } from 'zod'

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export const dateSchema = z.string().refine(isCalendarDate, 'Use a valid YYYY-MM-DD date')
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid HH:MM time')
export const moneySchema = z.number().finite().positive().max(9999999999.99)
  .refine(value => /^\d+(\.\d{1,2})?$/.test(String(value)),
    'Amount must have at most two decimal places')

export const analyticsQuerySchema = z.object({
  bookId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  type: z.enum(['income', 'expense']).default('expense'),
  limit: z.coerce.number().int().min(1).max(50).default(5),
})

export function monthWindow(month?: number, year?: number, now = new Date()) {
  const m = month ?? now.getUTCMonth() + 1
  const y = year ?? now.getUTCFullYear()
  return { month: m, year: y, start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) }
}