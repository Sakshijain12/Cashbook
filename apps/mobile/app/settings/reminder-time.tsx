// apps/mobile/app/settings/reminder-time.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '../../lib/store/settings'

const PRESETS = [
  { label: 'Morning', time: '08:00', desc: '8:00 AM — Start of day' },
  { label: 'Afternoon', time: '13:00', desc: '1:00 PM — Post-lunch check' },
  { label: 'Evening', time: '18:30', desc: '6:30 PM — After work / commute' },
  { label: 'Night', time: '21:00', desc: '9:00 PM — Recommended daily wrap-up' },
  { label: 'Bedtime', time: '22:30', desc: '10:30 PM — Final night ledger' },
]

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ReminderTimeScreen() {
  const router = useRouter()
  const {
    dailyReminder, setDailyReminder,
    reminderTime, setReminderTime,
    reminderDays, setReminderDays,
  } = useSettingsStore()

  const [activeTime, setActiveTime] = useState(reminderTime || '21:00')
  const [selectedDays, setSelectedDays] = useState<string[]>(reminderDays || ALL_DAYS)

  const [hourStr, minStr] = activeTime.split(':')
  const currentHour = parseInt(hourStr || '21', 10)
  const currentMin = parseInt(minStr || '00', 10)

  function formatTime12h(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  function adjustHour(delta: number) {
    let nextH = (currentHour + delta) % 24
    if (nextH < 0) nextH += 24
    const newT = `${String(nextH).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
    setActiveTime(newT)
    setReminderTime(newT)
  }

  function adjustMinute(delta: number) {
    let nextM = (currentMin + delta) % 60
    if (nextM < 0) nextM += 60
    const newT = `${String(currentHour).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`
    setActiveTime(newT)
    setReminderTime(newT)
  }

  function toggleDay(d: string) {
    let next: string[]
    if (selectedDays.includes(d)) {
      if (selectedDays.length === 1) {
        Alert.alert('Selection Error', 'At least one day must be selected')
        return
      }
      next = selectedDays.filter(day => day !== d)
    } else {
      next = [...selectedDays, d]
    }
    setSelectedDays(next)
    setReminderDays(next)
  }

  function handleSelectPreset(time: string) {
    setActiveTime(time)
    setReminderTime(time)
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Reminder</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Master Switch Card */}
        <View style={styles.masterCard}>
          <View style={styles.masterIconBox}>
            <Ionicons name="notifications" size={20} color="#854F0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterTitle}>Daily Reminder</Text>
            <Text style={styles.masterDesc}>Prompt me to review & log my spending</Text>
          </View>
          <Switch
            value={dailyReminder}
            onValueChange={setDailyReminder}
            trackColor={{ true: '#1D9E75' }}
          />
        </View>

        {dailyReminder && (
          <>
            {/* Display Big Time Card */}
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>NOTIFICATION SCHEDULE</Text>
              <Text style={styles.timeBig}>{formatTime12h(activeTime)}</Text>
              <Text style={styles.time24h}>({activeTime} 24h format)</Text>

              {/* Adjuster controls */}
              <View style={styles.adjustRow}>
                <View style={styles.adjustCol}>
                  <Text style={styles.adjustColLabel}>Hour</Text>
                  <View style={styles.adjustBtns}>
                    <TouchableOpacity style={styles.adjBtn} onPress={() => adjustHour(-1)}>
                      <Ionicons name="remove" size={16} color="#444" />
                    </TouchableOpacity>
                    <Text style={styles.adjVal}>{String(currentHour).padStart(2, '0')}</Text>
                    <TouchableOpacity style={styles.adjBtn} onPress={() => adjustHour(1)}>
                      <Ionicons name="add" size={16} color="#444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.adjSeparator}>:</Text>

                <View style={styles.adjustCol}>
                  <Text style={styles.adjustColLabel}>Minute</Text>
                  <View style={styles.adjustBtns}>
                    <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMinute(-5)}>
                      <Ionicons name="remove" size={16} color="#444" />
                    </TouchableOpacity>
                    <Text style={styles.adjVal}>{String(currentMin).padStart(2, '0')}</Text>
                    <TouchableOpacity style={styles.adjBtn} onPress={() => adjustMinute(5)}>
                      <Ionicons name="add" size={16} color="#444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Repeat Days */}
            <Text style={styles.secLabel}>Repeat on</Text>
            <View style={styles.card}>
              <View style={styles.daysRow}>
                {ALL_DAYS.map(d => {
                  const isSel = selectedDays.includes(d)
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, isSel && styles.dayChipActive]}
                      onPress={() => toggleDay(d)}
                    >
                      <Text style={[styles.dayChipText, isSel && styles.dayChipTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <View style={styles.quickDays}>
                <TouchableOpacity onPress={() => { setSelectedDays(ALL_DAYS); setReminderDays(ALL_DAYS) }}>
                  <Text style={styles.quickDayLink}>Every day</Text>
                </TouchableOpacity>
                <Text style={styles.quickDayDot}>·</Text>
                <TouchableOpacity onPress={() => { const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']; setSelectedDays(wd); setReminderDays(wd) }}>
                  <Text style={styles.quickDayLink}>Weekdays only</Text>
                </TouchableOpacity>
                <Text style={styles.quickDayDot}>·</Text>
                <TouchableOpacity onPress={() => { const we = ['Sat', 'Sun']; setSelectedDays(we); setReminderDays(we) }}>
                  <Text style={styles.quickDayLink}>Weekends only</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Preset times */}
            <Text style={styles.secLabel}>Quick Presets</Text>
            <View style={styles.group}>
              {PRESETS.map((p, idx) => {
                const isSelected = activeTime === p.time
                const isLast = idx === PRESETS.length - 1
                return (
                  <TouchableOpacity
                    key={p.time}
                    style={[styles.row, !isLast && styles.rowBorder, isSelected && styles.rowActive]}
                    onPress={() => handleSelectPreset(p.time)}
                  >
                    <View style={styles.rowMid}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.rowLabel, isSelected && styles.rowLabelActive]}>{p.label}</Text>
                        <View style={styles.presetTimeBadge}>
                          <Text style={styles.presetTimeBadgeText}>{p.time}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowDesc}>{p.desc}</Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={20} color="#185FA5" />
                    ) : (
                      <View style={styles.uncheckCircle} />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Notification preview */}
            <Text style={styles.secLabel}>Notification Preview</Text>
            <View style={styles.previewNotification}>
              <View style={styles.notifHeader}>
                <View style={styles.notifIcon}>
                  <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.notifApp}>CASHBOOK</Text>
                <Text style={styles.notifTime}>· {formatTime12h(activeTime)}</Text>
              </View>
              <Text style={styles.notifTitle}>Daily Ledger Check-in</Text>
              <Text style={styles.notifBody}>Did you spend anything today? Take 10 seconds to record your receipts.</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FAFAF8' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7', backgroundColor: '#FAFAF8' },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '500', color: '#2C2C2A' },
  body:         { flex: 1, padding: 16 },

  masterCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 16, marginBottom: 20 },
  masterIconBox:{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FAEEDA', alignItems: 'center', justifyContent: 'center' },
  masterTitle:  { fontSize: 14, fontWeight: '600', color: '#2C2C2A' },
  masterDesc:   { fontSize: 11, color: '#888', marginTop: 2 },

  timeCard:     { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 },
  timeLabel:    { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.6, marginBottom: 8 },
  timeBig:      { fontSize: 32, fontWeight: '700', color: '#2C2C2A' },
  time24h:      { fontSize: 12, color: '#888', marginTop: 2 },

  adjustRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 14 },
  adjustCol:    { alignItems: 'center' },
  adjustColLabel: { fontSize: 10, color: '#888', marginBottom: 6 },
  adjustBtns:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 20, padding: 4 },
  adjBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F2F1EB', alignItems: 'center', justifyContent: 'center' },
  adjVal:       { width: 36, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#2C2C2A' },
  adjSeparator: { fontSize: 24, fontWeight: '600', color: '#888', marginTop: 16 },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, padding: 14, marginBottom: 20 },

  daysRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dayChip:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', alignItems: 'center', justifyContent: 'center' },
  dayChipActive:{ backgroundColor: '#185FA5', borderColor: '#185FA5' },
  dayChipText:  { fontSize: 11, fontWeight: '500', color: '#666' },
  dayChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  quickDays:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderTopWidth: 0.5, borderTopColor: '#E0DED7', paddingTop: 10 },
  quickDayLink: { fontSize: 11, color: '#185FA5', fontWeight: '500' },
  quickDayDot:  { fontSize: 11, color: '#aaa' },

  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  rowActive:    { backgroundColor: '#F0F6FD' },
  rowMid:       { flex: 1 },
  rowLabel:     { fontSize: 13, color: '#2C2C2A' },
  rowLabelActive:{ color: '#0C447C', fontWeight: '600' },
  rowDesc:      { fontSize: 11, color: '#888', marginTop: 2 },
  presetTimeBadge: { backgroundColor: '#E0DED7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  presetTimeBadgeText: { fontSize: 10, fontWeight: '600', color: '#555' },
  uncheckCircle:{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#D0CEC6' },

  previewNotification: { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 14, padding: 14, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  notifHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  notifIcon:    { width: 18, height: 18, borderRadius: 4, backgroundColor: '#185FA5', alignItems: 'center', justifyContent: 'center' },
  notifApp:     { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 0.5 },
  notifTime:    { fontSize: 10, color: '#999' },
  notifTitle:   { fontSize: 13, fontWeight: '600', color: '#2C2C2A', marginBottom: 2 },
  notifBody:    { fontSize: 12, color: '#666', lineHeight: 16 },
})
