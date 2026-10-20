import { ScrollView, Text, View } from 'react-native';
import { useStore } from '@/data';
import { Panel, Stat } from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Stats() {
  const { reviews, cards, decks } = useStore();
  const t = useTheme();
  const startToday = new Date().setHours(0, 0, 0, 0);
  const today = reviews.filter((r) => r.reviewedAt >= startToday).length;
  const correct = reviews.filter((r) => r.grade !== 'again').length;
  const retention = reviews.length ? Math.round((correct / reviews.length) * 100) : 0;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startToday);
    d.setDate(d.getDate() - (6 - i));
    const start = d.getTime();
    const e = new Date(start);
    e.setDate(e.getDate() + 1);
    const end = e.getTime();
    return { start, day: d.getDay(), n: reviews.filter((r) => r.reviewedAt >= start && r.reviewedAt < end).length };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const mature = cards.filter((c) => c.intervalDays >= 21).length;

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat value={today} label="Reviewed today" />
        <Stat value={`${retention}%`} label="Retention" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat value={cards.length} label="Cards" />
        <Stat value={decks.length} label="Decks" />
        <Stat value={mature} label="Mature" />
      </View>
      <Panel>
        <Text style={{ color: t.text, fontWeight: '700', marginBottom: space.md }}>Last 7 days</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: space.sm }}>
          {days.map((d) => (
            <View key={d.start} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Text style={{ color: t.muted, fontSize: 11 }}>{d.n || ''}</Text>
              <View
                style={{
                  width: '100%', height: Math.max(4, (d.n / max) * 90),
                  backgroundColor: d.n ? t.primary : t.surfaceAlt, borderRadius: radius.sm,
                }}
              />
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 4 }}>{LETTERS[d.day]}</Text>
            </View>
          ))}
        </View>
      </Panel>
    </ScrollView>
  );
}
