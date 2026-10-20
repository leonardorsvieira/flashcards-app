import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FlashcardsRepository } from './repository';
import type { Card, Grade } from './types';

const KEY = 'flashcards:v1';
const DAY = 86_400_000;

// TEMPORARY stub: AsyncStorage persistence plus a tiny SM-2-like scheduler.
// Replace with an adapter over src/core.
export const localRepository: FlashcardsRepository = {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { decks: [], cards: [], reviews: [] };
  },
  async save(data) {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(data));
    } catch {}
  },
  schedule(card: Card, grade: Grade, now: number): Card {
    const q = { again: 1, hard: 3, good: 4, easy: 5 }[grade];
    const ease = Math.max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    if (grade === 'again') {
      return { ...card, ease, reps: 0, intervalDays: 0, due: now + 60_000 };
    }
    const reps = card.reps + 1;
    const mult = grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1;
    let intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(card.intervalDays * ease * mult);
    intervalDays = Math.max(1, intervalDays);
    return { ...card, ease, reps, intervalDays, due: now + intervalDays * DAY };
  },
};
