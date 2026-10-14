// apps/mobile/app/settings/privacy.tsx
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

export default function PrivacyScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Shield summary card */}
        <View style={styles.shieldCard}>
          <View style={styles.shieldIconBox}>
            <Ionicons name="shield-checkmark" size={24} color="#0F6E56" />
          </View>
          <Text style={styles.shieldTitle}>Privacy-First Architecture</Text>
          <Text style={styles.shieldSubtitle}>
            CashBook never sells your financial data, injects advertising trackers, or trains public AI models on your private books.
          </Text>
        </View>

        {/* Section 1 */}
        <Text style={styles.secLabel}>1. Data Storage & Ownership</Text>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            You retain complete ownership of all ledger entries, categories, receipt images, and books created within CashBook. Your data is stored in your private PostgreSQL instance and your local device cache.
          </Text>
        </View>

        {/* Section 2 */}
        <Text style={styles.secLabel}>2. Document OCR & Receipt Reading</Text>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            When you scan a receipt, the document image is processed solely to extract transaction amounts, merchant names, and calendar dates. OCR processing extracts numeric totals and does not index biometric or personal identity markers.
          </Text>
        </View>

        {/* Section 3 */}
        <Text style={styles.secLabel}>3. Explainable AI & Boundaries</Text>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            Spending patterns, median absolute deviation (MAD) baselines, and monthly forecast insights are computed deterministically via local database queries.
          </Text>
          <Text style={[styles.paragraph, { marginTop: 8 }]}>
            Optional AI ranking requires explicit, per-request consent. When triggered, only anonymized numeric totals and statistical evidence are submitted — merchant names, receipt images, and personal notes are strictly excluded.
          </Text>
        </View>

        {/* Section 4 */}
        <Text style={styles.secLabel}>4. Authentication & Keychain Security</Text>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            Authentication relies on purpose-checked JSON Web Tokens (JWT). Access tokens and refresh tokens are securely stored using native device hardware security (iOS Keychain and Android Keystore via Expo SecureStore).
          </Text>
        </View>

        {/* Section 5 */}
        <Text style={styles.secLabel}>5. Your Rights & Data Portability</Text>
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            You can export your complete ledger history at any time in Excel (.xlsx), PDF, CSV, or raw JSON formats under Settings &gt; Export all books.
          </Text>
          <Text style={[styles.paragraph, { marginTop: 8 }]}>
            You have the right to permanently delete specific entries, archive books, or clear all data. Deleted records are scrubbed and cannot be recovered.
          </Text>
        </View>

        {/* Last updated footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Policy version 1.0.0 · Effective October 2026</Text>
          <Text style={styles.footerText}>CashBook — Explainable Multi-Book Ledger</Text>
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

  shieldCard:   { backgroundColor: '#E1F5EE', borderWidth: 0.5, borderColor: '#B5E8D5', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 20 },
  shieldIconBox:{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  shieldTitle:  { fontSize: 15, fontWeight: '600', color: '#0F6E56' },
  shieldSubtitle: { fontSize: 11, color: '#0F6E56', textAlign: 'center', marginTop: 4, lineHeight: 16 },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginLeft: 4 },
  card:         { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, padding: 14, marginBottom: 16 },
  paragraph:    { fontSize: 12, lineHeight: 18, color: '#444' },

  footer:       { alignItems: 'center', marginTop: 12, marginBottom: 20 },
  footerText:   { fontSize: 11, color: '#888', marginTop: 2 },
})
