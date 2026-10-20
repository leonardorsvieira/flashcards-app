import { ScrollView, Text, View } from 'react-native';
import { countCards, retentionRate, reviewsPerDay, studiedToday, studyStreak } from '@/core';
import { useStore } from '@/data';
import { Panel, Stat } from '@/ui/components';
import { radius, space, useTheme } from '@/ui/theme';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function weekday(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  return LETTERS[new Date(y, m - 1, d).getDay()];
}

export default function Stats() {
  const { reviews, cards, decks } = useStore();
  const t = useTheme();
  const now = Date.now();
  const today = studiedToday(reviews, now);
  const retention = retentionRate(reviews);
  const streak = studyStreak(reviews, now);
  const counts = countCards(cards, now);
  const days = reviewsPerDay(reviews, now, 7);
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat value={today.total} label="Reviewed today" />
        <Stat value={retention.rate === null ? '-' : `${Math.round(retention.rate * 100)}%`} label="Retention" />
        <Stat value={streak.current} label="Day streak" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat value={counts.total} label="Cards" />
        <Stat value={decks.length} label="Decks" />
        <Stat value={counts.dueToday} label="Due today" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat value={counts.new} label="New" />
        <Stat value={counts.learning + counts.young} label="Young" />
        <Stat value={counts.mature} label="Mature" />
      </View>
      <Panel>
        <Text style={{ color: t.text, fontWeight: '700', marginBottom: space.md }}>Last 7 days</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: space.sm }}>
          {days.map((d) => (
            <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <Text style={{ color: t.muted, fontSize: 11 }}>{d.count || ''}</Text>
              <View
                style={{
                  width: '100%', height: Math.max(4, (d.count / max) * 90),
                  backgroundColor: d.count ? t.primary : t.surfaceAlt, borderRadius: radius.sm,
                }}
              />
              <Text style={{ color: t.muted, fontSize: 11, marginTop: 4 }}>{weekday(d.day)}</Text>
            </View>
          ))}
        </View>
      </Panel>
    </ScrollView>
  );
}
