// apps/mobile/app/settings/profile.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../lib/store/auth'
import { useBooksStore } from '../../lib/store/books'
import { useSettingsStore } from '../../lib/store/settings'
import { api } from '../../lib/api/client'

export default function ProfileScreen() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { books } = useBooksStore()
  const { currency } = useSettingsStore()

  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const initials = (name || user?.name || 'CB')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty')
      return
    }
    setSavingProfile(true)
    try {
      const { data } = await api.patch('/auth/me', { name: name.trim() })
      useAuthStore.setState(state => ({
        user: state.user ? { ...state.user, name: data.name } : data,
      }))
      Alert.alert('Success', 'Profile name updated successfully')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not update profile'
      Alert.alert('Update Failed', msg)
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation Error', 'New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      await api.patch('/auth/me', {
        currentPassword,
        newPassword,
      })
      Alert.alert('Success', 'Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not change password'
      Alert.alert('Failed', msg)
    } finally {
      setSavingPassword(false)
    }
  }

  function handleLogout() {
    Alert.alert('Log out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account & Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* User Banner Card */}
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.userName}>{user?.name ?? 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? ''}</Text>

            {/* Quick stats chips */}
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Ionicons name="book-outline" size={14} color="#185FA5" />
                <Text style={styles.statVal}>{books.length} Books</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="cash-outline" size={14} color="#27500A" />
                <Text style={styles.statVal}>Default {currency}</Text>
              </View>
              <View style={styles.statChip}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#0F6E56" />
                <Text style={styles.statVal}>Verified</Text>
              </View>
            </View>
          </View>

          {/* Edit Profile Info */}
          <Text style={styles.secLabel}>Personal Details</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.readOnlyBox}>
                <Text style={styles.readOnlyText}>{user?.email ?? '—'}</Text>
                <Ionicons name="lock-closed" size={14} color="#888" />
              </View>
              <Text style={styles.hintText}>Email cannot be changed once registered.</Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
              disabled={savingProfile}
              onPress={handleSaveProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Security & Password */}
          <Text style={styles.secLabel}>Security & Password</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showCurrent}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={18} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#999"
                  secureTextEntry={!showNew}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={18} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, borderWidth: 0, paddingHorizontal: 0 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-type new password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#888" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.outlineBtn, savingPassword && { opacity: 0.7 }]}
              disabled={savingPassword}
              onPress={handleChangePassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#185FA5" size="small" />
              ) : (
                <Text style={styles.outlineBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Session Management */}
          <Text style={styles.secLabel}>Session</Text>
          <View style={styles.card}>
            <View style={styles.sessionRow}>
              <View style={styles.sessionIconBox}>
                <Ionicons name="phone-portrait-outline" size={18} color="#27500A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>This Device</Text>
                <Text style={styles.sessionSub}>Active session · Token authenticated</Text>
              </View>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={16} color="#791F1F" />
              <Text style={styles.logoutBtnText}>Log Out from this Device</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#FAFAF8' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7', backgroundColor: '#FAFAF8' },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '500', color: '#2C2C2A' },
  body:         { flex: 1, padding: 16 },

  userCard:     { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20 },
  avatar:       { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E6F1FB', borderWidth: 1, borderColor: '#B5D4F4', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:   { fontSize: 24, fontWeight: '600', color: '#0C447C' },
  userName:     { fontSize: 18, fontWeight: '600', color: '#2C2C2A' },
  userEmail:    { fontSize: 13, color: '#888', marginTop: 3 },
  statsRow:     { flexDirection: 'row', gap: 8, marginTop: 16 },
  statChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5, borderColor: '#E0DED7' },
  statVal:      { fontSize: 11, fontWeight: '500', color: '#444' },

  secLabel:     { fontSize: 11, fontWeight: '600', color: '#888780', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: '#F2F1EB', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 14, padding: 14, marginBottom: 20 },

  inputGroup:   { marginBottom: 4 },
  inputLabel:   { fontSize: 12, fontWeight: '500', color: '#555', marginBottom: 6 },
  input:        { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#2C2C2A' },
  passWrapper:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 8, paddingHorizontal: 12 },
  readOnlyBox:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EAE8E1', borderWidth: 0.5, borderColor: '#D0CEC6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyText: { fontSize: 13, color: '#666' },
  hintText:     { fontSize: 11, color: '#888', marginTop: 4 },

  saveBtn:      { backgroundColor: '#185FA5', borderRadius: 8, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  saveBtnText:  { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  outlineBtn:   { backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#185FA5', borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  outlineBtnText: { color: '#185FA5', fontSize: 13, fontWeight: '600' },

  sessionRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  sessionIconBox: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EAF3DE', alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { fontSize: 13, fontWeight: '500', color: '#2C2C2A' },
  sessionSub:   { fontSize: 11, color: '#888', marginTop: 2 },
  activePill:   { backgroundColor: '#EAF3DE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  activePillText: { fontSize: 10, fontWeight: '600', color: '#27500A' },
  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8 },
  logoutBtnText:{ fontSize: 13, fontWeight: '500', color: '#791F1F' },
})
