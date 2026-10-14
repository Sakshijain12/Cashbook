// apps/mobile/app/settings/about.tsx
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

const STACK_ITEMS = [
  { label: 'Mobile Core', value: 'React Native 0.74 · Expo SDK 51' },
  { label: 'Navigation',  value: 'Expo Router (File-based navigation)' },
  { label: 'State & Cache', value: 'Zustand & TanStack Query' },
  { label: 'API Backend', value: 'Fastify 5 · TypeScript · Zod' },
  { label: 'Database',    value: 'PostgreSQL · Prisma 5' },
  { label: 'Document OCR',value: 'Google Cloud Vision · Sharp' },
  { label: 'Analytics',   value: 'SQL aggregates · MAD baseline · Heuristics' },
]

const HIGHLIGHTS = [
  'GitHub-style commit heat map for daily spendings & income intensity',
  'Multi-book ledgers with dual-entry internal transfers',
  'Bill & receipt OCR with grand total detection',
  'Full Excel (.xlsx) and PDF financial statements generation',
  'Explainable spending insights with optional AI prioritization',
]

export default function AboutScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About CashBook</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Brand Card */}
        <View style={styles.brandCard}>
          <View style={styles.logoBox}>
            <Ionicons name="wallet" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>CashBook</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>Version 1.0.0 (Release 2026.10)</Text>
          </View>
          <Text style={styles.appTagline}>
            Explainable Expense Tracking & Multi-Book Ledgers
          </Text>
        </View>

        {/* What's New */}
        <Text style={styles.secLabel}>What's New in v1.0.0</Text>
        <View style={styles.group}>
          {HIGHLIGHTS.map((h, i) => (
            <View key={i} style={[styles.highlightRow, i < HIGHLIGHTS.length - 1 && styles.rowBorder]}>
              <View style={styles.checkDot}>
                <Ionicons name="checkmark" size={12} color="#1D9E75" />
              </View>
              <Text style={styles.highlightText}>{h}</Text>
            </View>
          ))}
        </View>

        {/* Technical Architecture */}
        <Text style={styles.secLabel}>Technology Stack</Text>
        <View style={styles.group}>
          {STACK_ITEMS.map((item, idx) => {
            const isLast = idx === STACK_ITEMS.length - 1
            return (
              <View key={item.label} style={[styles.stackRow, !isLast && styles.rowBorder]}>
                <Text style={styles.stackLabel}>{item.label}</Text>
                <Text style={styles.stackVal}>{item.value}</Text>
              </View>
            )
          })}
        </View>

        {/* Open source & build */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Built with React Native & Expo</Text>
          <Text style={styles.footerText}>© 2026 CashBook. All rights reserved.</Text>
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

  brandCard:    { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  logoBox:      { width: 64, height: 64, borderRadius: 20, backgroundColor: '#185FA5', alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#185FA5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  appName:      { fontSize: 20, fontWeight: '700', color: '#2C2C2A' },
  versionBadge: { backgroundColor: '#EAF3DE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, marginTop: 6, marginBottom: 8 },
  versionBadgeText: { fontSize: 11, fontWeight: '600', color: '#27500A' },
  appTagline:   { fontSize: 12, color: '#666', textAlign: 'center' },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },

  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  checkDot:     { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center' },
  highlightText:{ flex: 1, fontSize: 12, color: '#333', lineHeight: 17 },

  stackRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14 },
  stackLabel:   { fontSize: 12, color: '#666' },
  stackVal:     { fontSize: 12, fontWeight: '500', color: '#2C2C2A', textAlign: 'right', flex: 1, marginLeft: 12 },

  footer:       { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  footerText:   { fontSize: 11, color: '#999', marginTop: 2 },
})
