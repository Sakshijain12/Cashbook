// apps/api/src/routes/categories.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../utils/db'

const createCategorySchema = z.object({
  name:      z.string().min(1).max(100),
  entryType: z.enum(['INCOME', 'EXPENSE']),
  color:     z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon:      z.string().optional(),
})

const updateCategorySchema = z.object({
  name:  z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon:  z.string().optional(),
})

export const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/v1/categories
  fastify.get('/', async (request) => {
    const userId  = (request.user as any).sub
    const { bookId } = request.query as { bookId?: string }

    const where: any = { userId }

    // Filter transfer cats to only active books
    if (bookId) {
      where.OR = [
        { isTransfer: false },
        { isTransfer: true, fromBookId: bookId, toBook: { isArchived: false } },
      ]
    } else {
      where.OR = [
        { isTransfer: false },
        { isTransfer: true, fromBook: { isArchived: false }, toBook: { isArchived: false } },
      ]
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ isTransfer: 'asc' }, { name: 'asc' }],
      include: { fromBook: { select: { id: true, name: true } }, toBook: { select: { id: true, name: true } } },
    })

    return categories
  })

  // POST /api/v1/categories
  fastify.post('/', async (request, reply) => {
    const userId = (request.user as any).sub
    const body   = createCategorySchema.parse(request.body)

    const category = await prisma.category.create({ data: { userId, ...body } })
    return reply.status(201).send(category)
  })

  // PATCH /api/v1/categories/:id
  fastify.patch('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }
    const body   = updateCategorySchema.parse(request.body)

    const category = await prisma.category.findFirst({ where: { id, userId } })
    if (!category) return reply.status(404).send({ error: 'Category not found' })
    if (category.isSystem) return reply.status(403).send({ error: 'System categories cannot be edited' })

    return prisma.category.update({ where: { id }, data: body })
  })

  // DELETE /api/v1/categories/:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = (request.user as any).sub
    const { id } = request.params as { id: string }

    const category = await prisma.category.findFirst({ where: { id, userId } })
    if (!category) return reply.status(404).send({ error: 'Category not found' })
    if (category.isSystem) return reply.status(403).send({ error: 'System categories cannot be deleted' })

    const activeCount = await prisma.entry.count({ where: { categoryId: id, deletedAt: null } })
    if (activeCount > 0) return reply.status(409).send({ error: `Category has ${activeCount} active ${activeCount === 1 ? 'entry' : 'entries'} — cannot delete` })

    await prisma.entry.deleteMany({ where: { categoryId: id } })
    await prisma.category.delete({ where: { id } })
    return { success: true }
  })
}
