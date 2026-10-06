import { useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Keyboard, StyleSheet, View } from 'react-native'

// Both pages move by the same distance, like two sections of one vertical page.
export function AuthFlowTransition({ active, welcome, auth }: { active: boolean; welcome: ReactNode; auth: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0))
  const [height, setHeight] = useState(0)
  const [settledActive, setSettledActive] = useState(false)
  const moving = settledActive !== active
  const layoutReady = height > 0
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReducedMotion(value)
    }).catch(() => { if (mounted) setReducedMotion(false) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => { mounted = false; subscription.remove() }
  }, [])

  useEffect(() => {
    if (!layoutReady || reducedMotion === null) return
    let cancelled = false
    let animation: Animated.CompositeAnimation | undefined
    let started = false
    const start = () => {
      if (cancelled || started) return
      started = true
      if (reducedMotion) {
        progress.setValue(active ? 1 : 0)
        setSettledActive(active)
        return
      }
      animation = Animated.timing(progress, {
        toValue: active ? 1 : 0,
        duration: 650,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
      animation.start(({ finished }) => { if (finished && !cancelled) setSettledActive(active) })
    }
    // Let keyboard dismissal finish before moving the entire page.
    const subscription = Keyboard.addListener('keyboardDidHide', start)
    const timeout = Keyboard.isVisible() ? setTimeout(start, 700) : undefined
    if (Keyboard.isVisible()) Keyboard.dismiss()
    else start()
    return () => {
      cancelled = true
      subscription.remove()
      if (timeout !== undefined) clearTimeout(timeout)
      animation?.stop()
    }
  }, [active, layoutReady, progress, reducedMotion])

  return (
    <View style={styles.viewport} onLayout={({ nativeEvent }) => setHeight(nativeEvent.layout.height)}>
      <Animated.View
        testID="auth-flow-welcome"
        style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }]}
        pointerEvents={!active && !moving ? 'auto' : 'none'}
        accessibilityElementsHidden={active || moving}
        importantForAccessibility={active || moving ? 'no-hide-descendants' : 'auto'}
      >{welcome}</Animated.View>
      <Animated.View
        testID="auth-flow-form"
        style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}
        pointerEvents={active && !moving ? 'auto' : 'none'}
        accessibilityElementsHidden={!active || moving}
        importantForAccessibility={!active || moving ? 'no-hide-descendants' : 'auto'}
      >{auth}</Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#090B10' },
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
