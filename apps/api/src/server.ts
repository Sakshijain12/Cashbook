import 'dotenv/config'
import { buildApp } from './app'
import { prisma } from './utils/db'

async function main() {
  const server = await buildApp()
  const shutdown = async () => {
    await server.close()
    await prisma.$disconnect()
  }
  process.once('SIGTERM', () => { void shutdown() })
  process.once('SIGINT', () => { void shutdown() })
  await server.listen({ port: Number(process.env.PORT || '3000'), host: '0.0.0.0' })
}

main().catch(err => { console.error(err); process.exit(1) })
