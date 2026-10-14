// apps/mobile/app/settings/backup.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSettingsStore, BackupItem } from '../../lib/store/settings'
import { useBooksStore } from '../../lib/store/books'

export default function BackupScreen() {
  const router = useRouter()
  const { books } = useBooksStore()
  const {
    autoBackup, setAutoBackup,
    lastBackupTime, backups,
    createBackup, restoreBackup, deleteBackup,
  } = useSettingsStore()

  const [backingUp, setBackingUp] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [wifiOnly, setWifiOnly] = useState(true)

  async function handleBackupNow() {
    setBackingUp(true)
    try {
      // Simulate backup snapshot creation
      await new Promise(r => setTimeout(r, 1200))
      const backup = await createBackup('manual', {
        booksCount: books.length,
        entriesCount: books.length * 15,
      })
      Alert.alert(
        'Backup Successful',
        `Created snapshot "${backup.timestamp}" (${backup.size}). Your ledger is safely archived.`
      )
    } catch {
      Alert.alert('Backup Error', 'Failed to generate data snapshot.')
    } finally {
      setBackingUp(false)
    }
  }

  function handleRestore(item: BackupItem) {
    Alert.alert(
      'Restore Backup?',
      `This will restore data from "${item.timestamp}". Entries created after this snapshot may be overwritten.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setRestoringId(item.id)
            try {
              await restoreBackup(item.id)
              Alert.alert('Restore Complete', 'Your books and entries have been restored successfully.')
            } finally {
              setRestoringId(null)
            }
          },
        },
      ]
    )
  }

  function handleDelete(item: BackupItem) {
    Alert.alert(
      'Delete Backup Snapshot?',
      `Are you sure you want to remove the snapshot from ${item.timestamp}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBackup(item.id),
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data & Backup</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusIconBox}>
            <Ionicons name="cloud-done-outline" size={24} color="#0F6E56" />
          </View>
          <Text style={styles.statusTitle}>Encrypted Cloud & Local Backup</Text>
          <Text style={styles.statusSubtitle}>
            {lastBackupTime ? `Last successful backup: ${lastBackupTime}` : 'No backups created yet'}
          </Text>

          <TouchableOpacity
            style={[styles.backupNowBtn, backingUp && { opacity: 0.7 }]}
            disabled={backingUp}
            onPress={handleBackupNow}
          >
            {backingUp ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                <Text style={styles.backupNowBtnText}>Back Up Now</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Settings group */}
        <Text style={styles.secLabel}>Preferences</Text>
        <View style={styles.group}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.rowIcon, { backgroundColor: '#E1F5EE' }]}>
              <Ionicons name="sync-outline" size={16} color="#0F6E56" />
            </View>
            <View style={styles.rowMid}>
              <Text style={styles.rowLabel}>Auto daily backup</Text>
              <Text style={styles.rowDesc}>Automatically snapshot books once per day</Text>
            </View>
            <Switch
              value={autoBackup}
              onValueChange={setAutoBackup}
              trackColor={{ true: '#1D9E75' }}
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: '#E6F1FB' }]}>
              <Ionicons name="wifi-outline" size={16} color="#185FA5" />
            </View>
            <View style={styles.rowMid}>
              <Text style={styles.rowLabel}>Wi-Fi only</Text>
              <Text style={styles.rowDesc}>Avoid mobile data when uploading cloud snapshots</Text>
            </View>
            <Switch
              value={wifiOnly}
              onValueChange={setWifiOnly}
              trackColor={{ true: '#1D9E75' }}
            />
          </View>
        </View>

        {/* Backup Snapshots History */}
        <Text style={styles.secLabel}>Saved Snapshots ({backups.length})</Text>
        {backups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No saved backups found</Text>
          </View>
        ) : (
          <View style={styles.group}>
            {backups.map((item, idx) => {
              const isLast = idx === backups.length - 1
              const isRestoring = restoringId === item.id
              return (
                <View key={item.id} style={[styles.row, !isLast && styles.rowBorder]}>
                  <View style={[styles.rowIcon, { backgroundColor: item.type === 'auto' ? '#E1F5EE' : '#FAEEDA' }]}>
                    <Ionicons
                      name={item.type === 'auto' ? 'time-outline' : 'save-outline'}
                      size={16}
                      color={item.type === 'auto' ? '#0F6E56' : '#854F0B'}
                    />
                  </View>
                  <View style={styles.rowMid}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.rowLabel}>{item.timestamp}</Text>
                      <View style={[styles.typeBadge, item.type === 'auto' ? styles.typeBadgeAuto : styles.typeBadgeManual]}>
                        <Text style={[styles.typeBadgeText, item.type === 'auto' ? styles.typeBadgeTextAuto : styles.typeBadgeTextManual]}>
                          {item.type}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowDesc}>
                      {item.size} · {item.booksCount} books · {item.entriesCount} entries
                    </Text>
                  </View>
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      disabled={isRestoring}
                      onPress={() => handleRestore(item)}
                    >
                      {isRestoring ? (
                        <ActivityIndicator size="small" color="#185FA5" />
                      ) : (
                        <Text style={styles.restoreBtnText}>Restore</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.trashBtn}
                      onPress={() => handleDelete(item)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#791F1F" />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Security Notice */}
        <View style={styles.securityBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#0F6E56" />
          <Text style={styles.securityText}>
            All backups are encrypted before storage. Passwords and sensitive auth tokens are never included in exported backups.
          </Text>
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

  statusCard:   { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 20 },
  statusIconBox:{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E1F5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statusTitle:  { fontSize: 14, fontWeight: '600', color: '#2C2C2A' },
  statusSubtitle: { fontSize: 11, color: '#888', marginTop: 3, marginBottom: 14 },
  backupNowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F6E56', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  backupNowBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  secLabel:     { fontSize: 10, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, marginBottom: 20, overflow: 'hidden' },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  rowIcon:      { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowMid:       { flex: 1 },
  rowLabel:     { fontSize: 13, color: '#2C2C2A' },
  rowDesc:      { fontSize: 11, color: '#888', marginTop: 2 },

  typeBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  typeBadgeAuto:{ backgroundColor: '#E1F5EE' },
  typeBadgeManual: { backgroundColor: '#FAEEDA' },
  typeBadgeText:{ fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  typeBadgeTextAuto: { color: '#0F6E56' },
  typeBadgeTextManual: { color: '#854F0B' },

  actionsRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restoreBtn:   { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#185FA5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  restoreBtnText: { color: '#185FA5', fontSize: 11, fontWeight: '600' },
  trashBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FCEBEB', alignItems: 'center', justifyContent: 'center' },

  emptyCard:    { backgroundColor: '#F2F1EB', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20 },
  emptyText:    { fontSize: 12, color: '#888' },

  securityBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EAF3DE', borderRadius: 10, padding: 12 },
  securityText: { flex: 1, fontSize: 11, lineHeight: 16, color: '#27500A' },
})
