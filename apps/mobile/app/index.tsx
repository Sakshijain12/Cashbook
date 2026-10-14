// apps/mobile/app/index.tsx
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../lib/store/auth'

export default function Index() {
  const router    = useRouter()
  const user      = useAuthStore(s => s.user)
  const isLoading = useAuthStore(s => s.isLoading)

  useEffect(() => {
    if (isLoading) return
    if (user) {
      router.replace('/tabs')
    } else {
      router.replace('/auth/login')
    }
  }, [user, isLoading])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' }}>
      <ActivityIndicator size="large" color="#185FA5" />
    </View>
  )
}
