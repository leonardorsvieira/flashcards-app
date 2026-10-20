import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { deckColor, useStore } from '@/data';
import { Empty, Fab, Panel } from '@/ui/components';
import { confirmAsync } from '@/ui/confirm';
import { space, useTheme } from '@/ui/theme';

export default function DeckList() {
  const { summaries, deleteDeck } = useStore();
  const router = useRouter();
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={summaries}
        keyExtractor={(x) => x.deck.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 100 }}
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
                {item.total} cards  ·  {item.toStudy} to study
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Excluir baralho"
              hitSlop={10}
              onPress={async () => {
                const ok = await confirmAsync(`Excluir "${item.deck.name}"?`, 'O baralho e todas as suas cartas serão apagados. Isso não pode ser desfeito.');
                if (ok) await deleteDeck(item.deck.id);
              }}
            >
              <Ionicons name="trash-outline" size={20} color={t.muted} />
            </Pressable>
          </Panel>
        )}
      />
      <Fab label="New deck" onPress={() => router.push('/deck/edit')} />
    </View>
  );
}
