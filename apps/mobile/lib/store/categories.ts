// apps/mobile/lib/store/categories.ts
import { create } from 'zustand'
import { api } from '../api/client'
import { sessionVersion } from '../api/session'

export interface Category {
  id:          string
  name:        string
  entryType:   'INCOME' | 'EXPENSE'
  isTransfer:  boolean
  isSystem:    boolean
  color:       string | null
  icon:        string | null
  fromBookId:  string | null
  toBookId:    string | null
  fromBook:    { id: string; name: string } | null
  toBook:      { id: string; name: string } | null
}

interface CategoriesState {
  categories:      Category[]
  isLoading:       boolean
  fetchCategories: (bookId?: string) => Promise<void>
  createCategory:  (name: string, entryType: 'INCOME' | 'EXPENSE', color?: string) => Promise<Category>
  updateCategory:  (id: string, data: Partial<Category>) => Promise<void>
  deleteCategory:  (id: string) => Promise<void>
}

let fetchVersion = 0
export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  categories: [],
  isLoading:  false,

  fetchCategories: async (bookId) => {
    const session = sessionVersion()
    const version = ++fetchVersion
    set({ isLoading: true })
    const params: Record<string, string> = {}
    if (bookId) params.bookId = bookId
    try {
      const { data } = await api.get('/categories', { params })
      if (version === fetchVersion && session === sessionVersion()) set({ categories: data })
    } finally {
      if (version === fetchVersion && session === sessionVersion()) set({ isLoading: false })
    }
  },

  createCategory: async (name, entryType, color) => {
    const { data } = await api.post('/categories', { name, entryType, ...(color ? { color } : {}) })
    set(s => ({ categories: [...s.categories, data] }))
    return data
  },

  updateCategory: async (id, body) => {
    const { data } = await api.patch(`/categories/${id}`, body)
    set(s => ({ categories: s.categories.map(c => c.id === id ? data : c) }))
  },

  deleteCategory: async (id) => {
    await api.delete(`/categories/${id}`)
    set(s => ({ categories: s.categories.filter(c => c.id !== id) }))
  },
}))
