import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { AppKeyboardProvider } from '@/components/keyboard-layout';

export default function RootLayout() {
  return (
    <AppKeyboardProvider>
    <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#090B10', primary: '#6E7CFF', text: '#FFFFFF' } }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090B10' } }} />
    </ThemeProvider>
    </AppKeyboardProvider>
  );
}
