import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Grade, useStore } from '@/data';
import { Button, Empty } from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

const GRADES: { g: Grade; label: string }[] = [
  { g: 'again', label: 'Again' },
  { g: 'hard', label: 'Hard' },
  { g: 'good', label: 'Good' },
  { g: 'easy', label: 'Easy' },
];

export default function Study() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { dueCards, grade } = useStore();
  const router = useRouter();
  const t = useTheme();
  // Snapshot the queue once so grading does not reshuffle the session.
  const queue = useRef<Card[]>(dueCards(deckId)).current;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!queue.length) return <Empty icon="checkmark-circle-outline" title="All caught up" hint="No cards are due right now." />;
  if (index >= queue.length) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
        <Empty icon="trophy-outline" title="Session complete" hint={`You reviewed ${queue.length} card${queue.length > 1 ? 's' : ''}.`} />
        <Button label="Done" onPress={() => router.back()} />
      </View>
    );
  }

  const card = queue[index];
  const answer = (g: Grade) => {
    grade(card.id, g);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <View style={{ flex: 1, padding: space.md }}>
      <Stack.Screen options={{ title: `${index + 1} / ${queue.length}` }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Flip card"
        onPress={() => setFlipped((f) => !f)}
        style={{
          flex: 1, backgroundColor: flipped ? t.surfaceAlt : t.surface, borderColor: t.border,
          borderWidth: 1, borderRadius: radius.lg, padding: space.lg, justifyContent: 'center',
        }}
      >
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: space.sm }}>
          {flipped ? 'ANSWER' : 'QUESTION'}
        </Text>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '600' }}>{flipped ? card.back : card.front}</Text>
        {!flipped && <Text style={{ color: t.muted, marginTop: space.lg }}>Tap to reveal</Text>}
      </Pressable>
      <View style={{ marginTop: space.md, minHeight: 56 }}>
        {flipped ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {GRADES.map(({ g, label }) => (
              <Pressable
                key={g}
                accessibilityRole="button"
                onPress={() => answer(g)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 16, borderRadius: radius.md, alignItems: 'center',
                  backgroundColor: t[g], opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: t.dark ? '#101214' : '#fff', fontWeight: '700' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Button label="Show answer" onPress={() => setFlipped(true)} />
        )}
      </View>
    </View>
  );
}
