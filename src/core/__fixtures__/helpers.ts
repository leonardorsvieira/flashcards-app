import { newSchedule } from '../scheduler';
import type { Card, CardSchedule, Grade, Review } from '../types';

/** Local-time timestamp helper (month is 1-based). */
export function at(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

let seq = 0;

export function makeCard(overrides: Partial<Omit<Card, 'schedule'>> & { schedule?: Partial<CardSchedule> } = {}): Card {
  seq++;
  const { schedule, ...rest } = overrides;
  return {
    id: `card-${seq}`,
    deckId: 'deck-1',
    front: `front ${seq}`,
    back: `back ${seq}`,
    createdAt: seq,
    updatedAt: seq,
    ...rest,
    schedule: { ...newSchedule(), ...schedule },
  };
}

export function makeReview(overrides: Partial<Review> & { reviewedAt: number }): Review {
  seq++;
  const grade: Grade = overrides.grade ?? 'good';
  return {
    id: `review-${seq}`,
    cardId: 'card-x',
    deckId: 'deck-1',
    grade,
    prevRepetitions: 1,
    prevIntervalDays: 1,
    nextIntervalDays: 6,
    prevEaseFactor: 2.5,
    nextEaseFactor: 2.5,
    ...overrides,
  };
}
