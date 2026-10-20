import { useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useStore } from '@/data';
import { Button, Empty, Fab, Panel } from '@/ui/components';
import { space, useTheme } from '@/ui/theme';
import { parseDeckCsv, serializeDeckCsv } from '@/utils/csv';

export default function CardList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { decks, cards, studyQueue, importCards } = useStore();
  const router = useRouter();
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const deck = decks.find((d) => d.id === id);
  const list = cards.filter((c) => c.deckId === id);
  const dueCount = studyQueue(id).cards.length;
  if (!deck) return <Empty icon="alert-circle-outline" title="Deck not found" hint="It may have been deleted." />;

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importCsv = () =>
    guard(async () => {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const rows = parseDeckCsv(await new File(res.assets[0].uri).text());
      const added = await importCards(deck.id, rows);
      Alert.alert('Import complete', `${added} card${added === 1 ? '' : 's'} added.`);
    });

  const exportCsv = () =>
    guard(async () => {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      const csv = serializeDeckCsv(list.map((c) => ({ front: c.front, back: c.back, tags: [] })));
      const safeName = deck.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'deck';
      const file = new File(Paths.cache, `${safeName}.csv`);
      file.create({ overwrite: true });
      file.write(csv);
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export deck' });
    });

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
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button variant="secondary" label="Import CSV" disabled={busy} onPress={importCsv} style={{ flex: 1 }} />
              <Button variant="secondary" label="Export CSV" disabled={busy || !list.length} onPress={exportCsv} style={{ flex: 1 }} />
            </View>
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
