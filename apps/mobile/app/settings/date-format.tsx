// apps/mobile/app/settings/date-format.tsx
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '../../lib/store/settings'

const DATE_FORMATS = [
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '11/10/2026', region: 'UK, EU, International' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '10/11/2026', region: 'United States' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-10-11', region: 'ISO 8601, Japan' },
  { id: 'D MMM YYYY', label: 'D MMM YYYY', example: '11 Oct 2026', region: 'Readable text' },
]

const TIME_FORMATS = [
  { id: '24h', label: '24 Hours', example: '21:00', desc: 'Military / standard 24h format' },
  { id: '12h', label: '12 Hours (AM/PM)', example: '9:00 PM', desc: 'Conventional 12h clock' },
]

const WEEK_STARTS = [
  { id: 'monday', label: 'Monday', desc: 'Standard business week start' },
  { id: 'sunday', label: 'Sunday', desc: 'Calendar standard in US & Japan' },
]

export default function DateFormatScreen() {
  const router = useRouter()
  const {
    dateFormat, setDateFormat,
    timeFormat, setTimeFormat,
    firstDayOfWeek, setFirstDayOfWeek,
  } = useSettingsStore()

  const now = new Date()

  function getLiveFormattedDate(fmt: string): string {
    const d = now.getDate()
    const m = now.getMonth() + 1
    const y = now.getFullYear()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    if (fmt === 'DD/MM/YYYY') return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    if (fmt === 'MM/DD/YYYY') return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`
    if (fmt === 'YYYY-MM-DD') return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (fmt === 'D MMM YYYY') return `${d} ${months[m - 1]} ${y}`
    return `${d}/${m}/${y}`
  }

  function getLiveFormattedTime(tf: '12h' | '24h'): string {
    const hours = now.getHours()
    const mins = now.getMinutes()
    const minsStr = String(mins).padStart(2, '0')
    if (tf === '24h') {
      return `${String(hours).padStart(2, '0')}:${minsStr}`
    } else {
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const h12 = hours % 12 || 12
      return `${h12}:${minsStr} ${ampm}`
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Date & Time Format</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Live Preview Card */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
          <Text style={styles.previewDate}>{getLiveFormattedDate(dateFormat)}</Text>
          <Text style={styles.previewTime}>{getLiveFormattedTime(timeFormat)}</Text>
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Week starts on {firstDayOfWeek === 'monday' ? 'Monday' : 'Sunday'}</Text>
          </View>
        </View>

        {/* Date format group */}
        <Text style={styles.secLabel}>Date format</Text>
        <View style={styles.group}>
          {DATE_FORMATS.map((df, idx) => {
            const isSelected = dateFormat === df.id
            const isLast = idx === DATE_FORMATS.length - 1
            return (
              <TouchableOpacity
                key={df.id}
                style={[styles.row, !isLast && styles.rowBorder, isSelected && styles.rowActive]}
                onPress={() => setDateFormat(df.id)}
              >
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelActive]}>{df.label}</Text>
                  <Text style={styles.rowDesc}>{df.example} · {df.region}</Text>
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

        {/* Time format group */}
        <Text style={styles.secLabel}>Time format</Text>
        <View style={styles.group}>
          {TIME_FORMATS.map((tf, idx) => {
            const isSelected = timeFormat === tf.id
            const isLast = idx === TIME_FORMATS.length - 1
            return (
              <TouchableOpacity
                key={tf.id}
                style={[styles.row, !isLast && styles.rowBorder, isSelected && styles.rowActive]}
                onPress={() => setTimeFormat(tf.id as '12h' | '24h')}
              >
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelActive]}>{tf.label}</Text>
                  <Text style={styles.rowDesc}>{tf.example} · {tf.desc}</Text>
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

        {/* First day of week group */}
        <Text style={styles.secLabel}>First day of the week</Text>
        <View style={styles.group}>
          {WEEK_STARTS.map((ws, idx) => {
            const isSelected = firstDayOfWeek === ws.id
            const isLast = idx === WEEK_STARTS.length - 1
            return (
              <TouchableOpacity
                key={ws.id}
                style={[styles.row, !isLast && styles.rowBorder, isSelected && styles.rowActive]}
                onPress={() => setFirstDayOfWeek(ws.id as 'monday' | 'sunday')}
              >
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, isSelected && styles.rowLabelActive]}>{ws.label}</Text>
                  <Text style={styles.rowDesc}>{ws.desc}</Text>
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

  previewCard:  { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 20 },
  previewLabel: { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.6, marginBottom: 8 },
  previewDate:  { fontSize: 20, fontWeight: '600', color: '#2C2C2A' },
  previewTime:  { fontSize: 14, color: '#185FA5', marginTop: 4, fontWeight: '500' },
  previewBadge: { backgroundColor: '#E6F1FB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 12 },
  previewBadgeText: { fontSize: 11, color: '#0C447C', fontWeight: '500' },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  rowActive:    { backgroundColor: '#F0F6FD' },
  rowMid:       { flex: 1 },
  rowLabel:     { fontSize: 13, color: '#2C2C2A' },
  rowLabelActive:{ color: '#0C447C', fontWeight: '600' },
  rowDesc:      { fontSize: 11, color: '#888', marginTop: 2 },

  uncheckCircle:{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#D0CEC6' },
})
