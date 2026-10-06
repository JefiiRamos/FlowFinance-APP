import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg'
import { FinanceIcon, palette } from './finance-visuals'

export function WelcomeScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const availableHeight = height - insets.top - insets.bottom
  const compact = availableHeight < 680
  const short = availableHeight < 520
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient pointerEvents="none" colors={['#23264F', '#15182C', '#090B10', '#090B10']} locations={[0, 0.32, 0.62, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.content, compact && styles.compactContent]}>
          <View style={styles.brand}>
            <FinanceIcon name="sparkles" size={25} color="#FFFFFF" />
            <Text style={styles.brandName}>FlowFinance</Text>
          </View>

          <View style={[styles.hero, compact && { marginVertical: 8 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Svg width="100%" height="100%" viewBox="0 0 340 310">
              <Defs>
                <SvgGradient id="wallet" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#8994FF" /><Stop offset="1" stopColor="#4B53CF" />
                </SvgGradient>
                <SvgGradient id="coin" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#D2D6FF" /><Stop offset="1" stopColor="#7C88FF" />
                </SvgGradient>
              </Defs>
              <Circle cx="170" cy="145" r="125" fill="#6E7CFF" opacity="0.05" />
              <Circle cx="170" cy="145" r="96" fill="none" stroke="#8A94FF" strokeWidth="1" opacity="0.12" />
              <Ellipse cx="175" cy="260" rx="104" ry="14" fill="#000000" opacity="0.28" />
              <Rect x="77" y="112" width="184" height="126" rx="28" fill="#3B409D" transform="rotate(-8 170 175)" />
              <Rect x="89" y="82" width="151" height="100" rx="18" fill="#22263D" stroke="#5B638D" transform="rotate(-13 164 132)" />
              <Path d="M110 117h57M110 130h33" stroke="#AEB5E1" strokeWidth="6" strokeLinecap="round" transform="rotate(-13 164 132)" />
              <Circle cx="212" cy="88" r="33" fill="#535CC4" />
              <Circle cx="208" cy="84" r="31" fill="url(#coin)" stroke="#DEE1FF" strokeWidth="2" />
              <Path d="M208 66v36m9-29c-5-7-19-5-19 2 0 11 21 5 21 15 0 8-15 11-23 3" fill="none" stroke="#4E56B2" strokeWidth="4" strokeLinecap="round" />
              <Rect x="69" y="136" width="196" height="112" rx="26" fill="url(#wallet)" stroke="#A6AEFF" strokeWidth="1.5" />
              <Path d="M87 153h153" stroke="#CDD2FF" strokeWidth="2" opacity="0.45" strokeLinecap="round" />
              <Rect x="215" y="171" width="62" height="44" rx="14" fill="#33396F" stroke="#A3ACFF" />
              <Circle cx="236" cy="193" r="5" fill="#CDD2FF" />
              <Path d="m112 209 16-16 13 9 21-23m-13 0h13v13" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
              <Path d="m277 71 5 14 14 5-14 5-5 14-5-14-14-5 14-5Z" fill="#D3D7FF" />
              <Path d="m56 116 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#909AFF" />
              <Circle cx="282" cy="240" r="4" fill="#8893FF" opacity="0.5" />
            </Svg>
          </View>

          <View style={[styles.bottom, compact && { gap: short ? 8 : 12 }]}>
            <Text accessibilityRole="header" style={[styles.title, compact && { fontSize: short ? 22 : 25, lineHeight: short ? 28 : 31 }]}>Seu dinheiro em ordem.{ '\n' }Sua vida mais leve.</Text>
            <Text style={[styles.subtitle, short && { fontSize: 13, lineHeight: 18 }]}>Organize seus gastos, alcance suas metas e conte com a IA no dia a dia.</Text>
            <View style={[styles.actions, compact && { marginTop: 0, gap: 8 }]}>
              <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.primary, compact && styles.compactButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Começar agora</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.secondary, compact && styles.compactButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Já tenho uma conta</Text>
              </Pressable>
            </View>
            <Text style={styles.footer}>Mais clareza para cada decisão financeira.</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090B10' },
  safeArea: { flex: 1 },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, width: '100%', maxWidth: 480, alignSelf: 'center' },
  compactContent: { paddingHorizontal: 20, paddingVertical: 12 },
  compactButton: { minHeight: 48, paddingVertical: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  brandName: { color: '#FFFFFF', fontSize: 20, fontWeight: '500', letterSpacing: -0.6 },
  hero: { flex: 1, minHeight: 0, maxHeight: 430, marginVertical: 16 },
  bottom: { flexShrink: 0, marginTop: 'auto', gap: 16 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '500', letterSpacing: -0.8, lineHeight: 35, textAlign: 'center' },
  subtitle: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  actions: { gap: 10, marginTop: 8 },
  primary: { minHeight: 54, borderRadius: 28, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', padding: 14 },
  secondary: { minHeight: 54, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#141924', alignItems: 'center', justifyContent: 'center', padding: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  secondaryText: { color: '#E3E6EF', fontSize: 15, fontWeight: '500' },
  footer: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  pressed: { opacity: 0.8 },
})
