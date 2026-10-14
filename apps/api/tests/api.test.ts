import test from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from '../src/app'
import { prisma } from '../src/utils/db'

const userId = '11111111-1111-4111-8111-111111111111'
const bookId = '22222222-2222-4222-8222-222222222222'
const categoryId = '33333333-3333-4333-8333-333333333333'
const payload = { bookId, categoryId, name: 'Test', amount: 10, entryDate: '2026-09-09', entryTime: '10:00' }

// Prisma delegates are proxies without ordinary method descriptors.
function stub(object: any, key: string, implementation: (...args: any[]) => unknown) {
  const original = object[key]
  object[key] = implementation
  return { mock: { restore: () => { object[key] = original } } }
}

test('API rejects token confusion, malformed input and unauthorized resource references', async t => {
  const app = await buildApp({ jwtSecret: 'test-only-secret-with-at-least-32-characters', logger: false })
  await app.ready()
  const headers = { authorization: `Bearer ${app.jwt.sign({ sub: userId, type: 'access' })}` }
  try {
    await t.test('health and auth checks run without external services', async () => {
      assert.equal((await app.inject('/health')).statusCode, 200)
      assert.equal((await app.inject('/api/v1/analytics/summary')).statusCode, 401)
      const refresh = app.jwt.sign({ sub: userId, type: 'refresh' })
      assert.equal((await app.inject({ url: '/api/v1/analytics/summary', headers: { authorization: `Bearer ${refresh}` } })).statusCode, 401)
    })
    await t.test('SQL injection and out-of-range filters fail before database access', async () => {
      for (const endpoint of ['summary', 'by-category', 'trend', 'top-entries', 'insights', 'heatmap']) {
        const result = await app.inject({ url: `/api/v1/analytics/${endpoint}?bookId=${encodeURIComponent("x' OR '1'='1")}`, headers })
        assert.equal(result.statusCode, 400)
      }
      assert.equal((await app.inject({ url: '/api/v1/entries?limit=-1', headers })).statusCode, 400)
    })
    await t.test('invalid dates and missing AI consent return 400', async () => {
      assert.equal((await app.inject({ method: 'POST', url: '/api/v1/entries', headers, payload: { ...payload, entryDate: '2026-02-30' } })).statusCode, 400)
      assert.equal((await app.inject({ method: 'POST', url: '/api/v1/analytics/coach', headers, payload: {} })).statusCode, 400)
    })
    await t.test('entry creation scopes the source book to the current user', async () => {
      const mock = stub(prisma.book, 'findFirst', async (args: any) => {
        assert.deepEqual(args.where, { id: bookId, userId, isArchived: false })
        return null
      })
      const result = await app.inject({ method: 'POST', url: '/api/v1/entries', headers, payload })
      assert.equal(result.statusCode, 404)
      mock.mock.restore()
    })
    await t.test('transfer structural edits cannot break paired ledger entries', async () => {
      const mock = stub(prisma.entry, 'findFirst', async () => ({ id: 'entry', bookId, categoryId, transferId: 'transfer' }))
      const result = await app.inject({ method: 'PATCH', url: '/api/v1/entries/entry', headers, payload: { bookId: userId } })
      assert.equal(result.statusCode, 400)
      mock.mock.restore()
    })
    await t.test('mixed-currency analytics fail instead of adding unlike amounts', async () => {
      const mock = stub(prisma.book, 'findMany', async () => [{ currency: 'JPY' }, { currency: 'USD' }])
      assert.equal((await app.inject({ url: '/api/v1/analytics/summary', headers })).statusCode, 400)
      mock.mock.restore()
    })
    await t.test('trend binds user input and fills six calendar months including year rollover', async () => {
      const books = stub(prisma.book, 'findMany', async () => [{ currency: 'JPY' }])
      const sql = stub(prisma, '$queryRaw', async (query: any) => {
        assert.equal(query.strings.join('').includes(userId), false)
        assert.ok(query.values.includes(userId))
        assert.ok(query.values.includes(bookId))
        return [{ month: 1, year: 2026, income: 100, expense: 20 }]
      })
      try {
        const result = await app.inject({ url: `/api/v1/analytics/trend?month=1&year=2026&bookId=${bookId}`, headers })
        assert.equal(result.statusCode, 200)
        const rows = result.json()
        assert.equal(rows.length, 6)
        assert.deepEqual(rows[0], { month: 8, year: 2025, income: 0, expense: 0 })
        assert.deepEqual(rows[5], { month: 1, year: 2026, income: 100, expense: 20 })
      } finally { books.mock.restore(); sql.mock.restore() }
    })
    await t.test('heatmap groups entries by calendar date and fills missing days', async () => {
      const books = stub(prisma.book, 'findMany', async () => [{ currency: 'JPY' }])
      const sql = stub(prisma, '$queryRaw', async () => {
        return [{ date: '2026-09-15', income: 5000, expense: 1200 }]
      })
      try {
        const result = await app.inject({ url: `/api/v1/analytics/heatmap?month=9&year=2026`, headers })
        assert.equal(result.statusCode, 200)
        const data = result.json()
        assert.equal(data.daysInMonth, 30)
        assert.equal(data.days.length, 30)
        assert.equal(data.maxExpense, 1200)
        assert.equal(data.maxIncome, 5000)
        assert.equal(data.activeExpenseDays, 1)
        assert.equal(data.activeIncomeDays, 1)
        assert.equal(data.days[14].date, '2026-09-15')
        assert.equal(data.days[14].expense, 1200)
        assert.equal(data.days[14].income, 5000)
        assert.equal(data.days[0].expense, 0)
      } finally { books.mock.restore(); sql.mock.restore() }
    })
    await t.test('foreign categories cannot be assigned during an edit', async () => {
      const entry = stub(prisma.entry, 'findFirst', async () => ({ id: 'entry', bookId, categoryId, transferId: null }))
      const category = stub(prisma.category, 'findFirst', async (args: any) => { assert.equal(args.where.userId, userId); return null })
      try {
        const result = await app.inject({ method: 'PATCH', url: '/api/v1/entries/entry', headers, payload: { categoryId: userId } })
        assert.equal(result.statusCode, 404)
      } finally { entry.mock.restore(); category.mock.restore() }
    })
    await t.test('database errors are sanitized', async () => {
      const mock = stub(prisma.book, 'findMany', async () => { throw new Error('private database connection details') })
      const result = await app.inject({ url: '/api/v1/analytics/summary', headers })
      assert.equal(result.statusCode, 500)
      assert.equal(result.body.includes('private'), false)
      mock.mock.restore()
    })
  } finally { await app.close() }
})