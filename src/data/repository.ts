import type { Card, Deck, Grade, Review } from './types';

export interface Snapshot {
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
}

/**
 * The only persistence/scheduling surface the UI store talks to.
 * Implement this over src/core (repository + SM-2 scheduler) to replace
 * the temporary local stub in localRepository.ts.
 */
export interface FlashcardsRepository {
  load(): Promise<Snapshot>;
  save(data: Snapshot): Promise<void>;
  /** Returns the card with updated scheduling state after grading. */
  schedule(card: Card, grade: Grade, now: number): Card;
}
