import { useEffect, useId, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { palette } from './finance-visuals'

const MovingPath = Animated.createAnimatedComponent(Path)
const MovingCircle = Animated.createAnimatedComponent(Circle)
const samples = Array.from({ length: 33 }, (_, index) => index / 32)

function useDetailMotion(enabled: boolean) {
  const [motion] = useState(() => new Animated.Value(0))
  useEffect(() => {
    let disposed = false
    let reduced = true
    let appState = AppState.currentState
    let loop: Animated.CompositeAnimation | undefined
    const update = () => {
      loop?.stop()
      loop = undefined
      if (disposed || reduced || !enabled || appState === 'background' || appState === 'inactive') {
        if (reduced) motion.setValue(0)
        return
      }
      loop = Animated.loop(Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false, isInteraction: false }),
        Animated.timing(motion, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false, isInteraction: false }),
      ]), { resetBeforeIteration: false })
      loop.start()
    }
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced = value; update() })
    const visibility = AppState.addEventListener('change', value => { appState = value; update() })
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!disposed) { reduced = value; update() }
    }).catch(() => { if (!disposed) { reduced = false; update() } })
    return () => { disposed = true; loop?.stop(); preference.remove(); visibility.remove() }
  }, [enabled, motion])
  return motion
}

// Sample positions on the curves, so the lights follow the changing lines.
function wavePoint(phase: number) {
  const t = 0.32 + phase * 0.1
  const u = 1 - t
  return {
    x: u ** 3 * -80 + 3 * u ** 2 * t * 100 + 3 * u * t ** 2 * 185 + t ** 3 * 490,
    y: u ** 3 * 845 + 3 * u ** 2 * t * (690 + phase * 45) + 3 * u * t ** 2 * (960 - phase * 55) + t ** 3 * 707,
  }
}

function orbitPoint(phase: number, outer: boolean) {
  const angle = ((outer ? 102 + phase * 24 : 166 - phase * 28) * Math.PI) / 180
  const radius = outer ? 156 + phase * 5 : 112 + phase * 4
  return { x: 438 + Math.cos(angle) * radius, y: 58 + Math.sin(angle) * radius }
}

function AuthDecoration({ variant, enabled }: { variant: 'login' | 'register'; enabled: boolean }) {
  const id = useId().replace(/:/g, '')
  const accent = '#9582FF'
  const motion = useDetailMotion(enabled)
  const coordinate = (points: { x: number; y: number }[], axis: 'x' | 'y') => motion.interpolate({ inputRange: samples, outputRange: points.map(point => point[axis]) })
  const wave = samples.map(wavePoint)
  const innerOrbit = samples.map(phase => orbitPoint(phase, false))
  const outerOrbit = samples.map(phase => orbitPoint(phase, true))
  return (
        <Svg width="100%" height="100%" viewBox="0 0 430 932" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id={`${id}-halo`} cx="100%" cy="10%" rx="90%" ry="55%">
              <Stop offset="0" stopColor={accent} stopOpacity="0.18" />
              <Stop offset="0.55" stopColor={accent} stopOpacity="0.04" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`${id}-flow`} cx="0%" cy="100%" rx="95%" ry="45%">
              <Stop offset="0" stopColor="#6E7CFF" stopOpacity="0.25" />
              <Stop offset="1" stopColor="#6E7CFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {variant === 'register' && <G>
          <Rect width="430" height="932" fill={`url(#${id}-halo)`} />
          {/* Open orbits frame the page; the center stays quiet for the form. */}
          <MovingCircle cx="438" cy="58" r={motion.interpolate({ inputRange: [0, 1], outputRange: [112, 116] })} fill="none" stroke={accent} strokeOpacity="0.16" strokeWidth="1" />
          <MovingCircle cx="438" cy="58" r={motion.interpolate({ inputRange: [0, 1], outputRange: [156, 161] })} fill="none" stroke={accent} strokeOpacity="0.08" strokeWidth="1" />
          <MovingCircle testID="auth-orbit-light" cx={coordinate(innerOrbit, 'x')} cy={coordinate(innerOrbit, 'y')} r="3" fill={accent} opacity="0.6" />
          <MovingCircle cx={coordinate(outerOrbit, 'x')} cy={coordinate(outerOrbit, 'y')} r="2" fill={accent} opacity="0.35" />
          </G>}
          {variant === 'login' && <G>
          <Rect width="430" height="932" fill={`url(#${id}-flow)`} />
          <MovingPath testID="auth-wave-line" d={motion.interpolate({ inputRange: [0, 1], outputRange: ['M-80 845 C100 690 185 960 490 707', 'M-80 845 C100 735 185 905 490 707'] })} fill="none" stroke="#9AA5FF" strokeOpacity="0.18" strokeWidth="1" />
          <MovingPath d={motion.interpolate({ inputRange: [0, 1], outputRange: ['M-80 873 C100 718 185 988 490 735', 'M-80 873 C100 755 185 941 490 735'] })} fill="none" stroke="#9AA5FF" strokeOpacity="0.12" strokeWidth="1" />
          <MovingPath d={motion.interpolate({ inputRange: [0, 1], outputRange: ['M-80 901 C100 746 185 1016 490 763', 'M-80 901 C100 775 185 977 490 763'] })} fill="none" stroke="#9AA5FF" strokeOpacity="0.07" strokeWidth="1" />
          <MovingCircle testID="auth-wave-light" cx={coordinate(wave, 'x')} cy={coordinate(wave, 'y')} r="3" fill="#AEB7FF" opacity="0.5" />
          </G>}
        </Svg>
  )
}

export function AuthBackground({ variant = 'welcome', progress }: { variant?: 'welcome' | 'login' | 'register' | 'account'; progress?: Animated.Value }) {
  if (variant === 'welcome') {
    return <LinearGradient pointerEvents="none" colors={['#23264F', '#15182C', '#090B10', '#090B10']} locations={[0, 0.32, 0.62, 1]} style={StyleSheet.absoluteFill} />
  }
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { backgroundColor: '#090D14', overflow: 'hidden' }]}>
      <Animated.View testID="auth-login-decoration" style={[StyleSheet.absoluteFill, { opacity: progress ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : variant === 'account' ? 0.55 : variant === 'login' ? 1 : 0, transform: [{ translateY: progress ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, 28] }) : 0 }] }]}>
        <AuthDecoration variant="login" enabled={variant === 'login' || variant === 'account'} />
      </Animated.View>
      <Animated.View testID="auth-register-decoration" style={[StyleSheet.absoluteFill, { opacity: progress ?? (variant === 'account' ? 0.3 : variant === 'register' ? 1 : 0), transform: [{ translateY: progress ? progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) : 0 }] }]}>
        <AuthDecoration variant="register" enabled={variant === 'register' || variant === 'account'} />
      </Animated.View>
    </View>
  )
}

export const authVisuals = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#141924' },
  secondary: { minHeight: 54, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#141924', alignItems: 'center', justifyContent: 'center', padding: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '500', letterSpacing: -0.6 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '500', letterSpacing: -0.8, lineHeight: 35, textAlign: 'center' },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  label: { color: '#E3E6EF', fontSize: 13, fontWeight: '500' },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#141924', color: '#FFFFFF', fontSize: 16, paddingHorizontal: 16, paddingVertical: 14 },
  primary: { minHeight: 54, borderRadius: 28, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', padding: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
})
