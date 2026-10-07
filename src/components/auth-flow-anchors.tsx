import { createContext, useContext, useEffect, useRef, type PropsWithChildren } from 'react'
import { View } from 'react-native'

export type AnchorRect = { x: number; y: number; width: number; height: number }
export type AnchorStage = 'welcome' | 'auth' | 'account'
export const AuthAnchorContext = createContext({
  moving: false,
  active: false,
  report: (_stage: AnchorStage, _rect: AnchorRect) => {},
})
export const useAuthAnchors = () => useContext(AuthAnchorContext)

export function SharedEmailAnchor({ stage, children }: PropsWithChildren<{ stage: AnchorStage }>) {
  const ref = useRef<View>(null)
  const { moving, report } = useAuthAnchors()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => report(stage, { x, y, width, height }))
    })
    return () => cancelAnimationFrame(frame)
  }, [moving, report, stage])
  return (
    <View ref={ref} collapsable={false} testID={stage + '-email-anchor'} onLayout={() => {
      ref.current?.measureInWindow((x, y, width, height) => report(stage, { x, y, width, height }))
    }} style={{ opacity: moving ? 0 : 1 }}>
      {children}
    </View>
  )
}
