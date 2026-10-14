// apps/mobile/app/tabs/index.tsx
import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, TextInput, SectionList, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useBooksStore } from '../../lib/store/books'
import {
  useEntriesStore, FilterType, Entry, SortBy, SortOrder,
  getPeriodLabel, isCurrentPeriod, parseLocalDate,
} from '../../lib/store/entries'
import { BookSelectorModal } from '../../components/ui/BookSelectorModal'
import { DateRangePickerModal } from '../../components/ui/DateRangePickerModal'
import { ThreeDotMenu } from '../../components/ui/ThreeDotMenu'
import { formatTime, useCurrencySymbol } from '../../lib/utils/format'
import { useAppTheme } from '../../lib/theme'

const FILTERS: FilterType[] = ['All', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom']

interface SectionItem {
  title:            string
  isAmountSection?: boolean
  data:             Entry[]
}

function buildSections(entries: Entry[], sortBy: SortBy, sortOrder: SortOrder): SectionItem[] {
  if (sortBy === 'amount') {
    if (entries.length === 0) return []
    const title = sortOrder === 'desc'
      ? 'AMOUNT · HIGHEST FIRST'
      : 'AMOUNT · LOWEST FIRST'
    return [{ title, isAmountSection: true, data: entries }]
  }

  const map = new Map<string, Entry[]>()
  for (const e of entries) {
    const d = e.entryDate.split('T')[0]
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(e)
  }
  return [...map.entries()].map(([date, data]) => ({
    title: date,
    isAmountSection: false,
    data,
  }))
}

function formatSectionDate(dateStr: string) {
  const d    = parseLocalDate(dateStr.split('T')[0])
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  return d.toLocaleDateString('en-GB', opts).toUpperCase()
}

function formatShortDate(dateStr: string) {
  const d    = parseLocalDate(dateStr.split('T')[0])
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  return d.toLocaleDateString('en-GB', opts)
}

export default function EntriesScreen() {
  const router           = useRouter()
  const theme            = useAppTheme()
  const { activeBook, setActiveBook, books, fetchBooks } = useBooksStore()
  const currencySymbol   = useCurrencySymbol(activeBook?.currency)
  const {
    entries, isLoading, filter, anchorDate, customDateRange, search,
    sortBy, sortOrder,
    setFilter, setSearch, setCustomDateRange, setSorting, toggleSort,
    fetchEntries, nextPeriod, prevPeriod, resetToToday,
  } = useEntriesStore()
  const [bookModal,          setBookModal]          = useState(false)
  const [calendarModalOpen,  setCalendarModalOpen]  = useState(false)
  const [searchOpen,         setSearchOpen]         = useState(false)

  useEffect(() => {
    fetchEntries(activeBook?.id)
    fetchBooks()
  }, [
    activeBook?.id, filter, anchorDate,
    customDateRange.startDate, customDateRange.endDate,
    search, sortBy, sortOrder,
  ])

  const sections = buildSections(entries, sortBy, sortOrder)

  const totalIncome  = entries.filter(e => ['INCOME', 'TRANSFER_IN'].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense = entries.filter(e => ['EXPENSE', 'TRANSFER_OUT'].includes(e.type)).reduce((s, e) => s + Number(e.amount), 0)
  const total        = totalIncome - totalExpense

  const menuItems = [
    {
      label:    'Sort by date',
      icon:     sortBy === 'date'
        ? (sortOrder === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline')
        : 'swap-vertical-outline',
      active:   sortBy === 'date',
      subtitle: sortBy === 'date'
        ? (sortOrder === 'desc' ? 'Newest first' : 'Oldest first')
        : undefined,
      onPress:  () => toggleSort('date'),
    },
    {
      label:    'Sort by amount',
      icon:     sortBy === 'amount'
        ? (sortOrder === 'desc' ? 'trending-down-outline' : 'trending-up-outline')
        : 'trending-up-outline',
      active:   sortBy === 'amount',
      subtitle: sortBy === 'amount'
        ? (sortOrder === 'desc' ? 'Highest first' : 'Lowest first')
        : undefined,
      onPress:  () => toggleSort('amount'),
    },
    { label: 'Create report',    icon: 'document-text-outline',  onPress: () => router.push('/reports') },
    { label: 'Saved reports',    icon: 'folder-open-outline',    onPress: () => router.push('/reports') },
    { label: 'Backup & restore', icon: 'cloud-upload-outline',   onPress: () => router.push('/tabs/settings') },
  ]

  const renderEntry = useCallback(({ item: e }: { item: Entry }) => {
    const isIncome   = ['INCOME', 'TRANSFER_IN'].includes(e.type)
    const isTransfer = ['TRANSFER_IN', 'TRANSFER_OUT'].includes(e.type)
    return (
      <TouchableOpacity
        style={[styles.entryRow, { borderBottomColor: theme.rowBorder }]}
        onPress={() => router.push(`/entry/${e.id}`)}
      >
        <View style={[styles.catIcon, { backgroundColor: (e.category?.color ?? '#888') + '22' }]}>
          <Ionicons
            name={isTransfer ? 'swap-horizontal-outline' : 'receipt-outline'}
            size={18}
            color={e.category?.color ?? '#888'}
          />
        </View>
        <View style={styles.entryMid}>
          <Text style={[styles.entryName, { color: theme.text }]} numberOfLines={1}>{e.name}</Text>
          <View style={styles.metaRow}>
            {sortBy === 'amount' ? (
              <View style={[styles.dateChip, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="calendar-outline" size={10} color={theme.primary} />
                <Text style={[styles.dateChipText, { color: theme.primaryText }]}>{formatShortDate(e.entryDate)}</Text>
              </View>
            ) : null}
            {isTransfer ? (
              <View style={[styles.transferChip, { backgroundColor: theme.isDark ? '#143823' : '#E1F5EE' }]}>
                <Text style={[styles.transferChipText, { color: theme.isDark ? '#86EFAC' : '#085041' }]}>transfer</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.entryMeta, { color: theme.textMuted }]}>{e.category?.name}</Text>
                {e.paymentMethod ? <Text style={[styles.entryMeta, { color: theme.textMuted }]}> · {e.paymentMethod.replace('_', ' ')}</Text> : null}
                {e.entryTime ? <Text style={[styles.entryMeta, { color: theme.textMuted }]}> · {formatTime(e.entryTime)}</Text> : null}
              </>
            )}
            {e.billUrl ? (
              <View style={[styles.billChip, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name="attach-outline" size={10} color={theme.primary} />
                <Text style={[styles.billChipText, { color: theme.primaryText }]}>bill</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.entryRight}>
          <Text style={[styles.entryAmt, { color: isIncome ? theme.success : theme.danger }]}>
            {isIncome ? '+' : '−'}{currencySymbol}{Number(e.amount).toLocaleString()}
          </Text>
          {e.billUrl ? (
            <View style={styles.receiptIcon}>
              <Ionicons name="receipt-outline" size={13} color={theme.primary} />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    )
  }, [router, sortBy, theme, currencySymbol])

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.bookSelector, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setBookModal(true)}
          >
            <Ionicons name="book-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.bookSelectorText, { color: theme.text }]} numberOfLines={1}>
              {activeBook?.name ?? 'Select book'}
            </Text>
            <Ionicons name="chevron-down-outline" size={12} color={theme.textMuted} />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setSearchOpen(v => !v)}
              style={[styles.hbtn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            >
              <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={18} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.hbtn,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
                filter === 'Custom' && { backgroundColor: theme.primaryBg, borderColor: theme.primary },
              ]}
              onPress={() => setCalendarModalOpen(true)}
              accessibilityLabel="Select custom date range"
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={filter === 'Custom' ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
            <ThreeDotMenu items={menuItems} />
          </View>
        </View>

        {searchOpen && (
          <TextInput
            style={[
              styles.searchInput,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            ]}
            placeholder="Search entries..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
          />
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.ftab,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
                filter === f && { backgroundColor: theme.primaryBg, borderColor: theme.primary },
              ]}
              onPress={() => {
                if (f === 'Custom') {
                  setCalendarModalOpen(true)
                } else {
                  setFilter(f)
                }
              }}
            >
              {f === 'Custom' && (
                <Ionicons
                  name="calendar-outline"
                  size={12}
                  color={filter === f ? theme.primaryText : theme.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.ftabText,
                  { color: theme.textSecondary },
                  filter === f && { color: theme.primaryText, fontWeight: '600' },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Period navigation bar: Previous / Period Name / Next */}
        <View style={[styles.periodBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[
              styles.periodBtn,
              { backgroundColor: theme.cardInner, borderColor: theme.cardBorder },
              filter === 'All' && styles.periodBtnDisabled,
            ]}
            onPress={prevPeriod}
            disabled={filter === 'All'}
            accessibilityLabel="Previous period"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={filter === 'All' ? theme.textMuted : theme.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.periodCenter}
            onPress={() => {
              if (filter === 'Custom') {
                setCalendarModalOpen(true)
              } else if (!isCurrentPeriod(filter, anchorDate, customDateRange)) {
                resetToToday()
              }
            }}
            disabled={filter === 'All'}
            activeOpacity={0.7}
          >
            {filter === 'Custom' && (
              <Ionicons name="calendar-outline" size={13} color={theme.primary} style={{ marginRight: 2 }} />
            )}
            <Text style={[styles.periodLabel, { color: theme.text }, filter === 'All' && { color: theme.textMuted }]}>
              {getPeriodLabel(filter, anchorDate, customDateRange)}
            </Text>
            {filter !== 'All' && !isCurrentPeriod(filter, anchorDate, customDateRange) && (
              <View style={[styles.todayBadge, { backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
                <Text style={[styles.todayBadgeText, { color: theme.primaryText }]}>Today</Text>
              </View>
            )}
            {filter === 'Custom' && (
              <Ionicons name="pencil-outline" size={12} color={theme.primary} style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodBtn,
              { backgroundColor: theme.cardInner, borderColor: theme.cardBorder },
              filter === 'All' && styles.periodBtnDisabled,
            ]}
            onPress={nextPeriod}
            disabled={filter === 'All'}
            accessibilityLabel="Next period"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={filter === 'All' ? theme.textMuted : theme.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Active sort bar if non-default sort is active */}
        {(sortBy === 'amount' || sortOrder === 'asc') && (
          <View style={[styles.sortBar, { backgroundColor: theme.primaryBg, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={styles.sortPill}
              onPress={() => toggleSort(sortBy)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  sortBy === 'amount'
                    ? (sortOrder === 'desc' ? 'trending-down' : 'trending-up')
                    : 'arrow-up'
                }
                size={13}
                color={theme.primary}
              />
              <Text style={[styles.sortPillText, { color: theme.primaryText }]}>
                {sortBy === 'amount'
                  ? `Amount: ${sortOrder === 'desc' ? 'Highest first' : 'Lowest first'}`
                  : 'Date: Oldest first'
                }
              </Text>
              <Text style={[styles.sortPillHint, { color: theme.primary }]}>Tap to reverse</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sortResetBtn}
              onPress={() => setSorting('date', 'desc')}
              accessibilityLabel="Reset sorting to default"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Entry list grouped by date or amount */}
      <SectionList
        sections={sections}
        keyExtractor={e => e.id}
        renderItem={renderEntry}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.card },
              section.isAmountSection && [styles.sectionHeaderAmount, { backgroundColor: theme.primaryBg }],
            ]}
          >
            {section.isAmountSection ? (
              <>
                <Ionicons
                  name={sortOrder === 'desc' ? 'trending-down-outline' : 'trending-up-outline'}
                  size={13}
                  color={theme.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.sectionHeaderTextAmount, { color: theme.primaryText }]}>{section.title}</Text>
              </>
            ) : (
              <Text style={[styles.sectionHeaderText, { color: theme.textMuted }]}>{formatSectionDate(section.title)}</Text>
            )}
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchEntries(activeBook?.id); fetchBooks() }} tintColor={theme.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={44} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>No entries yet</Text>
              <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>Tap + Income or − Expense to add your first entry</Text>
            </View>
          ) : null
        }
        stickySectionHeadersEnabled
      />

      {/* Summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
        <View style={styles.sumItem}>
          <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Income</Text>
          <Text style={[styles.sumVal, { color: theme.success }]}>{currencySymbol}{totalIncome.toLocaleString()}</Text>
        </View>
        <View style={[styles.sumItem, styles.sumItemBorder, { borderLeftColor: theme.cardBorder }]}>
          <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Expenses</Text>
          <Text style={[styles.sumVal, { color: theme.danger }]}>{currencySymbol}{totalExpense.toLocaleString()}</Text>
        </View>
        <View style={[styles.sumItem, styles.sumItemBorder, { borderLeftColor: theme.cardBorder }]}>
          <Text style={[styles.sumLabel, { color: theme.textMuted }]}>Total</Text>
          <Text style={[styles.sumVal, { color: total >= 0 ? theme.success : theme.danger }]}>
            {total < 0 ? '−' : ''}{currencySymbol}{Math.abs(total).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* FAB */}
      <View style={[styles.fabRow, { backgroundColor: theme.bg, borderTopColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.successBg }]}
          onPress={() => router.push({ pathname: '/entry/add', params: { mode: 'income' } })}
        >
          <Ionicons name="add-outline" size={18} color={theme.success} />
          <Text style={[styles.fabText, { color: theme.success }]}>Income</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.dangerBg }]}
          onPress={() => router.push({ pathname: '/entry/add', params: { mode: 'expense' } })}
        >
          <Ionicons name="remove-outline" size={18} color={theme.danger} />
          <Text style={[styles.fabText, { color: theme.danger }]}>Expense</Text>
        </TouchableOpacity>
      </View>

      <BookSelectorModal
        visible={bookModal}
        onClose={() => setBookModal(false)}
        onSelect={setActiveBook}
      />

      <DateRangePickerModal
        visible={calendarModalOpen}
        startDate={customDateRange.startDate}
        endDate={customDateRange.endDate}
        onClose={() => setCalendarModalOpen(false)}
        onApply={(range) => {
          setCustomDateRange(range)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#FAFAF8' },
  header:          { backgroundColor: '#FAFAF8', paddingHorizontal: 16, paddingTop: 52, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  headerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bookSelector:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', maxWidth: 180 },
  bookSelectorText:{ fontSize: 13, fontWeight: '500', color: '#2C2C2A' },
  headerActions:   { flexDirection: 'row', gap: 6 },
  hbtn:            { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', alignItems: 'center', justifyContent: 'center' },
  hbtnActive:      { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  searchInput:     { borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, fontSize: 14, backgroundColor: '#fff' },
  filterRow:       { flexDirection: 'row', gap: 6, paddingBottom: 8, paddingTop: 4 },
  ftab:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB' },
  ftabActive:      { backgroundColor: '#E6F1FB', borderColor: '#185FA5' },
  ftabText:        { fontSize: 11, color: '#6B6B68' },
  ftabTextActive:  { color: '#0C447C', fontWeight: '500' },
  periodBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, marginBottom: 10, backgroundColor: '#F2F1EB', borderRadius: 12, borderWidth: 0.5, borderColor: '#E0DED7' },
  periodBtn:       { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#E0DED7' },
  periodBtnDisabled:{ opacity: 0.35, backgroundColor: 'transparent', borderColor: 'transparent' },
  periodCenter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4, paddingHorizontal: 8 },
  periodLabel:     { fontSize: 13, fontWeight: '600', color: '#2C2C2A' },
  periodLabelAll:  { color: '#888780', fontWeight: '500' },
  todayBadge:      { backgroundColor: '#E6F1FB', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 0.5, borderColor: '#B5D4F4' },
  todayBadgeText:  { fontSize: 10, fontWeight: '600', color: '#185FA5' },
  sortBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: '#EBF3FB', borderRadius: 10, borderWidth: 0.5, borderColor: '#B5D4F4' },
  sortPill:         { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  sortPillText:     { fontSize: 11, fontWeight: '600', color: '#0C447C' },
  sortPillHint:     { fontSize: 10, color: '#185FA5', fontStyle: 'italic', marginLeft: 4 },
  sortResetBtn:     { padding: 2 },
  sectionHeader:   { backgroundColor: '#F2F1EB', paddingHorizontal: 16, paddingVertical: 6 },
  sectionHeaderText:{ fontSize: 11, fontWeight: '500', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHeaderAmount: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF3FB' },
  sectionHeaderTextAmount: { fontSize: 11, fontWeight: '600', color: '#0C447C', letterSpacing: 0.4 },
  listContent:     { paddingHorizontal: 16, paddingBottom: 8 },
  entryRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#EEEDE8' },
  catIcon:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entryMid:        { flex: 1, minWidth: 0 },
  entryName:       { fontSize: 13, fontWeight: '500', color: '#2C2C2A' },
  metaRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  dateChip:         { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E6F1FB', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginRight: 2 },
  dateChipText:     { fontSize: 9, color: '#0C447C', fontWeight: '500' },
  entryMeta:       { fontSize: 10, color: '#888780' },
  transferChip:    { backgroundColor: '#E1F5EE', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  transferChipText:{ fontSize: 9, color: '#085041', fontWeight: '500' },
  billChip:        { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E6F1FB', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  billChipText:    { fontSize: 9, color: '#185FA5' },
  entryRight:      { alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  entryAmt:        { fontSize: 13, fontWeight: '500' },
  receiptIcon:     { marginTop: 2 },
  empty:           { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyTitle:      { fontSize: 16, fontWeight: '500', color: '#aaa' },
  emptyDesc:       { fontSize: 13, color: '#bbb', textAlign: 'center', lineHeight: 20 },
  summaryBar:      { flexDirection: 'row', backgroundColor: '#F2F1EB', borderTopWidth: 0.5, borderTopColor: '#E0DED7', paddingVertical: 10 },
  sumItem:         { flex: 1, alignItems: 'center' },
  sumItemBorder:   { borderLeftWidth: 0.5, borderLeftColor: '#E0DED7' },
  sumLabel:        { fontSize: 10, color: '#888780', marginBottom: 2 },
  sumVal:          { fontSize: 13, fontWeight: '500' },
  fabRow:          { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FAFAF8', borderTopWidth: 0.5, borderTopColor: '#E0DED7' },
  fab:             { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  fabInc:          { backgroundColor: '#EAF3DE' },
  fabExp:          { backgroundColor: '#FCEBEB' },
  fabText:         { fontSize: 13, fontWeight: '500' },
})
