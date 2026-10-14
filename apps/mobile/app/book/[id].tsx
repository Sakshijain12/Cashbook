// apps/mobile/app/book/[id].tsx
import { useEffect, useState, useMemo } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api/client'
import { useBooksStore } from '../../lib/store/books'
import { useCurrencySymbol } from '../../lib/utils/format'
import { useAppTheme, ThemeColors } from '../../lib/theme'

export default function BookDetailScreen() {
  const theme    = useAppTheme()
  const styles   = useMemo(() => createStyles(theme), [theme])
  const { id }   = useLocalSearchParams<{ id: string }>()
  const router   = useRouter()
  const qc       = useQueryClient()
  const { books, fetchBooks } = useBooksStore()
  const book     = books.find(b => b.id === id)
  const currencySymbol = useCurrencySymbol(book?.currency)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['entries', id],
    queryFn:  () => api.get('/entries', { params: { bookId: id, limit: '100' } }).then(r => r.data),
    enabled:  !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/books/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['books'] })
      await qc.invalidateQueries({ queryKey: ['categories'] })
      await qc.invalidateQueries({ queryKey: ['entries'] })
      await qc.invalidateQueries({ queryKey: ['reports'] })
      await fetchBooks()
      router.back()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Failed to delete book'
      if (Platform.OS === 'web') alert(msg)
      else Alert.alert('Delete failed', msg)
    },
  })

  function confirmDelete() {
    if (books.length <= 1) {
      const msg = 'Cannot delete your only book. You must have at least one active book.'
      if (Platform.OS === 'web') alert(msg)
      else Alert.alert('Cannot delete', msg)
      return
    }

    const doDelete = () => {
      deleteMutation.mutate()
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Are you sure you want to delete "${book?.name}"?\n\nThis will permanently remove this book and all its recorded entries. This action cannot be undone.`)) {
          doDelete()
        }
      } else {
        doDelete()
      }
    } else {
      Alert.alert(
        `Delete "${book?.name}"?`,
        'This will permanently remove this book and all its recorded entries. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      )
    }
  }

  const entries = data?.entries ?? []
  const income  = entries.filter((e: any) => ['INCOME', 'TRANSFER_IN'].includes(e.type)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const expense = entries.filter((e: any) => ['EXPENSE', 'TRANSFER_OUT'].includes(e.type)).reduce((s: number, e: any) => s + Number(e.amount), 0)
  const balPositive = (book?.balance ?? 0) >= 0

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{book?.name ?? 'Book'}</Text>
        <TouchableOpacity onPress={confirmDelete} style={styles.moreBtn} accessibilityLabel="Delete book">
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
        </TouchableOpacity>
      </View>

      {/* Book summary */}
      <View style={[styles.bookHero, { borderLeftColor: book?.color ?? '#888', borderLeftWidth: 4 }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>Current balance</Text>
            <Text style={[styles.heroBalance, { color: balPositive ? (theme.isDark ? '#4ADE80' : '#27500A') : (theme.isDark ? '#F87171' : '#791F1F') }]}>
              {currencySymbol}{Math.abs(book?.balance ?? 0).toLocaleString()}
            </Text>
          </View>
          <View style={[styles.bookIconLg, { backgroundColor: (book?.color ?? '#888') + '22' }]}>
            <Ionicons name="book-outline" size={22} color={book?.color ?? '#888'} />
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Income</Text>
            <Text style={[styles.heroStatVal, { color: theme.isDark ? '#4ADE80' : '#27500A' }]}>+{currencySymbol}{income.toLocaleString()}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatBorder]}>
            <Text style={styles.heroStatLabel}>Expenses</Text>
            <Text style={[styles.heroStatVal, { color: theme.isDark ? '#F87171' : '#791F1F' }]}>−{currencySymbol}{expense.toLocaleString()}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatBorder]}>
            <Text style={styles.heroStatLabel}>Type</Text>
            <Text style={styles.heroStatVal}>{book?.type ?? '—'}</Text>
          </View>
        </View>
      </View>

      {/* Entries list */}
      <Text style={styles.secLabel}>All entries</Text>
      <FlatList
        data={entries}
        keyExtractor={(e: any) => e.id}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        contentContainerStyle={styles.list}
        renderItem={({ item: e }) => {
          const isIncome   = ['INCOME', 'TRANSFER_IN'].includes(e.type)
          const isTransfer = ['TRANSFER_IN', 'TRANSFER_OUT'].includes(e.type)
          return (
            <TouchableOpacity style={styles.entryRow} onPress={() => router.push(`/entry/${e.id}`)}>
              <View style={[styles.catIcon, { backgroundColor: (e.category?.color ?? '#888') + '22' }]}>
                <Ionicons name={isTransfer ? 'swap-horizontal-outline' : 'receipt-outline'} size={16} color={e.category?.color ?? '#888'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.entryMeta}>
                  {e.category?.name}{e.paymentMethod ? ` · ${e.paymentMethod}` : ''}
                </Text>
              </View>
              <View style={styles.entryRight}>
                <Text style={[styles.entryAmt, { color: isIncome ? (theme.isDark ? '#4ADE80' : '#27500A') : (theme.isDark ? '#F87171' : '#791F1F') }]}>
                  {isIncome ? '+' : '−'}{currencySymbol}{Number(e.amount).toLocaleString()}
                </Text>
                <Text style={styles.entryDate}>{e.entryDate?.split('T')[0]}</Text>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={40} color={theme.textMuted} />
            <Text style={styles.emptyText}>No entries for this book</Text>
          </View>
        }
      />
    </View>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: theme.bg },
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: theme.headerBorder, backgroundColor: theme.headerBg },
    backBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:    { fontSize: 15, fontWeight: '500', color: theme.text },
    moreBtn:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    bookHero:       { margin: 16, backgroundColor: theme.card, borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: theme.border },
    heroTop:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    heroLabel:      { fontSize: 11, color: theme.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
    heroBalance:    { fontSize: 28, fontWeight: '700' },
    bookIconLg:     { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    heroStats:      { flexDirection: 'row' },
    heroStat:       { flex: 1, alignItems: 'center' },
    heroStatBorder: { borderLeftWidth: 0.5, borderLeftColor: theme.border },
    heroStatLabel:  { fontSize: 10, color: theme.textMuted, marginBottom: 3 },
    heroStatVal:    { fontSize: 13, fontWeight: '500', color: theme.text, textTransform: 'capitalize' },
    secLabel:       { fontSize: 10, fontWeight: '500', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 8 },
    list:           { paddingHorizontal: 16, paddingBottom: 16 },
    entryRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border },
    catIcon:        { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    entryName:      { fontSize: 13, fontWeight: '500', color: theme.text },
    entryMeta:      { fontSize: 10, color: theme.textMuted, marginTop: 2 },
    entryRight:     { alignItems: 'flex-end', gap: 2 },
    entryAmt:       { fontSize: 13, fontWeight: '500' },
    entryDate:      { fontSize: 10, color: theme.textMuted },
    empty:          { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyText:      { fontSize: 14, color: theme.textMuted },
  })
}
