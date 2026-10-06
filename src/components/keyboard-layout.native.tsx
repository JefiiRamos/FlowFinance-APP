import type { PropsWithChildren } from 'react'
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller'

export function AppKeyboardProvider({ children }: PropsWithChildren) {
  return <KeyboardProvider>{children}</KeyboardProvider>
}

export function WelcomeKeyboardLayout({ children }: PropsWithChildren) {
  // Follow every native keyboard frame on both platforms, including dismissal.
  return <KeyboardAvoidingView behavior="padding" automaticOffset style={{ flex: 1 }}>{children}</KeyboardAvoidingView>
}
