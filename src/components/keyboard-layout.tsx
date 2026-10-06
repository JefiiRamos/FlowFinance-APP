import type { PropsWithChildren } from 'react'
import { View } from 'react-native'

export function AppKeyboardProvider({ children }: PropsWithChildren) {
  return children
}

export function WelcomeKeyboardLayout({ children }: PropsWithChildren) {
  return <View style={{ flex: 1 }}>{children}</View>
}
