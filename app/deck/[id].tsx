import { FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/data';
import { Button, Empty, Fab, Panel } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';

export default function CardList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { decks, cards, dueCards } = useStore();
  const router = useRouter();
  const t = useTheme();
  const deck = decks.find((d) => d.id === id);
  const list = cards.filter((c) => c.deckId === id);
  const dueCount = dueCards(id).length;
  if (!deck) return <Empty icon="alert-circle-outline" title="Deck not found" hint="It may have been deleted." />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: deck.name }} />
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.md, gap: space.sm, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: space.sm, marginBottom: space.sm }}>
            <Button
              label={dueCount ? `Study ${dueCount} card${dueCount > 1 ? 's' : ''}` : 'Nothing due'}
              disabled={!dueCount}
              onPress={() => router.push({ pathname: '/study/[deckId]', params: { deckId: id } })}
            />
            <Button variant="secondary" label="Edit deck" onPress={() => router.push({ pathname: '/deck/edit', params: { id } })} />
          </View>
        }
        ListEmptyComponent={<Empty icon="document-text-outline" title="No cards" hint="Tap + to add your first card." />}
        renderItem={({ item }) => (
          <Panel onPress={() => router.push({ pathname: '/card/edit', params: { deckId: id, id: item.id } })}>
            <Text numberOfLines={2} style={{ color: t.text, fontWeight: '600', fontSize: 16 }}>{item.front}</Text>
            <Text numberOfLines={2} style={{ color: t.muted, marginTop: 4 }}>{item.back}</Text>
          </Panel>
        )}
      />
      <Fab label="New card" onPress={() => router.push({ pathname: '/card/edit', params: { deckId: id } })} />
    </View>
  );
}
