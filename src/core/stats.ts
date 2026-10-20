import { addDays, calendarDaysBetween, dayKey, endOfDay, startOfDay } from './dates';
import type { Card, Review } from './types';

/** Interval (days) from which a card counts as "mature". */
export const MATURE_INTERVAL_DAYS = 21;

export interface Streak {
  /** Consecutive days with at least one review, ending today (or yesterday if nothing yet today). */
  current: number;
  longest: number;
  studiedToday: boolean;
}

export function studyStreak(reviews: readonly Review[], now: number): Streak {
  const days = new Set(reviews.filter((r) => r.reviewedAt <= now).map((r) => startOfDay(r.reviewedAt)));
  if (days.size === 0) return { current: 0, longest: 0, studiedToday: false };

  const sorted = [...days].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = calendarDaysBetween(sorted[i - 1], sorted[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const today = startOfDay(now);
  const studiedToday = days.has(today);
  let cursor = studiedToday ? today : startOfDay(addDays(today, -1));
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = startOfDay(addDays(cursor, -1));
  }
  return { current, longest, studiedToday };
}

export interface Retention {
  /** Share of reviews of already-learned cards not graded "again"; null when there is no data. */
  rate: number | null;
  passed: number;
  total: number;
}

/**
 * True retention: only reviews of cards that had been learned
 * (prevRepetitions > 0) count; first sightings and relearning steps are ignored.
 */
export function retentionRate(
  reviews: readonly Review[],
  range: { since?: number; until?: number } = {},
): Retention {
  let passed = 0;
  let total = 0;
  for (const r of reviews) {
    if (r.prevRepetitions <= 0) continue;
    if (range.since !== undefined && r.reviewedAt < range.since) continue;
    if (range.until !== undefined && r.reviewedAt >= range.until) continue;
    total++;
    if (r.grade !== 'again') passed++;
  }
  return { rate: total === 0 ? null : passed / total, passed, total };
}

export interface CardCounts {
  total: number;
  /** Never studied. */
  new: number;
  /** In (re)learning: studied but not yet passed since the last "again". */
  learning: number;
  /** Learned cards with interval < MATURE_INTERVAL_DAYS. */
  young: number;
  mature: number;
  /** Studied cards (learning or review) due by the end of today. */
  dueToday: number;
  /** Studied cards due right now. */
  dueNow: number;
}

export function countCards(cards: readonly Card[], now: number): CardCounts {
  const eod = endOfDay(now);
  const counts: CardCounts = { total: 0, new: 0, learning: 0, young: 0, mature: 0, dueToday: 0, dueNow: 0 };
  for (const { schedule: s } of cards) {
    counts.total++;
    if (s.dueAt === null) {
      counts.new++;
      continue;
    }
    if (s.repetitions === 0) counts.learning++;
    else if (s.intervalDays >= MATURE_INTERVAL_DAYS) counts.mature++;
    else counts.young++;
    if (s.dueAt <= eod) counts.dueToday++;
    if (s.dueAt <= now) counts.dueNow++;
  }
  return counts;
}

/** Number of cards due on each of the next `days` days; index 0 is today and includes overdue cards. */
export function dueForecast(cards: readonly Card[], now: number, days: number): number[] {
  const result = new Array<number>(Math.max(0, days)).fill(0);
  if (result.length === 0) return result;
  for (const { schedule: s } of cards) {
    if (s.dueAt === null) continue;
    const offset = Math.max(0, calendarDaysBetween(now, s.dueAt));
    if (offset < result.length) result[offset]++;
  }
  return result;
}

export interface DayCount {
  /** Local date key, e.g. "2026-10-20". */
  day: string;
  count: number;
}

/** Review counts for the last `days` days, oldest first, ending today. */
export function reviewsPerDay(reviews: readonly Review[], now: number, days: number): DayCount[] {
  const counts = new Map<string, number>();
  for (const r of reviews) counts.set(dayKey(r.reviewedAt), (counts.get(dayKey(r.reviewedAt)) ?? 0) + 1);
  const result: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(addDays(now, -i));
    result.push({ day, count: counts.get(day) ?? 0 });
  }
  return result;
}

export interface StudiedToday {
  /** Cards whose first-ever review happened today. */
  newCards: number;
  /** Reviews today of cards that were already learned. */
  reviews: number;
  /** All answers given today. */
  total: number;
}

export function studiedToday(reviews: readonly Review[], now: number): StudiedToday {
  const sod = startOfDay(now);
  const eod = endOfDay(now);
  const firstSeen = new Map<string, Review>();
  let reviewCount = 0;
  let total = 0;
  for (const r of reviews) {
    const prev = firstSeen.get(r.cardId);
    if (prev === undefined || r.reviewedAt < prev.reviewedAt) firstSeen.set(r.cardId, r);
    if (r.reviewedAt >= sod && r.reviewedAt <= eod) {
      total++;
      if (r.prevRepetitions > 0) reviewCount++;
    }
  }
  let newCards = 0;
  for (const first of firstSeen.values()) {
    // A card's first logged review only counts as "new" if it was actually unlearned then.
    if (first.prevRepetitions === 0 && first.reviewedAt >= sod && first.reviewedAt <= eod) newCards++;
  }
  return { newCards, reviews: reviewCount, total };
}
