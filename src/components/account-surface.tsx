import { useEffect, useState, type PropsWithChildren } from 'react'
import { AccessibilityInfo, Animated, Dimensions, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { FinanceBackground } from './finance-visuals'

export function AccountSurface({ completed, children }: PropsWithChildren<{ completed: boolean }>) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const layoutHeight = Platform.OS === 'android' ? Dimensions.get('screen').height : height
  const compact = layoutHeight - insets.top - insets.bottom < 680
  const [reveal] = useState(() => new Animated.Value(0))
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value) }).catch(() => { if (mounted) setReducedMotion(false) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion)
    return () => { mounted = false; subscription.remove() }
  }, [])
  useEffect(() => {
    if (reducedMotion === null) return
    if (reducedMotion) { reveal.setValue(1); return }
    reveal.setValue(0)
    const animation = Animated.timing(reveal, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [completed, reducedMotion, reveal])
  return (
    <View style={styles.screen}>
      <FinanceBackground />
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ height: compact ? 90 : 102 }} />
        <Animated.View style={{ flex: 1, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>
      </SafeAreaView>
    </View>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090B10' },
  identity: { width: '100%', maxWidth: 480, alignSelf: 'center', paddingBottom: 12 },
})
