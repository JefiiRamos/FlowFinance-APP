import type { PropsWithChildren } from 'react'
import { View } from 'react-native'

export function KeyboardTabFooter({ children }: PropsWithChildren) {
  return <View style={{ flexShrink: 0 }}>{children}</View>
}
