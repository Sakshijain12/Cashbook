// apps/mobile/app/settings/theme.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSettingsStore } from '../../lib/store/settings'
import { useAppTheme } from '../../lib/theme'

interface ThemeColorOption {
  id:    string
  name:  string
  color: string
  bg:    string
  desc:  string
}

const THEME_COLORS: ThemeColorOption[] = [
  { id: '#185FA5', name: 'Classic Blue',   color: '#185FA5', bg: '#E6F1FB', desc: 'Default CashBook clean blue' },
  { id: '#0F6E56', name: 'Forest Emerald', color: '#0F6E56', bg: '#E1F5EE', desc: 'Natural rich financial green' },
  { id: '#791F1F', name: 'Crimson Berry',  color: '#791F1F', bg: '#FCEBEB', desc: 'Sophisticated deep crimson' },
  { id: '#534AB7', name: 'Royal Indigo',   color: '#534AB7', bg: '#EEEDFE', desc: 'Modern and vibrant purple' },
  { id: '#854F0B', name: 'Warm Amber',     color: '#854F0B', bg: '#FAEEDA', desc: 'Warm earthy autumnal tones' },
  { id: '#D85A30', name: 'Sunset Coral',   color: '#D85A30', bg: '#FAECE7', desc: 'Energetic warm terracotta' },
  { id: '#2C2C2A', name: 'Midnight Slate', color: '#2C2C2A', bg: '#EAE8E1', desc: 'Monochrome minimalist aesthetic' },
  { id: '#D4537E', name: 'Rose Blush',     color: '#D4537E', bg: '#FBEAF0', desc: 'Vibrant modern magenta' },
]

export default function ThemeScreen() {
  const router = useRouter()
  const theme = useAppTheme()
  const {
    darkMode, setDarkMode,
    themeColor, themeName, setThemeColor,
  } = useSettingsStore()

  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color={themeColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>App Theme & Colors</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Live Theme Preview Card */}
        <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.previewLabel, { color: theme.textMuted }]}>LIVE THEME PREVIEW</Text>
          <View style={[styles.mockCard, { backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
            <View style={styles.mockHeader}>
              <View style={[styles.mockAvatar, { backgroundColor: themeColor }]}>
                <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.mockTitle, { color: theme.text }]}>Monthly Balance</Text>
                <Text style={[styles.mockSubtitle, { color: theme.textMuted }]}>September 2026 · All Books</Text>
              </View>
              <View style={[styles.mockBadge, { backgroundColor: themeColor + '25' }]}>
                <Text style={[styles.mockBadgeText, { color: themeColor }]}>{themeName}</Text>
              </View>
            </View>

            {/* Progress track */}
            <View style={[styles.mockProgressTrack, { backgroundColor: theme.isDark ? '#33322D' : '#E0DED7' }]}>
              <View style={[styles.mockProgressFill, { backgroundColor: themeColor, width: '68%' }]} />
            </View>

            {/* Action button mock */}
            <TouchableOpacity style={[styles.mockBtn, { backgroundColor: themeColor }]}>
              <Text style={styles.mockBtnText}>Sample Theme Button</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dark mode switch */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Appearance Mode</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: theme.isDark ? '#2D2852' : '#EEEDFE' }]}>
              <Ionicons name="moon-outline" size={16} color="#534AB7" />
            </View>
            <View style={styles.rowMid}>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Dark Mode</Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>
                {darkMode ? 'Dark interface enabled' : 'Light warm theme active'}
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ true: '#1D9E75' }}
            />
          </View>
        </View>

        {/* Accent color palette */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Accent Color</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          {THEME_COLORS.map((tc, idx) => {
            const isSelected = themeColor === tc.color
            const isLast = idx === THEME_COLORS.length - 1
            return (
              <TouchableOpacity
                key={tc.id}
                style={[
                  styles.row,
                  !isLast && { borderBottomWidth: 0.5, borderBottomColor: theme.rowBorder },
                  isSelected && { backgroundColor: theme.isDark ? '#262A36' : '#F0F6FD' },
                ]}
                onPress={() => setThemeColor(tc.color, tc.name)}
              >
                <View style={[styles.swatchCircle, { backgroundColor: tc.color }]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { color: isSelected ? tc.color : theme.text, fontWeight: isSelected ? '600' : '400' }]}>
                    {tc.name}
                  </Text>
                  <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{tc.desc}</Text>
                </View>
                <View style={[styles.miniBadge, { backgroundColor: theme.isDark ? '#2A2925' : tc.bg }]}>
                  <Text style={[styles.miniBadgeText, { color: tc.color }]}>{tc.color}</Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Interface Density */}
        <Text style={[styles.secLabel, { color: theme.textMuted }]}>Interface Density</Text>
        <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            style={[
              styles.row,
              { borderBottomWidth: 0.5, borderBottomColor: theme.rowBorder },
              density === 'comfortable' && { backgroundColor: theme.isDark ? '#262A36' : '#F0F6FD' },
            ]}
            onPress={() => setDensity('comfortable')}
          >
            <View style={styles.rowMid}>
              <Text style={[styles.rowLabel, { color: density === 'comfortable' ? themeColor : theme.text, fontWeight: density === 'comfortable' ? '600' : '400' }]}>
                Comfortable (Default)
              </Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>Spacious touch targets and relaxed padding</Text>
            </View>
            {density === 'comfortable' ? (
              <Ionicons name="checkmark-circle" size={20} color={themeColor} />
            ) : (
              <View style={[styles.uncheckCircle, { borderColor: theme.inputBorder }]} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.row,
              density === 'compact' && { backgroundColor: theme.isDark ? '#262A36' : '#F0F6FD' },
            ]}
            onPress={() => setDensity('compact')}
          >
            <View style={styles.rowMid}>
              <Text style={[styles.rowLabel, { color: density === 'compact' ? themeColor : theme.text, fontWeight: density === 'compact' ? '600' : '400' }]}>
                Compact
              </Text>
              <Text style={[styles.rowDesc, { color: theme.textMuted }]}>Condensed vertical spacing for higher data density</Text>
            </View>
            {density === 'compact' ? (
              <Ionicons name="checkmark-circle" size={20} color={themeColor} />
            ) : (
              <View style={[styles.uncheckCircle, { borderColor: theme.inputBorder }]} />
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '500' },
  body:         { flex: 1, padding: 16 },

  previewCard:  { borderWidth: 0.5, borderRadius: 14, padding: 16, marginBottom: 20 },
  previewLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10, textAlign: 'center' },
  mockCard:     { borderWidth: 0.5, borderRadius: 12, padding: 14 },
  mockHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mockAvatar:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mockTitle:    { fontSize: 13, fontWeight: '600' },
  mockSubtitle: { fontSize: 11, marginTop: 1 },
  mockBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  mockBadgeText:{ fontSize: 10, fontWeight: '600' },
  mockProgressTrack: { height: 6, borderRadius: 3, marginVertical: 14, overflow: 'hidden' },
  mockProgressFill:  { height: '100%', borderRadius: 3 },
  mockBtn:      { borderRadius: 8, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  mockBtnText:  { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  secLabel:     { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  group:        { borderWidth: 0.5, borderRadius: 12, marginBottom: 20, overflow: 'hidden' },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowIcon:      { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowMid:       { flex: 1 },
  rowLabel:     { fontSize: 13 },
  rowDesc:      { fontSize: 11, marginTop: 2 },

  swatchCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  miniBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText:{ fontSize: 10, fontWeight: '600' },
  uncheckCircle:{ width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
})
