// apps/mobile/components/ui/DateRangePickerModal.tsx
import { useState, useEffect, useMemo } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { parseLocalDate } from '../../lib/store/entries'
import { localDateISO } from '../../lib/utils/format'
import { useAppTheme } from '../../lib/theme'

interface Props {
  visible:   boolean
  startDate: string // YYYY-MM-DD
  endDate:   string // YYYY-MM-DD
  onClose:   () => void
  onApply:   (range: { startDate: string; endDate: string }) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function DateRangePickerModal({ visible, startDate, endDate, onClose, onApply }: Props) {
  const theme = useAppTheme()
  const today = useMemo(() => localDateISO(new Date()), [])
  const [tempStart, setTempStart]     = useState(startDate || today)
  const [tempEnd, setTempEnd]         = useState(endDate || today)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start')
  const [viewDate, setViewDate]       = useState(() => parseLocalDate(startDate || today))

  useEffect(() => {
    if (visible) {
      setTempStart(startDate || today)
      setTempEnd(endDate || today)
      setActiveField('start')
      setViewDate(parseLocalDate(startDate || today))
    }
  }, [visible, startDate, endDate, today])

  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const monthLabel = viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days: ({ dayNum: number; dateStr: string } | null)[] = []
    for (let i = 0; i < leadingBlanks; i++) days.push(null)
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ dayNum: d, dateStr })
    }
    return days
  }, [year, month])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const handleSelectDate = (dateStr: string) => {
    if (activeField === 'start') {
      setTempStart(dateStr)
      if (dateStr > tempEnd) {
        setTempEnd(dateStr)
      }
      setActiveField('end')
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr)
      } else {
        setTempEnd(dateStr)
      }
    }
  }

  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'last_30_days') => {
    const now = new Date()
    let s = today
    let e = today

    if (preset === 'today') {
      s = today
      e = today
    } else if (preset === 'yesterday') {
      const yest = new Date(now)
      yest.setDate(yest.getDate() - 1)
      s = localDateISO(yest)
      e = s
    } else if (preset === 'this_week') {
      const day = now.getDay()
      const diffToMon = day === 0 ? -6 : 1 - day
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon)
      const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
      s = localDateISO(mon)
      e = localDateISO(sun)
    } else if (preset === 'this_month') {
      const startM = new Date(now.getFullYear(), now.getMonth(), 1)
      const endM   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      s = localDateISO(startM)
      e = localDateISO(endM)
    } else if (preset === 'last_month') {
      const startLM = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endLM   = new Date(now.getFullYear(), now.getMonth(), 0)
      s = localDateISO(startLM)
      e = localDateISO(endLM)
    } else if (preset === 'last_30_days') {
      const d30 = new Date(now)
      d30.setDate(d30.getDate() - 29)
      s = localDateISO(d30)
      e = today
    }

    setTempStart(s)
    setTempEnd(e)
    setViewDate(parseLocalDate(s))
  }

  const formatCardDate = (isoStr: string) => {
    if (!isoStr) return 'Select date'
    const d = parseLocalDate(isoStr)
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const handleApply = () => {
    onApply({
      startDate: tempStart <= tempEnd ? tempStart : tempEnd,
      endDate:   tempStart <= tempEnd ? tempEnd : tempStart,
    })
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: theme.cardInner, borderBottomColor: theme.cardBorder }]}>
            <View style={styles.titleRow}>
              <Ionicons name="calendar" size={18} color={theme.primary} />
              <Text style={[styles.title, { color: theme.text }]}>Custom Period</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-outline" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Start / End Range Cards */}
            <View style={styles.cardsRow}>
              <TouchableOpacity
                style={[
                  styles.dateCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  activeField === 'start' && { borderColor: theme.primary, backgroundColor: theme.primaryBg }
                ]}
                onPress={() => setActiveField('start')}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardLabel, { color: theme.textMuted }, activeField === 'start' && { color: theme.primaryText }]}>
                  START DATE
                </Text>
                <Text style={[styles.cardVal, { color: theme.text }]} numberOfLines={1}>
                  {formatCardDate(tempStart)}
                </Text>
              </TouchableOpacity>

              <View style={styles.cardArrow}>
                <Ionicons name="arrow-forward" size={16} color={theme.textMuted} />
              </View>

              <TouchableOpacity
                style={[
                  styles.dateCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  activeField === 'end' && { borderColor: theme.primary, backgroundColor: theme.primaryBg }
                ]}
                onPress={() => setActiveField('end')}
                activeOpacity={0.8}
              >
                <Text style={[styles.cardLabel, { color: theme.textMuted }, activeField === 'end' && { color: theme.primaryText }]}>
                  END DATE
                </Text>
                <Text style={[styles.cardVal, { color: theme.text }]} numberOfLines={1}>
                  {formatCardDate(tempEnd)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'this_week', label: 'This Week' },
                { key: 'this_month', label: 'This Month' },
                { key: 'last_month', label: 'Last Month' },
                { key: 'last_30_days', label: 'Last 30 Days' },
              ].map(p => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.presetChip, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  onPress={() => applyPreset(p.key as any)}
                >
                  <Text style={[styles.presetChipText, { color: theme.textSecondary }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Month Navigator */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={[styles.monthBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={20} color={theme.primary} />
              </TouchableOpacity>
              <Text style={[styles.monthTitle, { color: theme.text }]}>{monthLabel}</Text>
              <TouchableOpacity onPress={nextMonth} style={[styles.monthBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map(w => (
                <Text key={w} style={[styles.weekText, { color: theme.textMuted }]}>{w}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.grid}>
              {calendarDays.map((item, idx) => {
                if (!item) {
                  return <View key={`blank-${idx}`} style={styles.dayCell} />
                }
                const { dayNum, dateStr } = item
                const isStart    = dateStr === tempStart
                const isEnd      = dateStr === tempEnd
                const inRange    = dateStr >= tempStart && dateStr <= tempEnd
                const isTodayDate = dateStr === today

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      inRange && !isStart && !isEnd && { backgroundColor: theme.primaryBg },
                      isStart && tempStart !== tempEnd && { backgroundColor: theme.primaryBg, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
                      isEnd && tempStart !== tempEnd && { backgroundColor: theme.primaryBg, borderTopRightRadius: 20, borderBottomRightRadius: 20 },
                    ]}
                    onPress={() => handleSelectDate(dateStr)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        (isStart || isEnd) && { backgroundColor: theme.primary },
                        isTodayDate && !isStart && !isEnd && { borderWidth: 1.5, borderColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: theme.text },
                          (isStart || isEnd) && { color: '#FFFFFF', fontWeight: '700' },
                          inRange && !isStart && !isEnd && { color: theme.primaryText, fontWeight: '600' },
                          isTodayDate && !isStart && !isEnd && { color: theme.primary, fontWeight: '700' },
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { backgroundColor: theme.cardInner, borderTopColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: theme.primary }]}
              onPress={handleApply}
              activeOpacity={0.8}
            >
              <Text style={styles.applyBtnText}>Apply Range</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '92%',
    backgroundColor: '#FAFAF8',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#E0DED7',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0DED7',
    backgroundColor: '#FAFAF8',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E0DED7',
  },
  dateCardActive: {
    borderColor: '#185FA5',
    backgroundColor: '#E6F1FB',
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#888780',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardLabelActive: {
    color: '#185FA5',
  },
  cardVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  cardArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 14,
  },
  presetChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F2F1EB',
    borderWidth: 0.5,
    borderColor: '#E0DED7',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#2C2C2A',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 6,
  },
  monthBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E0DED7',
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C2C2A',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EEEDE8',
    marginBottom: 6,
  },
  weekText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '500',
    color: '#888780',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInRange: {
    backgroundColor: '#E6F1FB',
  },
  dayRangeStart: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    backgroundColor: '#E6F1FB',
  },
  dayRangeEnd: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: '#E6F1FB',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#185FA5',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#185FA5',
  },
  dayText: {
    fontSize: 13,
    color: '#2C2C2A',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayTextInRange: {
    color: '#0C447C',
    fontWeight: '600',
  },
  dayTextToday: {
    color: '#185FA5',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: '#E0DED7',
    backgroundColor: '#FAFAF8',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F1EB',
    borderWidth: 0.5,
    borderColor: '#E0DED7',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B68',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#185FA5',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
