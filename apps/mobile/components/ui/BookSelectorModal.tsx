// apps/mobile/components/ui/BookSelectorModal.tsx
import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api/client'
import { BottomSheet } from './BottomSheet'
import { useBooksStore, Book } from '../../lib/store/books'
import { useCurrencySymbol, getCurrencySymbol } from '../../lib/utils/format'
import { useAppTheme } from '../../lib/theme'

interface Props {
  visible:  boolean
  onClose:  () => void
  onSelect: (book: Book) => void
}

export function BookSelectorModal({ visible, onClose, onSelect }: Props) {
  const theme = useAppTheme()
  const defaultSymbol = useCurrencySymbol()
  const { books: storeBooks, activeBook, fetchBooks } = useBooksStore()

  const { data: queryBooks, isLoading, refetch } = useQuery({
    queryKey: ['books'],
    queryFn:  () => api.get('/books').then(r => r.data),
  })

  useEffect(() => {
    if (visible) {
      void refetch()
      void fetchBooks()
    }
  }, [visible])

  const books: Book[] = (queryBooks && queryBooks.length > 0) ? queryBooks : storeBooks

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={0.55}>
      <View style={[styles.header, { borderBottomColor: theme.rowBorder }]}>
        <Text style={[styles.title, { color: theme.text }]}>Select book</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close-outline" size={22} color={theme.textMuted} />
        </TouchableOpacity>
      </View>
      <FlatList
        style={styles.flatList}
        data={books}
        keyExtractor={b => b.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>Loading books...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No books found</Text>
            </View>
          )
        }
        renderItem={({ item: b }) => {
          const isSelected = activeBook?.id === b.id
          return (
            <TouchableOpacity
              style={[
                styles.bookRow,
                { backgroundColor: theme.card },
                isSelected && { backgroundColor: theme.primaryBg, borderWidth: 1, borderColor: theme.primary }
              ]}
              onPress={() => { onSelect(b); onClose() }}
            >
              <View style={[styles.bookIcon, { backgroundColor: (b.color || theme.primary) + '22' }]}>
                <Ionicons name="book-outline" size={18} color={b.color || theme.primary} />
              </View>
              <View style={styles.bookInfo}>
                <Text style={[styles.bookName, { color: theme.text }]}>{b.name}</Text>
                <Text style={[styles.bookType, { color: theme.textMuted }]}>{b.type}</Text>
              </View>
              <View style={styles.bookRight}>
                <Text style={[styles.bookBalance, { color: (b.balance ?? 0) >= 0 ? theme.success : theme.danger }]}>
                  {((b.currency && b.currency !== 'JPY') ? getCurrencySymbol(b.currency) : defaultSymbol)}{Math.abs(b.balance ?? 0).toLocaleString()}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                )}
              </View>
            </TouchableOpacity>
          )
        }}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  title:          { fontSize: 15, fontWeight: '500', color: '#2C2C2A' },
  closeBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  flatList:       { flex: 1, minHeight: 0, width: '100%' },
  list:           { padding: 8, flexGrow: 1 },
  emptyContainer: { padding: 32, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:      { fontSize: 13, color: '#888' },
  bookRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 4 },
  bookRowActive:  { backgroundColor: '#E6F1FB' },
  bookIcon:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookInfo:       { flex: 1 },
  bookName:       { fontSize: 14, fontWeight: '500', color: '#2C2C2A' },
  bookType:       { fontSize: 11, color: '#888780', marginTop: 2, textTransform: 'capitalize' },
  bookRight:      { alignItems: 'flex-end', gap: 4 },
  bookBalance:    { fontSize: 13, fontWeight: '500' },
})
