import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { Animated, Easing } from 'react-native'
import { useReducedMotionPreference } from './motion-preference'

export function SectionTransition({ section, children }: PropsWithChildren<{ section: string }>) {
  const [progress] = useState(() => new Animated.Value(1))
  const previous = useRef(section)
  const reducedMotion = useReducedMotionPreference()
  useEffect(() => {
    if (previous.current === section) return
    previous.current = section
    if (reducedMotion !== false) { progress.setValue(1); return }
    progress.setValue(0)
    const animation = Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false })
    animation.start(({ finished }) => { if (finished) progress.setValue(1) })
    return () => { animation.stop(); progress.setValue(1) }
  }, [section, progress, reducedMotion])
  return <Animated.View testID="section-transition" style={{ flex: 1, minHeight: 0, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View>
}
