// apps/mobile/app/tabs/analytics.tsx
import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api/client'
import { useBooksStore } from '../../lib/store/books'
import { useSettingsStore } from '../../lib/store/settings'
import { formatAmount } from '../../lib/utils/format'
import { useAppTheme } from '../../lib/theme'

interface Insight {
  kind: string
  title: string
  explanation: string
  evidence: Record<string, string | number>
  action?: string
}
interface InsightReport { currency: string; notice: string; insights: Insight[]; sampleSize: number }

const EXPENSE_COLORS: Record<number, string> = {
  0: '#EAE8E1',
  1: '#FCDAD7',
  2: '#F6A29A',
  3: '#E05245',
  4: '#B81B18',
}

const EXPENSE_TEXT: Record<number, string> = {
  0: '#888780',
  1: '#791F1F',
  2: '#791F1F',
  3: '#FFFFFF',
  4: '#FFFFFF',
}

const INCOME_COLORS: Record<number, string> = {
  0: '#EAE8E1',
  1: '#D8F3E5',
  2: '#8CE0B0',
  3: '#2EA05B',
  4: '#136F35',
}

const INCOME_TEXT: Record<number, string> = {
  0: '#888780',
  1: '#27500A',
  2: '#27500A',
  3: '#FFFFFF',
  4: '#FFFFFF',
}

