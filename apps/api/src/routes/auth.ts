// apps/api/src/routes/auth.ts
import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../utils/db'

const registerSchema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().trim().toLowerCase().email(),
  password: z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes'),
})

const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email(),
  password: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {

  // POST /api/v1/auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: { name: body.name, email: body.email, passwordHash },
    })

    // Seed default categories for new user
    await seedDefaultCategories(user.id)

    const accessToken  = fastify.jwt.sign({ sub: user.id, email: user.email, type: 'access' })
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return reply.status(201).send({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email } })
  })

  // POST /api/v1/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const accessToken  = fastify.jwt.sign({ sub: user.id, email: user.email, type: 'access' })
    const refreshToken = fastify.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return { accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email } }
  })

  // GET /api/v1/auth/me
  fastify.get('/me', { preHandler: fastify.authenticate }, async (request) => {
    const userId = request.user.sub
    const user   = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, createdAt: true },
    })
    return user
  })

  // PATCH /api/v1/auth/me
  const updateProfileSchema = z.object({
    name:            z.string().min(1).max(100).optional(),
    currentPassword: z.string().optional(),
    newPassword:     z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes').optional(),
  })

  fastify.patch('/me', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body   = updateProfileSchema.parse(request.body)
    const userId = request.user.sub
    const user   = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })

    const updateData: { name?: string; passwordHash?: string } = {}
    if (body.name) updateData.name = body.name

    if (body.newPassword) {
      if (!body.currentPassword) return reply.status(400).send({ error: 'Current password is required to change password' })
      const valid = await bcrypt.compare(body.currentPassword, user.passwordHash)
      if (!valid) return reply.status(400).send({ error: 'Current password is incorrect' })
      updateData.passwordHash = await bcrypt.hash(body.newPassword, 12)
    }

    const updated = await prisma.user.update({
      where:  { id: userId },
      data:   updateData,
      select: { id: true, name: true, email: true, createdAt: true },
    })
    return updated
  })

  // POST /api/v1/auth/logout
  fastify.post('/logout', { preHandler: fastify.authenticate }, async (request) => {
    // With stateless JWT, logout is handled client-side by deleting tokens.
    // This endpoint exists for future token blacklisting.
    return { success: true }
  })

  // POST /api/v1/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(request.body)
    try {
      const payload = fastify.jwt.verify(refreshToken) as { sub: string; type: string }
      if (payload.type !== 'refresh') throw new Error('Invalid token type')
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } })
      if (!user) return reply.status(401).send({ error: 'Invalid refresh token' })
      const accessToken = fastify.jwt.sign({ sub: payload.sub, type: 'access' })
      return { accessToken }
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }
  })
}

async function seedDefaultCategories(userId: string) {
  const expenseCats = [
    { name: 'Food & drink', color: '#D85A30', icon: 'ti-shopping-bag' },
    { name: 'Transport',    color: '#378ADD', icon: 'ti-train' },
    { name: 'Shopping',     color: '#7F77DD', icon: 'ti-shopping-cart' },
    { name: 'Bills',        color: '#1D9E75', icon: 'ti-file-invoice' },
    { name: 'Health',       color: '#BA7517', icon: 'ti-heart' },
    { name: 'Entertainment',color: '#D4537E', icon: 'ti-music' },
    { name: 'Other',        color: '#444441', icon: 'ti-dots' },
  ]
  const incomeCats = [
    { name: 'Salary',      color: '#27500A', icon: 'ti-wallet' },
    { name: 'Freelance',   color: '#0F6E56', icon: 'ti-briefcase' },
    { name: 'Business',    color: '#185FA5', icon: 'ti-building' },
    { name: 'Investment',  color: '#854F0B', icon: 'ti-trending-up' },
    { name: 'Other income',color: '#444441', icon: 'ti-dots' },
  ]
  await prisma.category.createMany({
    data: [
      ...expenseCats.map(c => ({ userId, entryType: 'EXPENSE' as const, ...c })),
      ...incomeCats.map(c => ({ userId, entryType: 'INCOME' as const, ...c })),
    ],
  })
}
