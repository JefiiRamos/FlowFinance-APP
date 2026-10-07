import type { PropsWithChildren } from 'react'
import { Dimensions, Platform, StyleSheet, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { AuthBackground } from './auth-visuals'

// Visibility belongs to the entry transition; the account content stays visible.
export function AccountSurface({ children }: PropsWithChildren) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const layoutHeight = Platform.OS === 'android' ? Dimensions.get('screen').height : height
  const compact = layoutHeight - insets.top - insets.bottom < 680
  return (
    <View style={styles.screen}>
      <AuthBackground variant="account" />
      <StatusBar style="light" />
      <SafeAreaView style={styles.content}>
        <View style={{ height: compact ? 90 : 102 }} />
        <View testID="account-content" collapsable={false} style={styles.content}>{children}</View>
      </SafeAreaView>
    </View>
  )
}
const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#090B10' },
  content: { flex: 1, minHeight: 0 },
})
