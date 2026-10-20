import { useEffect } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/auth';
import { StoreProvider } from '@/data';
import { useTheme } from '@/ui/theme';

/** Sends people who have not chosen "sign in" or "continue without account" to the login screen. */
function AuthGate() {
  const { status } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;
  const onLogin = (segments as string[])[0] === 'login';

  useEffect(() => {
    if (navReady && status === 'signedOut' && !onLogin) router.replace('/login');
  }, [navReady, status, onLogin, router]);

  return null;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <AuthProvider>
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
          <Stack.Screen name="login" options={{ title: 'Conta', headerShown: false }} />
          <Stack.Screen name="deck/edit" options={{ title: 'Deck', presentation: 'modal' }} />
          <Stack.Screen name="deck/[id]" options={{ title: 'Cards' }} />
          <Stack.Screen name="card/edit" options={{ title: 'Card', presentation: 'modal' }} />
          <Stack.Screen name="study/[deckId]" options={{ title: 'Study' }} />
        </Stack>
        <AuthGate />
      </StoreProvider>
    </AuthProvider>
  );
}
