import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSpendingInsights, InsightEntry } from '../src/services/insights'
import { prioritizeInsights } from '../src/services/ai-coach'

const now = new Date('2026-09-09T12:00:00Z')
const entry = (id: string, date: string, amount = 10, name = 'Cafe'): InsightEntry => ({ id, name, amount, entryDate: new Date(date), categoryId: 'food', category: { name: 'Food' } })

test('sparse and future periods do not fabricate insights', () => {
  assert.deepEqual(buildSpendingInsights([], 9, 2026, now).insights, [])
  assert.deepEqual(buildSpendingInsights([entry('future', '2026-10-01', 9000)], 10, 2026, now).insights, [])
})

test('compares matching elapsed days and excludes future-dated entries', () => {
  const entries = [1, 2, 3].flatMap(day => [entry(`p${day}`, `2026-08-0${day}`, 10), entry(`c${day}`, `2026-09-0${day}`, 20)])
  entries.push(entry('late', '2026-08-30', 9999), entry('future', '2026-09-20', 9999))
  const change = buildSpendingInsights(entries, 9, 2026, now).insights.find(i => i.kind === 'change')!
  assert.equal(change.evidence.changePct, 100)
  assert.equal(change.evidence.previousTotal, 30)
})

test('forecast exposes arithmetic and minimum sample size', () => {
  const entries = [1, 2, 3, 4, 5].map(day => entry(String(day), `2026-09-0${day}`, 18))
  const forecast = buildSpendingInsights(entries, 9, 2026, now).insights.find(i => i.kind === 'forecast')!
  assert.equal(forecast.evidence.projectedExpense, 300)
  assert.equal(forecast.evidence.elapsedDays, 9)
  assert.equal(buildSpendingInsights(entries, 9, 2026, new Date('2026-09-05')).insights.some(i => i.kind === 'forecast'), false)
})

test('MAD baseline handles identical historic prices without division by zero', () => {
  const history = Array.from({ length: 8 }, (_, i) => entry(`h${i}`, `2026-08-${String(i + 1).padStart(2, '0')}`, 10))
  const insights = buildSpendingInsights([...history, entry('outlier', '2026-09-02', 100)], 9, 2026, now).insights
  assert.equal(insights.find(i => i.kind === 'anomaly')?.entryId, 'outlier')
  assert.equal(insights.find(i => i.kind === 'anomaly')?.evidence.threshold, 30)
})

test('recurring detection requires consistent cadence and amounts', () => {
  const entries = ['2026-07-01', '2026-08-01', '2026-09-01'].map((date, i) => entry(String(i), date, 15, 'Subscription'))
  assert.ok(buildSpendingInsights(entries, 9, 2026, now).insights.some(i => i.kind === 'recurring'))
  entries[2].amount = 100
  assert.equal(buildSpendingInsights(entries, 9, 2026, now).insights.some(i => i.kind === 'recurring'), false)
})

test('AI ranking sends only numeric evidence and rejects invented indices', async () => {
  const oldKey = process.env.OPENAI_API_KEY, oldModel = process.env.OPENAI_MODEL
  process.env.OPENAI_API_KEY = 'test-placeholder'
  process.env.OPENAI_MODEL = 'test-model'
  try {
    const insights = [{ kind: 'recurring' as const, title: 'SECRET MERCHANT', explanation: 'PRIVATE NOTE', entryId: 'PRIVATE ID', evidence: { merchant: 'SECRET MERCHANT', typicalAmount: 15, occurrences: 3 } }]
    let sent = ''
    const fakeFetch = (async (_url, init) => {
      sent = String(init?.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"indices":[0]}' } }] }), { status: 200 })
    }) as typeof fetch
    const result = await prioritizeInsights(insights, fakeFetch)
    assert.equal(result.provider, 'openai')
    assert.equal(sent.includes('SECRET MERCHANT'), false)
    assert.equal(sent.includes('PRIVATE'), false)
    const invalidFetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"indices":[99]}' } }] }))) as typeof fetch
    assert.equal((await prioritizeInsights(insights, invalidFetch)).provider, 'local')
    const failedFetch = (async () => { throw new Error('timeout') }) as typeof fetch
    assert.equal((await prioritizeInsights(insights, failedFetch)).provider, 'local')
    delete process.env.OPENAI_API_KEY
    assert.equal((await prioritizeInsights(insights, fakeFetch)).provider, 'local')
  } finally {
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = oldModel
  }
})