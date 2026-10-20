// UI-facing types. Mirror the src/core types (Deck, Card, Review); swap for core imports later.
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export interface Deck {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: number;
  ease: number;
  intervalDays: number;
  reps: number;
  due: number; // epoch ms
}

export interface Review {
  id: string;
  cardId: string;
  deckId: string;
  grade: Grade;
  reviewedAt: number;
}

export interface DeckSummary {
  deck: Deck;
  total: number;
  due: number;
  fresh: number;
}
