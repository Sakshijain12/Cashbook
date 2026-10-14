// apps/mobile/components/ui/ThreeDotMenu.tsx
import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TouchableWithoutFeedback,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAppTheme } from '../../lib/theme'

export interface MenuItem {
  label:     string
  icon:      string
  onPress:   () => void
  danger?:   boolean
  active?:   boolean
  subtitle?: string
}

interface Props {
  items: MenuItem[]
}

export function ThreeDotMenu({ items }: Props) {
  const theme             = useAppTheme()
  const [open, setOpen]   = useState(false)
  const btnRef            = useRef<any>(null)
  const [pos, setPos]     = useState({ top: 0, right: 0 })

  function measureAndOpen() {
    btnRef.current?.measure((_: any, __: any, w: number, h: number, px: number, py: number) => {
      setPos({ top: py + h + 4, right: 8 })
      setOpen(true)
    })
  }

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={[styles.btn, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
        onPress={measureAndOpen}
      >
        <Ionicons name="ellipsis-vertical-outline" size={18} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={StyleSheet.absoluteFill}>
            <View style={[styles.menu, { top: pos.top, right: pos.right, backgroundColor: theme.cardInner, borderColor: theme.cardBorder }]}>
              {items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.item,
                    i < items.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: theme.rowBorder },
                    item.active && { backgroundColor: theme.primaryBg },
                  ]}
                  onPress={() => { setOpen(false); item.onPress() }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={16}
                    color={item.danger ? theme.danger : item.active ? theme.primary : theme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemText,
                        { color: item.danger ? theme.danger : item.active ? theme.primaryText : theme.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.subtitle ? (
                      <Text style={[styles.itemSubtitle, { color: item.active ? theme.primary : theme.textMuted }]}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {item.active ? (
                    <Ionicons name="checkmark-sharp" size={15} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  btn:                { width: 32, height: 32, borderRadius: 16, borderWidth: 0.5, borderColor: '#E0DED7', backgroundColor: '#F2F1EB', alignItems: 'center', justifyContent: 'center' },
  menu:               { position: 'absolute', backgroundColor: '#FAFAF8', borderWidth: 0.5, borderColor: '#E0DED7', borderRadius: 12, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },
  item:               { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  itemActive:         { backgroundColor: '#EBF3FB' },
  itemBorder:         { borderBottomWidth: 0.5, borderBottomColor: '#E0DED7' },
  itemText:           { fontSize: 13, color: '#2C2C2A' },
  itemTextActive:     { color: '#0C447C', fontWeight: '600' },
  itemSubtitle:       { fontSize: 10, color: '#888', marginTop: 1 },
  itemSubtitleActive: { color: '#185FA5' },
})
