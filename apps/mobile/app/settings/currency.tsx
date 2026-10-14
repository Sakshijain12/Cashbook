// apps/mobile/app/settings/currency.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { api } from '../../lib/api/client'
import { useBooksStore } from '../../lib/store/books'
import { useSettingsStore } from '../../lib/store/settings'

interface CurrencyItem {
  code:   string
  symbol: string
  name:   string
  region: string
}

const CURRENCIES: CurrencyItem[] = [
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',          region: 'Japan' },
  { code: 'USD', symbol: '$',   name: 'United States Dollar',  region: 'United States' },
  { code: 'EUR', symbol: '€',   name: 'Euro',                  region: 'European Union' },
  { code: 'GBP', symbol: '£',   name: 'British Pound',         region: 'United Kingdom' },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee',          region: 'India' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar',       region: 'Canada' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',     region: 'Australia' },
  { code: 'SGD', symbol: 'S$',  name: 'Singapore Dollar',      region: 'Singapore' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc',           region: 'Switzerland' },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan',          region: 'China' },
  { code: 'KRW', symbol: '₩',   name: 'South Korean Won',      region: 'South Korea' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar',    region: 'New Zealand' },
  { code: 'SEK', symbol: 'kr',  name: 'Swedish Krona',         region: 'Sweden' },
  { code: 'THB', symbol: '฿',   name: 'Thai Baht',             region: 'Thailand' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham',            region: 'United Arab Emirates' },
  { code: 'MXN', symbol: '$',   name: 'Mexican Peso',          region: 'Mexico' },
  { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real',        region: 'Brazil' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar',      region: 'Hong Kong' },
]

export default function CurrencyScreen() {
  const router = useRouter()
  const { currency, setCurrency } = useSettingsStore()
  const [search, setSearch] = useState('')

  const filtered = CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSelect(c: CurrencyItem) {
    await setCurrency(c.code, c.name)
    try {
      const books = useBooksStore.getState().books
      if (Array.isArray(books) && books.length > 0) {
        for (const b of books) {
          api.patch(`/books/${b.id}`, { currency: c.code }).catch(() => {})
        }
        await useBooksStore.getState().fetchBooks()
      }
    } catch {}
    Alert.alert('Default Currency Set', `Default currency updated to ${c.code} (${c.name}).`, [
      { text: 'Done', onPress: () => router.back() }
    ])
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Default Currency</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search currency code or country..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#185FA5" />
          <Text style={styles.infoText}>
            This sets the default currency when creating new ledger books. Existing books retain their assigned currency.
          </Text>
        </View>

        {/* Currency list */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          <Text style={styles.secLabel}>Currencies ({filtered.length})</Text>
          <View style={styles.group}>
            {filtered.map((item, idx) => {
              const isSelected = item.code === currency
              const isLast = idx === filtered.length - 1
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.row, !isLast && styles.rowBorder, isSelected && styles.rowActive]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={[styles.symbolBadge, isSelected && styles.symbolBadgeActive]}>
                    <Text style={[styles.symbolText, isSelected && styles.symbolTextActive]}>
                      {item.symbol}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.codeText, isSelected && styles.codeTextActive]}>
                        {item.code}
                      </Text>
                      <Text style={styles.regionText}>· {item.region}</Text>
                    </View>
                    <Text style={styles.nameText}>{item.name}</Text>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkIcon}>
                      <Ionicons name="checkmark-circle" size={20} color="#185FA5" />
                    </View>
                  ) : (
                    <View style={styles.uncheckIcon} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FAFAF8' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7', backgroundColor: '#FAFAF8' },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '500', color: '#2C2C2A' },
  body:         { flex: 1, padding: 16 },

  searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput:  { flex: 1, fontSize: 13, color: '#2C2C2A' },

  infoBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#E6F1FB', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText:     { flex: 1, fontSize: 11, lineHeight: 16, color: '#0C447C' },

  list:         { flex: 1 },
  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, overflow: 'hidden' },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  rowActive:    { backgroundColor: '#F0F6FD' },

  symbolBadge:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E0DED7', alignItems: 'center', justifyContent: 'center' },
  symbolBadgeActive: { backgroundColor: '#185FA5' },
  symbolText:   { fontSize: 14, fontWeight: '600', color: '#555' },
  symbolTextActive: { color: '#FFFFFF' },

  codeText:     { fontSize: 14, fontWeight: '600', color: '#2C2C2A' },
  codeTextActive: { color: '#0C447C' },
  regionText:   { fontSize: 11, color: '#888' },
  nameText:     { fontSize: 11, color: '#666', marginTop: 2 },

  checkIcon:    { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  uncheckIcon:  { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#D0CEC6' },
})
