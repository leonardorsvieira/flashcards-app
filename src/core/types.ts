/**
 * Core domain types. All timestamps are epoch milliseconds (UTC instants);
 * calendar-day logic (streaks, "due today") uses the device's local time.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy';

export const GRADES: readonly Grade[] = ['again', 'hard', 'good', 'easy'];

export interface CardSchedule {
  /** SM-2 ease factor, never below the configured minimum (1.3 by default). */
  easeFactor: number;
  /** Current interval in days. 0 means the card is new or in (re)learning. */
  intervalDays: number;
  /** Consecutive successful reviews since the last lapse. */
  repetitions: number;
  /** Number of times the card was forgotten (graded "again" after being learned). */
  lapses: number;
  /** When the card becomes due. `null` means the card has never been studied (new). */
  dueAt: number | null;
  lastReviewedAt: number | null;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: number;
  updatedAt: number;
  schedule: CardSchedule;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  /** Max new cards introduced per day for this deck. */
  newCardsPerDay: number;
  /** Max review cards per day for this deck. */
  reviewsPerDay: number;
}

export interface Review {
  id: string;
  cardId: string;
  deckId: string;
  grade: Grade;
  reviewedAt: number;
  /** Repetitions before this review; 0 means the card was new or relearning. */
  prevRepetitions: number;
  prevIntervalDays: number;
  nextIntervalDays: number;
  prevEaseFactor: number;
  nextEaseFactor: number;
  /** Optional time spent answering, in ms. */
  durationMs?: number;
}

export interface NewDeckInput {
  name: string;
  description?: string;
  newCardsPerDay?: number;
  reviewsPerDay?: number;
}

export type DeckPatch = Partial<Pick<Deck, 'name' | 'description' | 'newCardsPerDay' | 'reviewsPerDay'>>;

export interface NewCardInput {
  deckId: string;
  front: string;
  back: string;
}

export type CardPatch = Partial<Pick<Card, 'front' | 'back' | 'deckId' | 'schedule'>>;

export const DEFAULT_NEW_CARDS_PER_DAY = 20;
export const DEFAULT_REVIEWS_PER_DAY = 200;
