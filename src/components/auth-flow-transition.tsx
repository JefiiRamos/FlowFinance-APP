import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Keyboard, StyleSheet, Text, View } from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthAnchorContext, type AnchorRect, type AnchorStage } from './auth-flow-anchors'
import { FinanceBackground, FinanceIcon } from './finance-visuals'
import { authVisuals } from './auth-visuals'

// Welcome, authentication and account are sections of one continuous page.
export function AuthFlowTransition({ active, authenticated = false, email, userName = '', welcome, auth, account }: { active: boolean; authenticated?: boolean; email: string; userName?: string; welcome: ReactNode; auth: ReactNode; account?: ReactNode }) {
  const step = authenticated ? 2 : active ? 1 : 0
  const stages: AnchorStage[] = ['welcome', 'auth', 'account']
  const [progress] = useState(() => new Animated.Value(step))
  const [height, setHeight] = useState(0)
  const [settledStep, setSettledStep] = useState(step)
  const moving = settledStep !== step
  const [brandTravel] = useState(() => new Animated.Value(step === 2 ? 2 : 0))
  const [greeting] = useState(() => new Animated.Value(step === 2 ? 1 : 0))
  const [curtain] = useState(() => new Animated.Value(0))
  const [accountReveal] = useState(() => new Animated.Value(step === 2 ? 1 : 0))
  const insets = useSafeAreaInsets()
  const viewportRef = useRef<View>(null)
  const currentProgress = useRef(step)
  const currentHeight = useRef(0)
  const [anchors, setAnchors] = useState<Partial<Record<AnchorStage, AnchorRect & { email: string }>>>({})
  const source = anchors[stages[settledStep]]
  const destination = anchors[stages[step]]
  const anchorsReady = source?.email === email && destination?.email === email
  const layoutReady = height > 0 && (step === settledStep || step === 0 || step === 2 || anchorsReady)
  const report = useCallback((stage: AnchorStage, rect: AnchorRect) => {
    viewportRef.current?.measureInWindow((x, y) => {
      const index = stage === 'welcome' ? 0 : stage === 'auth' ? 1 : 2
      const offset = currentHeight.current * (index - currentProgress.current)
      const normalized = { ...rect, email, x: rect.x - x, y: rect.y - y - offset }
      setAnchors(previous => ({ ...previous, [stage]: normalized }))
    })
  }, [email])
  useEffect(() => {
    const listener = progress.addListener(({ value }) => { currentProgress.current = value })
    return () => progress.removeListener(listener)
  }, [progress])
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
        progress.setValue(step)
        brandTravel.setValue(step === 2 ? 2 : 0)
        greeting.setValue(step === 2 ? 1 : 0)
        curtain.setValue(0)
        accountReveal.setValue(1)
        setSettledStep(step)
        return
      }
      if (step === 2 && settledStep !== 2) {
        const timing = (value: Animated.Value, toValue: number, duration: number) => Animated.timing(value, { toValue, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
        animation = Animated.sequence([
          Animated.parallel([timing(brandTravel, 1, 700), timing(curtain, 1, 450)]),
          timing(greeting, 1, 350),
          Animated.delay(650),
          Animated.parallel([timing(brandTravel, 2, 750), timing(progress, 2, 750), timing(accountReveal, 1, 750), timing(curtain, 0, 750)]),
        ])
      } else {
        if (step !== 2) { brandTravel.setValue(0); greeting.setValue(0); curtain.setValue(0); accountReveal.setValue(0) }
        animation = Animated.timing(progress, { toValue: step, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
      }
      animation.start(({ finished }) => { if (finished && !cancelled) setSettledStep(step) })
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
  }, [step, settledStep, layoutReady, progress, reducedMotion, brandTravel, greeting, curtain, accountReveal])

  return (
    <AuthAnchorContext.Provider value={{ active: step > 0, moving, report }}>
    <View ref={viewportRef} collapsable={false} style={styles.viewport} onLayout={({ nativeEvent }) => { currentHeight.current = nativeEvent.layout.height; setHeight(nativeEvent.layout.height) }}>
      <Animated.View
        testID="auth-flow-welcome"
        style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 2], outputRange: [0, -height * 2] }) }] }]}
        pointerEvents={step === 0 && !moving ? 'auto' : 'none'}
        accessibilityElementsHidden={step !== 0 || moving}
        importantForAccessibility={step !== 0 || moving ? 'no-hide-descendants' : 'auto'}
      >{welcome}</Animated.View>
      <Animated.View
        testID="auth-flow-form"
        style={[styles.page, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 2], outputRange: [height, -height] }) }] }]}
        pointerEvents={step === 1 && !moving ? 'auto' : 'none'}
        accessibilityElementsHidden={step !== 1 || moving}
        importantForAccessibility={step !== 1 || moving ? 'no-hide-descendants' : 'auto'}
      >{step === 2 && !moving ? null : auth}</Animated.View>
      <Animated.View testID="auth-flow-account" style={[styles.page, { opacity: accountReveal, transform: [{ translateY: step === 2 ? 0 : progress.interpolate({ inputRange: [0, 2], outputRange: [height * 2, 0] }) }] }]} pointerEvents={step === 2 && !moving ? 'auto' : 'none'} accessibilityElementsHidden={step !== 2 || moving} importantForAccessibility={step !== 2 || moving ? 'no-hide-descendants' : 'auto'}>{account}</Animated.View>
      <Animated.View pointerEvents="none" style={[styles.page, { opacity: curtain }]}><FinanceBackground /></Animated.View>
      {(step > 0 || moving) && <Animated.View testID="auth-shared-brand" pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: insets.top + (height - insets.top - insets.bottom < 680 ? 12 : 24), transform: [
        { translateY: brandTravel.interpolate({ inputRange: [0, 1, 2], outputRange: [0, height / 2 - insets.top - (height - insets.top - insets.bottom < 680 ? 12 : 24) - 38, 0] }) },
        { scale: brandTravel.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.16, 1] }) },
      ] }}>
        <View style={authVisuals.brand} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><FinanceIcon name="sparkles" size={25} color="#FFFFFF" /><Text style={authVisuals.brandName}>FlowFinance</Text></View>
        {step === 2 && <Animated.Text testID="account-welcome-greeting" accessibilityLiveRegion="polite" style={{ opacity: greeting, color: '#E3E6EF', fontSize: 18, lineHeight: 24, fontWeight: '500', textAlign: 'center', marginTop: 10, paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' }} numberOfLines={2}>Bem-vindo{userName ? ', ' + userName : ''}</Animated.Text>}
      </Animated.View>}
      {moving && step !== 2 && settledStep !== 2 && email && anchorsReady && source && destination && <Animated.View testID="auth-shared-email" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[authVisuals.input, {
        position: 'absolute', left: source.x, top: source.y, width: source.width, height: source.height, justifyContent: 'center',
        transform: [
          { translateX: progress.interpolate({ inputRange: settledStep < step ? [settledStep, step] : [step, settledStep], outputRange: settledStep < step ? [0, destination.x - source.x] : [destination.x - source.x, 0] }) },
          { translateY: progress.interpolate({ inputRange: settledStep < step ? [settledStep, step] : [step, settledStep], outputRange: settledStep < step ? [0, destination.y - source.y] : [destination.y - source.y, 0] }) },
        ],
      }]}><Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 16 }}>{email}</Text></Animated.View>}
    </View>
    </AuthAnchorContext.Provider>
  )
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#090B10' },
  page: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
})
