// apps/api/src/services/pdf.ts
import PdfPrinter from 'pdfmake'
import { TDocumentDefinitions } from 'pdfmake/interfaces'

const fontData = require('pdfmake/build/vfs_fonts') as Record<string, string>
const fonts = {
  Roboto: {
    normal:      Buffer.from(fontData['Roboto-Regular.ttf'], 'base64'),
    bold:        Buffer.from(fontData['Roboto-Medium.ttf'], 'base64'),
    italics:     Buffer.from(fontData['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(fontData['Roboto-MediumItalic.ttf'], 'base64'),
  },
}

const printer = new PdfPrinter(fonts)

const INCOME_COLOR  = '#27500A'
const EXPENSE_COLOR = '#791F1F'
const BLUE          = '#185FA5'

export async function generatePdf(entries: any[], options: any, reportName: string): Promise<Buffer> {
  const money = (amount: number) => `${options.currency ?? 'JPY'} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const tableBody: any[][] = [
    [
      { text: 'Date',     style: 'tableHeader' },
      { text: 'Name',     style: 'tableHeader' },
      { text: 'Book',     style: 'tableHeader' },
      { text: 'Category', style: 'tableHeader' },
      { text: 'Amount',   style: 'tableHeader', alignment: 'right' },
    ],
  ]

  let totalIncome  = 0
  let totalExpense = 0

  for (const e of entries) {
    const isIncome = ['INCOME', 'TRANSFER_IN'].includes(e.type)
    const amount   = Number(e.amount)
    if (e.type === 'INCOME') totalIncome += amount
    if (e.type === 'EXPENSE') totalExpense += amount

    tableBody.push([
      { text: new Date(e.entryDate).toLocaleDateString('en-GB'), fontSize: 9, color: '#666' },
      { text: e.name, fontSize: 10 },
      { text: e.book?.name || '', fontSize: 9, color: '#666' },
      { text: e.category?.name || '', fontSize: 9 },
      {
        text:      `${isIncome ? '+' : '-'}${money(amount)}`,
        alignment: 'right',
        fontSize:  10,
        bold:      true,
        color:     isIncome ? INCOME_COLOR : EXPENSE_COLOR,
      },
    ])
  }

  const categorySummary: any[] = []
  if (options.includeCategorySummary) {
    const catMap = new Map<string, number>()
    for (const e of entries) {
      if (['TRANSFER_IN', 'TRANSFER_OUT'].includes(e.type)) continue
      const key   = e.category?.name || 'Unknown'
      const prev  = catMap.get(key) || 0
      catMap.set(key, prev + Number(e.amount))
    }
    const sorted = [...catMap.entries()].sort((a, b) => b[1] - a[1])
    categorySummary.push(
      { text: 'Category Summary', style: 'sectionHeader', margin: [0, 20, 0, 8] },
      {
        table: {
          widths: ['*', 120],
          body: [
            [{ text: 'Category', style: 'tableHeader' }, { text: 'Total', style: 'tableHeader', alignment: 'right' }],
            ...sorted.map(([name, total]) => [
              { text: name, fontSize: 10 },
              { text: money(total), fontSize: 10, alignment: 'right', bold: true },
            ]),
          ],
        },
        layout: 'lightHorizontalLines',
      }
    )
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize:    'A4',
    pageMargins: [40, 60, 40, 60],
    styles: {
      header:        { fontSize: 20, bold: true, color: BLUE },
      subheader:     { fontSize: 12, color: '#666', margin: [0, 0, 0, 16] },
      sectionHeader: { fontSize: 14, bold: true, color: BLUE },
      tableHeader:   { fontSize: 10, bold: true, fillColor: BLUE, color: '#fff' },
    },
    content: [
      { text: 'CashBook Report', style: 'header' },
      { text: reportName,        style: 'subheader' },
      {
        columns: [
          { text: `Total income: ${money(totalIncome)}`, color: INCOME_COLOR, bold: true, fontSize: 11 },
          { text: `Total expense: ${money(totalExpense)}`, color: EXPENSE_COLOR, bold: true, fontSize: 11 },
          { text: `Saved: ${money(totalIncome - totalExpense)}`, bold: true, fontSize: 11 },
        ],
        margin: [0, 0, 0, 16],
      },
      { text: 'Transactions', style: 'sectionHeader', margin: [0, 0, 0, 8] },
      {
        table: { headerRows: 1, widths: [60, '*', 60, 80, 80], body: tableBody },
        layout: 'lightHorizontalLines',
      },
      ...categorySummary,
    ],
  }

  return new Promise((resolve, reject) => {
    const doc    = printer.createPdfKitDocument(docDefinition)
    const chunks: Buffer[] = []
    doc.on('data',  chunk => chunks.push(chunk))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}
