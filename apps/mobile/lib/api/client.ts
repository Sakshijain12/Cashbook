import axios, { InternalAxiosRequestConfig } from 'axios'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { storage } from '../utils/storage'
import { invalidateSession, sessionVersion } from './session'

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
  if (Platform.OS !== 'android') return envUrl

  if (!envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl
  }

  // If Metro debugger host is available (e.g. 192.168.x.x:8081), point to that machine on port 3000
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri
  if (hostUri) {
    const hostIp = hostUri.split(':')[0]
    if (hostIp) {
      return envUrl.replace('localhost', hostIp).replace('127.0.0.1', hostIp)
    }
  }

  // Fallback for Android emulator
  return envUrl.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2')
}

export const BASE_URL = resolveApiUrl()

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('file:') || url.startsWith('blob:')) {
    return url
  }
  const base = BASE_URL.replace(/\/api\/v1\/?$/, '')
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

export const api = axios.create({ baseURL: BASE_URL, timeout: 15000 })
let refreshPromise: Promise<string> | null = null
type SessionRequest = InternalAxiosRequestConfig & { sessionVersion?: number }

async function refreshAccessToken() {
  const version = sessionVersion()
  try {
    const refreshToken = await storage.getItem('refreshToken')
    if (!refreshToken) throw new Error('No refresh token')
    const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 })
    if (version !== sessionVersion()) throw new Error('Session changed')
    await storage.setItem('accessToken', data.accessToken)
    return data.accessToken as string
  } catch (error) {
    // Preserve the session on transient network/server failures.
    if (version === sessionVersion() && (!axios.isAxiosError(error) || [400, 401].includes(error.response?.status ?? 0))) {
      await Promise.all([storage.deleteItem('accessToken'), storage.deleteItem('refreshToken')])
      invalidateSession()
    }
    throw error
  }
}

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const version = sessionVersion()
  const token = await storage.getItem('accessToken')
  if (version !== sessionVersion()) throw new axios.CanceledError('Session changed')
  ;(config as SessionRequest).sessionVersion = version
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh token on 401
api.interceptors.response.use(
  (res) => {
    if ((res.config as SessionRequest).sessionVersion !== sessionVersion()) throw new axios.CanceledError('Session changed')
    return res
  },
  async (error) => {
    const original = error.config
    if (original && original.sessionVersion !== sessionVersion()) return Promise.reject(new axios.CanceledError('Session changed'))
    if (original && error.response?.status === 401 && !original._retry && !/\/auth\/(login|register|refresh)/.test(original.url ?? '')) {
      original._retry = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => { refreshPromise = null })
        const token = await refreshPromise
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch (refreshError) {
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)