function getIntensity(val: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (!val || val <= 0 || !max) return 0
  const ratio = val / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function formatDateLong(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function AnalyticsScreen() {
  const { books } = useBooksStore()
  const theme = useAppTheme()
  const now  = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [bookFilter, setBookFilter] = useState<string | null>(null)
  const [view, setView] = useState<'expense' | 'income'>('expense')
  const [heatMode, setHeatMode] = useState<'expense' | 'income' | 'both'>('expense')
  const [selectedDay, setSelectedDay] = useState<any | null>(null)

  const params = { month: String(month), year: String(year), ...(bookFilter ? { bookId: bookFilter } : {}) }

  useEffect(() => {
    setSelectedDay(null)
  }, [month, year, bookFilter])

  const { data: summary, isPending, error, refetch } = useQuery({ queryKey: ['summary', params], queryFn: () => api.get('/analytics/summary', { params }).then(r => r.data) })
  const { data: heatmapData, isPending: heatmapPending } = useQuery({ queryKey: ['heatmap', params], queryFn: () => api.get('/analytics/heatmap', { params }).then(r => r.data) })
  const { data: byCategory } = useQuery({ queryKey: ['by-cat',    { ...params, type: view }], queryFn: () => api.get('/analytics/by-category', { params: { ...params, type: view } }).then(r => r.data) })
  const { data: trend }      = useQuery({ queryKey: ['trend',     params], queryFn: () => api.get('/analytics/trend',       { params }).then(r => r.data) })
  const { data: topEntries } = useQuery({ queryKey: ['top-entries', params], queryFn: () => api.get('/analytics/top-entries', { params: { ...params, type: 'expense', limit: '5' } }).then(r => r.data) })
  const insightQuery = useQuery<InsightReport>({ queryKey: ['insights', params], queryFn: () => api.get('/analytics/insights', { params }).then(r => r.data) })
  const coach = useMutation({ mutationKey: ['coach', params], mutationFn: async () => {
    const { data } = await api.post('/analytics/coach', { ...params, consent: true }, { timeout: 25000 })
    return { ...data, scope: JSON.stringify(params) } as { provider: string; status: string; recommendations: Insight[]; scope: string }
  } })
  useEffect(() => { coach.reset() }, [month, year, bookFilter])
  const coachData = coach.data?.scope === JSON.stringify(params) ? coach.data : undefined
  const defaultCurrency = useSettingsStore(s => s.currency)
  const bookCurrency = books.find(b => b.id === bookFilter)?.currency
  const currency = (bookCurrency && bookCurrency !== 'JPY')
    ? bookCurrency
    : (defaultCurrency || summary?.currency || 'USD')
  const money = (value: number) => formatAmount(Number(value), currency)
  const maxTrend = Math.max(1, ...(trend ?? []).flatMap((t: any) => [t.income, t.expense]))

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const cats   = byCategory ?? []
  const maxCat = cats.reduce((m: number, c: any) => Math.max(m, c.total), 0)

  // GitHub-style grid calculation: 7 rows (Sun=0..Sat=6), columns = weeks
  const daysInMonth = heatmapData?.daysInMonth ?? new Date(Date.UTC(year, month, 0)).getUTCDate()
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const totalPadded = firstDayOfWeek + daysInMonth
  const numWeeks = Math.ceil(totalPadded / 7)

  const daysList = heatmapData?.days ?? []
  const grid: (any | null)[][] = []
  for (let r = 0; r < 7; r++) {
    grid[r] = []
    for (let w = 0; w < numWeeks; w++) {
      const dayNum = w * 7 + r - firstDayOfWeek + 1
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        grid[r][w] = daysList[dayNum - 1] ?? {
          date: `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
          day: dayNum,
          dayOfWeek: r,
          expense: 0,
          income: 0,
          net: 0,
        }
      } else {
        grid[r][w] = null
      }
    }
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const emptyCellBg = theme.isDark ? '#262521' : '#EAE8E1'

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Analytics</Text>
          <View style={styles.monthNav}>
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => { if (month === 1) { setMonth(12); setYear(y => y-1) } else setMonth(m => m-1) }}
            >
              <Text style={[styles.navBtnText, { color: theme.text }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: theme.text }]}>{MONTHS[month-1]} {year}</Text>
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => { if (month === 12) { setMonth(1); setYear(y => y+1) } else setMonth(m => m+1) }}
            >
              <Text style={[styles.navBtnText, { color: theme.text }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Book pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
          <TouchableOpacity
            style={[
              styles.bpill,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
              !bookFilter && { backgroundColor: theme.primaryBg, borderColor: theme.primary },
            ]}
            onPress={() => setBookFilter(null)}
          >
            <Text style={[styles.bpillText, { color: theme.textMuted }, !bookFilter && { color: theme.primaryText, fontWeight: '600' }]}>
              All books
            </Text>
          </TouchableOpacity>
          {books.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.bpill,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
                bookFilter === b.id && { backgroundColor: theme.primaryBg, borderColor: theme.primary },
              ]}
              onPress={() => setBookFilter(b.id)}
            >
              <Text style={[styles.bpillText, { color: theme.textMuted }, bookFilter === b.id && { color: theme.primaryText, fontWeight: '600' }]}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.body}>
        {isPending && <ActivityIndicator accessibilityLabel="Loading analytics" color={theme.primary} />}
        {error ? (
          <TouchableOpacity onPress={() => { void refetch(); void insightQuery.refetch() }} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={{ color: theme.danger }}>{(error as any)?.response?.data?.error ?? 'Analytics unavailable. Tap to retry.'}</Text>
          </TouchableOpacity>
        ) : null}
        {/* Summary */}
        <View style={styles.sumRow}>
          <View style={[styles.sumCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Income</Text>
            <Text style={[styles.sumVal, { color: theme.success }]}>{summary ? money(summary.income) : '—'}</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Expenses</Text>
            <Text style={[styles.sumVal, { color: theme.danger }]}>{summary ? money(summary.expense) : '—'}</Text>
          </View>
          <View style={[styles.sumCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Saved</Text>
            <Text style={[styles.sumVal, { color: theme.text }]}>{summary ? money(summary.saved) : '—'}</Text>
          </View>
        </View>

        {/* Heat Map Section (GitHub Commit Style) */}
        <View style={styles.secHd}>
          <Text style={[styles.secTitle, { color: theme.text }]}>Activity heat map</Text>
          <View style={[styles.hmModeToggle, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.hmModeBtn, heatMode === 'expense' && styles.hmModeBtnActiveExpense]}
              onPress={() => setHeatMode('expense')}
            >
              <View style={[styles.hmModeDot, { backgroundColor: '#E05245' }]} />
              <Text style={[styles.hmModeText, heatMode === 'expense' && styles.hmModeTextActiveExpense]}>Spend</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hmModeBtn, heatMode === 'income' && styles.hmModeBtnActiveIncome]}
              onPress={() => setHeatMode('income')}
            >
              <View style={[styles.hmModeDot, { backgroundColor: '#2EA05B' }]} />
              <Text style={[styles.hmModeText, heatMode === 'income' && styles.hmModeTextActiveIncome]}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hmModeBtn, heatMode === 'both' && styles.hmModeBtnActiveBoth]}
              onPress={() => setHeatMode('both')}
            >
              <Text style={[styles.hmModeText, heatMode === 'both' && styles.hmModeTextActiveBoth]}>Both</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, padding: 12 }]}>
          {heatmapPending && !heatmapData ? (
            <ActivityIndicator style={{ padding: 24 }} color={theme.primary} />
          ) : (
            <>
              {/* GitHub-style matrix grid */}
              <View style={styles.hmGridContainer}>
                {/* Week number columns header */}
                <View style={styles.hmRow}>
                  <View style={styles.hmDayLabelBox} />
                  {Array.from({ length: numWeeks }, (_, w) => (
                    <View key={`wh-${w}`} style={styles.hmCellWrapper}>
                      <Text style={[styles.hmWeekText, { color: theme.textMuted }]}>W{w + 1}</Text>
                    </View>
                  ))}
                </View>

                {/* 7 weekday rows */}
                {DAY_LABELS.map((dayLabel, r) => (
                  <View key={`dr-${dayLabel}`} style={styles.hmRow}>
                    <View style={styles.hmDayLabelBox}>
                      <Text style={[styles.hmDayLabelText, { color: theme.textMuted }]}>{dayLabel}</Text>
                    </View>
                    {Array.from({ length: numWeeks }, (_, w) => {
                      const cell = grid[r][w]
                      if (!cell) {
                        return (
                          <View key={`c-${r}-${w}`} style={styles.hmCellWrapper}>
                            <View style={styles.hmCellEmpty} />
                          </View>
                        )
                      }

                      const isSelected = selectedDay?.date === cell.date
                      let bg = emptyCellBg
                      let txtColor = theme.textMuted
                      let hasSecondaryIndicator = false
                      let secondaryColor = '#2EA05B'

                      if (heatMode === 'expense') {
                        const level = getIntensity(cell.expense, heatmapData?.maxExpense ?? 1)
                        bg = level === 0 ? emptyCellBg : EXPENSE_COLORS[level]
                        txtColor = level === 0 ? theme.textMuted : EXPENSE_TEXT[level]
                      } else if (heatMode === 'income') {
                        const level = getIntensity(cell.income, heatmapData?.maxIncome ?? 1)
                        bg = level === 0 ? emptyCellBg : INCOME_COLORS[level]
                        txtColor = level === 0 ? theme.textMuted : INCOME_TEXT[level]
                      } else {
                        // 'both' mode
                        const expLevel = getIntensity(cell.expense, heatmapData?.maxExpense ?? 1)
                        const incLevel = getIntensity(cell.income, heatmapData?.maxIncome ?? 1)
                        if (cell.income > 0 && cell.expense > 0) {
                          if (cell.income >= cell.expense) {
                            bg = INCOME_COLORS[incLevel]
                            txtColor = INCOME_TEXT[incLevel]
                            hasSecondaryIndicator = true
                            secondaryColor = '#E05245'
                          } else {
                            bg = EXPENSE_COLORS[expLevel]
                            txtColor = EXPENSE_TEXT[expLevel]
                            hasSecondaryIndicator = true
                            secondaryColor = '#2EA05B'
                          }
                        } else if (cell.income > 0) {
                          bg = INCOME_COLORS[incLevel]
                          txtColor = INCOME_TEXT[incLevel]
                        } else if (cell.expense > 0) {
                          bg = EXPENSE_COLORS[expLevel]
                          txtColor = EXPENSE_TEXT[expLevel]
                        }
                      }

                      return (
                        <View key={`c-${r}-${w}`} style={styles.hmCellWrapper}>
                          <TouchableOpacity
                            accessibilityLabel={`${cell.date}: Spent ${money(cell.expense)}, Income ${money(cell.income)}`}
                            style={[
                              styles.hmCell,
                              { backgroundColor: bg },
                              isSelected && [styles.hmCellSelected, { borderColor: theme.text }],
                            ]}
                            onPress={() => setSelectedDay(selectedDay?.date === cell.date ? null : cell)}
                          >
                            <Text style={[styles.hmCellDayText, { color: txtColor }]}>{cell.day}</Text>
                            {hasSecondaryIndicator && (
                              <View style={[styles.hmSecondaryDot, { backgroundColor: secondaryColor }]} />
                            )}
                          </TouchableOpacity>
                        </View>
                      )
                    })}
                  </View>
                ))}
              </View>

              {/* Inspector card for selected day */}
              {selectedDay && (
                <View style={[styles.hmInspector, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
                  <View style={[styles.hmInspHeader, { borderBottomColor: theme.rowBorder }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
                      <Text style={[styles.hmInspDate, { color: theme.text }]}>{formatDateLong(selectedDay.date)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.hmInspStats}>
                    <View style={styles.hmInspStatItem}>
                      <Text style={[styles.hmInspStatLabel, { color: theme.textMuted }]}>Spent</Text>
                      <Text style={[styles.hmInspStatVal, { color: theme.danger }]}>
                        {selectedDay.expense > 0 ? `-${money(selectedDay.expense)}` : money(0)}
                      </Text>
                    </View>
                    <View style={styles.hmInspStatItem}>
                      <Text style={[styles.hmInspStatLabel, { color: theme.textMuted }]}>Income</Text>
                      <Text style={[styles.hmInspStatVal, { color: theme.success }]}>
                        {selectedDay.income > 0 ? `+${money(selectedDay.income)}` : money(0)}
                      </Text>
                    </View>
                    <View style={styles.hmInspStatItem}>
                      <Text style={[styles.hmInspStatLabel, { color: theme.textMuted }]}>Net</Text>
                      <Text style={[
                        styles.hmInspStatVal,
                        { color: selectedDay.net > 0 ? theme.success : (selectedDay.net < 0 ? theme.danger : theme.text) },
                      ]}>
                        {selectedDay.net > 0 ? `+${money(selectedDay.net)}` : (selectedDay.net < 0 ? `-${money(Math.abs(selectedDay.net))}` : money(0))}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Legend & Active days count (GitHub style) */}
              <View style={[styles.hmLegendRow, { borderTopColor: theme.cardBorder }]}>
                <Text style={[styles.hmLegendStat, { color: theme.textSecondary }]}>
                  {heatMode === 'expense'
                    ? `${heatmapData?.activeExpenseDays ?? 0} active spending days`
                    : heatMode === 'income'
                    ? `${heatmapData?.activeIncomeDays ?? 0} active income days`
                    : `${(heatmapData?.activeExpenseDays ?? 0) + (heatmapData?.activeIncomeDays ?? 0)} transactions active`}
                </Text>

                <View style={styles.hmLegendSwatches}>
                  <Text style={[styles.hmLegendText, { color: theme.textMuted }]}>Less</Text>
                  {heatMode === 'both' ? (
                    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
                      <View style={[styles.hmLegendBox, { backgroundColor: EXPENSE_COLORS[1] }]} />
                      <View style={[styles.hmLegendBox, { backgroundColor: EXPENSE_COLORS[3] }]} />
                      <View style={[styles.hmLegendBox, { backgroundColor: INCOME_COLORS[1] }]} />
                      <View style={[styles.hmLegendBox, { backgroundColor: INCOME_COLORS[3] }]} />
                    </View>
                  ) : (
                    [0, 1, 2, 3, 4].map(lvl => (
                      <View
                        key={`leg-${lvl}`}
                        style={[
                          styles.hmLegendBox,
                          { backgroundColor: lvl === 0 ? emptyCellBg : (heatMode === 'expense' ? EXPENSE_COLORS[lvl] : INCOME_COLORS[lvl]) },
                        ]}
                      />
                    ))
                  )}
                  <Text style={[styles.hmLegendText, { color: theme.textMuted }]}>More</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={[styles.secTitle, { color: theme.text }]}>Spending insights · explained</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {insightQuery.isPending && <ActivityIndicator color={theme.primary} />}
          {insightQuery.isError && <TouchableOpacity onPress={() => { void insightQuery.refetch() }}><Text style={[styles.empty, { color: theme.textMuted }]}>Insights unavailable. Tap to retry.</Text></TouchableOpacity>}
          {insightQuery.data?.insights.length === 0 && <Text style={[styles.empty, { color: theme.textMuted }]}>Not enough evidence yet. Keep recording expenses to reveal patterns.</Text>}
          {(coachData?.recommendations ?? insightQuery.data?.insights ?? []).map((insight: Insight, index: number) => (
            <View key={`${insight.kind}-${index}`} style={[styles.insight, { backgroundColor: theme.isDark ? '#1E293B' : '#E6F1FB' }]}>
              <Text style={[styles.insightTitle, { color: theme.isDark ? '#93C5FD' : '#0C447C' }]}>{insight.title}</Text>
              {insight.evidence.projectedExpense !== undefined && <Text style={[styles.insightTitle, { color: theme.isDark ? '#93C5FD' : '#0C447C' }]}>{money(Number(insight.evidence.projectedExpense))}</Text>}
              <Text style={[styles.insightBody, { color: theme.textSecondary }]}>{insight.explanation}</Text>
              {insight.action && <Text style={[styles.insightAction, { color: theme.primary }]}>{insight.action}</Text>}
              <Text style={[styles.evidence, { color: theme.textMuted }]}>{Object.entries(insight.evidence).map(([key, value]) => `${key}: ${value}`).join(' · ')}</Text>
            </View>
          ))}
          <Text style={[styles.insightBody, { color: theme.textSecondary }]}>{insightQuery.data?.notice}</Text>
          {!!insightQuery.data?.insights.length && <>
            <Text style={[styles.insightBody, { color: theme.textSecondary, marginTop: 12 }]}>Optional AI ranking sends numeric evidence to OpenAI, including amounts. No merchant names, notes, or receipt images are sent. Tap below to consent for this request.</Text>
            <TouchableOpacity style={[styles.aiButton, { backgroundColor: theme.primaryBg }]} disabled={coach.isPending} onPress={() => coach.mutate()}>
              <Text style={[styles.insightAction, { color: theme.primary }]}>{coach.isPending ? 'Prioritizing…' : 'Prioritize with AI'}</Text>
            </TouchableOpacity>
          </>}
          {coachData && <Text style={[styles.insightBody, { color: theme.textSecondary }]}>{coachData.provider === 'openai' ? 'AI-ranked · facts and review actions are server-controlled.' : 'Local fallback · AI is not configured or is unavailable.'}</Text>}
          {coach.isError && <Text style={[styles.insightBody, { color: theme.textSecondary }]}>AI ranking unavailable. The original insights remain above.</Text>}
        </View>

        {/* Category toggle */}
        <View style={styles.secHd}>
          <Text style={[styles.secTitle, { color: theme.text }]}>{view === 'expense' ? 'Spending by category' : 'Income sources'}</Text>
          <View style={[styles.toggle, { borderColor: theme.cardBorder }]}>
            <TouchableOpacity style={[styles.tglBtn, view === 'expense' && [styles.tglActive, { backgroundColor: theme.cardInner }]]} onPress={() => setView('expense')}>
              <Text style={[styles.tglText, { color: theme.textMuted }, view === 'expense' && { color: theme.text, fontWeight: '600' }]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tglBtn, view === 'income' && [styles.tglActive, { backgroundColor: theme.cardInner }]]} onPress={() => setView('income')}>
              <Text style={[styles.tglText, { color: theme.textMuted }, view === 'income' && { color: theme.text, fontWeight: '600' }]}>Income</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bar chart by category */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {cats.length === 0
            ? <Text style={[styles.empty, { color: theme.textMuted }]}>No data for this period</Text>
            : cats.map((c: any) => (
              <View key={c.id ?? c.name} style={styles.barRow}>
                <Text style={[styles.barLabel, { color: theme.textMuted }]} numberOfLines={1}>{c.name.length > 9 ? c.name.slice(0,8)+'…' : c.name}</Text>
                <View style={[styles.barTrack, { backgroundColor: theme.isDark ? '#2A2925' : '#E0DED7' }]}>
                  <View style={[styles.barFill, { width: `${maxCat > 0 ? (c.total / maxCat) * 100 : 0}%`, backgroundColor: c.color + '33', borderRightWidth: 2, borderRightColor: c.color }]}>
                    <Text style={[styles.barPct, { color: c.color }]}>{c.pct}%</Text>
                  </View>
                </View>
                <Text style={[styles.barAmt, { color: view === 'expense' ? theme.danger : theme.success }]}>{money(c.total)}</Text>
              </View>
            ))
          }
        </View>

        {/* Trend */}
        <Text style={[styles.secTitle, { color: theme.text }]}>6-month trend</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, padding: 12 }]}>
          <View style={styles.trendLegend}>
            <View style={styles.tlegItem}><View style={[styles.tlegLine, { backgroundColor: theme.success }]} /><Text style={[styles.tlegText, { color: theme.textMuted }]}>Income</Text></View>
            <View style={styles.tlegItem}><View style={[styles.tlegLine, { backgroundColor: theme.danger }]} /><Text style={[styles.tlegText, { color: theme.textMuted }]}>Expense</Text></View>
          </View>
          {(trend ?? []).map((t: any) => (
            <View key={`${t.year}-${t.month}`} style={styles.trendRow}>
              <Text style={[styles.trendMonth, { color: theme.textMuted }]}>{MONTHS[t.month-1]} {String(t.year).slice(-2)}</Text>
              <View style={styles.trendBars}>
                <View accessibilityLabel={`Income ${money(t.income)}`} style={[styles.trendBar, { width: `${t.income / maxTrend * 100}%`, backgroundColor: theme.success + '88' }]} />
                <View accessibilityLabel={`Expense ${money(t.expense)}`} style={[styles.trendBar, { width: `${t.expense / maxTrend * 100}%`, backgroundColor: theme.danger + '88' }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Top expenses */}
        <Text style={[styles.secTitle, { color: theme.text }]}>Top expenses this month</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {(topEntries ?? []).map((e: any, i: number) => (
            <View key={e.id} style={[styles.topRow, i < (topEntries.length - 1) && [styles.topRowBorder, { borderBottomColor: theme.rowBorder }]]}>
              <View style={[styles.topRank, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
                <Text style={[styles.topRankText, { color: theme.textMuted }]}>{i+1}</Text>
              </View>
              <View style={[styles.topDot, { backgroundColor: e.category_color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.topName, { color: theme.text }]} numberOfLines={1}>{e.name}</Text>
                <Text style={[styles.topCat, { color: theme.textMuted }]}>{e.category_name}</Text>
              </View>
              <Text style={[styles.topAmt, { color: theme.danger }]}>{money(e.amount)}</Text>
            </View>
          ))}
          {!topEntries?.length && <Text style={styles.empty}>No expenses this period</Text>}
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  insight: { padding: 12, marginBottom: 10, borderRadius: 10, backgroundColor: '#E6F1FB' },
  insightTitle: { fontSize: 14, fontWeight: '600', color: '#0C447C', marginBottom: 5 },
  insightBody: { fontSize: 12, lineHeight: 18, color: '#555' },
  insightAction: { fontSize: 12, fontWeight: '600', color: '#0C447C', marginTop: 4 },
  evidence: { fontSize: 10, lineHeight: 16, color: '#666', marginTop: 8 },
  aiButton: { padding: 12, backgroundColor: '#E6F1FB', borderRadius: 8, marginVertical: 10, alignItems: 'center' },
  container:   { flex: 1, backgroundColor: '#FAFAF8' },
  header:      { paddingHorizontal: 16, paddingTop: 52, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7', backgroundColor: '#FAFAF8' },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageTitle:   { fontSize: 17, fontWeight: '500', color: '#2C2C2A' },
  monthNav:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn:      { width: 28, height: 28, borderRadius: 14, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', alignItems: 'center', justifyContent: 'center' },
  navBtnText:  { fontSize: 16, color: '#666', lineHeight: 20 },
  monthLabel:  { fontSize: 13, fontWeight: '500', color: '#2C2C2A', minWidth: 70, textAlign: 'center' },
  pillScroll:  { marginBottom: 10 },
  bpill:       { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', marginRight: 6 },
  bpillActive: { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  bpillText:   { fontSize: 11, color: '#888' },
  bpillTextActive: { color: '#0C447C', fontWeight: '500' },
  body:        { padding: 16 },
  sumRow:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sumCard:     { flex: 1, backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 10, padding: 10, alignItems: 'center' },
  sumLabel:    { fontSize: 10, color: '#888', marginBottom: 4 },
  sumVal:      { fontSize: 14, fontWeight: '500', color: '#2C2C2A' },
  secHd:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  secTitle:    { fontSize: 13, fontWeight: '500', color: '#2C2C2A', marginBottom: 10 },
  toggle:      { flexDirection: 'row', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 7, overflow: 'hidden' },
  tglBtn:      { paddingVertical: 4, paddingHorizontal: 10 },
  tglActive:   { backgroundColor: '#F2F1EB' },
  tglText:     { fontSize: 11, color: '#888' },
  card:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, padding: 10, marginBottom: 20 },
  empty:       { fontSize: 13, color: '#aaa', textAlign: 'center', padding: 20 },
  barRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel:    { fontSize: 11, color: '#888', width: 64, textAlign: 'right' },
  barTrack:    { flex: 1, height: 16, backgroundColor: '#E0DED7', borderRadius: 4, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 4, justifyContent: 'center', paddingLeft: 6 },
  barPct:      { fontSize: 10, fontWeight: '500' },
  barAmt:      { fontSize: 11, width: 60, textAlign: 'right', fontWeight: '500' },
  trendLegend: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  tlegItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tlegLine:    { width: 16, height: 2, borderRadius: 1 },
  tlegText:    { fontSize: 10, color: '#888' },
  trendRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  trendMonth:  { fontSize: 10, color: '#888', width: 40 },
  trendBars:   { flex: 1, height: 18, gap: 4 },
  trendBar:    { height: 7, borderRadius: 2 },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  topRowBorder:{ borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  topRank:     { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', alignItems: 'center', justifyContent: 'center' },
  topRankText: { fontSize: 10, fontWeight: '500', color: '#888' },
  topDot:      { width: 8, height: 8, borderRadius: 4 },
  topName:     { fontSize: 12, fontWeight: '500', color: '#2C2C2A' },
  topCat:      { fontSize: 10, color: '#888' },
  topAmt:      { fontSize: 12, fontWeight: '500', color: '#791F1F' },
  hmModeToggle: { flexDirection: 'row', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 8, overflow: 'hidden', backgroundColor: '#F2F1EB' },
  hmModeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 9 },
  hmModeBtnActiveExpense: { backgroundColor: '#FCDAD7' },
  hmModeBtnActiveIncome: { backgroundColor: '#D8F3E5' },
  hmModeBtnActiveBoth: { backgroundColor: '#E6F1FB' },
  hmModeDot: { width: 6, height: 6, borderRadius: 3 },
  hmModeText: { fontSize: 11, color: '#888' },
  hmModeTextActiveExpense: { color: '#791F1F', fontWeight: '600' },
  hmModeTextActiveIncome: { color: '#27500A', fontWeight: '600' },
  hmModeTextActiveBoth: { color: '#0C447C', fontWeight: '600' },
  hmGridContainer: { marginTop: 4, marginBottom: 8 },
  hmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  hmDayLabelBox: { width: 28, alignItems: 'flex-start' },
  hmDayLabelText: { fontSize: 10, color: '#888', fontWeight: '500' },
  hmWeekText: { fontSize: 10, color: '#aaa', fontWeight: '500' },
  hmCellWrapper: { flex: 1, alignItems: 'center' },
  hmCell: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  hmCellSelected: { borderWidth: 2, borderColor: '#2C2C2A' },
  hmCellEmpty: { width: 34, height: 34, opacity: 0 },
  hmCellDayText: { fontSize: 10, fontWeight: '500' },
  hmSecondaryDot: { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: 2.5 },
  hmInspector: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 8, padding: 10, marginVertical: 8 },
  hmInspHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0EEE6', paddingBottom: 6 },
  hmInspDate: { fontSize: 12, fontWeight: '600', color: '#2C2C2A' },
  hmInspStats: { flexDirection: 'row', justifyContent: 'space-between' },
  hmInspStatItem: { flex: 1, alignItems: 'center' },
  hmInspStatLabel: { fontSize: 10, color: '#888', marginBottom: 2 },
  hmInspStatVal: { fontSize: 12, fontWeight: '600' },
  hmLegendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#E0DED7' },
  hmLegendStat: { fontSize: 11, color: '#666' },
  hmLegendSwatches: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hmLegendBox: { width: 11, height: 11, borderRadius: 2 },
  hmLegendText: { fontSize: 10, color: '#888' },
})
