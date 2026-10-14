import { useEffect } from 'react'
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../lib/store/auth'
import { useBooksStore } from '../lib/store/books'
import { useEntriesStore } from '../lib/store/entries'
import { useCategoriesStore } from '../lib/store/categories'
import { useSettingsStore } from '../lib/store/settings'
import { useAppTheme } from '../lib/theme'
import { onSessionInvalidated } from '../lib/api/session'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 1000 * 60 } },
})

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const loadSession  = useAuthStore(s => s.loadSession)
  const loadSettings = useSettingsStore(s => s.loadSettings)
  const user         = useAuthStore(s => s.user)
  const fetchBooks   = useBooksStore(s => s.fetchBooks)
  const isLoading    = useAuthStore(s => s.isLoading)
  const router       = useRouter()
  const segments     = useSegments()
  const navigation   = useRootNavigationState()

  useEffect(() => {
    loadSession()
    loadSettings()
  }, [])
  useEffect(() => { if (user) fetchBooks() }, [user])
  useEffect(() => onSessionInvalidated(() => {
    queryClient.clear()
    useBooksStore.setState({ books: [], activeBook: null, isLoading: false })
    useEntriesStore.setState({ entries: [], total: 0, search: '', filter: 'All', isLoading: false })
    useCategoriesStore.setState({ categories: [], isLoading: false })
  }), [])
  useEffect(() => {
    if (navigation?.key && !isLoading && !user && segments[0] !== 'auth') router.replace('/auth/login')
  }, [navigation?.key, isLoading, user, segments[0]])

  return <>{children}</>
}

export default function RootLayout() {
  const theme = useAppTheme()

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bg }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.bg} />
        <AppBootstrap>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
            <Stack.Screen name="index"          options={{ headerShown: false }} />
            <Stack.Screen name="auth/login"     options={{ headerShown: false }} />
            <Stack.Screen name="auth/register"  options={{ headerShown: false }} />
            <Stack.Screen name="tabs"           options={{ headerShown: false }} />
            <Stack.Screen name="entry/add"      options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="entry/[id]"     options={{ headerShown: false }} />
            <Stack.Screen name="book/[id]"      options={{ headerShown: false }} />
            <Stack.Screen name="reports"        options={{ headerShown: false }} />
            <Stack.Screen name="settings/profile"       options={{ headerShown: false }} />
            <Stack.Screen name="settings/currency"      options={{ headerShown: false }} />
            <Stack.Screen name="settings/date-format"   options={{ headerShown: false }} />
            <Stack.Screen name="settings/reminder-time" options={{ headerShown: false }} />
            <Stack.Screen name="settings/categories"    options={{ headerShown: false }} />
            <Stack.Screen name="settings/theme"         options={{ headerShown: false }} />
            <Stack.Screen name="settings/backup"        options={{ headerShown: false }} />
            <Stack.Screen name="settings/export"        options={{ headerShown: false }} />
            <Stack.Screen name="settings/support"       options={{ headerShown: false }} />
            <Stack.Screen name="settings/privacy"       options={{ headerShown: false }} />
            <Stack.Screen name="settings/about"         options={{ headerShown: false }} />
          </Stack>
        </AppBootstrap>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
