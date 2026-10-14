// apps/mobile/lib/store/entries.ts
import { create } from 'zustand'
import { api } from '../api/client'
import { localDateISO } from '../utils/format'
import { sessionVersion } from '../api/session'

export interface Entry {
  id:            string
  bookId:        string
  categoryId:    string
  type:          'INCOME' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  amount:        number
  name:          string
  paymentMethod: string | null
  entryDate:     string
  entryTime:     string
  transferId:    string | null
  billUrl:       string | null
  billThumbUrl:  string | null
  note:          string | null
  category:      { id: string; name: string; color: string; isTransfer: boolean } | null
  book:          { id: string; name: string; color: string } | null
}

export type FilterType = 'All' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'

export interface CustomDateRange {
  startDate: string // YYYY-MM-DD
  endDate:   string // YYYY-MM-DD
}

export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function getDateRange(filter: FilterType, anchorDateStr: string, customRange?: CustomDateRange): Record<string, string> {
  if (filter === 'All') return {}

  if (filter === 'Custom') {
    const s = customRange?.startDate || anchorDateStr
    const e = customRange?.endDate || anchorDateStr
    return {
      dateFrom: s <= e ? s : e,
      dateTo:   s <= e ? e : s,
    }
  }

  const d = parseLocalDate(anchorDateStr)

  if (filter === 'Daily') {
    const dayIso = localDateISO(d)
    return { dateFrom: dayIso, dateTo: dayIso }
  }

  if (filter === 'Weekly') {
    const day = d.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday)
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
    return { dateFrom: localDateISO(mon), dateTo: localDateISO(sun) }
  }

  if (filter === 'Monthly') {
    const y = d.getFullYear()
    const m = d.getMonth()
    const start = new Date(y, m, 1)
    const end = new Date(y, m + 1, 0)
    return { dateFrom: localDateISO(start), dateTo: localDateISO(end) }
  }

  if (filter === 'Yearly') {
    const y = d.getFullYear()
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` }
  }

  return {}
}

export function shiftAnchorDate(filter: FilterType, anchorDateStr: string, direction: -1 | 1): string {
  const d = parseLocalDate(anchorDateStr)

  if (filter === 'Daily') {
    d.setDate(d.getDate() + direction)
    return localDateISO(d)
  }

  if (filter === 'Weekly') {
    d.setDate(d.getDate() + direction * 7)
    return localDateISO(d)
  }

  if (filter === 'Monthly') {
    const nextDate = new Date(d.getFullYear(), d.getMonth() + direction, 1)
    return localDateISO(nextDate)
  }

  if (filter === 'Yearly') {
    const nextDate = new Date(d.getFullYear() + direction, 0, 1)
    return localDateISO(nextDate)
  }

  return anchorDateStr
}

export function getPeriodLabel(filter: FilterType, anchorDateStr: string, customRange?: CustomDateRange): string {
  if (filter === 'All') return 'All Time'

  if (filter === 'Custom') {
    if (!customRange || !customRange.startDate) return 'Custom Period'
    const s = parseLocalDate(customRange.startDate)
    const e = parseLocalDate(customRange.endDate)
    if (customRange.startDate === customRange.endDate) {
      return s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }
    const sStr = s.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: s.getFullYear() !== e.getFullYear() ? 'numeric' : undefined,
    })
    const eStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${sStr} – ${eStr}`
  }

  const d = parseLocalDate(anchorDateStr)
  const todayStr = localDateISO(new Date())

  if (filter === 'Daily') {
    const isToday = anchorDateStr === todayStr
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = anchorDateStr === localDateISO(yesterday)

    const dateFormatted = d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })

    if (isToday) return `Today · ${dateFormatted}`
    if (isYesterday) return `Yesterday · ${dateFormatted}`
    return dateFormatted
  }

  if (filter === 'Weekly') {
    const day = d.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday)
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
    const monDay = mon.getDate()
    const sunDay = sun.getDate()
    const monMonth = mon.toLocaleDateString('en-GB', { month: 'short' })
    const sunMonth = sun.toLocaleDateString('en-GB', { month: 'short' })
    const year = sun.getFullYear()

    if (monMonth === sunMonth) {
      return `${monDay} – ${sunDay} ${monMonth} ${year}`
    }
    return `${monDay} ${monMonth} – ${sunDay} ${sunMonth} ${year}`
  }

  if (filter === 'Monthly') {
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  if (filter === 'Yearly') {
    return `${d.getFullYear()}`
  }

  return ''
}

export function isCurrentPeriod(filter: FilterType, anchorDateStr: string, customRange?: CustomDateRange): boolean {
  if (filter === 'All') return true
  const now = new Date()
  const todayStr = localDateISO(now)

  if (filter === 'Custom') {
    if (!customRange) return false
    return todayStr >= customRange.startDate && todayStr <= customRange.endDate
  }

  if (filter === 'Daily') {
    return anchorDateStr === todayStr
  }

  const d = parseLocalDate(anchorDateStr)

  if (filter === 'Weekly') {
    const day = d.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday)
    const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)
    return todayStr >= localDateISO(mon) && todayStr <= localDateISO(sun)
  }

  if (filter === 'Monthly') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }

  if (filter === 'Yearly') {
    return d.getFullYear() === now.getFullYear()
  }

  return true
}

export type SortBy = 'date' | 'amount'
export type SortOrder = 'desc' | 'asc'

