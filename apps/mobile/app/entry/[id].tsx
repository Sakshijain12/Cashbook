// apps/mobile/app/entry/[id].tsx
import { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, Modal, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api, resolveMediaUrl } from '../../lib/api/client'
import { formatDate, formatTime, useCurrencySymbol } from '../../lib/utils/format'
import { useBooksStore } from '../../lib/store/books'
import { useEntriesStore } from '../../lib/store/entries'
import { useAppTheme, ThemeColors } from '../../lib/theme'

export default function EntryDetailScreen() {
  const theme       = useAppTheme()
  const styles      = useMemo(() => createStyles(theme), [theme])
  const { id }      = useLocalSearchParams<{ id: string }>()
  const router      = useRouter()
  const qc          = useQueryClient()
  const [billOpen, setBillOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: entry, isLoading } = useQuery({
    queryKey: ['entry', id],
    queryFn:  () => api.get(`/entries/${id}`).then(r => r.data),
  })
  const currencySymbol = useCurrencySymbol(entry?.book?.currency)

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/entries/${id}`),
    onSuccess:  () => {
      setDeleteConfirmOpen(false)
      void qc.invalidateQueries()
      void useBooksStore.getState().fetchBooks()
      if (id) {
        void useEntriesStore.getState().deleteEntry(id).catch(() => {})
      }
      void useEntriesStore.getState().fetchEntries(useBooksStore.getState().activeBook?.id).catch(() => {})
      router.back()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'The entry was not deleted. Please try again.'
      setDeleteError(msg)
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`Delete failed: ${msg}`)
      } else {
        Alert.alert('Delete failed', msg)
      }
    },
  })

  function confirmDelete() {
    setDeleteError(null)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const warning = entry?.transferId
        ? 'This is a transfer between books. Both legs of this transfer will be deleted. Continue?'
        : `Are you sure you want to permanently delete "${entry?.name || 'this entry'}"? This action cannot be undone.`
      if (window.confirm(warning)) {
        deleteMutation.mutate()
        return
      }
      return
    }
    setDeleteConfirmOpen(true)
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#185FA5" />
      </View>
    )
  }

  if (!entry) return null

  const isIncome   = ['INCOME', 'TRANSFER_IN'].includes(entry.type)
  const isTransfer = ['TRANSFER_IN', 'TRANSFER_OUT'].includes(entry.type)
  const amtColor   = isIncome ? (theme.isDark ? '#4ADE80' : '#27500A') : (theme.isDark ? '#F87171' : '#791F1F')
  const sign       = isIncome ? '+' : '−'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
          <Ionicons name="chevron-back-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entry detail</Text>
        <TouchableOpacity
          onPress={confirmDelete}
          style={styles.deleteBtn}
          accessibilityLabel="Delete entry"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body}>
        {/* Amount hero */}
        <View style={styles.hero}>
          <View style={[styles.catIconLarge, { backgroundColor: (entry.category?.color || '#888') + '22' }]}>
            <Ionicons name="receipt-outline" size={28} color={entry.category?.color ?? '#888'} />
          </View>
          <Text style={styles.heroName}>{entry.name}</Text>
          <Text style={[styles.heroAmount, { color: amtColor }]}>
            {sign}{currencySymbol}{Number(entry.amount).toLocaleString()}
          </Text>
          {isTransfer && (
            <View style={styles.transferBadge}>
              <Ionicons name="swap-horizontal-outline" size={12} color={theme.isDark ? '#6EE7B7' : '#085041'} />
              <Text style={styles.transferBadgeText}>Transfer · not counted in totals</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Row label="Category"       value={entry.category?.name ?? '—'} styles={styles} />
          <Row label="Book"           value={entry.book?.name ?? '—'} styles={styles} />
          <Row label="Date"           value={formatDate(entry.entryDate)} styles={styles} />
          <Row label="Time"           value={formatTime(entry.entryTime)} styles={styles} />
          {entry.paymentMethod && (
            <Row label="Payment"      value={entry.paymentMethod.replace('_', ' ')} styles={styles} />
          )}
          <Row label="Type"           value={entry.type} styles={styles} />
          {entry.note && (
            <Row label="Note"         value={entry.note} styles={styles} />
          )}
        </View>

        {/* Bill image */}
        {entry.billUrl && (
          <View style={styles.billSection}>
            <Text style={styles.billLabel}>Attached bill</Text>
            <TouchableOpacity onPress={() => setBillOpen(true)} style={styles.billThumb}>
              <Image source={{ uri: resolveMediaUrl(entry.billThumbUrl || entry.billUrl) }} style={styles.billThumbImg} resizeMode="cover" />
              <View style={styles.billThumbOverlay}>
                <Ionicons name="expand-outline" size={20} color="#fff" />
                <Text style={styles.billThumbText}>Tap to view</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Action buttons (Edit & Delete) */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push({ pathname: '/entry/add', params: { editId: id } })}
          >
            <Ionicons name="pencil-outline" size={16} color={theme.primary} />
            <Text style={styles.editBtnText}>Edit entry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteSecondaryBtn}
            onPress={confirmDelete}
          >
            <Ionicons name="trash-outline" size={16} color={theme.danger} />
            <Text style={styles.deleteSecondaryBtnText}>Delete entry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Translucent confirmation layover overlay */}
      {deleteConfirmOpen && (
        <View style={styles.overlayContainer}>
          <TouchableOpacity
            style={styles.translucentBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!deleteMutation.isPending) {
                setDeleteConfirmOpen(false)
                setDeleteError(null)
              }
            }}
          />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="trash-outline" size={24} color={theme.danger} />
            </View>
            <Text style={styles.confirmTitle}>Delete entry?</Text>
            <Text style={styles.confirmDesc}>
              {entry.transferId
                ? 'This is a transfer between books. Both legs of this transfer will be deleted. This cannot be undone.'
                : `Are you sure you want to permanently delete "${entry.name}" (${sign}${currencySymbol}${Number(entry.amount).toLocaleString()})? This action cannot be undone.`}
            </Text>

            {deleteError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={14} color={theme.danger} />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            )}

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => {
                  setDeleteConfirmOpen(false)
                  setDeleteError(null)
                }}
                disabled={deleteMutation.isPending}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmDeleteBtn, deleteMutation.isPending && styles.confirmDeleteBtnDisabled]}
                onPress={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={15} color="#fff" />
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Full-screen bill viewer */}
      <Modal visible={billOpen} animationType="fade" onRequestClose={() => setBillOpen(false)}>
        <View style={styles.billModal}>
          <TouchableOpacity style={styles.billModalClose} onPress={() => setBillOpen(false)}>
            <Ionicons name="close-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: resolveMediaUrl(entry.billUrl) }} style={styles.billFull} resizeMode="contain" />
        </View>
      </Modal>
    </View>
  )
}

function Row({ label, value, styles }: { label: string; value: string; styles: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: theme.bg },
    loading:        { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg },
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.headerBorder, backgroundColor: theme.headerBg },
    backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
    deleteBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    body:           { flex: 1, padding: 16 },
    hero:           { alignItems: 'center', paddingVertical: 28, gap: 8 },
    catIconLarge:   { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    heroName:       { fontSize: 18, fontWeight: '500', color: theme.text, textAlign: 'center' },
    heroAmount:     { fontSize: 32, fontWeight: '700' },
    transferBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    transferBadgeText: { fontSize: 11, color: theme.isDark ? '#6EE7B7' : '#085041', fontWeight: '500' },
    card:           { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
    row:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: theme.border },
    rowLabel:       { fontSize: 12, color: theme.textMuted },
    rowValue:       { fontSize: 13, fontWeight: '500', color: theme.text, textAlign: 'right', flex: 1, marginLeft: 16 },
    billSection:    { marginBottom: 16 },
    billLabel:      { fontSize: 11, fontWeight: '500', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    billThumb:      { borderRadius: 12, overflow: 'hidden', height: 180, backgroundColor: theme.card, position: 'relative', borderWidth: 0.5, borderColor: theme.border },
    billThumbImg:   { width: '100%', height: '100%' },
    billThumbOverlay:{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, alignItems: 'center', gap: 4, flexDirection: 'row', justifyContent: 'center' },
    billThumbText:  { color: '#fff', fontSize: 13, fontWeight: '500' },
    actionButtonsRow:{ flexDirection: 'row', gap: 10, marginBottom: 32 },
    editBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 0.5, borderColor: theme.primary, backgroundColor: theme.primaryBg },
    editBtnText:    { fontSize: 14, fontWeight: '500', color: theme.primary },
    deleteSecondaryBtn:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, borderWidth: 0.5, borderColor: theme.dangerBorder, backgroundColor: theme.dangerBg },
    deleteSecondaryBtnText:{ fontSize: 14, fontWeight: '500', color: theme.danger },
    billModal:      { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    billModalClose: { position: 'absolute', top: 52, right: 20, zIndex: 10 },
    billFull:       { width: '100%', height: '80%' },

    // Translucent overlay & confirmation card styles
    overlayContainer:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.modalBackdrop, justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 99999, elevation: 99999 },
    translucentBackdrop:{ ...StyleSheet.absoluteFillObject },
    confirmCard:        { width: '100%', maxWidth: 360, backgroundColor: theme.modalCard, borderRadius: 20, padding: 22, borderWidth: 0.5, borderColor: theme.border, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 10 },
    confirmIconBox:     { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.dangerBg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    confirmTitle:       { fontSize: 17, fontWeight: '600', color: theme.text, marginBottom: 8, textAlign: 'center' },
    confirmDesc:        { fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
    errorBanner:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.dangerBg, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 14, width: '100%' },
    errorText:          { fontSize: 12, color: theme.danger, flex: 1 },
    confirmActions:     { flexDirection: 'row', gap: 10, width: '100%' },
    confirmCancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    confirmCancelText:  { fontSize: 14, fontWeight: '500', color: theme.textSecondary },
    confirmDeleteBtn:   { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
    confirmDeleteBtnDisabled:{ opacity: 0.6 },
    confirmDeleteText:  { fontSize: 14, fontWeight: '600', color: '#fff' },
  })
}
