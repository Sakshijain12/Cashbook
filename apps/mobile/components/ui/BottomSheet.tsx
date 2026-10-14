// apps/mobile/components/ui/BottomSheet.tsx
import { useEffect, useRef } from 'react'
import {
  Modal, View, TouchableOpacity, StyleSheet,
  Animated, useWindowDimensions, PanResponder, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useAppTheme } from '../../lib/theme'

interface Props {
  visible:    boolean
  onClose:    () => void
  children:   React.ReactNode
  snapHeight?: number  // 0–1 fraction of screen height, default 0.6
}

export function BottomSheet({ visible, onClose, children, snapHeight = 0.6 }: Props) {
  const theme = useAppTheme()
  const { height: SCREEN_H } = useWindowDimensions()
  const sheetH     = Math.min(Math.round(SCREEN_H * snapHeight), Math.round(SCREEN_H * 0.85))
  const isWeb      = Platform.OS === 'web'
  const translateY = useRef(new Animated.Value(sheetH)).current

  useEffect(() => {
    if (visible) {
      translateY.setValue(sheetH)
      Animated.spring(translateY, {
        toValue:         0,
        useNativeDriver: !isWeb,
        tension:         65,
        friction:        11,
      }).start()
    } else {
      Animated.timing(translateY, {
        toValue:         sheetH,
        duration:        200,
        useNativeDriver: !isWeb,
      }).start()
    }
  }, [visible, sheetH, isWeb])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove:          (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > sheetH * 0.3 || g.vy > 0.5) {
          onClose()
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: !isWeb, tension: 65, friction: 11,
          }).start()
        }
      },
    })
  ).current

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            { height: sheetH, transform: [{ translateY }], backgroundColor: theme.cardInner, borderTopColor: theme.cardBorder, borderTopWidth: 0.5 },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={[styles.handle, { backgroundColor: theme.cardBorder }]} />
          </View>
          <View style={styles.body}>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FAFAF8', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  handleArea: { paddingVertical: 10, alignItems: 'center' },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D3D1C7' },
  body:       { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
})

