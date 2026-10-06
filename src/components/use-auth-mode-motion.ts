import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing } from 'react-native'

export function useAuthModeMotion(mode: 'login' | 'register') {
  const [progress] = useState(() => new Animated.Value(mode === 'register' ? 1 : 0))
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
    if (reducedMotion === null) return
    if (reducedMotion) { progress.setValue(mode === 'register' ? 1 : 0); return }
    // One timeline keeps the field expansion and background reveal in sync.
    const animation = Animated.timing(progress, {
      toValue: mode === 'register' ? 1 : 0,
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [mode, progress, reducedMotion])
  return progress
}
