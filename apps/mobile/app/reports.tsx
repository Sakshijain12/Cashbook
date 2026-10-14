// apps/mobile/app/reports.tsx
import { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api } from '../lib/api/client'
import { useBooksStore } from '../lib/store/books'
import { DateRangePickerModal } from '../components/ui/DateRangePickerModal'
import { localDateISO } from '../lib/utils/format'
import { useAppTheme, ThemeColors } from '../lib/theme'

const PRESETS = ['This month', 'Last month', 'Last 3 months', 'This year', 'Custom'] as const

function getRange(preset: string, customStart: string, customEnd: string): [string, string] {
  const now   = new Date()
  const y     = now.getFullYear()
  const m     = now.getMonth()
  const today = localDateISO(now)

  if (preset === 'This month') {
    return [localDateISO(new Date(y, m, 1)), today]
  }
  if (preset === 'Last month') {
    const lmStart = new Date(y, m - 1, 1)
    const lmEnd   = new Date(y, m, 0)
    return [localDateISO(lmStart), localDateISO(lmEnd)]
  }
  if (preset === 'Last 3 months') {
    const from = new Date(y, m - 3, 1)
    return [localDateISO(from), today]
  }
  if (preset === 'This year') {
    return [`${y}-01-01`, today]
  }
  if (preset === 'Custom') {
    return [customStart || today, customEnd || today]
  }
  return [localDateISO(new Date(y, m, 1)), today]
}

