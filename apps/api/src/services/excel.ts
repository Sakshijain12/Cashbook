// apps/api/src/services/excel.ts
import writeExcelFile from 'write-excel-file/node'

export async function generateExcel(entries: any[], options: any, reportName: string): Promise<Buffer> {
  const sheets: { sheet: string; data: (string | number)[][] }[] = []

  // Main entries sheet
  const rows = entries.map(e => ({
    Date:           new Date(e.entryDate).toLocaleDateString('en-GB'),
    Time:           e.entryTime ? new Date(e.entryTime).toISOString().slice(11, 16) : '',
    Name:           e.name,
    Book:           e.book?.name || '',
    Category:       e.category?.name || '',
    Type:           e.type,
    'Payment Method': e.paymentMethod || '',
    Amount:         Number(e.amount),
    'Income/Expense': ['INCOME', 'TRANSFER_IN'].includes(e.type) ? Number(e.amount) : -Number(e.amount),
  }))

  sheets.push({ sheet: 'Transactions', data: [
    ['Date', 'Time', 'Name', 'Book', 'Category', 'Type', 'Payment Method', `Amount (${options.currency ?? 'JPY'})`, 'Signed amount'],
    ...rows.map(row => Object.values(row)),
  ] })

  // Summary sheet
  if (options.includeCategorySummary) {
    const catMap = new Map<string, { income: number; expense: number }>()
    for (const e of entries) {
      if (['TRANSFER_IN', 'TRANSFER_OUT'].includes(e.type)) continue
      const key  = e.category?.name || 'Unknown'
      const prev = catMap.get(key) || { income: 0, expense: 0 }
      if (e.type === 'INCOME') prev.income  += Number(e.amount)
      else                     prev.expense += Number(e.amount)
      catMap.set(key, prev)
    }
    const summaryRows = [...catMap.entries()].map(([cat, vals]) => ({
      Category: cat,
      Income:   vals.income,
      Expense:  vals.expense,
      Net:      vals.income - vals.expense,
    }))
    sheets.push({ sheet: 'Summary', data: [['Category', 'Income', 'Expense', 'Net'], ...summaryRows.map(row => Object.values(row))] })
  }

  // Strings are text cells, never formulas, even when a merchant starts with '='.
  return writeExcelFile(sheets).toBuffer()
}
