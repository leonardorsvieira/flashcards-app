import { addDays, MINUTE_MS } from './dates';
import type { CardSchedule, Grade } from './types';

/**
 * SM-2 based scheduler with four answer buttons.
 *
 * Grades map to SM-2 quality scores (again=1, hard=3, good=4, easy=5) and the
 * ease factor is updated with the classic SM-2 formula:
 *   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), clamped to minEase.
 *
 * Intervals:
 * - again: repetitions reset, interval 0, card comes back after `againDelayMinutes`.
 * - good:  1st success -> firstIntervalDays, 2nd -> secondIntervalDays,
 *          then round(prevInterval * EF').
 * - hard:  grows slower than good (prevInterval * hardMultiplier, at least +1 day),
 *          never more than good.
 * - easy:  always longer than good (good * easyBonus, at least good + 1);
 *          a new card graded easy jumps straight to easyFirstIntervalDays.
 */
export interface SchedulerConfig {
  initialEase: number;
  minEase: number;
  firstIntervalDays: number;
  secondIntervalDays: number;
  easyFirstIntervalDays: number;
  hardMultiplier: number;
  easyBonus: number;
  maxIntervalDays: number;
  againDelayMinutes: number;
}

export const DEFAULT_SCHEDULER_CONFIG: Readonly<SchedulerConfig> = Object.freeze({
  initialEase: 2.5,
  minEase: 1.3,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
  easyFirstIntervalDays: 4,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  maxIntervalDays: 36500,
  againDelayMinutes: 10,
});

export const GRADE_QUALITY: Readonly<Record<Grade, number>> = Object.freeze({
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
});

function resolveConfig(config?: Partial<SchedulerConfig>): SchedulerConfig {
  return { ...DEFAULT_SCHEDULER_CONFIG, ...config };
}

export function newSchedule(config?: Partial<SchedulerConfig>): CardSchedule {
  const cfg = resolveConfig(config);
  return {
    easeFactor: cfg.initialEase,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: null,
    lastReviewedAt: null,
  };
}

export function isNewCard(schedule: CardSchedule): boolean {
  return schedule.dueAt === null;
}

export function isDue(schedule: CardSchedule, cutoff: number): boolean {
  return schedule.dueAt !== null && schedule.dueAt <= cutoff;
}

/** SM-2 ease update for a grade, clamped to `minEase` and rounded to 2 decimals. */
export function nextEaseFactor(ease: number, grade: Grade, config?: Partial<SchedulerConfig>): number {
  const cfg = resolveConfig(config);
  const q = GRADE_QUALITY[grade];
  const updated = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(cfg.minEase, Math.round(updated * 100) / 100);
}

/** Interval in days the card would get for `grade` (0 for "again"). */
export function nextIntervalDays(
  schedule: CardSchedule,
  grade: Grade,
  config?: Partial<SchedulerConfig>,
): number {
  const cfg = resolveConfig(config);
  if (grade === 'again') return 0;

  const ease = nextEaseFactor(schedule.easeFactor, grade, cfg);
  const prev = Math.max(schedule.intervalDays, 1);
  const reps = schedule.repetitions;

  let good: number;
  if (reps === 0) good = cfg.firstIntervalDays;
  else if (reps === 1) good = cfg.secondIntervalDays;
  else good = Math.round(prev * ease);
  // A successful review should never shrink a mature interval.
  if (reps >= 2) good = Math.max(good, schedule.intervalDays + 1);

  let result: number;
  if (grade === 'good') {
    result = good;
  } else if (grade === 'hard') {
    result =
      reps === 0
        ? cfg.firstIntervalDays
        : Math.min(good, Math.max(prev + 1, Math.round(prev * cfg.hardMultiplier)));
  } else {
    result =
      reps === 0
        ? Math.max(cfg.easyFirstIntervalDays, good + 1)
        : Math.max(good + 1, Math.round(good * cfg.easyBonus));
  }
  return Math.min(cfg.maxIntervalDays, Math.max(1, result));
}

/** Applies a grade to a schedule and returns the new schedule (pure). */
export function scheduleReview(
  current: CardSchedule,
  grade: Grade,
  now: number,
  config?: Partial<SchedulerConfig>,
): CardSchedule {
  const cfg = resolveConfig(config);
  const easeFactor = nextEaseFactor(current.easeFactor, grade, cfg);

  if (grade === 'again') {
    const wasLearned = current.repetitions > 0;
    return {
      easeFactor,
      intervalDays: 0,
      repetitions: 0,
      lapses: current.lapses + (wasLearned ? 1 : 0),
      dueAt: now + cfg.againDelayMinutes * MINUTE_MS,
      lastReviewedAt: now,
    };
  }

  const intervalDays = nextIntervalDays(current, grade, cfg);
  return {
    easeFactor,
    intervalDays,
    repetitions: current.repetitions + 1,
    lapses: current.lapses,
    dueAt: addDays(now, intervalDays),
    lastReviewedAt: now,
  };
}

/** Intervals (days) each button would produce, for showing on answer buttons. */
export function previewIntervals(
  current: CardSchedule,
  config?: Partial<SchedulerConfig>,
): Record<Grade, number> {
  return {
    again: 0,
    hard: nextIntervalDays(current, 'hard', config),
    good: nextIntervalDays(current, 'good', config),
    easy: nextIntervalDays(current, 'easy', config),
  };
}
