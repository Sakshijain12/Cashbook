// apps/api/src/routes/entries.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/db'
import { scanBill } from '../services/ocr'
import { uploadToR2 } from '../services/storage'
import sharp from 'sharp'
import { dateSchema, timeSchema, moneySchema } from '../utils/validation'

const createEntrySchema = z.object({
  bookId:        z.string().uuid(),
  categoryId:    z.string().uuid(),
  amount:        moneySchema,
  name:          z.string().min(1).max(200),
  paymentMethod: z.enum(['cash', 'salary', 'card', 'online', 'direct_debit']).optional(),
  entryDate:     dateSchema,
  entryTime:     timeSchema,
  note:          z.string().optional(),
  billUrl:       z.string().optional(),
  billThumbUrl:  z.string().optional(),
  // For transfers
  destBookId:    z.string().uuid().optional(),
})

const updateEntrySchema = createEntrySchema.partial()

export const entryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/v1/entries
  fastify.get('/', async (request) => {
    const userId = (request.user as any).sub
    const {
      bookId, dateFrom, dateTo, type, categoryId,
      q, page = '1', limit = '50', includeTransfers = 'false',
      sortBy = 'date', sortOrder = 'desc',
    } = request.query as Record<string, string>

    const where: any = {
      userId,
      deletedAt: null,
    }

    if (bookId)     where.bookId     = bookId
    if (categoryId) where.categoryId = categoryId
    if (type)       where.type       = z.enum(['INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT']).parse(type)

    if (includeTransfers === 'false') {
      if (type === 'TRANSFER_IN' || type === 'TRANSFER_OUT') where.type = { in: [] }
      else if (!type) where.type = { notIn: ['TRANSFER_IN', 'TRANSFER_OUT'] }
    }

    if (dateFrom || dateTo) {
      where.entryDate = {}
      if (dateFrom) where.entryDate.gte = new Date(dateSchema.parse(dateFrom))
      if (dateTo)   where.entryDate.lte = new Date(dateSchema.parse(dateTo))
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
      ]
    }

    const pageNumber = z.coerce.number().int().min(1).max(100000).parse(page)
    const pageSize = z.coerce.number().int().min(1).max(200).parse(limit)
    const skip  = (pageNumber - 1) * pageSize
    const total = await prisma.entry.count({ where })

    const validSortBy = sortBy === 'amount' ? 'amount' : 'date'
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'
    const orderBy: any = validSortBy === 'amount'
      ? [
          { amount: validSortOrder },
          { entryDate: 'desc' },
          { entryTime: 'desc' },
        ]
      : [
          { entryDate: validSortOrder },
          { entryTime: validSortOrder },
        ]

    const entries = await prisma.entry.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      include: {
        category: true,
        book:     { select: { id: true, name: true, color: true } },
      },
    })

    return { entries, total, page: pageNumber, limit: pageSize }
  })

  // POST /api/v1/entries
  fastify.post('/', async (request, reply) => {
    const userId = (request.user as any).sub
    const body   = createEntrySchema.parse(request.body)

    const book = await prisma.book.findFirst({ where: { id: body.bookId, userId, isArchived: false } })
    if (!book) return reply.status(404).send({ error: 'Book not found' })

    // Look up category to check if it's a transfer
    const category = await prisma.category.findFirst({
      where: { id: body.categoryId, userId },
    })
    if (!category) return reply.status(404).send({ error: 'Category not found' })

    if (category.isTransfer) {
      // ── TRANSFER: create two linked entries atomically ──────────────────
      const destBookId = body.destBookId || category.toBookId
      if (!destBookId) return reply.status(400).send({ error: 'Destination book required for transfers' })
      if (category.fromBookId !== body.bookId || category.toBookId !== destBookId || destBookId === body.bookId) {
        return reply.status(400).send({ error: 'Transfer category must match the source and destination books' })
      }
      const destination = await prisma.book.findFirst({ where: { id: destBookId, userId, isArchived: false } })
      if (!destination) return reply.status(404).send({ error: 'Destination book not found' })
      if (destination.currency !== book.currency) return reply.status(400).send({ error: 'Cross-currency transfers require exchange rates and are not supported yet' })

      const result = await prisma.$transaction(async (tx) => {
        const transfer = await tx.transfer.create({
          data: {
            userId,
            fromBookId:   body.bookId,
            toBookId:     destBookId,
            amount:       body.amount,
            transferDate: new Date(body.entryDate),
            transferTime: new Date(`1970-01-01T${body.entryTime}:00Z`),
            note:         body.note,
          },
        })

        const entryFrom = await tx.entry.create({
          data: {
            userId,
            bookId:      body.bookId,
            categoryId:  body.categoryId,
            type:        'TRANSFER_OUT',
            amount:      body.amount,
            name:        body.name,
            entryDate:   new Date(body.entryDate),
            entryTime:   new Date(`1970-01-01T${body.entryTime}:00Z`),
            transferId:  transfer.id,
            note:        body.note,
          },
        })

        const entryTo = await tx.entry.create({
          data: {
            userId,
            bookId:      destBookId,
            categoryId:  body.categoryId,
            type:        'TRANSFER_IN',
            amount:      body.amount,
            name:        body.name,
            entryDate:   new Date(body.entryDate),
            entryTime:   new Date(`1970-01-01T${body.entryTime}:00Z`),
            transferId:  transfer.id,
            note:        body.note,
          },
        })

        await tx.transfer.update({
          where: { id: transfer.id },
          data: { entryFromId: entryFrom.id, entryToId: entryTo.id },
        })

        return { transfer, entryFrom, entryTo }
      })

      return reply.status(201).send(result)
    } else {
      // ── NORMAL ENTRY ────────────────────────────────────────────────────
      // Determine type from category entryType
      const entryType = category.entryType === 'INCOME' ? 'INCOME' : 'EXPENSE'

      const entry = await prisma.entry.create({
        data: {
          userId,
          bookId:        body.bookId,
          categoryId:    body.categoryId,
          type:          entryType,
          amount:        body.amount,
          name:          body.name,
          paymentMethod: body.paymentMethod,
          entryDate:     new Date(body.entryDate),
          entryTime:     new Date(`1970-01-01T${body.entryTime}:00Z`),
          billUrl:       body.billUrl,
          billThumbUrl:  body.billThumbUrl,
          note:          body.note,
        },
        include: { category: true, book: { select: { id: true, name: true } } },
      })

      return reply.status(201).send(entry)
    }
  })

  // GET /api/v1/entries/:id
  fastify.get('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }

    const entry = await prisma.entry.findFirst({
      where: { id, userId, deletedAt: null },
      include: { category: true, book: true },
    })
    if (!entry) return reply.status(404).send({ error: 'Entry not found' })
    return entry
  })

  // PATCH /api/v1/entries/:id
  fastify.patch('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const body   = updateEntrySchema.parse(request.body)

    const entry = await prisma.entry.findFirst({ where: { id, userId, deletedAt: null } })
    if (!entry) return reply.status(404).send({ error: 'Entry not found' })

    if (entry.transferId && ((body.bookId && body.bookId !== entry.bookId) ||
      (body.categoryId && body.categoryId !== entry.categoryId) || body.destBookId)) {
      return reply.status(400).send({ error: 'Transfer books and category cannot be changed. Delete and recreate the transfer.' })
    }
    if (body.bookId) {
      const book = await prisma.book.findFirst({ where: { id: body.bookId, userId, isArchived: false } })
      if (!book) return reply.status(404).send({ error: 'Book not found' })
      if (body.bookId !== entry.bookId) {
        const previousBook = await prisma.book.findFirst({ where: { id: entry.bookId, userId } })
        if (previousBook?.currency !== book.currency) return reply.status(400).send({ error: 'Cannot move an entry between currencies' })
      }
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.amount !== undefined) updateData.amount = body.amount
    if (body.bookId !== undefined) updateData.bookId = body.bookId
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod
    if (body.note !== undefined) updateData.note = body.note
    if (body.billUrl !== undefined) updateData.billUrl = body.billUrl
    if (body.billThumbUrl !== undefined) updateData.billThumbUrl = body.billThumbUrl

    if (body.entryDate) {
      updateData.entryDate = new Date(body.entryDate)
    }

    if (body.entryTime) {
      const timeVal = body.entryTime.includes('T')
        ? body.entryTime.split('T')[1].slice(0, 5)
        : body.entryTime
      updateData.entryTime = new Date(`1970-01-01T${timeVal}:00Z`)
    }

    if (body.categoryId) {
      updateData.categoryId = body.categoryId
      const category = await prisma.category.findFirst({
        where: { id: body.categoryId, userId },
      })
      if (!category) return reply.status(404).send({ error: 'Category not found' })
      if (!entry.transferId && category.isTransfer) return reply.status(400).send({ error: 'Create a new transfer instead of changing a normal entry into one' })
      if (!category.isTransfer && !entry.transferId) {
        updateData.type = category.entryType === 'INCOME' ? 'INCOME' : 'EXPENSE'
      }
    }

    // If transfer, update both legs
    if (entry.transferId) {
      const transferUpdate: any = {}
      if (body.amount !== undefined) transferUpdate.amount = body.amount
      if (updateData.entryDate) transferUpdate.transferDate = updateData.entryDate
      if (updateData.entryTime) transferUpdate.transferTime = updateData.entryTime
      if (body.note !== undefined) transferUpdate.note = body.note

      await prisma.$transaction([
        prisma.entry.update({ where: { id }, data: updateData }),
        prisma.entry.updateMany({
          where: { userId, transferId: entry.transferId, deletedAt: null, id: { not: id } },
          data: {
            ...(body.amount !== undefined && { amount: body.amount }),
            ...(body.name !== undefined && { name: body.name }),
            ...(updateData.entryDate && { entryDate: updateData.entryDate }),
            ...(updateData.entryTime && { entryTime: updateData.entryTime }),
            ...(body.note !== undefined && { note: body.note }),
          },
        }),
        ...(Object.keys(transferUpdate).length > 0 ? [
          prisma.transfer.update({
            where: { id: entry.transferId },
            data: transferUpdate,
          }),
        ] : []),
      ])
      return { success: true }
    }

    return prisma.entry.update({
      where: { id },
      data: updateData,
      include: { category: true, book: { select: { id: true, name: true } } },
    })
  })

  // DELETE /api/v1/entries/:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }

    const entry = await prisma.entry.findFirst({ where: { id, userId, deletedAt: null } })
    if (!entry) return reply.status(404).send({ error: 'Entry not found' })

    if (entry.transferId) {
      // Retain the transfer as an audit link; soft-delete both ledger legs.
      await prisma.$transaction([
        prisma.entry.updateMany({
          where:  { userId, transferId: entry.transferId },
          data:   { deletedAt: new Date() },
        }),
      ])
    } else {
      await prisma.entry.update({ where: { id }, data: { deletedAt: new Date() } })
    }

    return { success: true }
  })

  // POST /api/v1/entries/scan-bill
  fastify.post('/scan-bill', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(data.mimetype)) {
      return reply.status(415).send({ error: 'Upload a JPEG, PNG, or WebP receipt image' })
    }
    const input = await data.toBuffer()
    let buffer: Buffer
    try {
      // Decode rather than trust MIME; strip metadata and bound decompressed image size.
      buffer = await sharp(input, { limitInputPixels: 20000000 }).rotate()
        .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer()
    } catch {
      return reply.status(400).send({ error: 'Invalid image or image exceeds 20 megapixels' })
    }
    const host = request.headers.host || `localhost:${process.env.PORT || 3000}`
    const protocol = request.protocol || 'http'
    const baseUrl = `${protocol}://${host}`

    const { url, thumbUrl } = await uploadToR2(buffer, 'image/jpeg', 'bills', baseUrl)
    const extracted = await scanBill(buffer)

    return { ...extracted, billUrl: url, billThumbUrl: thumbUrl }
  })
}
