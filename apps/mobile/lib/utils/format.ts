// apps/mobile/lib/utils/format.ts
import { useSettingsStore } from '../store/settings'

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'A$',
  SGD: 'S$',
  CHF: 'CHF',
  CNY: '¥',
  KRW: '₩',
  NZD: 'NZ$',
  SEK: 'kr',
  THB: '฿',
  AED: 'AED',
  MXN: '$',
  BRL: 'R$',
  HKD: 'HK$',
}

export function getCurrencySymbol(code?: string): string {
  if (!code) return '$'
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code
}

export function getEffectiveCurrencySymbol(bookCurrency?: string, fallbackCurrency?: string): string {
  const defaultCurrency = fallbackCurrency ?? useSettingsStore.getState().currency
  const code = (bookCurrency && bookCurrency !== 'JPY')
    ? bookCurrency
    : (defaultCurrency || bookCurrency || 'USD')
  return getCurrencySymbol(code)
}

export function useCurrencySymbol(bookCurrency?: string): string {
  const settingsCurrency = useSettingsStore(s => s.currency)
  const code = (bookCurrency && bookCurrency !== 'JPY')
    ? bookCurrency
    : (settingsCurrency || bookCurrency || 'USD')
  return getCurrencySymbol(code)
}

export function formatAmount(amount: number, currency?: string): string {
  const code = currency || useSettingsStore.getState().currency || 'USD'
  const symbol = getCurrencySymbol(code)
  const num = Number(amount)
  const formatted = num % 1 === 0
    ? num.toLocaleString()
    : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${symbol}${formatted}`
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatTime(time?: string | null): string {
  if (!time) return ''
  const str = String(time)
  if (str.includes('T')) {
    return str.split('T')[1]?.slice(0, 5) ?? ''
  }
  return str.slice(0, 5)
}

export function todayISO(): string {
  return localDateISO(new Date())
}

export function localDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function nowTime(): string {
  return new Date().toTimeString().slice(0, 5)
}
