import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/data';
import { Button, Field } from '@/ui/components';
import { deckColors, space, useTheme } from '@/ui/theme';

export default function DeckEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { decks, saveDeck, deleteDeck } = useStore();
  const router = useRouter();
  const t = useTheme();
  const existing = decks.find((d) => d.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [color, setColor] = useState(existing?.color ?? deckColors[0]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit deck' : 'New deck' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Spanish verbs" autoFocus={!existing} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
      <Text style={{ color: t.muted, fontWeight: '600', fontSize: 13, marginBottom: 8 }}>Color</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.lg }}>
        {deckColors.map((c) => (
          <Pressable
            key={c}
            accessibilityLabel={`Color ${c}`}
            onPress={() => setColor(c)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c, borderWidth: 3, borderColor: color === c ? t.text : 'transparent' }}
          />
        ))}
      </View>
      <Button
        label="Save"
        disabled={!name.trim()}
        onPress={() => {
          saveDeck({ id: existing?.id, name: name.trim(), description: description.trim(), color });
          router.back();
        }}
      />
      {existing && (
        <Button
          variant="danger"
          label="Delete deck"
          style={{ marginTop: space.sm }}
          onPress={() => {
            deleteDeck(existing.id);
            router.dismissTo('/');
          }}
        />
      )}
    </ScrollView>
  );
}
