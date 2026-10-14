// apps/mobile/lib/utils/storage.ts
// expo-secure-store is not available on web — fall back to localStorage.
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key)
      }
      return null
    }
    return SecureStore.getItemAsync(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value)
      }
      return
    }
    await SecureStore.setItemAsync(key, value)
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key)
      }
      return
    }
    await SecureStore.deleteItemAsync(key)
  },
}
