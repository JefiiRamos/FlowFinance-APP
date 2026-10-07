import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Keyboard, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthAnchorContext, type AnchorRect, type AnchorStage } from './auth-flow-anchors'
import { FinanceIcon } from './finance-visuals'
import { authVisuals } from './auth-visuals'

// This transition only owns welcome -> authentication. Account entry mounts separately.
export function AuthFlowTransition({ active, email, welcome, auth }: { active: boolean; email: string; welcome: ReactNode; auth: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0))
  const [height, setHeight] = useState(0)
  const [settledActive, setSettledActive] = useState(false)
  const moving = active !== settledActive
  const insets = useSafeAreaInsets()
  const viewportRef = useRef<View>(null)
  const currentProgress = useRef(0)
  const currentHeight = useRef(0)
  const [anchors, setAnchors] = useState<Partial<Record<AnchorStage, AnchorRect & { email: string }>>>({})
  const source = active ? anchors.welcome : anchors.auth
  const destination = active ? anchors.auth : anchors.welcome
  const anchorsReady = source?.email === email && destination?.email === email
  const layoutReady = height > 0 && (!active || active === settledActive || anchorsReady)
  const report = useCallback((stage: AnchorStage, rect: AnchorRect) => {
    viewportRef.current?.measureInWindow((x, y) => {
      const offset = currentHeight.current * ((stage === 'welcome' ? 0 : 1) - currentProgress.current)
      setAnchors(previous => ({ ...previous, [stage]: { ...rect, email, x: rect.x - x, y: rect.y - y - offset } }))
    })
  }, [email])
  useEffect(() => {
    const listener = progress.addListener(({ value }) => { currentProgress.current = value })
    return () => progress.removeListener(listener)
  }, [progress])
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value) }).catch(() => { if (mounted) setReducedMotion(false) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => { mounted = false; subscription.remove() }
  }, [])
  useEffect(() => {
    if (!layoutReady || reducedMotion === null) return
    let cancelled = false
    let started = false
    let animation: Animated.CompositeAnimation | undefined
    const start = () => {
      if (cancelled || started) return
      started = true
      if (reducedMotion) { progress.setValue(active ? 1 : 0); setSettledActive(active); return }
      animation = Animated.timing(progress, { toValue: active ? 1 : 0, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
      animation.start(({ finished }) => { if (finished && !cancelled) setSettledActive(active) })
    }
    const subscription = Keyboard.addListener('keyboardDidHide', start)
    const timeout = Keyboard.isVisible() ? setTimeout(start, 700) : undefined
    if (Keyboard.isVisible()) Keyboard.dismiss()
    else start()
    return () => { cancelled = true; subscription.remove(); if (timeout !== undefined) clearTimeout(timeout); animation?.stop() }
  }, [active, layoutReady, progress, reducedMotion])
  return (
    <AuthAnchorContext.Provider value={{ active, moving, report }}>
      <View ref={viewportRef} collapsable={false} style={styles.viewport} onLayout={({ nativeEvent }) => { currentHeight.current = nativeEvent.layout.height; setHeight(nativeEvent.layout.height) }}>
        <Animated.View testID="auth-flow-welcome" style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) }] }]} pointerEvents={!active && !moving ? 'auto' : 'none'} accessibilityElementsHidden={active || moving} importantForAccessibility={active || moving ? 'no-hide-descendants' : 'auto'}>{welcome}</Animated.View>
        <Animated.View testID="auth-flow-form" style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]} pointerEvents={active && !moving ? 'auto' : 'none'} accessibilityElementsHidden={!active || moving} importantForAccessibility={!active || moving ? 'no-hide-descendants' : 'auto'}>{auth}</Animated.View>
        {(active || moving) && <View testID="auth-shared-brand" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[authVisuals.brand, { position: 'absolute', left: 0, right: 0, top: insets.top + (height - insets.top - insets.bottom < 680 ? 12 : 24) }]}><FinanceIcon name="sparkles" size={25} color="#FFFFFF" /><Text style={authVisuals.brandName}>FlowFinance</Text></View>}
        {moving && anchorsReady && source && destination && <Animated.View testID="auth-shared-email" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[authVisuals.input, { position: 'absolute', left: source.x, top: source.y, width: source.width, height: source.height, justifyContent: 'center', transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: active ? [0, destination.x - source.x] : [destination.x - source.x, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: active ? [0, destination.y - source.y] : [destination.y - source.y, 0] }) },
        ] }]}><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 16 }}>{email}</Text></Animated.View>}
      </View>
    </AuthAnchorContext.Provider>
  )
}
const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#090B10' },
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
