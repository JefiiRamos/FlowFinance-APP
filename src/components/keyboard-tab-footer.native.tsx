import { useEffect, useState, type PropsWithChildren } from 'react'
import { Keyboard, Platform, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'

export function KeyboardTabFooter({ children }: PropsWithChildren) {
  const { progress } = useReanimatedKeyboardAnimation()
  const reducedMotion = useReducedMotion()
  const [fullHeight, setFullHeight] = useState(100)
  const [hidden, setHidden] = useState(() => Keyboard.isVisible())
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setHidden(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setHidden(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  // Follow the native keyboard frame, including interactive dismissal, without
  // JS animation timers or unmounting the bar halfway through its transition.
  const slotStyle = useAnimatedStyle(() => {
    const amount = Math.max(0, Math.min(1, progress.value))
    return { height: fullHeight * (1 - amount), opacity: reducedMotion ? (amount < 0.01 ? 1 : 0) : Math.max(0, 1 - amount * 1.3) }
  }, [fullHeight, reducedMotion])
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateY: reducedMotion ? 0 : Math.max(0, Math.min(1, progress.value)) * 20 }] }), [reducedMotion])
  return (
    <Animated.View style={[{ flexShrink: 0, overflow: 'hidden' }, slotStyle]} pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
      <Animated.View style={barStyle}><View collapsable={false} onLayout={({ nativeEvent }) => { if (nativeEvent.layout.height > 0) setFullHeight(nativeEvent.layout.height) }}>{children}</View></Animated.View>
    </Animated.View>
  )
}
