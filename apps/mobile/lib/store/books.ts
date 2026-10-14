// apps/mobile/lib/store/books.ts
import { create } from 'zustand'
import { api } from '../api/client'
import { sessionVersion } from '../api/session'
import { useSettingsStore } from './settings'

export interface Book {
  id:         string
  name:       string
  type:       string
  color:      string
  icon:       string
  currency:   string
  balance:    number
  income?:    number
  expense?:   number
  monthIncome:  number
  monthExpense: number
}

interface BooksState {
  books:       Book[]
  activeBook:  Book | null
  isLoading:   boolean
  fetchBooks:  () => Promise<void>
  setActiveBook: (book: Book) => void
  createBook:  (data: Partial<Book>) => Promise<Book>
  deleteBook:  (id: string) => Promise<void>
}

export const useBooksStore = create<BooksState>((set, get) => ({
  books:      [],
  activeBook: null,
  isLoading:  false,

  fetchBooks: async () => {
    const version = sessionVersion()
    set({ isLoading: true })
    try {
      const { data } = await api.get('/books')
      if (version !== sessionVersion()) return
      const defaultCurrency = useSettingsStore.getState().currency
      if (defaultCurrency && defaultCurrency !== 'JPY' && Array.isArray(data)) {
        for (const b of data) {
          if (b.currency === 'JPY') {
            b.currency = defaultCurrency
            api.patch(`/books/${b.id}`, { currency: defaultCurrency }).catch(() => {})
          }
        }
      }
      set({ books: data, activeBook: data.find((b: Book) => b.id === get().activeBook?.id) ?? data[0] ?? null, isLoading: false })
    } catch {
      if (version === sessionVersion()) set({ isLoading: false })
    }
  },

  setActiveBook: (book) => set({ activeBook: book }),

  createBook: async (bookData) => {
    const defaultCurrency = useSettingsStore.getState().currency || 'USD'
    const payload = { currency: defaultCurrency, ...bookData }
    const { data } = await api.post('/books', payload)
    await get().fetchBooks()
    return data
  },

  deleteBook: async (id: string) => {
    await api.delete(`/books/${id}`)
    await get().fetchBooks()
  },
}))
