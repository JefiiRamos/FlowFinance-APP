import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useReducedMotionPreference } from './motion-preference'

export function AnimatedChoiceTabs({ value, options, onChange, disabled = false }: {
  value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean
}) {
  const index = Math.max(0, options.findIndex(option => option.id === value))
  const [position] = useState(() => new Animated.Value(index))
  const [width, setWidth] = useState(0)
  const reducedMotion = useReducedMotionPreference()
  const cell = Math.max(0, (width - 8) / options.length)
  useEffect(() => {
    if (reducedMotion !== false) { position.setValue(index); return }
    const animation = Animated.timing(position, { toValue: index, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false })
    animation.start()
    return () => animation.stop()
  }, [index, position, reducedMotion])
  return <View style={s.tabs} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
    {width > 0 && <Animated.View pointerEvents="none" style={[s.indicator, { width: cell, transform: [{ translateX: Animated.multiply(position, cell) }] }]} />}
    {options.map((option, optionIndex) => <Pressable key={option.id} accessibilityRole="tab" accessibilityLabel={option.label} accessibilityState={{ selected: value === option.id, disabled }} disabled={disabled} onPress={() => { if (value !== option.id) onChange(option.id) }} style={({ pressed }) => [s.tab, pressed && { opacity: 0.7 }]}>
      <Text style={s.label}>{option.label}</Text>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.activeLabel, { opacity: position.interpolate({ inputRange: [optionIndex - 1, optionIndex, optionIndex + 1], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}><Text style={[s.label, { color: '#FFFFFF' }]}>{option.label}</Text></Animated.View>
    </Pressable>)}
  </View>
}

export function SoftTransition({ changeKey, children, style }: PropsWithChildren<{ changeKey: string; style?: StyleProp<ViewStyle> }>) {
  const [progress] = useState(() => new Animated.Value(1))
  const previous = useRef(changeKey)
  const reducedMotion = useReducedMotionPreference()
  useEffect(() => {
    if (previous.current === changeKey) return
    previous.current = changeKey
    if (reducedMotion !== false) { progress.setValue(1); return }
    progress.setValue(0)
    const animation = Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false })
    animation.start()
    return () => { animation.stop(); progress.setValue(1) }
  }, [changeKey, progress, reducedMotion])
  return <Animated.View style={[style, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>{children}</Animated.View>
}
const s = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', position: 'relative' },
  indicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: '#252B40' },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  label: { color: '#A1A7B3', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  activeLabel: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
})
