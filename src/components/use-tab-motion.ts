import { useEffect, useState } from 'react'
import { Animated, Easing } from 'react-native'
import { useReducedMotionPreference } from './motion-preference'

export function useTabMotion(index: number) {
  const [selection] = useState(() => new Animated.Value(index))
  const reducedMotion = useReducedMotionPreference()
  useEffect(() => {
    if (reducedMotion !== false) { selection.setValue(index); return }
    const animation = Animated.timing(selection, { toValue: index, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false })
    animation.start()
    return () => animation.stop()
  }, [index, selection, reducedMotion])
  return selection
}
