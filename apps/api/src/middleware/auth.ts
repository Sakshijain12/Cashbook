// apps/api/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify'

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const payload = request.user as { sub?: string; type?: string }
    if (!payload.sub || payload.type !== 'access') {
      return reply.status(401).send({ error: 'Access token required' })
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}
