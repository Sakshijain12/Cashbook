// apps/mobile/app/auth/login.tsx
import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '../../lib/store/auth'
import { useAppTheme, ThemeColors } from '../../lib/theme'

export default function LoginScreen() {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()
  const login = useAuthStore(s => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
      router.replace('/tabs')
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Invalid email or password'
      setError(msg)
      // Also show native alert on mobile
      if (Platform.OS !== 'web') Alert.alert('Login failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoArea}>
          <Text style={styles.logoText}>CashBook</Text>
          <Text style={styles.logoSub}>Personal expense tracker</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
            placeholderTextColor={theme.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword(v => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Log in</Text>
            }
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.switchLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* <Text style={styles.demo}>Demo: demo@cashbook.app / password123</Text> */}
      </View>
    </KeyboardAvoidingView>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
    logoArea: { alignItems: 'center', marginBottom: 48 },
    logoText: { fontSize: 36, fontWeight: '700', color: theme.primary, letterSpacing: -1 },
    logoSub: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
    form: { gap: 0 },
    label: { fontSize: 11, fontWeight: '500', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: 16 },
    input: { borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: theme.inputBg, color: theme.text },
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      backgroundColor: theme.inputBg,
      paddingHorizontal: 14,
    },
    passwordInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    eyeBtn: {
      padding: 4,
      marginLeft: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorBox: { backgroundColor: theme.dangerBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
    errorText: { color: theme.danger, fontSize: 13 },
    btn: { backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    switchText: { fontSize: 13, color: theme.textMuted },
    switchLink: { fontSize: 13, color: theme.primary, fontWeight: '500' },
    demo: { textAlign: 'center', fontSize: 11, color: theme.textMuted, marginTop: 40 },
  })
}
