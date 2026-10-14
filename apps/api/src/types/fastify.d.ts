// apps/api/src/types/fastify.d.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; type: 'access' | 'refresh'; email?: string }
    user: { sub: string; type: 'access' | 'refresh'; email?: string }
  }
}
