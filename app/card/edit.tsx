import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/data';
import { Button, Field } from '@/ui/components';
import { space } from '@/ui/theme';

export default function CardEdit() {
  const { deckId, id } = useLocalSearchParams<{ deckId: string; id?: string }>();
  const { cards, saveCard, deleteCard } = useStore();
  const router = useRouter();
  const existing = cards.find((c) => c.id === id);
  const [front, setFront] = useState(existing?.front ?? '');
  const [back, setBack] = useState(existing?.back ?? '');
  const valid = !!front.trim() && !!back.trim();

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit card' : 'New card' }} />
      <Field label="Front" value={front} onChangeText={setFront} placeholder="Question or prompt" multiline autoFocus={!existing} />
      <Field label="Back" value={back} onChangeText={setBack} placeholder="Answer" multiline />
      <Button
        label="Save"
        disabled={!valid}
        onPress={() => {
          saveCard({ id: existing?.id, deckId: existing?.deckId ?? deckId, front: front.trim(), back: back.trim() });
          router.back();
        }}
      />
      {!existing && (
        <Button
          variant="secondary"
          label="Save and add another"
          disabled={!valid}
          style={{ marginTop: space.sm }}
          onPress={() => {
            saveCard({ deckId, front: front.trim(), back: back.trim() });
            setFront('');
            setBack('');
          }}
        />
      )}
      {existing && (
        <Button
          variant="danger"
          label="Delete card"
          style={{ marginTop: space.sm }}
          onPress={() => {
            deleteCard(existing.id);
            router.back();
          }}
        />
      )}
    </ScrollView>
  );
}
