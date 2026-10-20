import { FlatList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth';
import { deckColor, useStore } from '@/data';
import { Empty, Fab, Panel } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';

export default function DeckList() {
  const { summaries } = useStore();
  const { status } = useAuth();
  const router = useRouter();
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={summaries}
        keyExtractor={(x) => x.deck.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 100 }}
        ListHeaderComponent={
          status === 'guest' ? (
            <Panel onPress={() => router.push('/login')} style={{ borderColor: t.primary, borderWidth: 1 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>Entrar ou criar conta</Text>
              <Text style={{ color: t.muted, marginTop: 2 }}>
                Salve seus baralhos na nuvem e acesse de qualquer aparelho.
              </Text>
            </Panel>
          ) : null
        }
        ListEmptyComponent={<Empty icon="albums-outline" title="No decks yet" hint="Tap + to create your first deck." />}
        renderItem={({ item }) => (
          <Panel
            onPress={() => router.push({ pathname: '/deck/[id]', params: { id: item.deck.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
          >
            <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: deckColor(item.deck.id) }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{item.deck.name}</Text>
              {!!item.deck.description && (
                <Text numberOfLines={1} style={{ color: t.muted, marginTop: 2 }}>{item.deck.description}</Text>
              )}
              <Text style={{ color: t.muted, marginTop: 6, fontSize: 13 }}>
                {item.total} cards  Â·  {item.toStudy} to study
              </Text>
            </View>
          </Panel>
        )}
      />
      <Fab label="New deck" onPress={() => router.push('/deck/edit')} />
    </View>
  );
}
