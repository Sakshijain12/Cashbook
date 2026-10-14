import { z } from 'zod'
import { SpendingInsight } from './insights'

const actions: Record<SpendingInsight['kind'], string> = {
  change: 'Review which categories changed before adjusting your budget.',
  forecast: 'Compare this estimate with your monthly spending target.',
  anomaly: 'Check this entry against the receipt for a typo or one-off purchase.',
  recurring: 'Confirm whether this payment repeats and whether you still need it.',
}

// The model ranks evidence, but cannot invent amounts, transactions, or advice.
// No merchant names, notes, receipts, account IDs, or free-text fields leave the API.
export async function prioritizeInsights(insights: SpendingInsight[], fetcher: typeof fetch = fetch) {
  const fallback = () => ({ provider: 'local' as const, status: 'fallback' as const,
    recommendations: insights.slice(0, 3).map(insight => ({ ...insight, action: actions[insight.kind] })) })
  if (!insights.length || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return fallback()
  const evidence = insights.map((insight, index) => ({ index, kind: insight.kind,
    evidence: Object.fromEntries(Object.entries(insight.evidence).filter(([, value]) => typeof value === 'number')) }))
  try {
    const response = await fetcher('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL, store: false, max_completion_tokens: 200,
        messages: [
          { role: 'system', content: 'Rank up to three supplied spending insights by practical usefulness for reviewing a personal budget. Favor strong evidence and actionable anomalies over uncertain extrapolation. Return only unique indices from the input. Do not calculate new financial facts.' },
          { role: 'user', content: JSON.stringify(evidence) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'insight_ranking', strict: true,
          schema: { type: 'object', properties: { indices: { type: 'array', items: { type: 'integer' } } }, required: ['indices'], additionalProperties: false } } },
      }),
    })
    if (!response.ok) return fallback()
    const result = await response.json() as { choices?: { message?: { content?: string } }[] }
    const parsed = z.object({ indices: z.array(z.number().int().min(0).max(insights.length - 1)).min(1).max(3) }).strict()
      .parse(JSON.parse(result.choices?.[0]?.message?.content ?? '{}'))
    if (new Set(parsed.indices).size !== parsed.indices.length) return fallback()
    return { provider: 'openai' as const, status: 'ranked' as const,
      recommendations: parsed.indices.map(index => ({ ...insights[index], action: actions[insights[index].kind] })) }
  } catch {
    return fallback()
  }
}