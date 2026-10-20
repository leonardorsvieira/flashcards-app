import { addDays, MINUTE_MS } from '../dates';
import {
  DEFAULT_SCHEDULER_CONFIG,
  isDue,
  isNewCard,
  newSchedule,
  nextEaseFactor,
  previewIntervals,
  scheduleReview,
} from '../scheduler';
import type { CardSchedule } from '../types';
import { at } from '../__fixtures__/helpers';

const NOW = at(2026, 3, 10, 9);

function learned(overrides: Partial<CardSchedule> = {}): CardSchedule {
  return {
    easeFactor: 2.5,
    intervalDays: 6,
    repetitions: 2,
    lapses: 0,
    dueAt: NOW,
    lastReviewedAt: NOW - 6 * 86400000,
    ...overrides,
  };
}

describe('newSchedule', () => {
  it('starts as a new, never-due card with the initial ease', () => {
    const s = newSchedule();
    expect(s).toEqual({
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      dueAt: null,
      lastReviewedAt: null,
    });
    expect(isNewCard(s)).toBe(true);
    expect(isDue(s, NOW)).toBe(false);
  });

  it('honors a custom initial ease', () => {
    expect(newSchedule({ initialEase: 2.0 }).easeFactor).toBe(2.0);
  });
});

describe('nextEaseFactor (SM-2 formula)', () => {
  it('applies the per-grade ease deltas', () => {
    expect(nextEaseFactor(2.5, 'again')).toBe(1.96);
    expect(nextEaseFactor(2.5, 'hard')).toBe(2.36);
    expect(nextEaseFactor(2.5, 'good')).toBe(2.5);
    expect(nextEaseFactor(2.5, 'easy')).toBe(2.6);
  });

  it('never drops below the minimum ease', () => {
    expect(nextEaseFactor(1.3, 'again')).toBe(1.3);
    expect(nextEaseFactor(1.4, 'hard')).toBe(1.3);
  });
});

describe('scheduleReview', () => {
  it('good: 1 day, then 6 days, then interval * ease', () => {
    let s = scheduleReview(newSchedule(), 'good', NOW);
    expect(s.repetitions).toBe(1);
    expect(s.intervalDays).toBe(1);
    expect(s.dueAt).toBe(addDays(NOW, 1));
    expect(s.lastReviewedAt).toBe(NOW);

    s = scheduleReview(s, 'good', s.dueAt!);
    expect(s.repetitions).toBe(2);
    expect(s.intervalDays).toBe(6);

    s = scheduleReview(s, 'good', s.dueAt!);
    expect(s.repetitions).toBe(3);
    expect(s.intervalDays).toBe(15); // round(6 * 2.5)
    expect(s.easeFactor).toBe(2.5);
  });

  it('again: resets repetitions, counts a lapse, comes back in minutes', () => {
    const s = scheduleReview(learned(), 'again', NOW);
    expect(s.repetitions).toBe(0);
    expect(s.intervalDays).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.easeFactor).toBe(1.96);
    expect(s.dueAt).toBe(NOW + DEFAULT_SCHEDULER_CONFIG.againDelayMinutes * MINUTE_MS);
  });

  it('again on a new card does not count as a lapse', () => {
    const s = scheduleReview(newSchedule(), 'again', NOW);
    expect(s.lapses).toBe(0);
    expect(isNewCard(s)).toBe(false);
  });

  it('relearning after a lapse restarts at the first interval', () => {
    const lapsed = scheduleReview(learned({ intervalDays: 30, repetitions: 5 }), 'again', NOW);
    const s = scheduleReview(lapsed, 'good', NOW + 10 * MINUTE_MS);
    expect(s.intervalDays).toBe(1);
    expect(s.repetitions).toBe(1);
  });

  it('orders intervals again < hard <= good < easy', () => {
    for (const base of [newSchedule(), learned({ repetitions: 1, intervalDays: 1 }), learned(), learned({ intervalDays: 40, repetitions: 6, easeFactor: 1.3 })]) {
      const p = previewIntervals(base);
      expect(p.again).toBe(0);
      expect(p.hard).toBeGreaterThanOrEqual(1);
      expect(p.hard).toBeLessThanOrEqual(p.good);
      expect(p.easy).toBeGreaterThan(p.good);
    }
  });

  it('hard grows a mature interval slowly and lowers ease', () => {
    const s = scheduleReview(learned({ intervalDays: 10, repetitions: 3 }), 'hard', NOW);
    expect(s.intervalDays).toBe(12); // round(10 * 1.2)
    expect(s.easeFactor).toBe(2.36);
  });

  it('easy on a new card jumps to the easy first interval', () => {
    const s = scheduleReview(newSchedule(), 'easy', NOW);
    expect(s.intervalDays).toBe(4);
    expect(s.easeFactor).toBe(2.6);
  });

  it('easy applies the bonus over good', () => {
    const s = scheduleReview(learned(), 'easy', NOW);
    // good with EF 2.6 = round(6 * 2.6) = 16; easy = round(16 * 1.3) = 21
    expect(s.intervalDays).toBe(21);
  });

  it('a successful review never shrinks the interval even at minimum ease', () => {
    const s = scheduleReview(learned({ intervalDays: 3, repetitions: 4, easeFactor: 1.3 }), 'hard', NOW);
    expect(s.intervalDays).toBeGreaterThan(3);
  });

  it('caps intervals at maxIntervalDays', () => {
    const s = scheduleReview(learned({ intervalDays: 1000, repetitions: 10 }), 'easy', NOW, { maxIntervalDays: 365 });
    expect(s.intervalDays).toBe(365);
  });

  it('is pure: does not mutate the input schedule', () => {
    const input = learned();
    const copy = { ...input };
    scheduleReview(input, 'again', NOW);
    expect(input).toEqual(copy);
  });

  it('isDue compares dueAt against a cutoff', () => {
    const s = scheduleReview(newSchedule(), 'good', NOW);
    expect(isDue(s, NOW)).toBe(false);
    expect(isDue(s, s.dueAt!)).toBe(true);
  });
});
