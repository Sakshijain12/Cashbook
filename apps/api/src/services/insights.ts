// Explainable statistical baselines, not a trained model or financial advice.
export interface InsightEntry {
  id: string
  name: string
  amount: number
  entryDate: Date
  categoryId: string
  category: { name: string }
}

export interface SpendingInsight {
  kind: 'change' | 'forecast' | 'anomaly' | 'recurring'
  title: string
  explanation: string
  evidence: Record<string, number | string>
  entryId?: string
}

const round = (n: number) => Math.round(n * 100) / 100
const sum = (entries: InsightEntry[]) => round(entries.reduce((total, e) => total + Math.round(e.amount * 100), 0) / 100)
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildSpendingInsights(entries: InsightEntry[], month: number, year: number, now = new Date()) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const tomorrow = new Date(today.getTime() + 86400000)
  const currentMonth = today >= start && today < end
  const cutoff = currentMonth ? tomorrow : end
  const daysInMonth = new Date(end.getTime() - 1).getUTCDate()
  const elapsedDays = currentMonth ? today.getUTCDate() : daysInMonth
  const visible = entries.filter(e => e.entryDate < cutoff && e.entryDate < tomorrow && e.amount > 0)
  const current = visible.filter(e => e.entryDate >= start && e.entryDate < end)
  const history = visible.filter(e => e.entryDate < start)
  const previousStart = new Date(Date.UTC(year, month - 2, 1))
  const previousDays = new Date(start.getTime() - 1).getUTCDate()
  const comparisonDays = Math.min(elapsedDays, previousDays)
  const previousCutoff = currentMonth ? new Date(Date.UTC(year, month - 2, comparisonDays + 1)) : start
  const previous = history.filter(e => e.entryDate >= previousStart && e.entryDate < previousCutoff)
  const comparableCurrent = currentMonth ? current.filter(e => e.entryDate.getUTCDate() <= comparisonDays) : current
  const insights: SpendingInsight[] = []
  const total = sum(current)
  const previousTotal = sum(previous)

  if (start > today) return { method: 'explainable-statistics-v1', sampleSize: 0, insights, notice: 'Future periods have no observed spending insights.' }
  if (previous.length >= 3 && comparableCurrent.length >= 3 && previousTotal > 0) {
    const comparableTotal = sum(comparableCurrent)
    const changePct = round((comparableTotal - previousTotal) / previousTotal * 100)
    insights.push({ kind: 'change', title: `Spending ${changePct >= 0 ? 'up' : 'down'} ${Math.abs(changePct)}%`,
      explanation: currentMonth ? `Compares the first ${comparisonDays} calendar days of this and last month; transfers excluded.` : 'Compares two complete calendar months; transfers excluded.',
      evidence: { currentTotal: comparableTotal, previousTotal, changePct, currentCount: comparableCurrent.length, previousCount: previous.length } })
  }

  if (currentMonth && elapsedDays >= 7 && current.length >= 5) {
    insights.push({ kind: 'forecast', title: 'Month-end spending estimate',
      explanation: 'Observed spending ÷ elapsed calendar days × days in this month. Assumes a steady pace; not a guarantee or a learned forecast.',
      evidence: { projectedExpense: round(total / elapsedDays * daysInMonth), spent: total, elapsedDays, daysInMonth } })
  }

  const anomalies: SpendingInsight[] = []
  for (const entry of current) {
    const baseline = history.filter(e => e.categoryId === entry.categoryId).map(e => e.amount)
    if (baseline.length < 8) continue
    const center = median(baseline)
    const mad = median(baseline.map(value => Math.abs(value - center)))
    // MAD can be zero for repeated prices. A 3x median floor avoids tiny deviations being flagged.
    const threshold = Math.max(center * 3, center + 3.5 * 1.4826 * mad)
    if (entry.amount <= threshold) continue
    anomalies.push({ kind: 'anomaly', title: `Unusually large ${entry.category.name} expense`, entryId: entry.id,
      explanation: 'Above both 3× the category median and median + 3.5 robust standard deviations from the prior three months. Review, not a fraud determination.',
      evidence: { amount: entry.amount, categoryMedian: round(center), threshold: round(threshold), baselineCount: baseline.length } })
  }
  insights.push(...anomalies.sort((a, b) => Number(b.evidence.amount) - Number(a.evidence.amount)).slice(0, 3))

  const merchants = new Map<string, InsightEntry[]>()
  for (const entry of visible) {
    const merchant = entry.name.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!merchant || merchant === entry.category.name.toLowerCase()) continue
    const key = `${entry.categoryId}:${merchant}`
    merchants.set(key, [...(merchants.get(key) ?? []), entry])
  }
  for (const group of merchants.values()) {
    const recent = group.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime()).slice(-3)
    if (recent.length < 3 || !recent.some(e => e.entryDate >= start)) continue
    const typical = median(recent.map(e => e.amount))
    const gaps = recent.slice(1).map((e, i) => (e.entryDate.getTime() - recent[i].entryDate.getTime()) / 86400000)
    if (gaps.every(gap => gap >= 20 && gap <= 40) && recent.every(e => Math.abs(e.amount - typical) <= typical * 0.1)) {
      insights.push({ kind: 'recurring', title: 'Possible recurring payment', entryId: recent[2].id,
        explanation: 'Three payments with the same normalized name and category, 20–40 days apart, with amounts within 10% of their median. Confirm whether this is a subscription.',
        evidence: { merchant: recent[2].name, typicalAmount: round(typical), occurrences: 3 } })
      break
    }
  }
  return { method: 'explainable-statistics-v1', sampleSize: current.length, insights,
    notice: 'Based only on recorded expenses. Missing entries can distort results. No transaction data is sent to an LLM.' }
}