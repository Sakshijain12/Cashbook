// apps/mobile/app/entry/add.tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../../lib/api/client'
import { useBooksStore } from '../../lib/store/books'
import { useCategoriesStore, Category } from '../../lib/store/categories'
import { useEntriesStore } from '../../lib/store/entries'
import { formatTime, todayISO, useCurrencySymbol } from '../../lib/utils/format'
import { useAppTheme, ThemeColors } from '../../lib/theme'

const PAYMENT_METHODS = ['cash', 'salary', 'card', 'online', 'direct_debit'] as const
type PayMethod = typeof PAYMENT_METHODS[number]

function nowTime()   { return new Date().toTimeString().slice(0, 5) }

export default function AddEntryScreen() {
  const theme      = useAppTheme()
  const styles     = useMemo(() => createStyles(theme), [theme])
  const router     = useRouter()
  const qc         = useQueryClient()
  const activeBook = useBooksStore(s => s.activeBook)
  const currencySymbol = useCurrencySymbol(activeBook?.currency)
  const books      = useBooksStore(s => s.books)
  const fetchBooks = useBooksStore(s => s.fetchBooks)
  const { fetchEntries } = useEntriesStore()
  const { categories, fetchCategories, createCategory } = useCategoriesStore()

  const { mode: initMode, editId } = useLocalSearchParams<{ mode?: string; editId?: string }>()
  const isEdit = !!editId

  const [mode,        setMode]        = useState<'income' | 'expense'>((initMode as any) ?? 'expense')
  const [name,        setName]        = useState('')
  const [amount,      setAmount]      = useState('')
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [payMethod,   setPayMethod]   = useState<PayMethod>('cash')
  const [date,        setDate]        = useState(todayISO())
  const [time,        setTime]        = useState(nowTime())
  const [note,        setNote]        = useState('')
  const [bill,        setBill]        = useState<{ uri: string; billUrl?: string; billThumbUrl?: string } | null>(null)
  const [scanning,    setScanning]    = useState(false)
  const [catSearch,   setCatSearch]   = useState('')
  const [catOpen,     setCatOpen]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [editBookId, setEditBookId] = useState<string | null>(null)
  const [scanNotice, setScanNotice] = useState('Review receipt details before saving')
  const scanVersion = useRef(0)
  useEffect(() => () => { scanVersion.current += 1 }, [])

  // Ensure books are loaded
  useEffect(() => {
    if (!activeBook && books.length === 0) {
      fetchBooks()
    }
  }, [activeBook, books.length])

  // Fetch categories and prefill for edit mode
  useEffect(() => {
    const bookId = activeBook?.id ?? books[0]?.id
    fetchCategories(bookId).catch(() => setError('Could not load categories. Check your connection.'))
    if (isEdit) {
      api.get(`/entries/${editId}`).then(({ data }) => {
        setName(data.name)
        setEditBookId(data.bookId)
        setAmount(String(data.amount))
        setDate(data.entryDate?.split('T')[0] ?? todayISO())
        setTime(formatTime(data.entryTime) || nowTime())
        setNote(data.note ?? '')
        setMode(data.type === 'INCOME' ? 'income' : 'expense')
        setPayMethod(data.paymentMethod ?? 'cash')
        if (data.billUrl) setBill({ uri: data.billUrl, billUrl: data.billUrl, billThumbUrl: data.billThumbUrl })
        if (data.category) setSelectedCat(data.category)
      }).catch(() => setError('Could not load this entry. Please retry.'))
    }
  }, [editId, activeBook?.id, books.length])

  // Filtered category list — match the active mode (Income categories for Income, Expense for Expense)
  const targetType   = mode === 'income' ? 'INCOME' : 'EXPENSE'
  const normalCats   = categories.filter(c => !c.isTransfer && c.entryType === targetType && (catSearch === '' || c.name.toLowerCase().includes(catSearch.toLowerCase())))
  const transferCats = mode === 'expense'
    ? categories.filter(c => c.isTransfer && (catSearch === '' || c.name.toLowerCase().includes(catSearch.toLowerCase())))
    : []
  const exactMatch   = categories.some(c => c.entryType === targetType && c.name.toLowerCase() === catSearch.toLowerCase())
  const showCreate   = catSearch.length > 0 && !exactMatch && !selectedCat?.isTransfer

  // Create category on the fly
  const createCatMutation = useMutation({
    mutationFn: (name: string) => createCategory(name, mode === 'income' ? 'INCOME' : 'EXPENSE'),
    onSuccess:  cat => selectCategory(cat),
  })

  // Scan bill
  const scanMutation = useMutation({
    mutationFn: async ({ uri, mimeType }: { uri: string; mimeType: string; version: number }) => {
      const form = new FormData()
      const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
      if (Platform.OS === 'web') {
        const blob = await fetch(uri).then(response => response.blob())
        form.append('file', blob, `receipt.${ext}`)
      } else {
        form.append('file', { uri, name: `receipt.${ext}`, type: mimeType } as any)
      }
      const { data } = await api.post('/entries/scan-bill', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      return data
    },
    onSuccess: (data, variables) => {
      if (variables.version !== scanVersion.current) return
      if (data.name)      setName(data.name)
      if (data.amount !== null && data.amount !== undefined) setAmount(String(data.amount))
      if (data.entryDate) setDate(data.entryDate)
      if (data.entryTime) setTime(data.entryTime)
      if (data.billUrl) {
        setBill(prev => prev
          ? { ...prev, billUrl: data.billUrl, billThumbUrl: data.billThumbUrl }
          : { uri: data.billUrl, billUrl: data.billUrl, billThumbUrl: data.billThumbUrl }
        )
      }
      if (data.suggestedCategory) {
        const match = categories.find(c => c.name === data.suggestedCategory && !c.isTransfer && c.entryType === targetType)
        if (match) selectCategory(match)
      }
      const extractedParts: string[] = []
      if (data.name) extractedParts.push(data.name)
      if (data.amount !== null && data.amount !== undefined) extractedParts.push(`${currencySymbol}${Number(data.amount).toLocaleString()}`)

      if (extractedParts.length > 0) {
        setScanNotice(`✨ Scanned: ${extractedParts.join(' · ')}`)
      } else if (data.status === 'extracted') {
        setScanNotice('✨ Bill scanned — details extracted!')
      } else if (data.status === 'no_text') {
        setScanNotice('Receipt attached. No text recognized; enter details manually.')
      } else {
        setScanNotice('Receipt attached. Review details before saving.')
      }
      setScanning(false)
    },
    onError: (error: any, variables) => {
      if (variables.version !== scanVersion.current) return
      setScanning(false)
      setScanNotice('Upload failed — please retry or enter details manually.')
      setError(error?.response?.data?.error || 'Could not read the receipt. Remove it to retry, or enter details manually.')
    },
  })

  // Save entry
  const saveMutation = useMutation({
    mutationFn: () => {
      const currentBook = activeBook ?? books[0]
      const finalName = (name.trim() || selectedCat!.name).trim()
      const payload = {
        bookId:        isEdit ? editBookId! : currentBook!.id,
        categoryId:    selectedCat!.id,
        amount:        parseFloat(amount),
        name:          finalName,
        paymentMethod: selectedCat?.isTransfer ? undefined : payMethod,
        entryDate:     date,
        entryTime:     time,
        note:          note.trim() || undefined,
        billUrl:       bill?.billUrl,
        billThumbUrl:  bill?.billThumbUrl,
      }
      if (isEdit) return api.patch(`/entries/${editId}`, payload)
      return api.post('/entries', payload)
    },
    onSuccess: () => {
      const currentBook = activeBook ?? books[0]
      void fetchEntries(currentBook?.id).catch(() => {})
      void fetchBooks()
      void qc.invalidateQueries()
      router.back()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || e?.message || 'Could not save entry'
      setError(msg)
      if (Platform.OS !== 'web') Alert.alert('Error', msg)
    },
  })

  function selectCategory(cat: Category) {
    setSelectedCat(cat)
    setCatOpen(false)
    setCatSearch('')
    if (!name.trim() || cat.isTransfer) setName(cat.name)
    setError(null)
  }

  async function pickBill(source: 'camera' | 'gallery') {
    const perms = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perms.granted) { Alert.alert('Permission needed'); return }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images })

    if (!result.canceled && result.assets?.[0]) {
      const uri = result.assets[0].uri
      setBill({ uri })
      setScanning(true)
      setError(null)
      const version = ++scanVersion.current
      scanMutation.mutate({ uri, mimeType: result.assets[0].mimeType ?? 'image/jpeg', version })
    }
  }

  function validate(): boolean {
    if (scanning) { setError('Wait for the receipt scan to finish.'); return false }
    if (isEdit && !editBookId) { setError('Wait for the entry to load.'); return false }
    const currentBook = activeBook ?? books[0]
    if (!currentBook) {
      const msg = 'No book found. Please create a book first in the Books tab'
      setError(msg)
      if (Platform.OS !== 'web') Alert.alert('No book selected', msg)
      return false
    }
    const finalName = name.trim() || selectedCat?.name || ''
    if (!finalName) {
      const msg = 'Please enter a name for this entry'
      setError(msg)
      if (Platform.OS !== 'web') Alert.alert('Enter a name', msg)
      return false
    }
    const num = parseFloat(amount)
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(num) || num <= 0 || num > 9999999999.99) {
      const msg = 'Please enter a valid amount'
      setError(msg)
      if (Platform.OS !== 'web') Alert.alert('Enter a valid amount', msg)
      return false
    }
    if (!selectedCat) {
      const msg = `Please select a ${mode} category`
      setError(msg)
      if (Platform.OS !== 'web') Alert.alert('Select a category', msg)
      return false
    }
    const parsedDate = new Date(`${date}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError('Enter a valid date (YYYY-MM-DD) and time (HH:MM).')
      return false
    }
    setError(null)
    return true
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Mode tabs */}
        <View style={styles.topbar}>
          <TouchableOpacity
            style={[styles.tab, mode === 'income' && styles.tabInc]}
            onPress={() => { setMode('income'); setSelectedCat(null); setError(null) }}
          >
            <Text style={[styles.tabText, mode === 'income' && styles.tabTextInc]}>+ Income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'expense' && styles.tabExp]}
            onPress={() => { setMode('expense'); setSelectedCat(null); setError(null) }}
          >
            <Text style={[styles.tabText, mode === 'expense' && styles.tabTextExp]}>− Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close-outline" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Bill upload */}
          {!bill ? (
            <View style={styles.uploadZone}>
              <Ionicons name="camera-outline" size={28} color={theme.textMuted} />
              <Text style={styles.uploadTitle}>Upload your bill</Text>
              <Text style={styles.uploadSub}>Scans receipt words & amount with OCR and saves the bill image.</Text>
              <View style={styles.uploadBtns}>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickBill('camera')}>
                  <Ionicons name="camera-outline" size={16} color={theme.textSecondary} />
                  <Text style={styles.uploadBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => pickBill('gallery')}>
                  <Ionicons name="image-outline" size={16} color={theme.textSecondary} />
                  <Text style={styles.uploadBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.billThumb}>
              <Image source={{ uri: bill.uri }} style={styles.thumbImg} />
              <View style={styles.thumbInfo}>
                <Text style={styles.thumbName}>Bill attached</Text>
                {scanning ? (
                  <View style={styles.scanRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.scanText}>Reading bill with OCR...</Text>
                  </View>
                ) : (
                  <View style={styles.autofillBadge}>
                    <Ionicons name="sparkles-outline" size={11} color={theme.isDark ? '#6EE7B7' : '#085041'} />
                    <Text style={[styles.autofillText, { flexShrink: 1 }]}>{scanNotice}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { scanVersion.current += 1; setBill(null); setScanning(false) }}>
                <Ionicons name="close-circle-outline" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, scanning && styles.inputFilled]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. FamilyMart, Monthly rent..."
              placeholderTextColor={theme.textMuted}
            />
          </View>

          {/* Amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amtRow}>
              <Text style={styles.currency}>{currencySymbol}</Text>
              <TextInput
                style={[styles.amtInput, scanning && styles.inputFilled]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <View style={styles.divider} />

          {/* Category combobox */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity style={styles.comboTrigger} onPress={() => setCatOpen(v => !v)}>
              {selectedCat ? (
                <View style={styles.comboSelected}>
                  <View style={[styles.catBadge, { backgroundColor: selectedCat.isTransfer ? (theme.isDark ? '#143823' : '#E1F5EE') : theme.badgeBg }]}>
                    <Text style={[styles.catBadgeText, { color: selectedCat.isTransfer ? (theme.isDark ? '#6EE7B7' : '#085041') : theme.badgeText }]}>
                      {selectedCat.isTransfer ? 'transfer' : 'category'}
                    </Text>
                  </View>
                  <Text style={styles.comboSelectedText} numberOfLines={1}>{selectedCat.name}</Text>
                </View>
              ) : (
                <Text style={styles.comboPlaceholder}>Select or type a category...</Text>
              )}
              <Ionicons name={catOpen ? 'chevron-up-outline' : 'chevron-down-outline'} size={14} color={theme.textMuted} />
            </TouchableOpacity>

            {catOpen && (
              <View style={styles.dropdown}>
                <View style={styles.searchRow}>
                  <Ionicons name="search-outline" size={14} color={theme.textMuted} />
                  <TextInput
                    style={styles.catSearch}
                    placeholder="Search or type new..."
                    placeholderTextColor={theme.textMuted}
                    value={catSearch}
                    onChangeText={setCatSearch}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (showCreate) createCatMutation.mutate(catSearch)
                      else {
                        const match = categories.find(c => c.name.toLowerCase() === catSearch.toLowerCase())
                        if (match) selectCategory(match)
                      }
                    }}
                  />
                  {catSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setCatSearch('')}>
                      <Ionicons name="close-circle-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {normalCats.length > 0 && (
                    <>
                      <Text style={styles.dropSection}>{mode === 'income' ? 'Income categories' : 'Expense categories'}</Text>
                      {normalCats.map(c => (
                        <TouchableOpacity key={c.id} style={styles.dropItem} onPress={() => selectCategory(c)}>
                          <View style={[styles.dotSmall, { backgroundColor: c.color ?? '#888' }]} />
                          <Text style={styles.dropItemText}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {transferCats.length > 0 && (
                    <>
                      <Text style={styles.dropSection}>Transfers between books</Text>
                      {transferCats.map(c => (
                        <TouchableOpacity key={c.id} style={styles.dropItem} onPress={() => selectCategory(c)}>
                          <View style={[styles.dotSmall, { backgroundColor: '#0F6E56' }]} />
                          <Text style={styles.dropItemText}>{c.name}</Text>
                          <View style={styles.transferTag}><Text style={styles.transferTagText}>transfer</Text></View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                  {showCreate && (
                    <TouchableOpacity style={styles.createRow} onPress={() => createCatMutation.mutate(catSearch)}>
                      <View style={styles.createIcon}>
                        <Ionicons name="add-outline" size={14} color={theme.primary} />
                      </View>
                      <Text style={styles.createText}>
                        Create "<Text style={{ fontWeight: '600' }}>{catSearch}</Text>"
                      </Text>
                    </TouchableOpacity>
                  )}
                  {normalCats.length === 0 && transferCats.length === 0 && !showCreate && (
                    <Text style={styles.dropEmpty}>No matches. Type to create new.</Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Payment method — normal only */}
          {selectedCat && !selectedCat.isTransfer && (
            <View style={styles.field}>
              <Text style={styles.label}>Payment method</Text>
              <View style={styles.pillRow}>
                {PAYMENT_METHODS.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pill, payMethod === m && styles.pillActive]}
                    onPress={() => setPayMethod(m)}
                  >
                    <Text style={[styles.pillText, payMethod === m && styles.pillTextActive]}>
                      {m.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Transfer destination */}
          {selectedCat?.isTransfer && (
            <View style={styles.field}>
              <Text style={styles.label}>Transfer to</Text>
              <View style={styles.destBox}>
                <Text style={styles.destLabel}>Destination book</Text>
                <Text style={styles.destVal}>{selectedCat.toBook?.name ?? '—'}</Text>
              </View>
              <View style={styles.transferNote}>
                <Ionicons name="information-circle-outline" size={13} color={theme.isDark ? '#6EE7B7' : '#0F6E56'} />
                <Text style={styles.transferNoteText}>Not counted as income or expense</Text>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          {/* Date & time */}
          <View style={styles.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time</Text>
              <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.label}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { height: 72, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              placeholder="Any extra details..."
              placeholderTextColor={theme.textMuted}
              multiline
            />
          </View>

          {/* Error message banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, mode === 'income' ? styles.saveBtnInc : styles.saveBtnExp, saveMutation.isPending && { opacity: 0.7 }]}
            onPress={() => validate() && saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? <ActivityIndicator color={mode === 'income' ? (theme.isDark ? '#4ADE80' : '#27500A') : (theme.isDark ? '#F87171' : '#791F1F')} />
              : <Text style={[styles.saveBtnText, { color: mode === 'income' ? (theme.isDark ? '#4ADE80' : '#27500A') : (theme.isDark ? '#F87171' : '#791F1F') }]}>
                  {isEdit ? 'Update entry' : `Save ${mode}`}
                </Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: theme.bg },
    topbar:           { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 0.5, borderBottomColor: theme.headerBorder, paddingTop: 52, backgroundColor: theme.headerBg },
    tab:              { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
    tabInc:           { backgroundColor: theme.successBg },
    tabExp:           { backgroundColor: theme.dangerBg },
    tabText:          { fontSize: 13, fontWeight: '500', color: theme.textMuted },
    tabTextInc:       { color: theme.isDark ? '#4ADE80' : '#27500A' },
    tabTextExp:       { color: theme.isDark ? '#F87171' : '#791F1F' },
    closeBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    body:             { flex: 1, paddingHorizontal: 16 },
    uploadZone:       { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 10, padding: 20, alignItems: 'center', gap: 6, backgroundColor: theme.card, marginVertical: 14 },
    uploadTitle:      { fontSize: 13, fontWeight: '500', color: theme.text },
    uploadSub:        { fontSize: 11, color: theme.textMuted },
    uploadBtns:       { flexDirection: 'row', gap: 8, marginTop: 6 },
    uploadBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.cardInner },
    uploadBtnText:    { fontSize: 12, color: theme.textSecondary },
    billThumb:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.card, borderRadius: 10, padding: 10, marginVertical: 14, borderWidth: 0.5, borderColor: theme.border },
    thumbImg:         { width: 44, height: 56, borderRadius: 6, backgroundColor: theme.border },
    thumbInfo:        { flex: 1, gap: 4 },
    thumbName:        { fontSize: 12, fontWeight: '500', color: theme.text },
    scanRow:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
    scanText:         { fontSize: 11, color: theme.textMuted },
    autofillBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
    autofillText:     { fontSize: 10, color: theme.isDark ? '#6EE7B7' : '#085041', fontWeight: '500' },
    divider:          { height: 0.5, backgroundColor: theme.border, marginVertical: 14, marginHorizontal: -16 },
    field:            { marginBottom: 14 },
    label:            { fontSize: 10, fontWeight: '500', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
    input:            { borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: theme.inputBg, color: theme.text },
    inputFilled:      { backgroundColor: theme.isDark ? '#0D382B' : '#F0FBF6', borderColor: '#0F6E56' },
    amtRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
    currency:         { fontSize: 20, color: theme.textMuted },
    amtInput:         { flex: 1, borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 24, fontWeight: '600', backgroundColor: theme.inputBg, color: theme.text },
    comboTrigger:     { borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.inputBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    comboSelected:    { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    comboSelectedText:{ fontSize: 14, color: theme.text, flex: 1 },
    comboPlaceholder: { fontSize: 14, color: theme.textMuted, flex: 1 },
    catBadge:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
    catBadgeText:     { fontSize: 10, fontWeight: '500' },
    dropdown:         { borderWidth: 0.5, borderColor: theme.border, borderRadius: 10, backgroundColor: theme.cardInner, marginTop: 4 },
    searchRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: theme.border },
    catSearch:        { flex: 1, fontSize: 14, color: theme.text },
    dropSection:      { fontSize: 10, fontWeight: '500', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.card },
    dropItem:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border },
    dotSmall:         { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    dropItemText:     { flex: 1, fontSize: 14, color: theme.text },
    transferTag:      { backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 1 },
    transferTagText:  { fontSize: 9, color: theme.isDark ? '#6EE7B7' : '#085041' },
    createRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: theme.border },
    createIcon:       { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.primaryBg, alignItems: 'center', justifyContent: 'center' },
    createText:       { fontSize: 13, color: theme.primary },
    dropEmpty:        { fontSize: 13, color: theme.textMuted, textAlign: 'center', padding: 16 },
    pillRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill:             { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, borderWidth: 0.5, borderColor: theme.border, backgroundColor: theme.card },
    pillActive:       { backgroundColor: theme.badgeBg, borderColor: theme.primary },
    pillText:         { fontSize: 12, color: theme.textSecondary, textTransform: 'capitalize' },
    pillTextActive:   { color: theme.badgeText, fontWeight: '500' },
    destBox:          { backgroundColor: theme.isDark ? '#0F2C23' : '#E1F5EE', borderWidth: 0.5, borderColor: '#0F6E56', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    destLabel:        { fontSize: 12, color: theme.isDark ? '#6EE7B7' : '#085041' },
    destVal:          { fontSize: 14, fontWeight: '500', color: theme.isDark ? '#6EE7B7' : '#085041' },
    transferNote:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    transferNoteText: { fontSize: 11, color: theme.isDark ? '#6EE7B7' : '#0F6E56' },
    dateRow:          { flexDirection: 'row', marginBottom: 14 },
    saveBtn:          { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    saveBtnInc:       { backgroundColor: theme.successBg },
    saveBtnExp:       { backgroundColor: theme.dangerBg },
    saveBtnText:      { fontSize: 15, fontWeight: '500' },
    errorBox:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.dangerBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
    errorText:        { color: theme.danger, fontSize: 13 },
  })
}
