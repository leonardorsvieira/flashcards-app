import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '@/data';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <StoreProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deck/edit" options={{ title: 'Deck', presentation: 'modal' }} />
        <Stack.Screen name="deck/[id]" options={{ title: 'Cards' }} />
        <Stack.Screen name="card/edit" options={{ title: 'Card', presentation: 'modal' }} />
        <Stack.Screen name="study/[deckId]" options={{ title: 'Study' }} />
      </Stack>
    </StoreProvider>
  );
}
