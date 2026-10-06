import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#090B10', primary: '#6E7CFF', text: '#FFFFFF' } }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#090B10' } }} />
    </ThemeProvider>
  );
}
