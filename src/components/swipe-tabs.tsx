import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Keyboard, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { useReducedMotionPreference } from './motion-preference'

const PagerPosition = createContext<Animated.AnimatedDivision<number> | null>(null)
export function usePagerPosition() {
  const position = useContext(PagerPosition)
  if (!position) throw new Error('Tabbar must be inside SwipeTabs')
  return position
}

export function SwipeTabs({ index, onIndexChange, pages, footer }: { index: number; onIndexChange: (index: number) => void; pages: ReactNode[]; footer: ReactNode }) {
  const window = useWindowDimensions()
  const [width, setWidth] = useState(window.width)
  const [offset] = useState(() => new Animated.Value(index * window.width))
  const scroll = useRef<ScrollView>(null)
  const requested = useRef<number | null>(null)
  const lastRequest = useRef({ index: -1, width: -1 })
  const webTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reducedMotion = useReducedMotionPreference()
  const position = useMemo(() => Animated.divide(offset, Math.max(1, width)), [offset, width])

  useEffect(() => {
    if (lastRequest.current.index === index && lastRequest.current.width === width) return
    const animate = lastRequest.current.width === width && reducedMotion === false
    lastRequest.current = { index, width }
    requested.current = animate ? index : null
    scroll.current?.scrollTo({ x: index * width, animated: animate })
    if (!animate) offset.setValue(index * width)
  }, [index, width, offset, reducedMotion])
  useEffect(() => () => { if (webTimer.current !== undefined) clearTimeout(webTimer.current) }, [])

  const settle = useCallback((x: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, Math.round(x / Math.max(1, width))))
    // An interrupted programmatic scroll must not override a newer tab tap.
    if (Platform.OS !== 'web' && requested.current !== null && Math.abs(x - requested.current * width) > 2) return
    requested.current = null
    lastRequest.current = { index: next, width }
    if (next !== index) onIndexChange(next)
  }, [index, onIndexChange, pages.length, width])
  const onScroll = useMemo(() => Animated.event([{ nativeEvent: { contentOffset: { x: offset } } }], { useNativeDriver: Platform.OS !== 'web' }), [offset])
  const onWebScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll(event)
    if (webTimer.current !== undefined) clearTimeout(webTimer.current)
    const x = event.nativeEvent.contentOffset.x
    webTimer.current = setTimeout(() => settle(x), 140)
  }, [onScroll, settle])

  return (
    <PagerPosition.Provider value={position}>
      <View style={styles.screen}>
        <Animated.ScrollView testID="swipe-tab-pager" ref={scroll} horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled bounces={false} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEventThrottle={16} style={styles.viewport} contentContainerStyle={styles.track} onLayout={({ nativeEvent }) => { if (nativeEvent.layout.width > 0) setWidth(nativeEvent.layout.width) }} onScroll={Platform.OS === 'web' ? onWebScroll : onScroll}
          onScrollBeginDrag={() => { requested.current = null; Keyboard.dismiss() }}
          onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.x)}
          onScrollEndDrag={event => { const x = event.nativeEvent.contentOffset.x; if (Math.abs(x / width - Math.round(x / width)) < 0.005) settle(x) }}>
          {pages.map((page, pageIndex) => <View key={pageIndex} testID={'swipe-page-' + pageIndex} collapsable={false} style={{ width, height: '100%' }} pointerEvents={index === pageIndex ? 'auto' : 'none'} accessibilityElementsHidden={index !== pageIndex} importantForAccessibility={index === pageIndex ? 'auto' : 'no-hide-descendants'}>{page}</View>)}
        </Animated.ScrollView>
        {footer}
      </View>
    </PagerPosition.Provider>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  viewport: { flex: 1, minHeight: 0 },
  track: { height: '100%' },
})
