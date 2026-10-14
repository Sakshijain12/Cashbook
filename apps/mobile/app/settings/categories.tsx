// apps/mobile/app/settings/categories.tsx
import { useState, useEffect, useMemo } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCategoriesStore, Category } from '../../lib/store/categories'
import { useAppTheme, ThemeColors } from '../../lib/theme'

type Mode = 'expense' | 'income' | 'transfer'

const COLORS = [
  '#D85A30', '#378ADD', '#7F77DD', '#1D9E75', '#BA7517',
  '#D4537E', '#27500A', '#185FA5', '#854F0B', '#444441',
]

export default function CategoriesScreen() {
  const theme = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])
  const router = useRouter()
  const params = useLocalSearchParams<{ mode?: string }>()
  const initialMode: Mode = (params.mode === 'income' || params.mode === 'transfer') ? params.mode : 'expense'

  const [mode, setMode] = useState<Mode>(initialMode)
  const [search, setSearch] = useState('')

  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategoriesStore()

  // Create state
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit modal state
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(COLORS[0])
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete modal state
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (params.mode && (params.mode === 'expense' || params.mode === 'income' || params.mode === 'transfer')) {
      setMode(params.mode as Mode)
    }
  }, [params.mode])

  const filtered = categories.filter(c => {
    const matchesMode =
      mode === 'transfer' ? c.isTransfer :
      mode === 'income' ? (!c.isTransfer && c.entryType === 'INCOME') :
      (!c.isTransfer && c.entryType === 'EXPENSE')

    if (!matchesMode) return false
    if (!search.trim()) return true
    return c.name.toLowerCase().includes(search.toLowerCase())
  })

  async function handleCreate() {
    if (!newName.trim()) {
      setCreateError('Category name cannot be empty')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      await createCategory(newName.trim(), mode === 'income' ? 'INCOME' : 'EXPENSE', newColor)
      setNewName('')
    } catch (e: any) {
      setCreateError(e.response?.data?.error || 'Failed to create category')
    } finally {
      setCreating(false)
    }
  }

  function startEdit(cat: Category) {
    setEditingCat(cat)
    setEditName(cat.name)
    setEditColor(cat.color || COLORS[0])
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!editingCat) return
    if (!editName.trim()) {
      setEditError('Category name cannot be empty')
      return
    }
    setSavingEdit(true)
    setEditError(null)
    try {
      await updateCategory(editingCat.id, {
        name: editName.trim(),
        color: editColor,
      })
      setEditingCat(null)
    } catch (e: any) {
      setEditError(e.response?.data?.error || 'Failed to update category')
    } finally {
      setSavingEdit(false)
    }
  }

  function startDelete(cat: Category) {
    setDeletingCat(cat)
    setDeleteError(null)
  }

  async function handleConfirmDelete() {
    if (!deletingCat) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCategory(deletingCat.id)
      setDeletingCat(null)
      if (editingCat?.id === deletingCat.id) {
        setEditingCat(null)
      }
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Cannot delete category with recorded entries.'
      setDeleteError(msg)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={22} color="#185FA5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Category Manager</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        {/* Mode tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'expense' && styles.tabBtnActiveExpense]}
            onPress={() => setMode('expense')}
          >
            <View style={[styles.tabDot, { backgroundColor: '#791F1F' }]} />
            <Text style={[styles.tabBtnText, mode === 'expense' && styles.tabBtnTextActiveExpense]}>Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'income' && styles.tabBtnActiveIncome]}
            onPress={() => setMode('income')}
          >
            <View style={[styles.tabDot, { backgroundColor: '#27500A' }]} />
            <Text style={[styles.tabBtnText, mode === 'income' && styles.tabBtnTextActiveIncome]}>Income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, mode === 'transfer' && styles.tabBtnActiveTransfer]}
            onPress={() => setMode('transfer')}
          >
            <View style={[styles.tabDot, { backgroundColor: '#0F6E56' }]} />
            <Text style={[styles.tabBtnText, mode === 'transfer' && styles.tabBtnTextActiveTransfer]}>Transfer</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${mode} categories...`}
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Add Category Section (only for expense and income) */}
        {mode !== 'transfer' && (
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>New {mode === 'income' ? 'Income' : 'Expense'} Category</Text>
            <View style={styles.addInputRow}>
              <View style={[styles.selectedColorCircle, { backgroundColor: newColor }]} />
              <TextInput
                style={styles.addInput}
                placeholder="Category name (e.g. Groceries)"
                placeholderTextColor="#999"
                value={newName}
                onChangeText={(t) => { setNewName(t); setCreateError(null) }}
                onSubmitEditing={handleCreate}
              />
              <TouchableOpacity
                style={[styles.addBtn, (!newName.trim() || creating) && { opacity: 0.6 }]}
                disabled={!newName.trim() || creating}
                onPress={handleCreate}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="add" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            {createError ? (
              <Text style={styles.createErrorText}>{createError}</Text>
            ) : null}

            {/* Color swatches */}
            <View style={styles.colorPalette}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotSelected]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Transfer Notice */}
        {mode === 'transfer' && (
          <View style={styles.transferBanner}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#0F6E56" />
            <Text style={styles.transferBannerText}>
              Transfer categories are auto-generated when you perform internal book transfers to maintain double-entry balancing.
            </Text>
          </View>
        )}

        {/* Category List */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.secLabel}>Existing Categories ({filtered.length})</Text>
          {isLoading && !categories.length ? (
            <ActivityIndicator style={{ padding: 20 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No categories found</Text>
            </View>
          ) : (
            <View style={styles.group}>
              {filtered.map((cat, idx) => {
                const isLast = idx === filtered.length - 1
                return (
                  <View key={cat.id} style={[styles.row, !isLast && styles.rowBorder]}>
                    <View style={[styles.catColorCircle, { backgroundColor: cat.color ?? '#888' }]} />
                    <Text style={styles.catName}>{cat.name}</Text>

                    {cat.isSystem ? (
                      <View style={styles.systemBadge}>
                        <Ionicons name="lock-closed-outline" size={11} color="#888" />
                        <Text style={styles.systemBadgeText}>system</Text>
                      </View>
                    ) : (
                      mode !== 'transfer' && (
                        <View style={styles.catActions}>
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => startEdit(cat)}
                            accessibilityLabel={`Edit ${cat.name}`}
                          >
                            <Ionicons name="pencil-outline" size={15} color="#444" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.iconBtn, styles.trashBtn]}
                            onPress={() => startDelete(cat)}
                            accessibilityLabel={`Delete ${cat.name}`}
                          >
                            <Ionicons name="trash-outline" size={15} color="#791F1F" />
                          </TouchableOpacity>
                        </View>
                      )
                    )}
                  </View>
                )
              })}
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Edit Category Modal (Translucent Overlay) */}
      <Modal
        visible={editingCat !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCat(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.selectedColorCircle, { backgroundColor: editColor }]} />
                <Text style={styles.modalTitle}>Edit Category</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingCat(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={22} color="#888" />
              </TouchableOpacity>
            </View>

            {/* Input */}
            <Text style={styles.modalFieldLabel}>Category Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={(t) => { setEditName(t); setEditError(null) }}
              placeholder="Category name"
              placeholderTextColor="#999"
              autoFocus
            />

            {/* Color Palette */}
            <Text style={styles.modalFieldLabel}>Color</Text>
            <View style={styles.modalColorPalette}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, editColor === c && styles.colorDotSelected]}
                  onPress={() => setEditColor(c)}
                />
              ))}
            </View>

            {editError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#791F1F" />
                <Text style={styles.errorText}>{editError}</Text>
              </View>
            ) : null}

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingCat(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!editName.trim() || savingEdit) && { opacity: 0.6 }]}
                disabled={!editName.trim() || savingEdit}
                onPress={handleSaveEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Shortcut to delete */}
            {editingCat && !editingCat.isSystem && (
              <TouchableOpacity
                style={styles.modalDeleteLink}
                onPress={() => {
                  const toDelete = editingCat
                  setEditingCat(null)
                  startDelete(toDelete)
                }}
              >
                <Ionicons name="trash-outline" size={14} color="#791F1F" />
                <Text style={styles.modalDeleteLinkText}>Delete this category</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal (Translucent Overlay) */}
      <Modal
        visible={deletingCat !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeletingCat(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.deleteIconBox}>
              <Ionicons name="trash" size={24} color="#791F1F" />
            </View>

            <Text style={styles.deleteTitle}>Delete "{deletingCat?.name}"?</Text>
            <Text style={styles.deleteDesc}>
              This will permanently delete this category. Categories with active recorded entries cannot be removed.
            </Text>

            {deleteError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#791F1F" />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeletingCat(null)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmDeleteBtn, deleting && { opacity: 0.6 }]}
                disabled={deleting}
                onPress={handleConfirmDelete}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: theme.bg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: theme.headerBorder, backgroundColor: theme.headerBg },
    backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle:  { fontSize: 17, fontWeight: '500', color: theme.text },
    body:         { flex: 1, padding: 16 },

    tabRow:       { flexDirection: 'row', backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 10, padding: 3, marginBottom: 14 },
    tabBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
    tabBtnActiveExpense: { backgroundColor: theme.dangerBg },
    tabBtnActiveIncome:  { backgroundColor: theme.successBg },
    tabBtnActiveTransfer:{ backgroundColor: theme.isDark ? '#143823' : '#E1F5EE' },
    tabDot:       { width: 6, height: 6, borderRadius: 3 },
    tabBtnText:   { fontSize: 12, color: theme.textMuted, fontWeight: '500' },
    tabBtnTextActiveExpense: { color: theme.isDark ? '#F87171' : '#791F1F', fontWeight: '600' },
    tabBtnTextActiveIncome:  { color: theme.isDark ? '#4ADE80' : '#27500A', fontWeight: '600' },
    tabBtnTextActiveTransfer:{ color: theme.isDark ? '#6EE7B7' : '#0F6E56', fontWeight: '600' },

    searchBox:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14 },
    searchInput:  { flex: 1, fontSize: 13, color: theme.text },

    addCard:      { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, padding: 12, marginBottom: 16 },
    addCardTitle: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    addInputRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    selectedColorCircle: { width: 22, height: 22, borderRadius: 11 },
    addInput:     { flex: 1, backgroundColor: theme.inputBg, borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: theme.text },
    addBtn:       { backgroundColor: theme.primary, width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    createErrorText: { fontSize: 11, color: theme.danger, marginTop: 6, marginLeft: 2 },

    colorPalette: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: theme.border },
    colorDot:     { width: 22, height: 22, borderRadius: 11 },
    colorDotSelected: { borderWidth: 2, borderColor: theme.text },

    transferBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: theme.isDark ? '#143823' : '#E1F5EE', borderRadius: 10, padding: 12, marginBottom: 16 },
    transferBannerText: { flex: 1, fontSize: 11, lineHeight: 16, color: theme.isDark ? '#6EE7B7' : '#0F6E56' },

    secLabel:     { fontSize: 10, fontWeight: '600', color: theme.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
    group:        { backgroundColor: theme.card, borderWidth: 0.5, borderColor: theme.border, borderRadius: 12, overflow: 'hidden' },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    rowBorder:    { borderBottomWidth: 0.5, borderBottomColor: theme.border },
    catColorCircle: { width: 14, height: 14, borderRadius: 7 },
    catName:      { flex: 1, fontSize: 13, color: theme.text, fontWeight: '500' },
    catActions:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.cardInner, borderWidth: 0.5, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
    trashBtn:     { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },

    systemBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.rowIconBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    systemBadgeText: { fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', fontWeight: '500' },

    emptyCard:    { backgroundColor: theme.card, borderRadius: 12, padding: 24, alignItems: 'center' },
    emptyText:    { fontSize: 12, color: theme.textMuted },

    // Modal styles (Translucent overlay)
    modalBackdrop: { flex: 1, backgroundColor: theme.modalBackdrop, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard:     { width: '100%', maxWidth: 360, backgroundColor: theme.modalCard, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
    modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    modalTitle:    { fontSize: 16, fontWeight: '600', color: theme.text },
    modalFieldLabel: { fontSize: 11, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
    modalInput:    { backgroundColor: theme.inputBg, borderWidth: 0.5, borderColor: theme.inputBorder, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.text },
    modalColorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 8 },
    errorBanner:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.dangerBg, borderWidth: 0.5, borderColor: theme.dangerBorder, borderRadius: 8, padding: 8, marginTop: 10 },
    errorText:     { flex: 1, fontSize: 11, color: theme.danger, lineHeight: 15 },
    modalBtnRow:   { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalCancelBtn:{ flex: 1, backgroundColor: theme.card, borderRadius: 8, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    modalCancelBtnText: { fontSize: 13, fontWeight: '500', color: theme.textSecondary },
    modalSaveBtn:  { flex: 1, backgroundColor: theme.primary, borderRadius: 8, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    modalSaveBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    modalDeleteLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 14, paddingVertical: 4 },
    modalDeleteLinkText: { fontSize: 12, color: theme.danger, fontWeight: '500' },

    // Delete modal
    deleteIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.dangerBg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 },
    deleteTitle:   { fontSize: 16, fontWeight: '600', color: theme.text, textAlign: 'center', marginBottom: 6 },
    deleteDesc:    { fontSize: 12, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
    modalConfirmDeleteBtn: { flex: 1, backgroundColor: theme.danger, borderRadius: 8, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    modalConfirmDeleteText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  })
}
