// apps/mobile/app/tabs/settings.tsx
import { useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../lib/store/auth'
import { useSettingsStore } from '../../lib/store/settings'
import { useAppTheme, ThemeColors } from '../../lib/theme'
import { api } from '../../lib/api/client'
import { useQueryClient } from '@tanstack/react-query'

interface RowProps {
  icon:       string
  iconBg:     string
  iconColor:  string
  label:      string
  desc?:      string
  right?:     React.ReactNode
  onPress?:   () => void
  danger?:    boolean
  last?:      boolean
  theme:      ThemeColors
}

function Row({ icon, iconBg, iconColor, label, desc, right, onPress, danger, last, theme }: RowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        !last && { borderBottomWidth: 0.5, borderBottomColor: theme.rowBorder }
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: theme.isDark ? theme.rowIconBg : iconBg }]}>
        <Ionicons name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.rowMid}>
        <Text style={[styles.rowLabel, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
        {desc ? <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text> : null}
      </View>
      {right !== undefined ? right : (
        onPress ? <Ionicons name="chevron-forward-outline" size={14} color={theme.isDark ? '#666' : '#ccc'} /> : null
      )}
    </TouchableOpacity>
  )
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const theme = useAppTheme()

  const {
    currency, currencyName,
    dateFormat, timeFormat,
    dailyReminder, setDailyReminder,
    reminderTime,
    darkMode, setDarkMode,
    themeColor, themeName,
    autoBackup, setAutoBackup,
    lastBackupTime,
    loadSettings,
  } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [])

  function handleLogout() {
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ])
  }

  function handleClearAll() {
    Alert.alert(
      'Clear all entries?',
      'This permanently deletes all transactions in all of your books. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.get('/entries?limit=500')
              const entries = res.data?.items ?? []
              for (const e of entries) {
                await api.delete(`/entries/${e.id}`).catch(() => {})
              }
              qc.clear()
              Alert.alert('Cleared', 'All recorded entries have been removed.')
            } catch {
              Alert.alert('Notice', 'Unable to clear entries at this time.')
            }
          },
        },
      ]
    )
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? 'CB'

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <TouchableOpacity
          style={[
            styles.profileCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder }
          ]}
          onPress={() => router.push('/settings/profile')}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: theme.isDark ? '#263445' : '#E6F1FB', borderColor: theme.isDark ? '#3B82F6' : '#B5D4F4' }]}>
            <Text style={[styles.avatarText, { color: theme.isDark ? '#93C5FD' : '#0C447C' }]}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: theme.text }]}>{user?.name ?? 'User'}</Text>
            <Text style={[styles.profileEmail, { color: theme.textMuted }]}>{user?.email ?? ''}</Text>
          </View>
          <Ionicons name="chevron-forward-outline" size={16} color={theme.isDark ? '#666' : '#ccc'} />
        </TouchableOpacity>

        {/* General */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>General</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="cash-outline"
            iconBg="#EAF3DE"
            iconColor="#27500A"
            label="Default currency"
            desc={`${currency} — ${currencyName}`}
            onPress={() => router.push('/settings/currency')}
            theme={theme}
          />
          <Row
            icon="time-outline"
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            label="Date & time format"
            desc={`${dateFormat} · ${timeFormat}`}
            onPress={() => router.push('/settings/date-format')}
            theme={theme}
          />
          <Row
            icon="notifications-outline"
            iconBg="#FAEEDA"
            iconColor="#854F0B"
            label="Daily reminder"
            desc="Remind me to log entries"
            right={<Switch value={dailyReminder} onValueChange={setDailyReminder} trackColor={{ true: '#1D9E75' }} />}
            theme={theme}
          />
          <Row
            icon="alarm-outline"
            iconBg="#FAEEDA"
            iconColor="#854F0B"
            label="Reminder time"
            desc={reminderTime}
            onPress={() => router.push('/settings/reminder-time')}
            last
            theme={theme}
          />
        </View>

        {/* Categories */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Categories</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="arrow-up-circle-outline"
            iconBg="#FCEBEB"
            iconColor="#791F1F"
            label="Expense categories"
            desc="Manage your expense labels"
            right={<View style={[styles.badge, { backgroundColor: theme.badgeBg }]}><Text style={[styles.badgeText, { color: theme.badgeText }]}>manage</Text></View>}
            onPress={() => router.push('/settings/categories?mode=expense')}
            theme={theme}
          />
          <Row
            icon="arrow-down-circle-outline"
            iconBg="#EAF3DE"
            iconColor="#27500A"
            label="Income categories"
            desc="Manage your income labels"
            right={<View style={[styles.badge, { backgroundColor: theme.badgeBg }]}><Text style={[styles.badgeText, { color: theme.badgeText }]}>manage</Text></View>}
            onPress={() => router.push('/settings/categories?mode=income')}
            theme={theme}
          />
          <Row
            icon="swap-horizontal-outline"
            iconBg="#E1F5EE"
            iconColor="#0F6E56"
            label="Transfer categories"
            desc="Auto-generated — view only"
            right={<View style={[styles.badge, { backgroundColor: theme.badgeBg }]}><Text style={[styles.badgeText, { color: theme.badgeText }]}>view</Text></View>}
            onPress={() => router.push('/settings/categories?mode=transfer')}
            last
            theme={theme}
          />
        </View>

        {/* Appearance */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Appearance</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="moon-outline"
            iconBg="#EEEDFE"
            iconColor="#534AB7"
            label="Dark mode"
            desc={darkMode ? 'Dark interface enabled' : 'Light warm theme active'}
            right={<Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ true: '#1D9E75' }} />}
            theme={theme}
          />
          <Row
            icon="color-palette-outline"
            iconBg="#FBEAF0"
            iconColor="#993556"
            label="App theme"
            desc={themeName}
            right={<View style={[styles.colorSwatch, { backgroundColor: themeColor, borderColor: theme.border }]} />}
            onPress={() => router.push('/settings/theme')}
            last
            theme={theme}
          />
        </View>

        {/* Data */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Data & backup</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="cloud-upload-outline"
            iconBg="#E1F5EE"
            iconColor="#0F6E56"
            label="Auto backup"
            desc="Daily backup to cloud"
            right={<Switch value={autoBackup} onValueChange={setAutoBackup} trackColor={{ true: '#1D9E75' }} />}
            theme={theme}
          />
          <Row
            icon="save-outline"
            iconBg="#E1F5EE"
            iconColor="#0F6E56"
            label="Back up now"
            desc={lastBackupTime ? `Last: ${lastBackupTime}` : 'Tap to create snapshot'}
            onPress={() => router.push('/settings/backup')}
            theme={theme}
          />
          <Row
            icon="cloud-download-outline"
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            label="Restore backup"
            desc="Restore previous snapshot"
            onPress={() => router.push('/settings/backup')}
            theme={theme}
          />
          <Row
            icon="download-outline"
            iconBg="#FAEEDA"
            iconColor="#854F0B"
            label="Export all books"
            desc="Download as Excel, PDF or CSV"
            onPress={() => router.push('/settings/export')}
            last
            theme={theme}
          />
        </View>

        {/* Reports shortcut */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Reports</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="document-text-outline"
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            label="Create report"
            desc="Generate PDF or Excel"
            onPress={() => router.push('/reports')}
            theme={theme}
          />
          <Row
            icon="folder-open-outline"
            iconBg="#E6F1FB"
            iconColor="#185FA5"
            label="Saved reports"
            desc="View past statements"
            onPress={() => router.push('/reports')}
            last
            theme={theme}
          />
        </View>

        {/* About */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>About</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Row
            icon="information-circle-outline"
            iconBg="#F2F1EB"
            iconColor="#5F5E5A"
            label="App version"
            desc="Architecture & release notes"
            right={<View style={[styles.greenBadge, { backgroundColor: theme.successBg }]}><Text style={[styles.greenBadgeText, { color: theme.success }]}>v1.0.0</Text></View>}
            onPress={() => router.push('/settings/about')}
            theme={theme}
          />
          <Row
            icon="mail-outline"
            iconBg="#F2F1EB"
            iconColor="#5F5E5A"
            label="Contact support"
            desc="Help, FAQs & feedback"
            onPress={() => router.push('/settings/support')}
            theme={theme}
          />
          <Row
            icon="shield-outline"
            iconBg="#F2F1EB"
            iconColor="#5F5E5A"
            label="Privacy policy"
            desc="Data ownership & AI boundaries"
            onPress={() => router.push('/settings/privacy')}
            last
            theme={theme}
          />
        </View>

        {/* Danger zone */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Danger zone</Text>
        <View style={[styles.group, styles.dangerGroup, { backgroundColor: theme.card, borderColor: theme.isDark ? '#791F1F88' : '#F09595' }]}>
          <Row
            icon="trash-outline"
            iconBg="#FCEBEB"
            iconColor="#791F1F"
            label="Clear all entries"
            desc="Permanently delete all data"
            danger
            onPress={handleClearAll}
            theme={theme}
          />
          <Row
            icon="log-out-outline"
            iconBg="#FCEBEB"
            iconColor="#791F1F"
            label="Log out"
            danger
            onPress={handleLogout}
            last
            theme={theme}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5 },
  pageTitle:      { fontSize: 17, fontWeight: '500' },
  profileCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, margin: 16, padding: 14, borderWidth: 0.5, borderRadius: 14 },
  avatar:         { width: 48, height: 48, borderRadius: 24, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 18, fontWeight: '600' },
  profileName:    { fontSize: 14, fontWeight: '500' },
  profileEmail:   { fontSize: 11, marginTop: 2 },
  secLabel:       { fontSize: 10, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  group:          { borderWidth: 0.5, borderRadius: 12, marginHorizontal: 16, marginBottom: 20, overflow: 'hidden' },
  dangerGroup:    { borderColor: '#F09595' },
  row:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowIcon:        { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowMid:         { flex: 1 },
  rowLabel:       { fontSize: 13 },
  rowDesc:        { fontSize: 10, marginTop: 1 },
  badge:          { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText:      { fontSize: 10, fontWeight: '500' },
  greenBadge:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  greenBadgeText: { fontSize: 10, fontWeight: '500' },
  colorSwatch:    { width: 18, height: 18, borderRadius: 9, borderWidth: 0.5 },
})
