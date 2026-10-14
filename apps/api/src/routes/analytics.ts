import { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../utils/db'
import { analyticsQuerySchema, monthWindow } from '../utils/validation'
import { buildSpendingInsights } from '../services/insights'
import { prioritizeInsights } from '../services/ai-coach'
import { z } from 'zod'

async function loadInsights(userId: string, query: z.infer<typeof analyticsQuerySchema>) {
  const { month, year, end } = monthWindow(query.month, query.year)
  const { currency } = await scope(userId, query.bookId)
  const entries = await prisma.entry.findMany({
    where: { userId, bookId: query.bookId, deletedAt: null, type: 'EXPENSE', entryDate: { gte: new Date(Date.UTC(year, month - 4, 1)), lt: end } },
    select: { id: true, name: true, amount: true, entryDate: true, categoryId: true, category: { select: { name: true } } },
    orderBy: [{ entryDate: 'asc' }, { id: 'asc' }], take: 5001,
  })
  if (entries.length > 5000) return { currency, method: 'explainable-statistics-v1', sampleSize: 0, insights: [], notice: 'Too many entries for this analysis. Select a single book. No partial-data insights were generated.' }
  return { currency, ...buildSpendingInsights(entries.map(e => ({ ...e, amount: Number(e.amount) })), month, year) }
}

async function scope(userId: string, bookId?: string) {
  const books = await prisma.book.findMany({ where: { userId, ...(bookId ? { id: bookId } : {}) }, select: { currency: true } })
  if (bookId && !books.length) throw Object.assign(new Error('Book not found'), { statusCode: 404 })
  const currencies = new Set(books.map(b => b.currency))
  if (currencies.size > 1) throw Object.assign(new Error('Select one book: mixed currencies cannot be added without exchange rates'), { statusCode: 400 })
  return { currency: books[0]?.currency ?? 'JPY', filter: bookId ? Prisma.sql`AND e.book_id = ${bookId}` : Prisma.empty }
}

export const analyticsRoutes: FastifyPluginAsync = async fastify => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/summary', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    const { start, end, month, year } = monthWindow(query.month, query.year)
    const { filter, currency } = await scope(request.user.sub, query.bookId)
    const rows = await prisma.$queryRaw<{ income: Prisma.Decimal; expense: Prisma.Decimal }[]>(Prisma.sql`
      SELECT COALESCE(SUM(CASE WHEN e.type = 'INCOME' THEN e.amount ELSE 0 END), 0) AS income,
             COALESCE(SUM(CASE WHEN e.type = 'EXPENSE' THEN e.amount ELSE 0 END), 0) AS expense
      FROM entries e WHERE e.user_id = ${request.user.sub} AND e.deleted_at IS NULL
      AND e.entry_date >= ${start} AND e.entry_date < ${end} ${filter}`)
    const income = Number(rows[0]?.income ?? 0)
    const expense = Number(rows[0]?.expense ?? 0)
    return { income, expense, saved: Number(new Prisma.Decimal(income).minus(expense)), month, year, currency }
  })

  fastify.get('/by-category', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    const { start, end } = monthWindow(query.month, query.year)
    const { filter } = await scope(request.user.sub, query.bookId)
    const type = query.type === 'income' ? 'INCOME' : 'EXPENSE'
    const rows = await prisma.$queryRaw<{ id: string; name: string; color: string; total: Prisma.Decimal }[]>(Prisma.sql`
      SELECT c.id, c.name, COALESCE(c.color, '#444441') AS color, SUM(e.amount) AS total
      FROM entries e JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = ${request.user.sub} AND e.deleted_at IS NULL AND e.type = ${type}::"LedgerType"
      AND e.entry_date >= ${start} AND e.entry_date < ${end} ${filter}
      GROUP BY c.id, c.name, c.color ORDER BY total DESC`)
    const total = rows.reduce((sum, row) => sum + Number(row.total), 0)
    return rows.map(row => ({ ...row, total: Number(row.total), pct: total ? Math.round(Number(row.total) / total * 100) : 0 }))
  })

  fastify.get('/trend', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    const { month, year, end } = monthWindow(query.month, query.year)
    const start = new Date(Date.UTC(year, month - 6, 1))
    const { filter } = await scope(request.user.sub, query.bookId)
    const rows = await prisma.$queryRaw<{ month: number; year: number; income: Prisma.Decimal; expense: Prisma.Decimal }[]>(Prisma.sql`
      SELECT EXTRACT(MONTH FROM e.entry_date)::int AS month, EXTRACT(YEAR FROM e.entry_date)::int AS year,
        COALESCE(SUM(CASE WHEN e.type = 'INCOME' THEN e.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN e.type = 'EXPENSE' THEN e.amount ELSE 0 END), 0) AS expense
      FROM entries e WHERE e.user_id = ${request.user.sub} AND e.deleted_at IS NULL
      AND e.entry_date >= ${start} AND e.entry_date < ${end} ${filter}
      GROUP BY month, year ORDER BY year, month`)
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(Date.UTC(year, month - 6 + i, 1))
      const m = date.getUTCMonth() + 1, y = date.getUTCFullYear()
      const row = rows.find(r => r.month === m && r.year === y)
      return { month: m, year: y, income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) }
    })
  })

  fastify.get('/top-entries', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    const { start, end } = monthWindow(query.month, query.year)
    await scope(request.user.sub, query.bookId)
    const rows = await prisma.entry.findMany({
      where: { userId: request.user.sub, bookId: query.bookId, deletedAt: null, type: query.type === 'income' ? 'INCOME' : 'EXPENSE', entryDate: { gte: start, lt: end } },
      orderBy: [{ amount: 'desc' }, { id: 'asc' }], take: query.limit,
      select: { id: true, name: true, amount: true, category: { select: { name: true, color: true } } },
    })
    return rows.map(r => ({ id: r.id, name: r.name, amount: Number(r.amount), category_name: r.category.name, category_color: r.category.color ?? '#444441' }))
  })

  fastify.get('/heatmap', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    const { start, end, month, year } = monthWindow(query.month, query.year)
    const { filter, currency } = await scope(request.user.sub, query.bookId)
    const rows = await prisma.$queryRaw<{ date: string; income: Prisma.Decimal; expense: Prisma.Decimal }[]>(Prisma.sql`
      SELECT e.entry_date::text AS date,
             COALESCE(SUM(CASE WHEN e.type = 'INCOME' THEN e.amount ELSE 0 END), 0) AS income,
             COALESCE(SUM(CASE WHEN e.type = 'EXPENSE' THEN e.amount ELSE 0 END), 0) AS expense
      FROM entries e WHERE e.user_id = ${request.user.sub} AND e.deleted_at IS NULL
      AND e.entry_date >= ${start} AND e.entry_date < ${end} ${filter}
      GROUP BY e.entry_date::text
      ORDER BY date ASC`)

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const map = new Map(rows.map(r => [r.date, { income: Number(r.income), expense: Number(r.expense) }]))

    let maxExpense = 0
    let maxIncome = 0
    let totalExpense = 0
    let totalIncome = 0
    let activeExpenseDays = 0
    let activeIncomeDays = 0

    const days = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0')
      const mStr = String(month).padStart(2, '0')
      const dateStr = `${year}-${mStr}-${dayStr}`
      const entry = map.get(dateStr) ?? { income: 0, expense: 0 }
      const expense = entry.expense
      const income = entry.income

      if (expense > maxExpense) maxExpense = expense
      if (income > maxIncome) maxIncome = income
      if (expense > 0) activeExpenseDays++
      if (income > 0) activeIncomeDays++
      totalExpense += expense
      totalIncome += income

      // Day of week in UTC: 0=Sun, 1=Mon, ..., 6=Sat
      const dayOfWeek = new Date(Date.UTC(year, month - 1, d)).getUTCDay()

      days.push({
        date: dateStr,
        day: d,
        dayOfWeek,
        expense,
        income,
        net: income - expense,
      })
    }

    return {
      month,
      year,
      currency,
      daysInMonth,
      days,
      maxExpense,
      maxIncome,
      totalExpense,
      totalIncome,
      activeExpenseDays,
      activeIncomeDays,
    }
  })

  fastify.get('/insights', async request => {
    const query = analyticsQuerySchema.parse(request.query)
    return loadInsights(request.user.sub, query)
  })

  fastify.post('/coach', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async request => {
    const body = analyticsQuerySchema.extend({ consent: z.literal(true) }).parse(request.body)
    const report = await loadInsights(request.user.sub, body)
    return { ...await prioritizeInsights(report.insights), currency: report.currency,
      notice: 'AI only prioritizes existing evidence. Amounts and review actions are server-controlled. Not financial advice.' }
  })
}
