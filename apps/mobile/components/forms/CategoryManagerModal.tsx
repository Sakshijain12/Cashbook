// apps/mobile/components/forms/CategoryManagerModal.tsx
import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, ActivityIndicator, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BottomSheet } from '../ui/BottomSheet'
import { useCategoriesStore, Category } from '../../lib/store/categories'

type Mode = 'expense' | 'income' | 'transfer'

interface Props {
  visible:  boolean
  onClose:  () => void
  mode:     Mode
}

const COLORS = ['#D85A30','#378ADD','#7F77DD','#1D9E75','#BA7517','#D4537E','#27500A','#185FA5','#854F0B','#444441']

export function CategoryManagerModal({ visible, onClose, mode }: Props) {
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategoriesStore()
  const [newName,    setNewName]    = useState('')
  const [newColor,   setNewColor]   = useState(COLORS[0])
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editName,   setEditName]   = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => { if (visible) fetchCategories() }, [visible])

  const filtered = categories.filter(c => {
    if (mode === 'transfer') return c.isTransfer
    if (mode === 'income')   return !c.isTransfer && c.entryType === 'INCOME'
    return !c.isTransfer && c.entryType === 'EXPENSE'
  })

  const title = mode === 'transfer' ? 'Transfer categories'
              : mode === 'income'   ? 'Income categories'
              : 'Expense categories'

  async function handleCreate() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createCategory(newName.trim(), mode === 'income' ? 'INCOME' : 'EXPENSE', newColor)
      setNewName('')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updateCategory(id, { name: editName.trim() })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(cat: Category) {
    const doDelete = async () => {
      try {
        await deleteCategory(cat.id)
      } catch (e: any) {
        const msg = e?.response?.data?.error || 'This category has recorded entries.'
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
          window.alert(msg)
        } else {
          Alert.alert('Cannot delete', msg)
        }
      }
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        if (window.confirm(`Delete "${cat.name}"?\nCategories with existing entries cannot be deleted.`)) {
          void doDelete()
        }
      } else {
        void doDelete()
      }
    } else {
      Alert.alert(
        `Delete "${cat.name}"?`,
        'This cannot be undone. Categories with existing entries cannot be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      )
    }
  }

  const renderItem = ({ item: cat }: { item: Category }) => {
    const isEditing = editingId === cat.id
    return (
      <View style={[styles.catRow, isEditing && styles.catRowEditing]}>
        <View style={[styles.catDot, { backgroundColor: cat.color ?? '#888' }]} />

        {isEditing ? (
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            autoFocus
            onSubmitEditing={() => handleUpdate(cat.id)}
          />
        ) : (
          <Text style={styles.catName}>{cat.name}</Text>
        )}

        {cat.isSystem ? (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed-outline" size={12} color="#888" />
            <Text style={styles.lockText}>system</Text>
          </View>
        ) : isEditing ? (
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleUpdate(cat.id)}>
              <Ionicons name="checkmark-outline" size={16} color="#27500A" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setEditingId(null)}>
              <Ionicons name="close-outline" size={16} color="#888" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => { setEditingId(cat.id); setEditName(cat.name) }}
            >
              <Ionicons name="pencil-outline" size={15} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(cat)}>
              <Ionicons name="trash-outline" size={15} color="#791F1F" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={0.75}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      {mode !== 'transfer' && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add new category..."
            value={newName}
            onChangeText={setNewName}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <View style={styles.colorPicker}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotSel]}
                onPress={() => setNewColor(c)}
              />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, (!newName.trim() || saving) && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!newName.trim() || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#0C447C" />
              : <Text style={styles.addBtnText}>Add</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {mode === 'transfer' && (
        <View style={styles.transferNotice}>
          <Ionicons name="information-circle-outline" size={14} color="#085041" />
          <Text style={styles.transferNoticeText}>
            Transfer categories are auto-managed. Add books to create new ones.
          </Text>
        </View>
      )}

      <FlatList
        style={{ flex: 1, minHeight: 0 }}
        data={filtered}
        keyExtractor={c => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No categories yet. Add one above.</Text>
        }
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  title:           { fontSize: 15, fontWeight: '500', color: '#2C2C2A' },
  closeBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addRow:          { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#E0DED7', gap: 8 },
  addInput:        { borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, backgroundColor: '#fff' },
  colorPicker:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  colorDot:        { width: 22, height: 22, borderRadius: 11 },
  colorDotSel:     { borderWidth: 2.5, borderColor: '#2C2C2A', transform: [{ scale: 1.15 }] },
  addBtn:          { backgroundColor: '#E6F1FB', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addBtnText:      { fontSize: 13, fontWeight: '500', color: '#0C447C' },
  transferNotice:  { flexDirection: 'row', gap: 8, margin: 12, padding: 10, backgroundColor: '#E1F5EE', borderRadius: 8, borderWidth: 0.5, borderColor: '#0F6E56' },
  transferNoticeText: { flex: 1, fontSize: 11, color: '#085041', lineHeight: 16 },
  list:            { paddingHorizontal: 8, paddingBottom: 16 },
  catRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderBottomWidth: 0.5, borderBottomColor: '#F0EEE9' },
  catRowEditing:   { backgroundColor: '#F5F4EF' },
  catDot:          { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catName:         { flex: 1, fontSize: 14, color: '#2C2C2A' },
  editInput:       { flex: 1, fontSize: 14, color: '#2C2C2A', borderBottomWidth: 1, borderBottomColor: '#185FA5', paddingBottom: 2 },
  lockBadge:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#F2F1EB', borderRadius: 20 },
  lockText:        { fontSize: 10, color: '#888' },
  editActions:     { flexDirection: 'row', gap: 4 },
  iconBtn:         { width: 28, height: 28, borderRadius: 6, borderWidth: 0.5, borderColor: '#E0DED7', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  empty:           { textAlign: 'center', color: '#aaa', fontSize: 13, paddingVertical: 24 },
})
