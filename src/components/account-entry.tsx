import { useEffect, useState, type PropsWithChildren } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, Keyboard, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthBackground, authVisuals } from './auth-visuals'
import { FinanceIcon } from './finance-visuals'

type Phase = 'header' | 'content' | 'ready'

// A fresh instance is mounted for each authenticated session. The actual account
// is a plain View, never a child of the welcome/auth animated page stack.
export function AccountEntry({ animate, userName, children }: PropsWithChildren<{ animate: boolean; userName: string }>) {
  const insets = useSafeAreaInsets()
  const [height, setHeight] = useState(0)
  const [phase, setPhase] = useState<Phase>(animate ? 'header' : 'ready')
  const [travel] = useState(() => new Animated.Value(0))
  const [greeting] = useState(() => new Animated.Value(0))
  const [mask] = useState(() => new Animated.Value(1))
  const layoutReady = height > 0
  const headerTop = insets.top + (height - insets.top - insets.bottom < 680 ? 12 : 24)

  useEffect(() => {
    if (!animate || !layoutReady) return
    let disposed = false
    let completed = false
    let started = false
    let animation: Animated.CompositeAnimation | undefined
    let fallback: ReturnType<typeof setTimeout> | undefined
    let keyboardTimeout: ReturnType<typeof setTimeout> | undefined
    let keyboardSubscription: ReturnType<typeof Keyboard.addListener> | undefined
    const finish = (skipMotion: boolean) => {
      if (disposed || (completed && !skipMotion)) return
      completed = true
      if (fallback !== undefined) clearTimeout(fallback)
      travel.setValue(2)
      greeting.setValue(1)
      setPhase(skipMotion ? 'ready' : 'content')
    }
    const start = () => {
      if (disposed || started || completed) return
      started = true
      keyboardSubscription?.remove()
      if (keyboardTimeout !== undefined) clearTimeout(keyboardTimeout)
      const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false })
      animation = Animated.sequence([
        timing(travel, 1, 650),
        timing(greeting, 1, 320),
        Animated.delay(480),
        timing(travel, 2, 650),
      ])
      // Native animations can be interrupted when the app backgrounds. Even if
      // the native completion callback is lost, account mounting must continue.
      fallback = setTimeout(() => finish(false), 2350)
      animation.start(({ finished }) => { if (finished) finish(false) })
    }
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      if (value) { animation?.stop(); finish(true) }
    })
    let backgrounded = false
    const visibility = AppState.addEventListener('change', value => {
      if (value !== 'active') backgrounded = true
      else if (backgrounded) { animation?.stop(); finish(true) }
    })
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (disposed) return
      if (value) { finish(true); return }
      if (Keyboard.isVisible()) {
        keyboardSubscription = Keyboard.addListener('keyboardDidHide', start)
        keyboardTimeout = setTimeout(start, 600)
        Keyboard.dismiss()
      } else start()
    }).catch(start)
    return () => {
      disposed = true
      animation?.stop()
      if (fallback !== undefined) clearTimeout(fallback)
      if (keyboardTimeout !== undefined) clearTimeout(keyboardTimeout)
      keyboardSubscription?.remove()
      preference.remove()
      visibility.remove()
    }
  }, [animate, layoutReady, travel, greeting])

  useEffect(() => {
    if (phase !== 'content') return
    let disposed = false
    const finish = () => { if (!disposed) setPhase('ready') }
    const fallback = setTimeout(finish, 600)
    const animation = Animated.timing(mask, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false })
    animation.start(({ finished }) => { if (finished) { clearTimeout(fallback); finish() } })
    return () => { disposed = true; clearTimeout(fallback); animation.stop() }
  }, [phase, mask])

  const brand = <View style={authVisuals.brand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><FinanceIcon name="sparkles" size={25} color="#FFFFFF" /><Text style={authVisuals.brandName}>FlowFinance</Text></View>
  const greetingText = 'Bem-vindo' + (userName ? ', ' + userName : '')
  return (
    <View testID="account-entry" style={styles.screen} onLayout={({ nativeEvent }) => setHeight(nativeEvent.layout.height)}>
      <StatusBar style="light" />
      {phase === 'header' ? <AuthBackground variant="account" /> : <View testID="auth-flow-account" collapsable={false} style={styles.screen} pointerEvents={phase === 'ready' ? 'auto' : 'none'}>{children}</View>}
      {phase === 'content' && <Animated.View testID="account-content-reveal-mask" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#090D14', opacity: mask }]} />}
      {phase === 'header' ? (
        <Animated.View testID="auth-shared-brand" pointerEvents="none" style={[styles.header, { top: headerTop, transform: [
          { translateY: travel.interpolate({ inputRange: [0, 1, 2], outputRange: [0, Math.max(0, height / 2 - headerTop - 38), 0] }) },
          { scale: travel.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.16, 1] }) },
        ] }]}>
          {brand}
          <Animated.Text testID="account-welcome-greeting" accessibilityLiveRegion="polite" style={[styles.greeting, { opacity: greeting }]} numberOfLines={2}>{greetingText}</Animated.Text>
        </Animated.View>
      ) : (
        <View testID="auth-shared-brand" pointerEvents="none" style={[styles.header, { top: headerTop }]}>{brand}<Text testID="account-welcome-greeting" accessibilityLiveRegion="polite" style={styles.greeting} numberOfLines={2}>{greetingText}</Text></View>
      )}
    </View>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#090D14' },
  header: { position: 'absolute', left: 0, right: 0 },
  greeting: { color: '#E3E6EF', fontSize: 18, lineHeight: 24, fontWeight: '500', textAlign: 'center', marginTop: 10, paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
})