export default function ReportsScreen() {
  const theme       = useAppTheme()
  const styles      = useMemo(() => createStyles(theme), [theme])
  const router      = useRouter()
  const { books }   = useBooksStore()
  const qc          = useQueryClient()

  const todayIso = localDateISO(new Date())
  const [preset,        setPreset]        = useState<string>('Last month')
  const [customStart,   setCustomStart]   = useState(todayIso)
  const [customEnd,     setCustomEnd]     = useState(todayIso)
  const [customModal,   setCustomModal]   = useState(false)
  const [selectedBooks, setSelectedBooks] = useState<string[]>([])
  const [incIncome,     setIncIncome]     = useState(true)
  const [incExpense,    setIncExpense]    = useState(true)
  const [incTransfer,   setIncTransfer]   = useState(false)
  const [incCatSum,     setIncCatSum]     = useState(true)
  const [incBills,      setIncBills]      = useState(true)

  const [dateFrom, dateTo] = getRange(preset, customStart, customEnd)

  const { data: savedReports = [], refetch } = useQuery({
    queryKey: ['reports'],
    queryFn:  () => api.get('/reports').then(r => r.data),
  })

  async function saveReportLocally(report: {
    fileData?: string
    fileName?: string
    mimeType?: string
    fileUrl?:  string
    name:      string
    format:    string
  }) {
    const ext = report.format === 'pdf' ? 'pdf' : 'xlsx'
    const fileName = report.fileName || `CashBook_Report_${report.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
    const mimeType = report.mimeType || (report.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    // Web browser direct download
    if (Platform.OS === 'web') {
      if (report.fileData) {
        try {
          const byteCharacters = atob(report.fileData)
          const byteNumbers = new Uint8Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const blob = new Blob([byteNumbers], { type: mimeType })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = fileName
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          setTimeout(() => URL.revokeObjectURL(url), 2000)
          Alert.alert('Report downloaded', `Saved "${fileName}" to your device.`)
          return
        } catch (err) {
          console.error('Blob download error:', err)
        }
      }

      if (report.fileUrl) {
        const downloadUrl = report.fileUrl.startsWith('http')
          ? report.fileUrl
          : `${api.defaults.baseURL || 'http://localhost:3000/api/v1'}${report.fileUrl.replace('/api/v1', '')}`
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = fileName
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        Alert.alert('Report downloaded', `Saved "${fileName}" to your device.`)
        return
      }
    }

    // Native iOS / Android
    try {
      const fileUri = `${FileSystem.documentDirectory}${fileName}`
      if (report.fileData) {
        await FileSystem.writeAsStringAsync(fileUri, report.fileData, {
          encoding: FileSystem.EncodingType.Base64,
        })
      } else if (report.fileUrl) {
        const downloadUrl = report.fileUrl.startsWith('http')
          ? report.fileUrl
          : `${api.defaults.baseURL || 'http://localhost:3000/api/v1'}${report.fileUrl.replace('/api/v1', '')}`
        await FileSystem.downloadAsync(downloadUrl, fileUri)
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: `Save ${report.format.toUpperCase()} Report`,
          UTI: report.format === 'pdf' ? 'com.adobe.pdf' : 'org.openxmlformats.spreadsheetml.sheet',
        })
      } else {
        Alert.alert('Report saved', `Report saved to ${fileUri}`)
      }
    } catch (err: any) {
      Alert.alert('Save error', err.message || 'Could not save file locally to device')
    }
  }

  const generateMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'xlsx') => {
      const { data } = await api.post('/reports/generate', {
        format,
        bookIds:               selectedBooks.length ? selectedBooks : undefined,
        dateFrom,
        dateTo,
        includeIncome:         incIncome,
        includeExpense:        incExpense,
        includeTransfers:      incTransfer,
        includeCategorySummary:incCatSum,
        includeBills:          incBills,
      })
      return data
    },
    onSuccess: async (data) => {
      refetch()
      await saveReportLocally(data)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to generate report'
      Alert.alert('Report Error', msg)
    },
  })

  function notify(title: string, message: string) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(`${title}\n${message}`)
      }
    } else {
      Alert.alert(title, message)
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/reports/${id}`)
      return res.data
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['reports'] })
      const previousReports = qc.getQueryData<any[]>(['reports'])
      if (previousReports) {
        qc.setQueryData<any[]>(['reports'], previousReports.filter(r => r.id !== id))
      }
      return { previousReports }
    },
    onError: (err: any, _id, context) => {
      if (context?.previousReports) {
        qc.setQueryData(['reports'], context.previousReports)
      }
      const msg = err.response?.data?.error || err.message || 'Could not delete report'
      notify('Delete failed', msg)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['reports'] })
      void refetch()
    },
  })

  function handleDeleteReport(r: { id: string; name: string }) {
    const doDelete = () => {
      deleteMutation.mutate(r.id)
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Are you sure you want to delete the report "${r.name}"?`)) {
          doDelete()
        }
      } else {
        doDelete()
      }
    } else {
      Alert.alert(
        'Delete report',
        `Are you sure you want to delete "${r.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      )
    }
  }

  function toggleBook(id: string) {
    setSelectedBooks(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create report</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>

        {/* Date range */}
        <Text style={styles.secLabel}>Date range</Text>
        <View style={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.preset, preset === p && styles.presetActive]}
              onPress={() => {
                setPreset(p)
                if (p === 'Custom') setCustomModal(true)
              }}
            >
              <Text style={[styles.presetText, preset === p && styles.presetTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setCustomModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={16} color={theme.primary} />
          <Text style={styles.dateText}>{dateFrom}</Text>
          <Text style={styles.dateSep}>→</Text>
          <Text style={styles.dateText}>{dateTo}</Text>
          <View style={{ flex: 1 }} />
          <Ionicons name="pencil-outline" size={14} color={theme.textMuted} />
        </TouchableOpacity>

        {/* Books */}
        <Text style={styles.secLabel}>Books to include</Text>
        <View style={styles.chipRow}>
          {books.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[styles.chip, selectedBooks.includes(b.id) && styles.chipActive]}
              onPress={() => toggleBook(b.id)}
            >
              <Text style={[styles.chipText, selectedBooks.includes(b.id) && styles.chipTextActive]}>
                {b.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedBooks.length === 0 && (
          <Text style={styles.allBooksNote}>All books will be included</Text>
        )}

        {/* Include toggles */}
        <Text style={styles.secLabel}>Include in report</Text>
        <View style={styles.toggleGroup}>
          {[
            { label: 'Income entries',    desc: 'All income transactions',   val: incIncome,   set: setIncIncome,   icon: 'arrow-down-circle-outline' },
            { label: 'Expense entries',   desc: 'All expense transactions',  val: incExpense,  set: setIncExpense,  icon: 'arrow-up-circle-outline' },
            { label: 'Transfer entries',  desc: 'Book-to-book transfers',    val: incTransfer, set: setIncTransfer, icon: 'swap-horizontal-outline' },
            { label: 'Category summary',  desc: 'Totals grouped by category',val: incCatSum,   set: setIncCatSum,   icon: 'pie-chart-outline' },
            { label: 'Bill attachments',  desc: 'Embed bill images in PDF',  val: incBills,    set: setIncBills,    icon: 'attach-outline' },
          ].map((t, i, arr) => (
            <View key={t.label} style={[styles.toggleRow, i < arr.length - 1 && styles.toggleBorder]}>
              <Ionicons name={t.icon as any} size={18} color={theme.textMuted} style={{ marginRight: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t.label}</Text>
                <Text style={styles.toggleDesc}>{t.desc}</Text>
              </View>
              <Switch value={t.val} onValueChange={t.set} trackColor={{ true: '#1D9E75' }} />
            </View>
          ))}
        </View>

        {/* Export buttons */}
        <Text style={styles.secLabel}>Export as</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => generateMutation.mutate('pdf')}
            disabled={generateMutation.isPending}
            activeOpacity={0.8}
          >
            <View style={[styles.exportIcon, { backgroundColor: theme.dangerBg }]}>
              {generateMutation.isPending
                ? <ActivityIndicator size="small" color={theme.isDark ? '#F87171' : '#791F1F'} />
                : <Ionicons name="document-outline" size={24} color={theme.isDark ? '#F87171' : '#791F1F'} />
              }
            </View>
            <Text style={styles.exportName}>PDF</Text>
            <Text style={styles.exportDesc}>Save formatted PDF report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportBtn}
            onPress={() => generateMutation.mutate('xlsx')}
            disabled={generateMutation.isPending}
            activeOpacity={0.8}
          >
            <View style={[styles.exportIcon, { backgroundColor: theme.successBg }]}>
              {generateMutation.isPending
                ? <ActivityIndicator size="small" color={theme.isDark ? '#4ADE80' : '#27500A'} />
                : <Ionicons name="grid-outline" size={24} color={theme.isDark ? '#4ADE80' : '#27500A'} />
              }
            </View>
            <Text style={styles.exportName}>Excel</Text>
            <Text style={styles.exportDesc}>Save raw spreadsheet (.xlsx)</Text>
          </TouchableOpacity>
        </View>

        {/* Saved reports */}
        <Text style={styles.secLabel}>Saved reports</Text>
        {savedReports.length === 0
          ? <Text style={styles.noReports}>No reports yet</Text>
          : (
            <View style={styles.savedList}>
              {savedReports.map((r: any, i: number) => (
                <View key={r.id} style={[styles.savedRow, i < savedReports.length - 1 && styles.savedBorder]}>
                  <View style={[styles.savedIcon, { backgroundColor: r.format === 'pdf' ? theme.dangerBg : theme.successBg }]}>
                    <Ionicons name={r.format === 'pdf' ? 'document-outline' : 'grid-outline'} size={16} color={r.format === 'pdf' ? (theme.isDark ? '#F87171' : '#791F1F') : (theme.isDark ? '#4ADE80' : '#27500A')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.savedMeta}>{r.format.toUpperCase()} · {r.fileSizeKb} KB</Text>
                  </View>
                  <View style={styles.savedActions}>
                    <TouchableOpacity
                      style={styles.sactBtn}
                      onPress={() => saveReportLocally(r)}
                      accessibilityLabel="Download report"
                    >
                      <Ionicons name="download-outline" size={15} color={theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sactBtn, styles.deleteBtn]}
                      onPress={() => handleDeleteReport(r)}
                      disabled={deleteMutation.isPending && deleteMutation.variables === r.id}
                      accessibilityLabel="Delete report"
                      activeOpacity={0.7}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === r.id ? (
                        <ActivityIndicator size={12} color={theme.danger} />
                      ) : (
                        <Ionicons name="trash-outline" size={15} color={theme.danger} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        }

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Custom Date Range Picker */}
      <DateRangePickerModal
        visible={customModal}
        startDate={customStart}
        endDate={customEnd}
        onClose={() => setCustomModal(false)}
        onApply={(range) => {
          setCustomStart(range.startDate)
          setCustomEnd(range.endDate)
          setPreset('Custom')
        }}
      />
    </View>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.bg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.headerBorder, backgroundColor: theme.headerBg },
    backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:  { fontSize: 15, fontWeight: '500', color: theme.text },
    body:         { flex: 1, padding: 16 },
    secLabel:     { fontSize: 10, fontWeight: '500', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
    presetRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
    preset:       { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card },
    presetActive: { backgroundColor: theme.primaryBg, borderColor: theme.primary },
    presetText:   { fontSize: 11, color: theme.textSecondary },
    presetTextActive: { color: theme.primary, fontWeight: '500' },
    dateDisplay:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, padding: 10, backgroundColor: theme.card, borderRadius: 8, borderWidth: 0.5, borderColor: theme.border },
    dateText:     { fontSize: 13, color: theme.text, fontWeight: '500' },
    dateSep:      { fontSize: 13, color: theme.textMuted },
    chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    chip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card },
    chipActive:   { backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderColor: '#0F6E56' },
    chipText:     { fontSize: 11, color: theme.textSecondary },
    chipTextActive:{ color: theme.isDark ? '#6EE7B7' : '#085041', fontWeight: '500' },
    allBooksNote: { fontSize: 11, color: theme.textMuted, marginBottom: 16, fontStyle: 'italic' },
    toggleGroup:  { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
    toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
    toggleBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.border },
    toggleLabel:  { fontSize: 13, color: theme.text },
    toggleDesc:   { fontSize: 10, color: theme.textMuted, marginTop: 1 },
    exportRow:    { flexDirection: 'row', gap: 10, marginBottom: 24 },
    exportBtn:    { flex: 1, backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6 },
    exportIcon:   { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    exportName:   { fontSize: 14, fontWeight: '500', color: theme.text },
    exportDesc:   { fontSize: 10, color: theme.textMuted, textAlign: 'center' },
    savedList:    { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
    savedRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
    savedBorder:  { borderBottomWidth: 0.5, borderBottomColor: theme.border },
    savedIcon:    { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    savedName:    { fontSize: 12, fontWeight: '500', color: theme.text },
    savedMeta:    { fontSize: 10, color: theme.textMuted, marginTop: 1 },
    savedActions: { flexDirection: 'row', gap: 6 },
    sactBtn:      { width: 30, height: 30, borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.cardInner, alignItems: 'center', justifyContent: 'center' },
    deleteBtn:    { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
    noReports:    { fontSize: 13, color: theme.textMuted, textAlign: 'center', paddingVertical: 20 },
  })
}

