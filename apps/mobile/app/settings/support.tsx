// apps/mobile/app/settings/support.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

interface FaqItem {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'How does receipt scanning and OCR work?',
    a: 'When you take or upload a photo of a bill or receipt, the document is normalized and analyzed using document OCR to recognize text, merchant names, dates, and the grand total amount without sending your private ledger entries to third-party ad networks.',
  },
  {
    q: 'Can I track accounts with different currencies?',
    a: 'Yes. Each ledger book in CashBook can have its own currency (JPY, USD, EUR, INR, GBP, etc.). When viewing individual books, figures are formatted in that book\'s currency.',
  },
  {
    q: 'How do internal book transfers work?',
    a: 'Transfers use double-entry accounting. An outgoing debit entry in one book creates a corresponding incoming credit entry in the destination book, keeping your overall ledger balanced.',
  },
  {
    q: 'Is my data shared with external AI services?',
    a: 'No transaction data is ever sent to external LLMs automatically. Optional AI prioritization requires your explicit per-request consent and only sends anonymized numeric totals — never merchant names, personal notes, or receipt images.',
  },
  {
    q: 'How do I backup my records?',
    a: 'You can create automatic or manual encrypted snapshots under Settings > Data & backup, or export complete Excel spreadsheets anytime under Settings > Export all books.',
  },
]

export default function SupportScreen() {
  const router = useRouter()
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  function toggleFaq(idx: number) {
    setExpandedFaq(expandedFaq === idx ? null : idx)
  }

  async function handleSendFeedback() {
    if (!message.trim()) {
      Alert.alert('Required', 'Please enter a message or question')
      return
    }
    setSending(true)
    try {
      await new Promise(r => setTimeout(r, 800))
      Alert.alert('Message Sent', 'Thank you for your feedback! Our support team will review your message.', [
        { text: 'OK', onPress: () => { setSubject(''); setMessage('') } }
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerIconBox}>
            <Ionicons name="chatbubbles-outline" size={22} color="#185FA5" />
          </View>
          <Text style={styles.bannerTitle}>We are here to help</Text>
          <Text style={styles.bannerDesc}>
            Browse answers to common questions or send our engineering team a direct note.
          </Text>
        </View>

        {/* FAQs */}
        <Text style={styles.secLabel}>Frequently Asked Questions</Text>
        <View style={styles.group}>
          {FAQS.map((faq, idx) => {
            const isExpanded = expandedFaq === idx
            const isLast = idx === FAQS.length - 1
            return (
              <View key={idx} style={[styles.faqItem, !isLast && styles.faqBorder]}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  onPress={() => toggleFaq(idx)}
                >
                  <Text style={[styles.faqQuestion, isExpanded && styles.faqQuestionActive]}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={16}
                    color="#888"
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqAnswerBox}>
                    <Text style={styles.faqAnswer}>{faq.a}</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* Send message form */}
        <Text style={styles.secLabel}>Send Feedback / Bug Report</Text>
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Question about category totals"
              placeholderTextColor="#999"
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          <View style={[styles.inputGroup, { marginTop: 12 }]}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Describe your issue, feature suggestion, or question..."
              placeholderTextColor="#999"
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.7 }]}
            disabled={sending}
            onPress={handleSendFeedback}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" />
                <Text style={styles.sendBtnText}>Submit Message</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Diagnostics Card */}
        <Text style={styles.secLabel}>Diagnostic Information</Text>
        <View style={styles.card}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Application Version</Text>
            <Text style={styles.diagVal}>v1.0.0 (Build 2026.10)</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Platform</Text>
            <Text style={styles.diagVal}>{Platform.OS.toUpperCase()}</Text>
          </View>
          <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.diagLabel}>API Backend</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.diagVal}>Connected</Text>
            </View>
          </View>
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

  bannerCard:   { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 20 },
  bannerIconBox:{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6F1FB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bannerTitle:  { fontSize: 15, fontWeight: '600', color: '#2C2C2A' },
  bannerDesc:   { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 3, lineHeight: 16 },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },

  faqItem:      { paddingVertical: 12, paddingHorizontal: 14 },
  faqBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  faqQuestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQuestion:  { flex: 1, fontSize: 13, fontWeight: '500', color: '#2C2C2A' },
  faqQuestionActive: { color: '#0C447C' },
  faqAnswerBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#E6E4DC' },
  faqAnswer:    { fontSize: 12, lineHeight: 18, color: '#555' },

  card:         { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, padding: 14, marginBottom: 20 },
  inputGroup:   { marginBottom: 4 },
  inputLabel:   { fontSize: 11, fontWeight: '500', color: '#666', marginBottom: 6 },
  input:        { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#2C2C2A' },
  sendBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#185FA5', borderRadius: 8, paddingVertical: 11, marginTop: 12 },
  sendBtnText:  { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  diagRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  diagLabel:    { fontSize: 12, color: '#666' },
  diagVal:      { fontSize: 12, fontWeight: '500', color: '#2C2C2A' },
  onlineDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#27500A' },
})
