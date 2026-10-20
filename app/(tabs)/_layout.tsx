import { Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '@/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/ui/theme';

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  const { status, signOut } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerShadowVisible: false,
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Decks',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color as string} size={size} />,
          headerRight: () =>
            status === 'guest' ? (
              <Pressable onPress={() => router.push('/login')} hitSlop={10} style={{ marginRight: 16 }}>
                <Text style={{ color: t.muted, fontSize: 14 }}>Entrar</Text>
              </Pressable>
            ) : status === 'signedIn' ? (
              <Pressable onPress={() => void signOut()} hitSlop={10} style={{ marginRight: 16 }}>
                <Text style={{ color: t.muted, fontSize: 14 }}>Sair</Text>
              </Pressable>
            ) : null,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" color={color as string} size={size} /> }}
      />
    </Tabs>
  );
}
