// apps/api/src/routes/books.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/db'

const createBookSchema = z.object({
  name:     z.string().min(1).max(100),
  type:     z.enum(['cash', 'bank', 'credit', 'prepaid', 'forex']),
  color:    z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon:     z.string(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default('JPY'),
})

const updateBookSchema = createBookSchema.partial()

export const bookRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require auth
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/v1/books
  fastify.get('/', async (request) => {
    const userId = (request.user as any).sub
    const books = await prisma.book.findMany({
      where: { userId, isArchived: false },
      orderBy: { sortOrder: 'asc' },
    })

    // Compute balance, income, and expense for each book (all entries in the book)
    const booksWithBalance = await Promise.all(
      books.map(async (book) => {
        const result = await prisma.$queryRaw<{
          balance: number
          income: number
          expense: number
        }[]>`
          SELECT
            COALESCE(SUM(CASE WHEN type IN ('INCOME','TRANSFER_IN')  THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type IN ('EXPENSE','TRANSFER_OUT') THEN amount ELSE 0 END), 0)
            AS balance,
            COALESCE(SUM(CASE WHEN type IN ('INCOME','TRANSFER_IN')  THEN amount ELSE 0 END), 0) AS income,
            COALESCE(SUM(CASE WHEN type IN ('EXPENSE','TRANSFER_OUT') THEN amount ELSE 0 END), 0) AS expense
          FROM entries
          WHERE book_id = ${book.id}
            AND deleted_at IS NULL
        `
        const balance = Number(result[0]?.balance ?? 0)
        const income = Number(result[0]?.income ?? 0)
        const expense = Number(result[0]?.expense ?? 0)

        return {
          ...book,
          balance,
          income,
          expense,
          monthIncome: income,
          monthExpense: expense,
        }
      })
    )

    return booksWithBalance
  })

  // POST /api/v1/books
  fastify.post('/', async (request, reply) => {
    const userId  = (request.user as any).sub
    const body    = createBookSchema.parse(request.body)

    const book = await prisma.book.create({ data: { userId, ...body } })

    // Auto-generate transfer categories with every existing book
    const existingBooks = await prisma.book.findMany({
      where: { userId, isArchived: false, id: { not: book.id } },
    })

    const transferCats = existingBooks.flatMap((existing) => [
      {
        userId,
        name:        `${existing.name} → ${book.name}`,
        entryType:   'EXPENSE' as const,
        isTransfer:  true,
        fromBookId:  existing.id,
        toBookId:    book.id,
        isSystem:    true,
        color:       '#0F6E56',
        icon:        'ti-arrows-right-left',
      },
      {
        userId,
        name:        `${book.name} → ${existing.name}`,
        entryType:   'EXPENSE' as const,
        isTransfer:  true,
        fromBookId:  book.id,
        toBookId:    existing.id,
        isSystem:    true,
        color:       '#0F6E56',
        icon:        'ti-arrows-right-left',
      },
    ])

    if (transferCats.length > 0) {
      await prisma.category.createMany({ data: transferCats })
    }

    return reply.status(201).send({
      ...book,
      balance: 0,
      income: 0,
      expense: 0,
      monthIncome: 0,
      monthExpense: 0,
      transferCategoriesCreated: transferCats.length,
    })
  })

  // GET /api/v1/books/:id
  fastify.get('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }

    const book = await prisma.book.findFirst({ where: { id, userId } })
    if (!book) return reply.status(404).send({ error: 'Book not found' })

    const result = await prisma.$queryRaw<{
      balance: number
      income: number
      expense: number
    }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN type IN ('INCOME','TRANSFER_IN')  THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type IN ('EXPENSE','TRANSFER_OUT') THEN amount ELSE 0 END), 0)
        AS balance,
        COALESCE(SUM(CASE WHEN type IN ('INCOME','TRANSFER_IN')  THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type IN ('EXPENSE','TRANSFER_OUT') THEN amount ELSE 0 END), 0) AS expense
      FROM entries
      WHERE book_id = ${id}
        AND deleted_at IS NULL
    `
    const balance = Number(result[0]?.balance ?? 0)
    const income = Number(result[0]?.income ?? 0)
    const expense = Number(result[0]?.expense ?? 0)

    return {
      ...book,
      balance,
      income,
      expense,
      monthIncome: income,
      monthExpense: expense,
    }
  })

  // PATCH /api/v1/books/:id
  fastify.patch('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const body   = updateBookSchema.parse(request.body)

    const book = await prisma.book.findFirst({ where: { id, userId } })
    if (!book) return reply.status(404).send({ error: 'Book not found' })

    return prisma.book.update({ where: { id }, data: body })
  })

  // DELETE /api/v1/books/:id  (archive / delete)
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }

    const book = await prisma.book.findFirst({ where: { id, userId, isArchived: false } })
    if (!book) return reply.status(404).send({ error: 'Book not found' })

    const activeCount = await prisma.book.count({ where: { userId, isArchived: false } })
    if (activeCount <= 1) {
      return reply.status(400).send({ error: 'Cannot delete the only book. You must have at least one active book.' })
    }

    // Soft delete entries belonging to this book so they don't count towards overall balances
    await prisma.entry.updateMany({
      where: { bookId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    })

    await prisma.book.update({ where: { id }, data: { isArchived: true } })
    return { success: true }
  })
}
