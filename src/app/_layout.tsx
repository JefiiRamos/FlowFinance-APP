import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#EAF0F4', primary: '#405D86', text: '#1C2B50' } }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#EAF0F4' } }} />
    </ThemeProvider>
  );
}
