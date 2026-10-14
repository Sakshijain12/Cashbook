// apps/mobile/app/tabs/books.tsx
import { useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Modal,
  TextInput, Alert, RefreshControl, Platform, ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { api } from '../../lib/api/client'
import { useBooksStore, Book } from '../../lib/store/books'
import { useSettingsStore } from '../../lib/store/settings'
import { useCurrencySymbol, getCurrencySymbol } from '../../lib/utils/format'
import { useAppTheme } from '../../lib/theme'

const BOOK_TYPES = [
  { key: 'bank',    label: 'Bank account',   icon: 'business-outline'    },
  { key: 'cash',    label: 'Cash / wallet',   icon: 'cash-outline'        },
  { key: 'credit',  label: 'Credit card',     icon: 'card-outline'        },
  { key: 'prepaid', label: 'Prepaid / forex', icon: 'globe-outline'       },
]

const COLORS = ['#185FA5','#27500A','#791F1F','#0F6E56','#633806','#3C3489','#993556','#444441']

export default function BooksScreen() {
  const qc          = useQueryClient()
  const theme       = useAppTheme()
  const defaultSymbol = useCurrencySymbol()
  const { setActiveBook, activeBook, fetchBooks } = useBooksStore()
  const router      = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [bookName, setBookName]   = useState('')
  const [bookType, setBookType]   = useState('bank')
  const [bookColor, setBookColor] = useState(COLORS[0])

  // Book action menu state
  const [selectedBook, setSelectedBook] = useState<Book | any | null>(null)
  const [actionSheetVisible, setActionSheetVisible] = useState(false)

  const { data: books = [], isLoading, refetch } = useQuery({
    queryKey: ['books'],
    queryFn:  () => api.get('/books').then(r => r.data),
  })

  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch])
  )

  const totalBalance = books.reduce((s: number, b: any) => s + (b.balance ?? 0), 0)
  const totalIncome  = books.reduce((s: number, b: any) => s + (b.income ?? b.monthIncome ?? 0), 0)
  const totalExpense = books.reduce((s: number, b: any) => s + (b.expense ?? b.monthExpense ?? 0), 0)

  const createMutation = useMutation({
    mutationFn: () => api.post('/books', {
      name: bookName,
      type: bookType,
      color: bookColor,
      icon: 'ti-book',
      currency: useSettingsStore.getState().currency || 'USD',
    }),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      setModalOpen(false)
      setBookName('')
      Alert.alert('Book created', `"${bookName}" and ${res.data.transferCategoriesCreated} transfer categories were created.`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (bookId: string) => api.delete(`/books/${bookId}`),
    onSuccess: async (_, bookId) => {
      setActionSheetVisible(false)
      setSelectedBook(null)
      await qc.invalidateQueries({ queryKey: ['books'] })
      await qc.invalidateQueries({ queryKey: ['categories'] })
      await qc.invalidateQueries({ queryKey: ['entries'] })
      await qc.invalidateQueries({ queryKey: ['reports'] })
      await fetchBooks()
      if (Platform.OS === 'web') {
        // Subtle feedback or no interruption
      } else {
        Alert.alert('Book deleted', 'The book and its entries have been removed.')
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Failed to delete book'
      if (Platform.OS === 'web') {
        alert(msg)
      } else {
        Alert.alert('Delete failed', msg)
      }
    },
  })

  function handleDeleteBook(book: any) {
    if (!book) return

    if (books.length <= 1) {
      const msg = 'Cannot delete your only book. You must have at least one active book.'
      if (Platform.OS === 'web') {
        alert(msg)
      } else {
        Alert.alert('Cannot delete', msg)
      }
      return
    }

    const doDelete = () => {
      deleteMutation.mutate(book.id)
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Are you sure you want to delete "${book.name}"?\n\nThis will permanently remove this book and all its recorded entries. This action cannot be undone.`)) {
          doDelete()
        }
      } else {
        doDelete()
      }
    } else {
      Alert.alert(
        `Delete "${book.name}"?`,
        'This will permanently remove this book and all its recorded entries. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      )
    }
  }

  const cashAndBank = books.filter((b: any) => ['cash', 'bank'].includes(b.type))
  const cards       = books.filter((b: any) => !['cash', 'bank'].includes(b.type))

  const renderBook = (b: any) => (
    <TouchableOpacity
      key={b.id}
      style={[
        styles.bookCard,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        activeBook?.id === b.id && { borderColor: theme.primary, backgroundColor: theme.primaryBg },
      ]}
      onPress={() => { setActiveBook(b); router.push(`/book/${b.id}`) }}
    >
      <View style={styles.bookTop}>
        <View style={[styles.bookIcon, { backgroundColor: (b.color || theme.primary) + '22' }]}>
          <Ionicons name="book-outline" size={16} color={b.color || theme.primary} />
        </View>
        <TouchableOpacity
          style={[styles.moreBtn, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}
          onPress={(e) => {
            e.stopPropagation?.()
            setSelectedBook(b)
            setActionSheetVisible(true)
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Options for ${b.name}`}
        >
          <Ionicons name="ellipsis-horizontal-outline" size={14} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.bookName, { color: theme.text }]}>{b.name}</Text>
      <Text style={[styles.bookType, { color: theme.textMuted }]}>{b.type}</Text>
      <Text style={[styles.bookBalance, { color: (b.balance ?? 0) >= 0 ? theme.success : theme.danger }]}>
        {((b.currency && b.currency !== 'JPY') ? getCurrencySymbol(b.currency) : defaultSymbol)}{Math.abs(b.balance ?? 0).toLocaleString()}
      </Text>
      <View style={styles.bookMiniRow}>
        <Text style={[styles.bookMini, { color: theme.success }]}>+{((b.currency && b.currency !== 'JPY') ? getCurrencySymbol(b.currency) : defaultSymbol)}{(b.income ?? b.monthIncome ?? 0).toLocaleString()}</Text>
        <Text style={[styles.bookMini, { color: theme.danger }]}>-{((b.currency && b.currency !== 'JPY') ? getCurrencySymbol(b.currency) : defaultSymbol)}{(b.expense ?? b.monthExpense ?? 0).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Books</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]} onPress={() => setModalOpen(true)}>
            <Ionicons name="add-outline" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Net worth */}
      <View style={[styles.netWorth, { backgroundColor: theme.card, borderBottomColor: theme.cardBorder }]}>
        <View>
          <Text style={[styles.nwLabel, { color: theme.textMuted }]}>Total balance</Text>
          <Text style={[styles.nwVal, { color: theme.text }]}>{defaultSymbol}{totalBalance.toLocaleString()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.nwMini, { color: theme.success }]}>+{defaultSymbol}{totalIncome.toLocaleString()}</Text>
          <Text style={[styles.nwMini, { color: theme.danger }]}>-{defaultSymbol}{totalExpense.toLocaleString()}</Text>
        </View>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.primary} />}
        ListHeaderComponent={
          <>
            {cashAndBank.length > 0 && (
              <>
                <Text style={[styles.secLabel, { color: theme.textMuted }]}>Cash & bank</Text>
                <View style={styles.bookGrid}>{cashAndBank.map(renderBook)}</View>
              </>
            )}
            {cards.length > 0 && (
              <>
                <Text style={[styles.secLabel, { color: theme.textMuted }]}>Cards & prepaid</Text>
                <View style={styles.bookGrid}>
                  {cards.map(renderBook)}
                  <TouchableOpacity style={[styles.addCard, { borderColor: theme.cardBorder }]} onPress={() => setModalOpen(true)}>
                    <Ionicons name="add-outline" size={22} color={theme.textMuted} />
                    <Text style={[styles.addCardText, { color: theme.textMuted }]}>Add book</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Add book modal */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: theme.cardInner }]}>
          <View style={[styles.modalHandle, { backgroundColor: theme.cardBorder }]} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>New book</Text>

          <Text style={[styles.label, { color: theme.textMuted }]}>Book name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="e.g. Wise, PayPay..."
            placeholderTextColor={theme.textMuted}
            value={bookName}
            onChangeText={setBookName}
            autoFocus
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Type</Text>
          <View style={styles.typeGrid}>
            {BOOK_TYPES.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeOpt,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  bookType === t.key && { borderColor: theme.primary, backgroundColor: theme.primaryBg },
                ]}
                onPress={() => setBookType(t.key)}
              >
                <Ionicons name={t.icon as any} size={20} color={bookType === t.key ? theme.primary : theme.textMuted} />
                <Text style={[styles.typeOptText, { color: theme.textSecondary }, bookType === t.key && { color: theme.primaryText }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textMuted }]}>Colour</Text>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, bookColor === c && styles.colorDotSel]}
                onPress={() => setBookColor(c)}
              />
            ))}
          </View>

          {books.length > 0 && (
            <View style={[styles.autoNotice, { backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderColor: theme.isDark ? '#22C55E' : '#0F6E56' }]}>
              <Ionicons name="sparkles-outline" size={14} color={theme.isDark ? '#86EFAC' : '#0F6E56'} />
              <Text style={[styles.autoNoticeText, { color: theme.isDark ? '#86EFAC' : '#085041' }]}>
                {books.length * 2} transfer categories will be auto-created between this book and your {books.length} existing book{books.length !== 1 ? 's' : ''}.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }, !bookName && { opacity: 0.5 }]}
            onPress={() => bookName && createMutation.mutate()}
            disabled={!bookName || createMutation.isPending}
          >
            <Text style={[styles.createBtnText, { color: '#FFFFFF' }]}>Create book</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setModalOpen(false)}
          >
            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Book Actions Layover Modal */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteMutation.isPending) {
            setActionSheetVisible(false)
            setSelectedBook(null)
          }
        }}
      >
        <View style={styles.overlayContainer}>
          <TouchableOpacity
            style={styles.translucentBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!deleteMutation.isPending) {
                setActionSheetVisible(false)
                setSelectedBook(null)
              }
            }}
          />
          {selectedBook && (
            <View style={[styles.actionCard, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
              <View style={[styles.actionHeader, { borderBottomColor: theme.rowBorder }]}>
                <View style={[styles.actionBookIcon, { backgroundColor: (selectedBook.color || theme.primary) + '22' }]}>
                  <Ionicons name="book-outline" size={20} color={selectedBook.color || theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionBookTitle, { color: theme.text }]}>{selectedBook.name}</Text>
                  <Text style={[styles.actionBookSubtitle, { color: theme.textMuted }]}>
                    {selectedBook.type} · {((selectedBook.currency && selectedBook.currency !== 'JPY') ? getCurrencySymbol(selectedBook.currency) : defaultSymbol)}{Math.abs(selectedBook.balance ?? 0).toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionCloseBtn, { backgroundColor: theme.card }]}
                  onPress={() => {
                    if (!deleteMutation.isPending) {
                      setActionSheetVisible(false)
                      setSelectedBook(null)
                    }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-outline" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.actionOptions}>
                <TouchableOpacity
                  style={[styles.actionRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                  activeOpacity={0.7}
                  onPress={() => {
                    const target = selectedBook
                    setActionSheetVisible(false)
                    setSelectedBook(null)
                    setActiveBook(target)
                    router.push(`/book/${target.id}`)
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: theme.primaryBg }]}>
                    <Ionicons name="open-outline" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionRowText, { color: theme.text }]}>Open book details</Text>
                    <Text style={[styles.actionRowSub, { color: theme.textMuted }]}>View entries and book analytics</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={16} color={theme.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionRow,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                    { borderColor: theme.isDark ? '#7F2323' : '#F8D7DA', backgroundColor: theme.isDark ? '#2D1616' : '#FFFDFD' }
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleDeleteBook(selectedBook)}
                  disabled={deleteMutation.isPending}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: theme.dangerBg }]}>
                    {deleteMutation.isPending ? (
                      <ActivityIndicator size="small" color={theme.danger} />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color={theme.danger} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionDestructiveText, { color: theme.danger }]}>
                      {deleteMutation.isPending ? 'Deleting book...' : 'Delete book'}
                    </Text>
                    <Text style={[styles.actionDestructiveSub, { color: theme.isDark ? '#FCA5A5' : '#A33A3A' }]}>
                      Permanently delete this book and its entries
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.actionCancelBtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
                activeOpacity={0.7}
                onPress={() => {
                  if (!deleteMutation.isPending) {
                    setActionSheetVisible(false)
                    setSelectedBook(null)
                  }
                }}
              >
                <Text style={[styles.actionCancelText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FAFAF8' },
  header:       { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle:    { fontSize: 17, fontWeight: '500', color: '#2C2C2A' },
  addBtn:       { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', alignItems: 'center', justifyContent: 'center' },
  netWorth:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#F2F1EB', borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  nwLabel:      { fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  nwVal:        { fontSize: 22, fontWeight: '500', color: '#2C2C2A' },
  nwMini:       { fontSize: 12, fontWeight: '500' },
  listContent:  { padding: 16 },
  secLabel:     { fontSize: 10, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  bookGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  bookCard:     { width: '47%', backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 12 },
  bookCardActive:{ borderColor: '#185FA5', backgroundColor: '#E6F1FB' },
  bookTop:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  bookIcon:     { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  moreBtn:      { width: 22, height: 22, borderRadius: 6, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  bookName:     { fontSize: 12, fontWeight: '500', color: '#2C2C2A', marginBottom: 2 },
  bookType:     { fontSize: 10, color: '#888', marginBottom: 8 },
  bookBalance:  { fontSize: 16, fontWeight: '500' },
  bookMiniRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  bookMini:     { fontSize: 10 },
  addCard:      { width: '47%', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D3D1C7', borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 110 },
  addCardText:  { fontSize: 11, color: '#aaa', fontWeight: '500' },
  modal:        { flex: 1, padding: 20 },
  modalHandle:  { width: 36, height: 4, backgroundColor: '#D3D1C7', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:   { fontSize: 15, fontWeight: '500', color: '#2C2C2A', textAlign: 'center', marginBottom: 20 },
  label:        { fontSize: 10, fontWeight: '500', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  input:        { borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 16, backgroundColor: '#fff' },
  typeGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeOpt:      { width: '47%', padding: 10, borderRadius: 10, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', alignItems: 'center', gap: 4 },
  typeOptSel:   { borderColor: '#185FA5', backgroundColor: '#E6F1FB' },
  typeOptText:  { fontSize: 11, fontWeight: '500', color: '#888', textAlign: 'center' },
  colorRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  colorDot:     { width: 26, height: 26, borderRadius: 13 },
  colorDotSel:  { borderWidth: 2.5, borderColor: '#2C2C2A' },
  autoNotice:   { flexDirection: 'row', gap: 8, backgroundColor: '#E1F5EE', borderWidth: 0.5, borderColor: '#0F6E56', borderRadius: 8, padding: 10, marginBottom: 16 },
  autoNoticeText:{ flex: 1, fontSize: 11, color: '#085041', lineHeight: 16 },
  createBtn:    { backgroundColor: '#E6F1FB', paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  createBtnText:{ fontSize: 14, fontWeight: '500', color: '#0C447C' },
  cancelBtn:    { paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 0.5, borderColor: '#E0DED7' },
  cancelBtnText:{ fontSize: 13, color: '#888' },

  // Translucent overlay & action layover card styles
  overlayContainer:     { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  translucentBackdrop:  { ...StyleSheet.absoluteFillObject },
  actionCard:           { width: '100%', maxWidth: 360, backgroundColor: '#FAFAF8', borderRadius: 20, padding: 18, borderWidth: 0.5, borderColor: '#E0DED7', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 10 },
  actionHeader:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  actionBookIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionBookTitle:      { fontSize: 16, fontWeight: '600', color: '#2C2C2A' },
  actionBookSubtitle:   { fontSize: 12, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  actionCloseBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F2F1EB' },
  actionOptions:        { paddingTop: 14, gap: 10 },
  actionRow:            { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#E0DED7' },
  actionRowDestructive: { borderColor: '#F8D7DA', backgroundColor: '#FFFDFD' },
  actionIconBox:        { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionRowText:        { fontSize: 14, fontWeight: '500', color: '#2C2C2A' },
  actionRowSub:         { fontSize: 11, color: '#888', marginTop: 2 },
  actionDestructiveText:{ fontSize: 14, fontWeight: '500', color: '#D93025' },
  actionDestructiveSub: { fontSize: 11, color: '#A33A3A', marginTop: 2 },
  actionCancelBtn:      { marginTop: 14, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7' },
  actionCancelText:     { fontSize: 13, fontWeight: '500', color: '#666' },
})

