import Fastify, { FastifyError } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs'
import { ZodError } from 'zod'
import { authRoutes } from './routes/auth'
import { bookRoutes } from './routes/books'
import { categoryRoutes } from './routes/categories'
import { entryRoutes } from './routes/entries'
import { analyticsRoutes } from './routes/analytics'
import { reportRoutes } from './routes/reports'
import { authMiddleware } from './middleware/auth'

export async function buildApp(options: { jwtSecret?: string; logger?: boolean } = {}) {
  const secret = options.jwtSecret ?? process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters')
  const server = Fastify({ logger: options.logger ?? true })
  server.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Invalid input', issues: error.issues.map(({ path, message }) => ({ path, message })) })
    }
    const status = error.statusCode ?? 500
    if (status >= 500) request.log.error({ err: error }, 'Request failed')
    return reply.status(status).send({ error: status >= 500 ? 'Internal server error' : error.message })
  })
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, undefined)
      return
    }
    try {
      done(null, JSON.parse(body))
    } catch (err: any) {
      err.statusCode = 400
      done(err, undefined)
    }
  })
  await server.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production' && origins.length ? origins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  })

  // Ensure local uploads directory exists and serve it statically
  const uploadsDir = path.join(process.cwd(), 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
  await server.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })
  await server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5, parts: 6 } })
  await server.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await server.register(jwt, { secret, sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } })
  server.decorate('authenticate', authMiddleware)
  server.register(authRoutes, { prefix: '/api/v1/auth' })
  server.register(bookRoutes, { prefix: '/api/v1/books' })
  server.register(categoryRoutes, { prefix: '/api/v1/categories' })
  server.register(entryRoutes, { prefix: '/api/v1/entries' })
  server.register(analyticsRoutes, { prefix: '/api/v1/analytics' })
  server.register(reportRoutes, { prefix: '/api/v1/reports' })
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  return server
}