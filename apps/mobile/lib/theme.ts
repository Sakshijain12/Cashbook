// apps/mobile/lib/theme.ts
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useSettingsStore } from './store/settings'

export interface ThemeColors {
  isDark:        boolean
  bg:            string
  card:          string
  cardBorder:    string
  border:        string
  cardInner:     string
  headerBg:      string
  headerBorder:  string
  tabBarBg:      string
  tabBarBorder:  string
  text:          string
  textSecondary: string
  textMuted:     string
  rowBorder:     string
  rowIconBg:     string
  inputBg:       string
  inputBorder:   string
  primary:       string
  primaryBg:     string
  primaryText:   string
  danger:        string
  dangerBg:      string
  dangerBorder:  string
  success:       string
  successBg:     string
  warning:       string
  warningBg:     string
  badgeBg:       string
  badgeText:     string
  modalBackdrop: string
  modalCard:     string
}

export const lightColors: ThemeColors = {
  isDark:        false,
  bg:            '#FAFAF8',
  card:          '#F2F1EB',
  cardBorder:    '#E0DED7',
  border:        '#E0DED7',
  cardInner:     '#FFFFFF',
  headerBg:      '#FAFAF8',
  headerBorder:  '#E0DED7',
  tabBarBg:      '#FAFAF8',
  tabBarBorder:  '#E0DED7',
  text:          '#2C2C2A',
  textSecondary: '#666664',
  textMuted:     '#888780',
  rowBorder:     '#E0DED7',
  rowIconBg:     '#EAE8E1',
  inputBg:       '#FFFFFF',
  inputBorder:   '#D0CEC6',
  primary:       '#185FA5',
  primaryBg:     '#E6F1FB',
  primaryText:   '#0C447C',
  danger:        '#791F1F',
  dangerBg:      '#FCEBEB',
  dangerBorder:  '#F09595',
  success:       '#27500A',
  successBg:     '#EAF3DE',
  warning:       '#854F0B',
  warningBg:     '#FAEEDA',
  badgeBg:       '#EEEDFE',
  badgeText:     '#3C3489',
  modalBackdrop: 'rgba(0,0,0,0.45)',
  modalCard:     '#FFFFFF',
}

export const darkColors: ThemeColors = {
  isDark:        true,
  bg:            '#141413',
  card:          '#1F1E1B',
  cardBorder:    '#2E2D28',
  border:        '#2E2D28',
  cardInner:     '#292824',
  headerBg:      '#141413',
  headerBorder:  '#2E2D28',
  tabBarBg:      '#181715',
  tabBarBorder:  '#2E2D28',
  text:          '#F5F4F0',
  textSecondary: '#B4B3AC',
  textMuted:     '#888780',
  rowBorder:     '#2E2D28',
  rowIconBg:     '#2A2925',
  inputBg:       '#262521',
  inputBorder:   '#3E3D37',
  primary:       '#3B82F6',
  primaryBg:     '#1E293B',
  primaryText:   '#93C5FD',
  danger:        '#EF4444',
  dangerBg:      '#3F1818',
  dangerBorder:  '#7F2323',
  success:       '#22C55E',
  successBg:     '#143823',
  warning:       '#F59E0B',
  warningBg:     '#3D2A10',
  badgeBg:       '#2D2852',
  badgeText:     '#C7D2FE',
  modalBackdrop: 'rgba(0,0,0,0.7)',
  modalCard:     '#22211D',
}

export function useAppTheme(): ThemeColors {
  const darkMode = useSettingsStore(s => s.darkMode)
  const themeColor = useSettingsStore(s => s.themeColor)

  const colors = darkMode ? darkColors : lightColors

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colors.bg
      document.body.style.color = colors.text
      if (document.documentElement) {
        document.documentElement.style.backgroundColor = colors.bg
      }
    }
  }, [darkMode, colors.bg, colors.text])

  return {
    ...colors,
    border: colors.cardBorder,
    primary: themeColor || colors.primary,
  }
}
