import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'
import Svg, { Path, Circle, Rect } from 'react-native-svg'

export const palette = {
  ink: '#1C2B50', primary: '#405D86', muted: '#778398',
  success: '#278767', danger: '#BA5B64', border: 'rgba(255,255,255,0.65)',
}

export function FinanceBackground() {
  return <LinearGradient pointerEvents="none" colors={['#EDF3F6', '#E8EFF3', '#BAC8D5', '#788FAB']} locations={[0, 0.42, 0.72, 1]} style={StyleSheet.absoluteFill} />
}

export type IconName = 'home' | 'wallet' | 'plus' | 'chat' | 'grid' | 'target' | 'chart' | 'repeat' | 'sparkles' | 'arrow' | 'eye' | 'eye-off' | 'send' | 'back' | 'user' | 'logout' | 'check' | 'mail' | 'lock'
const paths: Partial<Record<IconName, string>> = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  wallet: 'M4 5h14v3H5a2 2 0 0 1 0-4h12M4 8v11a2 2 0 0 0 2 2h14V8ZM16 12h4v5h-4Z',
  plus: 'M12 4v16M4 12h16', chat: 'M4 4h16v13H9l-5 4ZM8 8h8M8 12h5',
  target: 'M12 8v4l5-5M17 7h4V3', chart: 'M4 20V4M4 20h17M8 16v-5M13 16V7M18 16v-8',
  repeat: 'M4 8h15l-4-4M20 16H5l4 4M20 8v4M4 16v-4',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4',
  arrow: 'M6 18 18 6M7 6h11v11', eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z',
  'eye-off': 'M3 3l18 18M9 5c8-2 13 7 13 7l-3 4M6 6l-4 6s5 9 13 6',
  send: 'm3 11 18-8-8 18-2-8ZM11 13 21 3', back: 'm14 5-7 7 7 7',
  user: 'M4 21v-2a8 8 0 0 1 16 0v2', logout: 'M9 4H4v16h5M10 12h11l-4-4M21 12l-4 4',
  check: 'm5 12 4 4L19 6',
  mail: 'M3 5h18v14H3ZM3 5l9 7 9-7', lock: 'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3M12 15v2',
}

export function FinanceIcon({ name, size = 22, color = palette.primary }: { name: IconName; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] && <Path d={paths[name]} />}
      {name === 'eye' && <Circle cx="12" cy="12" r="3" />}
      {name === 'target' && <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /></>}
      {name === 'user' && <Circle cx="12" cy="7" r="4" />}
      {name === 'grid' && <>{[3, 14].flatMap((x) => [3, 14].map((y) => <Rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" />))}</>}
    </Svg>
  )
}
