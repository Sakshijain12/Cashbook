// apps/api/src/routes/reports.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '../utils/db'
import { generatePdf } from '../services/pdf'
import { generateExcel } from '../services/excel'
import { uploadToR2 } from '../services/storage'
import { dateSchema } from '../utils/validation'

const generateSchema = z.object({
  format:                  z.enum(['pdf', 'xlsx', 'excel']).transform(f => f === 'excel' ? 'xlsx' : f),
  bookIds:                 z.array(z.string().uuid()).optional(),
  dateFrom:                dateSchema,
  dateTo:                  dateSchema,
  includeIncome:           z.boolean().default(true),
  includeExpense:          z.boolean().default(true),
  includeTransfers:        z.boolean().default(false),
  includeCategorySummary:  z.boolean().default(true),
  includeBills:            z.boolean().default(true),
})

export const reportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // POST /api/v1/reports/generate
  fastify.post('/generate', async (request, reply) => {
    const userId = (request.user as any).sub
    const body   = generateSchema.parse(request.body)

    // Normalize date order so start date is never after end date
    const dateFrom = body.dateFrom <= body.dateTo ? body.dateFrom : body.dateTo
    const dateTo   = body.dateFrom <= body.dateTo ? body.dateTo : body.dateFrom

    const books = await prisma.book.findMany({
      where: { userId, ...(body.bookIds?.length ? { id: { in: body.bookIds } } : {}) },
      select: { id: true, currency: true },
    })

    if (body.bookIds?.length && body.bookIds.some(id => !books.some(book => book.id === id))) {
      return reply.status(404).send({ error: 'Book not found' })
    }

    const currency = books[0]?.currency ?? 'JPY'
    const options = { ...body, currency }

    // Build entry query
    const typeFilter: string[] = []
    if (body.includeIncome)    typeFilter.push('INCOME')
    if (body.includeExpense)   typeFilter.push('EXPENSE')
    if (body.includeTransfers) { typeFilter.push('TRANSFER_IN'); typeFilter.push('TRANSFER_OUT') }

    const entries = await prisma.entry.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(typeFilter.length ? { type: { in: typeFilter as any } } : {}),
        entryDate: { gte: new Date(dateFrom), lte: new Date(dateTo) },
        ...(body.bookIds?.length ? { bookId: { in: body.bookIds } } : {}),
      },
      orderBy: [{ entryDate: 'asc' }, { entryTime: 'asc' }],
      include: { category: true, book: { select: { id: true, name: true } } },
      take: 10001,
    })

    if (entries.length > 10000) {
      return reply.status(400).send({ error: 'Report is too large. Choose a shorter date range.' })
    }

    const reportName = `${dateFrom} to ${dateTo}`

    let buffer: Buffer
    if (body.format === 'pdf') {
      buffer = await generatePdf(entries, options, reportName)
    } else {
      buffer = await generateExcel(entries, options, reportName)
    }

    const ext = body.format === 'pdf' ? 'pdf' : 'xlsx'
    const mimeType = body.format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const reportId = crypto.randomUUID()

    // Save locally first to guarantee local file availability
    const reportsDir = path.join(process.cwd(), 'uploads', 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    const localFilePath = path.join(reportsDir, `${reportId}.${ext}`)
    fs.writeFileSync(localFilePath, buffer)

    let fileUrl = `/api/v1/reports/${reportId}/download`

    // Try R2 upload if configured
    const r2Configured = process.env.R2_ACCOUNT_ID &&
      !process.env.R2_ACCOUNT_ID.includes('your-cloudflare') &&
      process.env.R2_ACCESS_KEY_ID &&
      !process.env.R2_ACCESS_KEY_ID.includes('your-r2')

    if (r2Configured) {
      try {
        const r2Result = await uploadToR2(buffer, mimeType, `reports/${userId}`)
        fileUrl = r2Result.url
      } catch (r2Err) {
        request.log.warn({ err: r2Err }, 'R2 upload failed, used local storage')
      }
    }

    const report = await prisma.report.create({
      data: {
        id:          reportId,
        userId,
        name:        reportName,
        format:      body.format,
        fileUrl,
        fileSizeKb:  Math.ceil(buffer.length / 1024),
        dateFrom:    new Date(dateFrom),
        dateTo:      new Date(dateTo),
      },
    })

    return reply.status(201).send({
      ...report,
      fileData: buffer.toString('base64'),
      mimeType,
      fileName: `CashBook_Report_${dateFrom}_to_${dateTo}.${ext}`,
    })
  })

  // GET /api/v1/reports
  fastify.get('/', async (request) => {
    const userId = (request.user as any).sub
    return prisma.report.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
    })
  })

  // GET /api/v1/reports/:id
  fastify.get('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const report = await prisma.report.findFirst({ where: { id, userId } })
    if (!report) return reply.status(404).send({ error: 'Report not found' })
    return report
  })

  // GET /api/v1/reports/:id/download
  fastify.get('/:id/download', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const report = await prisma.report.findFirst({ where: { id, userId } })
    if (!report) return reply.status(404).send({ error: 'Report not found' })

    const ext = report.format === 'pdf' ? 'pdf' : 'xlsx'
    const mimeType = report.format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const fileName = `${report.id}.${ext}`
    const candidatePaths = [
      path.join(process.cwd(), 'uploads', 'reports', fileName),
      path.join(process.cwd(), 'apps', 'api', 'uploads', 'reports', fileName),
      path.resolve(__dirname, '../../uploads/reports', fileName),
    ]
    const localFilePath = candidatePaths.find(p => fs.existsSync(p))

    if (localFilePath) {
      const buffer = fs.readFileSync(localFilePath)
      return reply
        .type(mimeType)
        .header('Content-Disposition', `attachment; filename="CashBook_Report_${report.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}"`)
        .send(buffer)
    }

    if (report.fileUrl && report.fileUrl.startsWith('http')) {
      return reply.redirect(report.fileUrl)
    }

    return reply.status(404).send({ error: 'Report file not found on server' })
  })

  // DELETE /api/v1/reports/:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const report = await prisma.report.findFirst({ where: { id, userId } })
    if (!report) return reply.status(404).send({ error: 'Report not found' })

    const ext = report.format === 'pdf' ? 'pdf' : 'xlsx'
    const fileName = `${report.id}.${ext}`
    const candidatePaths = [
      path.join(process.cwd(), 'uploads', 'reports', fileName),
      path.join(process.cwd(), 'apps', 'api', 'uploads', 'reports', fileName),
      path.resolve(__dirname, '../../uploads/reports', fileName),
    ]
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p) } catch {}
      }
    }

    await prisma.report.delete({ where: { id } })
    return { success: true }
  })
}

