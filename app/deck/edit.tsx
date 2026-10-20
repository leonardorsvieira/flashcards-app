import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/data';
import { Button, Field } from '@/ui/components';
import { confirmAsync } from '@/ui/confirm';
import { space } from '@/ui/theme';

export default function DeckEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { decks, saveDeck, deleteDeck } = useStore();
  const router = useRouter();
  const existing = decks.find((d) => d.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.md }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? 'Edit deck' : 'New deck' }} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Spanish verbs" autoFocus={!existing} />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Optional" multiline />
      <Button
        label="Save"
        disabled={!name.trim() || busy}
        onPress={() =>
          run(async () => {
            await saveDeck({ id: existing?.id, name: name.trim(), description: description.trim() });
            router.back();
          })
        }
      />
      {existing && (
        <Button
          variant="danger"
          label="Delete deck"
          disabled={busy}
          style={{ marginTop: space.sm }}
          onPress={() =>
            run(async () => {
              if (!(await confirmAsync(`Excluir "${existing.name}"?`, 'O baralho e todas as suas cartas serão apagados. Isso não pode ser desfeito.'))) return;
              await deleteDeck(existing.id);
              router.dismissTo('/');
            })
          }
        />
      )}
    </ScrollView>
  );
}
