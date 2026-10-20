import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { advanceQueue, DEFAULT_SCHEDULER_CONFIG, endOfDay, previewIntervals } from '@/core';
import type { Card, Grade } from '@/core';
import { useStore } from '@/data';
import { Button, Empty } from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

const GRADES: { g: Grade; label: string }[] = [
  { g: 'again', label: 'Again' },
  { g: 'hard', label: 'Hard' },
  { g: 'good', label: 'Good' },
  { g: 'easy', label: 'Easy' },
];

function formatDays(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
}

export default function Study() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { studyQueue, grade } = useStore();
  const router = useRouter();
  const t = useTheme();
  // Built once per session; grading advances it locally so the order stays stable.
  const [queue, setQueue] = useState<Card[]>(() => studyQueue(deckId).cards);
  const [answered, setAnswered] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const busy = useRef(false);
  const shownAt = useRef(Date.now());

  if (!queue.length && answered === 0) {
    return <Empty icon="checkmark-circle-outline" title="All caught up" hint="No cards are due right now." />;
  }
  if (!queue.length) {
    return (
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
        <Empty icon="trophy-outline" title="Session complete" hint={`You answered ${answered} time${answered > 1 ? 's' : ''}.`} />
        <Button label="Done" onPress={() => router.back()} />
      </View>
    );
  }

  const card = queue[0];
  const intervals = previewIntervals(card.schedule);
  const labelFor = (g: Grade) =>
    g === 'again' ? `${DEFAULT_SCHEDULER_CONFIG.againDelayMinutes}m` : formatDays(intervals[g]);

  const answer = async (g: Grade) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const updated = await grade(card.id, g, Date.now() - shownAt.current);
      setQueue((q) => advanceQueue(q, updated, endOfDay(Date.now())));
      setAnswered((n) => n + 1);
      setFlipped(false);
      shownAt.current = Date.now();
    } finally {
      busy.current = false;
    }
  };

  return (
    <View style={{ flex: 1, padding: space.md }}>
      <Stack.Screen options={{ title: `${queue.length} left` }} />
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
      <View style={{ marginTop: space.md, minHeight: 64 }}>
        {flipped ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {GRADES.map(({ g, label }) => (
              <Pressable
                key={g}
                accessibilityRole="button"
                accessibilityLabel={`${label}, next in ${labelFor(g)}`}
                onPress={() => answer(g)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center',
                  backgroundColor: t[g], opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: t.dark ? '#101214' : '#fff', fontWeight: '700' }}>{label}</Text>
                <Text style={{ color: t.dark ? '#101214' : '#fff', fontSize: 12, marginTop: 2 }}>{labelFor(g)}</Text>
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
