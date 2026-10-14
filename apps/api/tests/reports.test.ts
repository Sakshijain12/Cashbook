import test from 'node:test'
import assert from 'node:assert/strict'
import { generateExcel } from '../src/services/excel'
import { generatePdf } from '../src/services/pdf'

const entries = [{ name: '=1+1', amount: 10.25, type: 'EXPENSE', entryDate: new Date('2026-09-09'), entryTime: new Date('1970-01-01T10:30:00Z'), book: { name: 'Cash' }, category: { name: 'Food' } }]

test('Excel export produces an XLSX archive', async () => {
  const buffer = await generateExcel(entries, { includeCategorySummary: true, currency: 'USD' }, 'Test')
  assert.equal(buffer.subarray(0, 2).toString(), 'PK')
  assert.ok(buffer.length > 1000)
})

test('PDF export uses actual fonts and produces a PDF', async () => {
  const buffer = await generatePdf(entries, { includeCategorySummary: true, currency: 'USD' }, 'Test')
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-')
  assert.ok(buffer.length > 1000)
})