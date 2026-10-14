import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReceipt } from '../src/services/receipt-parser'
import { dateSchema, timeSchema, moneySchema, analyticsQuerySchema, monthWindow } from '../src/utils/validation'

test('receipt prefers grand total over prices, subtotal and change; preserves decimals', () => {
  const bill = parseReceipt('Cafe\nCoffee $4.50\nSubtotal 10.50\nTax 1.25\nTOTAL $11.75\nCash 20.00\nChange 8.25\n15/03/2026 7:05 PM')
  assert.equal(bill.amount, 11.75)
  assert.equal(bill.entryDate, '2026-03-15')
  assert.equal(bill.entryTime, '19:05')
  assert.equal(bill.requiresReview, true)
})

test('Japanese receipt recognizes total and date', () => {
  const bill = parseReceipt('LAWSON\n小計 1000\n合計 ￥1,280\n2026年9月9日 09:20')
  assert.equal(bill.amount, 1280)
  assert.equal(bill.entryDate, '2026-09-09')
  assert.equal(bill.suggestedCategory, 'Food & drink')
})

test('Japanese receipt with OCR spacing around comma extracts full total', () => {
  const bill = parseReceipt('ボンベイカフェ 晴海店\nMIX GRIL\n@1, 350 2 ¥2, 700\n小計 2点 ¥2,700\nで at ¥2 , 700\n(内消費税等 ¥245)\nCredit Card ¥2, 700')
  assert.equal(bill.amount, 2700)
  assert.equal(bill.suggestedCategory, 'Food & drink')
  assert.equal(bill.name, 'ボンベイカフェ晴海店')
})

test('ambiguous and impossible dates are not silently autofilled', () => {
  assert.equal(parseReceipt('03/04/2026').entryDate, null)
  assert.equal(parseReceipt('2026-02-30').entryDate, null)
  assert.equal(parseReceipt('2024-02-29').entryDate, '2024-02-29')
  assert.equal(parseReceipt('25:99').entryTime, null)
  assert.equal(parseReceipt('12:05 AM').entryTime, '00:05')
})

test('does not mistake a line item for the payable total', () => {
  assert.equal(parseReceipt('Coffee $4.50').amount, null)
  assert.equal(parseReceipt('Subtotal 200').amount, null)
  assert.equal(parseReceipt('TOTAL\n₹1,23,456.78').amount, 123456.78)
  assert.equal(parseReceipt('TOTAL 12,50').amount, null)
  assert.equal(parseReceipt('TOTAL 12.345').amount, null)
  assert.equal(parseReceipt('TOTAL -50.00').amount, null)
})

test('validates monetary precision, calendar dates, time and analytics filters', () => {
  assert.equal(moneySchema.safeParse(12.34).success, true)
  for (const amount of [0, -1, Infinity, 1.234, 1.000001, 10000000000]) assert.equal(moneySchema.safeParse(amount).success, false)
  assert.equal(dateSchema.safeParse('2026-02-29').success, false)
  assert.equal(timeSchema.safeParse('23:59').success, true)
  assert.equal(timeSchema.safeParse('24:00').success, false)
  for (const query of [{ bookId: "x' OR '1'='1" }, { month: '13' }, { year: 'NaN' }, { limit: '99999' }]) {
    assert.equal(analyticsQuerySchema.safeParse(query).success, false)
  }
  assert.equal(monthWindow(12, 2026).end.toISOString(), '2027-01-01T00:00:00.000Z')
})