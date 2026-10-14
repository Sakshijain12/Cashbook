// apps/mobile/lib/store/settings.ts
import { create } from 'zustand'
import { storage } from '../utils/storage'

export interface BackupItem {
  id: string
  timestamp: string
  size: string
  entriesCount: number
  booksCount: number
  type: 'manual' | 'auto'
}

export interface SettingsState {
  // General
  currency: string
  currencyName: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  firstDayOfWeek: 'monday' | 'sunday'
  dailyReminder: boolean
  reminderTime: string
  reminderDays: string[]

  // Appearance
  darkMode: boolean
  themeColor: string
  themeName: string

  // Data & Backup
  autoBackup: boolean
  lastBackupTime: string | null
  backups: BackupItem[]

  // Actions
  loadSettings: () => Promise<void>
  setCurrency: (code: string, name: string) => Promise<void>
  setDateFormat: (fmt: string) => Promise<void>
  setTimeFormat: (fmt: '12h' | '24h') => Promise<void>
  setFirstDayOfWeek: (day: 'monday' | 'sunday') => Promise<void>
  setDailyReminder: (enabled: boolean) => Promise<void>
  setReminderTime: (time: string) => Promise<void>
  setReminderDays: (days: string[]) => Promise<void>
  setDarkMode: (enabled: boolean) => Promise<void>
  setThemeColor: (color: string, name: string) => Promise<void>
  setAutoBackup: (enabled: boolean) => Promise<void>
  createBackup: (type?: 'manual' | 'auto', meta?: { entriesCount?: number; booksCount?: number }) => Promise<BackupItem>
  restoreBackup: (id: string) => Promise<void>
  deleteBackup: (id: string) => Promise<void>
}

const STORAGE_KEY = 'cashbook_app_settings'
const BACKUPS_KEY = 'cashbook_app_backups'

export const useSettingsStore = create<SettingsState>((set, get) => ({
  currency: 'JPY',
  currencyName: 'Japanese Yen',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  firstDayOfWeek: 'monday',
  dailyReminder: true,
  reminderTime: '21:00',
  reminderDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],

  darkMode: false,
  themeColor: '#185FA5',
  themeName: 'Classic Blue',

  autoBackup: true,
  lastBackupTime: 'Today, 7:35 AM',
  backups: [
    {
      id: 'b-1',
      timestamp: 'Today, 7:35 AM',
      size: '248 KB',
      entriesCount: 32,
      booksCount: 2,
      type: 'auto',
    },
    {
      id: 'b-2',
      timestamp: 'Yesterday, 8:00 PM',
      size: '242 KB',
      entriesCount: 30,
      booksCount: 2,
      type: 'manual',
    },
  ],

  loadSettings: async () => {
    try {
      const raw = await storage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        set(state => ({ ...state, ...parsed }))
      }
      const rawBackups = await storage.getItem(BACKUPS_KEY)
      if (rawBackups) {
        const parsedBackups = JSON.parse(rawBackups)
        set({ backups: parsedBackups })
      }
    } catch (e) {
      console.warn('Failed to load settings:', e)
    }
  },

  setCurrency: async (code, name) => {
    set({ currency: code, currencyName: name })
    const { currency, currencyName, dateFormat, timeFormat, firstDayOfWeek, dailyReminder, reminderTime, reminderDays, darkMode, themeColor, themeName, autoBackup, lastBackupTime } = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify({ currency, currencyName, dateFormat, timeFormat, firstDayOfWeek, dailyReminder, reminderTime, reminderDays, darkMode, themeColor, themeName, autoBackup, lastBackupTime }))
  },

  setDateFormat: async (fmt) => {
    set({ dateFormat: fmt })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setTimeFormat: async (fmt) => {
    set({ timeFormat: fmt })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setFirstDayOfWeek: async (day) => {
    set({ firstDayOfWeek: day })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setDailyReminder: async (enabled) => {
    set({ dailyReminder: enabled })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setReminderTime: async (time) => {
    set({ reminderTime: time })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setReminderDays: async (days) => {
    set({ reminderDays: days })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setDarkMode: async (enabled) => {
    set({ darkMode: enabled })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setThemeColor: async (color, name) => {
    set({ themeColor: color, themeName: name })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  setAutoBackup: async (enabled) => {
    set({ autoBackup: enabled })
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
  },

  createBackup: async (type = 'manual', meta = {}) => {
    const now = new Date()
    const timeStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const newBackup: BackupItem = {
      id: 'b-' + Date.now(),
      timestamp: timeStr,
      size: `${Math.floor(200 + Math.random() * 80)} KB`,
      entriesCount: meta.entriesCount ?? 32,
      booksCount: meta.booksCount ?? 2,
      type,
    }
    const updated = [newBackup, ...get().backups]
    set({ backups: updated, lastBackupTime: timeStr })
    await storage.setItem(BACKUPS_KEY, JSON.stringify(updated))
    const state = get()
    await storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return newBackup
  },

  restoreBackup: async (_id) => {
    // Simulated restore logic
    await new Promise(r => setTimeout(r, 600))
  },

  deleteBackup: async (id) => {
    const updated = get().backups.filter(b => b.id !== id)
    set({ backups: updated })
    await storage.setItem(BACKUPS_KEY, JSON.stringify(updated))
  },
}))
