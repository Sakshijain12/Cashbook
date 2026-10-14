// apps/mobile/lib/store/auth.ts
import { create } from 'zustand'
import { storage } from '../utils/storage'
import { api } from '../api/client'
import { invalidateSession, onSessionInvalidated } from '../api/session'

interface User { id: string; name: string; email: string }

interface AuthState {
  user:        User | null
  isLoading:   boolean
  login:       (email: string, password: string) => Promise<void>
  register:    (name: string, email: string, password: string) => Promise<void>
  logout:      () => Promise<void>
  loadSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  isLoading: true,

  loadSession: async () => {
    try {
      const token = await storage.getItem('accessToken')
      if (token) {
        const { data } = await api.get('/auth/me')
        set({ user: data, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    await storage.setItem('accessToken',  data.accessToken)
    await storage.setItem('refreshToken', data.refreshToken)
    set({ user: data.user })
  },

  register: async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    await storage.setItem('accessToken',  data.accessToken)
    await storage.setItem('refreshToken', data.refreshToken)
    set({ user: data.user })
  },

  logout: async () => {
    invalidateSession()
    await storage.deleteItem('accessToken')
    await storage.deleteItem('refreshToken')
    set({ user: null })
  },
}))

onSessionInvalidated(() => useAuthStore.setState({ user: null, isLoading: false }))
