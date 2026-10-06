import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Dimensions, Easing, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthBackground, authVisuals } from './auth-visuals'
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg'
import { FinanceIcon, palette } from './finance-visuals'
import { WelcomeKeyboardLayout } from './keyboard-layout'
import { SharedEmailAnchor, useAuthAnchors } from './auth-flow-anchors'

export function WelcomeScreen({ initialEmail = '', verifiedMode, onContinue }: { initialEmail?: string; verifiedMode?: 'login' | 'register'; onContinue: (email: string) => Promise<void> }) {
  const anchors = useAuthAnchors()
  const [email, setEmail] = useState(initialEmail)
  const [emailError, setEmailError] = useState('')
  const [checking, setChecking] = useState(false)
  const pending = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible())

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    })
    return () => { show.remove(); hide.remove() }
  }, [])
  async function continueWithEmail() {
    if (!canInteract || pending.current) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Digite um e-mail válido para continuar.')
      return
    }
    setEmailError('')
    setEmail(normalizedEmail)
    Keyboard.dismiss()
    pending.current = true
    setChecking(true)
    try { await onContinue(normalizedEmail) } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Não foi possível verificar seu e-mail. Tente novamente.')
    } finally { pending.current = false; setChecking(false) }
  }
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // Android resizes the window for the keyboard; keep typography and spacing
  // based on the full screen so crossing a breakpoint does not cause a jump.
  const layoutHeight = Platform.OS === 'android' ? Dimensions.get('screen').height : height
  const availableHeight = layoutHeight - insets.top - insets.bottom
  const compact = availableHeight < 680
  const short = availableHeight < 520
  const [brandOpacity] = useState(() => new Animated.Value(0))
  const [brandPosition] = useState(() => new Animated.Value(0))
  const [heroProgress] = useState(() => new Animated.Value(0))
  const [bodyProgress] = useState(() => new Animated.Value(0))
  const [brandCenter, setBrandCenter] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  const [introFinished, setIntroFinished] = useState(false)
  const canInteract = introFinished || reducedMotion === true
  const layoutReady = brandCenter !== null
  const centerOffset = height / 2 - insets.top - (brandCenter ?? 0)

  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled)
    }).catch(() => { if (active) setReducedMotion(false) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => { active = false; subscription.remove() }
  }, [])

  useEffect(() => {
    if (!layoutReady || reducedMotion === null) return
    if (reducedMotion) {
      brandOpacity.setValue(1)
      brandPosition.setValue(1)
      heroProgress.setValue(1)
      bodyProgress.setValue(1)
      return
    }
    const intro = Animated.sequence([
      Animated.timing(brandOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.delay(240),
      Animated.timing(brandPosition, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.stagger(130, [
        Animated.timing(heroProgress, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bodyProgress, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ])
    intro.start(({ finished }) => { if (finished) setIntroFinished(true) })
    return () => intro.stop()
  }, [layoutReady, reducedMotion, brandOpacity, brandPosition, heroProgress, bodyProgress])
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AuthBackground />
      <SafeAreaView style={styles.safeArea}>
        <WelcomeKeyboardLayout>
        <ScrollView ref={scrollRef} scrollEnabled={keyboardOpen} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={false} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, compact && styles.compactContent]}>
          <Animated.View testID="welcome-brand" onLayout={({ nativeEvent }) => setBrandCenter(nativeEvent.layout.y + nativeEvent.layout.height / 2)} style={[authVisuals.brand, {
            zIndex: 1,
            opacity: anchors.active || anchors.moving ? 0 : brandOpacity,
            transform: [
              { translateY: brandPosition.interpolate({ inputRange: [0, 1], outputRange: [centerOffset, 0] }) },
              { scale: brandPosition.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1] }) },
            ],
          }]}>
            <FinanceIcon name="sparkles" size={25} color="#FFFFFF" />
            <Text style={authVisuals.brandName}>FlowFinance</Text>
          </Animated.View>

          <Animated.View style={[styles.hero, compact && { marginVertical: 8 }, { opacity: heroProgress, transform: [{ scale: heroProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width="100%" height="100%" viewBox="0 0 340 310">
              <Defs>
                <SvgGradient id="wallet" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#8994FF" /><Stop offset="1" stopColor="#4B53CF" />
                </SvgGradient>
                <SvgGradient id="coin" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#D2D6FF" /><Stop offset="1" stopColor="#7C88FF" />
                </SvgGradient>
              </Defs>
              <Circle cx="170" cy="145" r="125" fill="#6E7CFF" opacity="0.05" />
              <Circle cx="170" cy="145" r="96" fill="none" stroke="#8A94FF" strokeWidth="1" opacity="0.12" />
              <Ellipse cx="175" cy="260" rx="104" ry="14" fill="#000000" opacity="0.28" />
              <Rect x="77" y="112" width="184" height="126" rx="28" fill="#3B409D" transform="rotate(-8 170 175)" />
              <Rect x="89" y="82" width="151" height="100" rx="18" fill="#22263D" stroke="#5B638D" transform="rotate(-13 164 132)" />
              <Path d="M110 117h57M110 130h33" stroke="#AEB5E1" strokeWidth="6" strokeLinecap="round" transform="rotate(-13 164 132)" />
              <Circle cx="212" cy="88" r="33" fill="#535CC4" />
              <Circle cx="208" cy="84" r="31" fill="url(#coin)" stroke="#DEE1FF" strokeWidth="2" />
              <Path d="M208 66v36m9-29c-5-7-19-5-19 2 0 11 21 5 21 15 0 8-15 11-23 3" fill="none" stroke="#4E56B2" strokeWidth="4" strokeLinecap="round" />
              <Rect x="69" y="136" width="196" height="112" rx="26" fill="url(#wallet)" stroke="#A6AEFF" strokeWidth="1.5" />
              <Path d="M87 153h153" stroke="#CDD2FF" strokeWidth="2" opacity="0.45" strokeLinecap="round" />
              <Rect x="215" y="171" width="62" height="44" rx="14" fill="#33396F" stroke="#A3ACFF" />
              <Circle cx="236" cy="193" r="5" fill="#CDD2FF" />
              <Path d="m112 209 16-16 13 9 21-23m-13 0h13v13" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <Path d="m277 71 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z" fill="#D3D7FF" />
              <Path d="m56 116 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#909AFF" />
              <Circle cx="282" cy="240" r="4" fill="#8893FF" opacity="0.5" />
            </Svg>
          </Animated.View>

          <Animated.View testID="welcome-body" pointerEvents={canInteract ? 'auto' : 'none'} accessibilityElementsHidden={!canInteract} importantForAccessibility={canInteract ? 'auto' : 'no-hide-descendants'} style={[styles.bottom, compact && { gap: short ? 8 : 12 }, { opacity: bodyProgress }]}>
            <Text accessibilityRole="header" style={[authVisuals.title, compact && { fontSize: short ? 22 : 25, lineHeight: short ? 28 : 31 }]}>Seu dinheiro em ordem.{ '\n' }Sua vida mais leve.</Text>
            <Text style={[authVisuals.subtitle, short && { fontSize: 13, lineHeight: 18 }]}>Organize seus gastos, alcance suas metas e conte com a IA no dia a dia.</Text>
            <View style={[styles.actions, compact && { marginTop: 0, gap: 8 }]}>
              <Text style={authVisuals.label}>Seu e-mail</Text>
              <SharedEmailAnchor stage="welcome">
              <TextInput
                accessibilityLabel="Seu e-mail"
                placeholder="voce@email.com"
                placeholderTextColor={palette.muted}
                value={email}
                onChangeText={(value) => { setEmail(value); setEmailError('') }}
                editable={canInteract && !checking}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={continueWithEmail}
                style={[authVisuals.input, emailError ? styles.emailInputError : undefined]}
              />
              </SharedEmailAnchor>
              <Text accessibilityLiveRegion="polite" style={styles.verificationStatus}>{verifiedMode ? (verifiedMode === 'login' ? 'Encontramos sua conta.' : 'Vamos criar sua conta.') : checking ? 'Verificando seu e-mail…' : ''}</Text>
              {emailError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{emailError}</Text> : null}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canInteract || checking, busy: checking }} disabled={!canInteract || checking} onPress={() => void continueWithEmail()} style={({ pressed }) => [authVisuals.primary, compact && styles.compactButton, checking && { opacity: 0.7 }, pressed && styles.pressed]}>
                <Text style={authVisuals.primaryText}>{verifiedMode ? 'Tudo pronto' : checking ? 'Verificando…' : 'Continuar'}</Text>
              </Pressable>
            </View>
            <Text style={styles.footer}>Mais clareza para cada decisão financeira.</Text>
          </Animated.View>
        </ScrollView>
        </WelcomeKeyboardLayout>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090B10' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, flexShrink: 1, flexBasis: 0, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, width: '100%', maxWidth: 480, alignSelf: 'center' },
  compactContent: { paddingHorizontal: 20, paddingVertical: 12 },
  compactButton: { minHeight: 48, paddingVertical: 12 },
  hero: { flex: 1, minHeight: 0, maxHeight: 430, marginVertical: 16 },
  bottom: { flexShrink: 0, marginTop: 'auto', gap: 16 },
  actions: { gap: 10, marginTop: 8 },
  emailInputError: { borderColor: '#FF9A9A' },
  verificationStatus: { color: palette.muted, fontSize: 13, lineHeight: 18, minHeight: 18 },
  errorText: { color: '#FF9A9A', fontSize: 12, lineHeight: 18 },
  footer: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  pressed: { opacity: 0.8 },
})