export function sortEntriesList(entries: Entry[], sortBy: SortBy, sortOrder: SortOrder): Entry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'amount') {
      const diff = Number(a.amount) - Number(b.amount)
      if (diff !== 0) return sortOrder === 'asc' ? diff : -diff
      const dateA = `${a.entryDate.split('T')[0]} ${a.entryTime || '00:00'}`
      const dateB = `${b.entryDate.split('T')[0]} ${b.entryTime || '00:00'}`
      return dateB.localeCompare(dateA)
    }

    const dateA = `${a.entryDate.split('T')[0]} ${a.entryTime || '00:00'}`
    const dateB = `${b.entryDate.split('T')[0]} ${b.entryTime || '00:00'}`
    const comp = dateA.localeCompare(dateB)
    if (comp !== 0) return sortOrder === 'asc' ? comp : -comp
    return b.id.localeCompare(a.id)
  })
}

interface EntriesState {
  entries:            Entry[]
  total:              number
  isLoading:          boolean
  filter:             FilterType
  anchorDate:         string
  customDateRange:    CustomDateRange
  search:             string
  sortBy:             SortBy
  sortOrder:          SortOrder
  setFilter:          (f: FilterType) => void
  setAnchorDate:      (date: string) => void
  setCustomDateRange: (range: CustomDateRange) => void
  nextPeriod:         () => void
  prevPeriod:         () => void
  resetToToday:       () => void
  setSearch:          (s: string) => void
  setSorting:         (sortBy: SortBy, sortOrder?: SortOrder) => void
  toggleSort:         (target: SortBy) => void
  fetchEntries:       (bookId?: string) => Promise<void>
  deleteEntry:        (id: string) => Promise<void>
}

let fetchVersion = 0
export const useEntriesStore = create<EntriesState>((set, get) => {
  const initialToday = localDateISO(new Date())
  return {
    entries:         [],
    total:           0,
    isLoading:       false,
    filter:          'All',
    anchorDate:      initialToday,
    customDateRange: { startDate: initialToday, endDate: initialToday },
    search:          '',
    sortBy:          'date',
    sortOrder:       'desc',

    setFilter: (filter) => {
      set({ filter, anchorDate: localDateISO(new Date()) })
    },
    setAnchorDate: (anchorDate) => set({ anchorDate }),
    setCustomDateRange: (customDateRange) => {
      set({ customDateRange, filter: 'Custom' })
    },
    setSorting: (sortBy, sortOrder = 'desc') => {
      const { entries } = get()
      const sorted = sortEntriesList(entries, sortBy, sortOrder)
      set({ sortBy, sortOrder, entries: sorted })
    },
    toggleSort: (target) => {
      const { sortBy, sortOrder, entries } = get()
      let nextSortBy: SortBy = target
      let nextSortOrder: SortOrder = 'desc'
      if (sortBy === target) {
        nextSortOrder = sortOrder === 'desc' ? 'asc' : 'desc'
      } else {
        nextSortBy = target
        nextSortOrder = 'desc'
      }
      const sorted = sortEntriesList(entries, nextSortBy, nextSortOrder)
      set({ sortBy: nextSortBy, sortOrder: nextSortOrder, entries: sorted })
    },
    nextPeriod: () => {
      const { filter, anchorDate, customDateRange } = get()
      if (filter === 'All') return
      if (filter === 'Custom') {
        const s = parseLocalDate(customDateRange.startDate)
        const e = parseLocalDate(customDateRange.endDate)
        const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
        s.setDate(s.getDate() + diffDays)
        e.setDate(e.getDate() + diffDays)
        set({ customDateRange: { startDate: localDateISO(s), endDate: localDateISO(e) } })
        return
      }
      const next = shiftAnchorDate(filter, anchorDate, 1)
      set({ anchorDate: next })
    },
    prevPeriod: () => {
      const { filter, anchorDate, customDateRange } = get()
      if (filter === 'All') return
      if (filter === 'Custom') {
        const s = parseLocalDate(customDateRange.startDate)
        const e = parseLocalDate(customDateRange.endDate)
        const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
        s.setDate(s.getDate() - diffDays)
        e.setDate(e.getDate() - diffDays)
        set({ customDateRange: { startDate: localDateISO(s), endDate: localDateISO(e) } })
        return
      }
      const prev = shiftAnchorDate(filter, anchorDate, -1)
      set({ anchorDate: prev })
    },
    resetToToday: () => {
      const today = localDateISO(new Date())
      set({ anchorDate: today, customDateRange: { startDate: today, endDate: today } })
    },
    setSearch: (search) => set({ search }),

    fetchEntries: async (bookId) => {
      const session = sessionVersion()
      const version = ++fetchVersion
      set({ isLoading: true })
      const { filter, anchorDate, customDateRange, search, sortBy, sortOrder } = get()
      const params: Record<string, string> = {
        limit: '100',
        includeTransfers: 'true',
        sortBy,
        sortOrder,
      }
      if (bookId) params.bookId = bookId
      if (search) params.q     = search
      Object.assign(params, getDateRange(filter, anchorDate, customDateRange))
      try {
        const { data } = await api.get('/entries', { params })
        if (version === fetchVersion && session === sessionVersion()) {
          const rawEntries = data.entries.map((e: Entry) => ({ ...e, amount: Number(e.amount) }))
          const sorted = sortEntriesList(rawEntries, sortBy, sortOrder)
          set({ entries: sorted, total: data.total })
        }
      } finally {
        if (version === fetchVersion && session === sessionVersion()) set({ isLoading: false })
      }
    },

    deleteEntry: async (id) => {
      const transferId = get().entries.find(e => e.id === id)?.transferId
      await api.delete(`/entries/${id}`)
      set(s => {
        const entries = s.entries.filter(e => e.id !== id && (!transferId || e.transferId !== transferId))
        return { entries, total: Math.max(0, s.total - (s.entries.length - entries.length)) }
      })
    },
  }
})
