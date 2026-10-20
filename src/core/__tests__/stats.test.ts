import { addDays, calendarDaysBetween, dayKey, endOfDay, MINUTE_MS, startOfDay } from '../dates';
import { countCards, dueForecast, retentionRate, reviewsPerDay, studiedToday, studyStreak } from '../stats';
import { at, makeCard, makeReview } from '../__fixtures__/helpers';

const NOW = at(2026, 10, 20, 15);

function onDay(offset: number, hour = 9) {
  const d = new Date(addDays(NOW, offset));
  d.setHours(hour, 0, 0, 0);
  return makeReview({ reviewedAt: d.getTime() });
}

describe('dates', () => {
  it('computes local day boundaries and keys', () => {
    expect(startOfDay(NOW)).toBe(at(2026, 10, 20, 0));
    expect(endOfDay(NOW)).toBe(at(2026, 10, 21, 0) - 1);
    expect(dayKey(NOW)).toBe('2026-10-20');
    expect(calendarDaysBetween(at(2026, 10, 18, 23), at(2026, 10, 20, 1))).toBe(2);
  });
});

describe('studyStreak', () => {
  it('is zero with no reviews', () => {
    expect(studyStreak([], NOW)).toEqual({ current: 0, longest: 0, studiedToday: false });
  });

  it('counts consecutive days ending today', () => {
    const r = [onDay(0), onDay(0, 10), onDay(-1), onDay(-2), onDay(-4)];
    expect(studyStreak(r, NOW)).toEqual({ current: 3, longest: 3, studiedToday: true });
  });

  it('keeps the streak alive if the last study day was yesterday', () => {
    const r = [onDay(-1), onDay(-2)];
    expect(studyStreak(r, NOW)).toEqual({ current: 2, longest: 2, studiedToday: false });
  });

  it('breaks the streak after a missed day but remembers the longest', () => {
    const r = [onDay(-2), onDay(-10), onDay(-11), onDay(-12), onDay(-13)];
    expect(studyStreak(r, NOW)).toEqual({ current: 0, longest: 4, studiedToday: false });
  });

  it('ignores reviews in the future', () => {
    expect(studyStreak([onDay(1)], NOW).current).toBe(0);
  });
});

describe('retentionRate', () => {
  it('returns null without learned-card reviews', () => {
    expect(retentionRate([makeReview({ reviewedAt: NOW, prevRepetitions: 0 })])).toEqual({ rate: null, passed: 0, total: 0 });
  });

  it('counts only reviews of learned cards, failing on again', () => {
    const r = [
      makeReview({ reviewedAt: NOW, grade: 'good' }),
      makeReview({ reviewedAt: NOW, grade: 'hard' }),
      makeReview({ reviewedAt: NOW, grade: 'easy' }),
      makeReview({ reviewedAt: NOW, grade: 'again' }),
      makeReview({ reviewedAt: NOW, grade: 'again', prevRepetitions: 0 }),
    ];
    expect(retentionRate(r)).toEqual({ rate: 0.75, passed: 3, total: 4 });
  });

  it('filters by time range', () => {
    const r = [makeReview({ reviewedAt: NOW - 1000, grade: 'again' }), makeReview({ reviewedAt: NOW, grade: 'good' })];
    expect(retentionRate(r, { since: NOW }).rate).toBe(1);
    expect(retentionRate(r, { until: NOW }).rate).toBe(0);
  });
});

describe('countCards', () => {
  it('classifies cards and counts what is due', () => {
    const cards = [
      makeCard(),
      makeCard({ schedule: { dueAt: NOW + 5 * MINUTE_MS, repetitions: 0 } }),
      makeCard({ schedule: { dueAt: NOW - 1, repetitions: 2, intervalDays: 6 } }),
      makeCard({ schedule: { dueAt: addDays(NOW, 30), repetitions: 5, intervalDays: 30 } }),
      makeCard({ schedule: { dueAt: at(2026, 10, 20, 22), repetitions: 4, intervalDays: 25 } }),
    ];
    expect(countCards(cards, NOW)).toEqual({
      total: 5,
      new: 1,
      learning: 1,
      young: 1,
      mature: 2,
      dueToday: 3,
      dueNow: 1,
    });
  });
});

describe('dueForecast', () => {
  it('buckets cards per day with overdue cards in today', () => {
    const cards = [
      makeCard(),
      makeCard({ schedule: { dueAt: addDays(NOW, -5), repetitions: 1 } }),
      makeCard({ schedule: { dueAt: NOW, repetitions: 1 } }),
      makeCard({ schedule: { dueAt: addDays(NOW, 2), repetitions: 1 } }),
      makeCard({ schedule: { dueAt: addDays(NOW, 10), repetitions: 1 } }),
    ];
    expect(dueForecast(cards, NOW, 4)).toEqual([2, 0, 1, 0]);
    expect(dueForecast(cards, NOW, 0)).toEqual([]);
  });
});

describe('reviewsPerDay', () => {
  it('returns one entry per day, oldest first', () => {
    const r = [onDay(0), onDay(0), onDay(-2), onDay(-9)];
    expect(reviewsPerDay(r, NOW, 3)).toEqual([
      { day: '2026-10-18', count: 1 },
      { day: '2026-10-19', count: 0 },
      { day: '2026-10-20', count: 2 },
    ]);
  });
});

describe('studiedToday', () => {
  it('counts first-time cards and learned-card reviews today', () => {
    const r = [
      makeReview({ cardId: 'a', prevRepetitions: 0, reviewedAt: NOW - 60 * MINUTE_MS }),
      makeReview({ cardId: 'a', prevRepetitions: 0, reviewedAt: NOW - 50 * MINUTE_MS }),
      makeReview({ cardId: 'b', prevRepetitions: 0, reviewedAt: addDays(NOW, -3) }),
      makeReview({ cardId: 'b', prevRepetitions: 0, reviewedAt: NOW - 40 * MINUTE_MS }), // relearning, not new
      makeReview({ cardId: 'c', prevRepetitions: 2, reviewedAt: NOW - 30 * MINUTE_MS }),
      makeReview({ cardId: 'd', prevRepetitions: 2, reviewedAt: addDays(NOW, -1) }),
    ];
    expect(studiedToday(r, NOW)).toEqual({ newCards: 1, reviews: 1, total: 4 });
  });
});
