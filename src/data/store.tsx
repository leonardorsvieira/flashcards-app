import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AsyncStorageRepository,
  buildDeckStudyQueue,
  recordReview,
  type Card,
  type Deck,
  type Grade,
  type Review,
  type StudyQueue,
} from '@/core';
import { SEED_CARDS, SEED_DECK_NAME } from '@/utils/seed';
import { deckColors } from '@/ui/theme';

const SEEDED_KEY = '@flashcards/seeded/v1';

const repo = new AsyncStorageRepository(AsyncStorage);

/** Decks carry no color in the core model, so derive a stable one from the id. */
export function deckColor(deckId: string): string {
  let h = 0;
  for (let i = 0; i < deckId.length; i++) h = (h * 31 + deckId.charCodeAt(i)) >>> 0;
  return deckColors[h % deckColors.length];
}

export interface DeckSummary {
  deck: Deck;
  total: number;
  /** Cards in today's study queue (limits applied). */
  toStudy: number;
}

interface Data {
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
}

interface Store extends Data {
  summaries: DeckSummary[];
  saveDeck(input: { id?: string; name: string; description: string }): Promise<string>;
  deleteDeck(id: string): Promise<void>;
  saveCard(input: { id?: string; deckId: string; front: string; back: string }): Promise<void>;
  deleteCard(id: string): Promise<void>;
  /** Cards to study now for a deck, honoring daily limits. */
  studyQueue(deckId: string): StudyQueue;
  /** Grades a card and returns its updated version. */
  grade(cardId: string, grade: Grade, durationMs?: number): Promise<Card>;
  /** Adds cards to a deck; rows with an empty front or back are skipped. Returns how many were added. */
  importCards(deckId: string, rows: { front: string; back: string }[]): Promise<number>;
}

const Ctx = createContext<Store | null>(null);

async function readAll(): Promise<Data> {
  const [decks, cards, reviews] = await Promise.all([repo.listDecks(), repo.listCards(), repo.listReviews()]);
  return { decks, cards, reviews };
}

/** Creates the sample Portuguese deck once, on the very first launch. */
async function seedOnFirstLaunch(): Promise<void> {
  if (await AsyncStorage.getItem(SEEDED_KEY)) return;
  if ((await repo.listDecks()).length === 0) {
    const deck = await repo.createDeck({
      name: SEED_DECK_NAME,
      description: 'Sample deck to get you started',
    });
    for (const c of SEED_CARDS) await repo.createCard({ deckId: deck.id, front: c.front, back: c.back });
  }
  await AsyncStorage.setItem(SEEDED_KEY, '1');
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const next = await readAll();
    if (mounted.current) setData(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        await seedOnFirstLaunch();
      } catch (e) {
        console.warn('Seeding failed', e);
      }
      try {
        await refresh();
      } catch (e) {
        console.warn('Loading data failed', e);
        if (mounted.current) setData({ decks: [], cards: [], reviews: [] });
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const saveDeck: Store['saveDeck'] = useCallback(
    async ({ id, name, description }) => {
      const deck = id ? await repo.updateDeck(id, { name, description }) : await repo.createDeck({ name, description });
      await refresh();
      return deck.id;
    },
    [refresh],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      await repo.deleteDeck(id);
      await refresh();
    },
    [refresh],
  );

  const saveCard: Store['saveCard'] = useCallback(
    async ({ id, deckId, front, back }) => {
      if (id) await repo.updateCard(id, { front, back });
      else await repo.createCard({ deckId, front, back });
      await refresh();
    },
    [refresh],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      await repo.deleteCard(id);
      await refresh();
    },
    [refresh],
  );

  const grade: Store['grade'] = useCallback(
    async (cardId, g, durationMs) => {
      const { card } = await recordReview(repo, cardId, g, Date.now(), { durationMs });
      await refresh();
      return card;
    },
    [refresh],
  );

  const importCards: Store['importCards'] = useCallback(
    async (deckId, rows) => {
      let added = 0;
      try {
        for (const r of rows) {
          if (!r.front.trim() || !r.back.trim()) continue;
          await repo.createCard({ deckId, front: r.front, back: r.back });
          added++;
        }
      } finally {
        await refresh();
      }
      return added;
    },
    [refresh],
  );

  const value = useMemo<Store | null>(() => {
    if (!data) return null;
    const studyQueue = (deckId: string): StudyQueue => {
      const deck = data.decks.find((d) => d.id === deckId);
      if (!deck) return buildDeckStudyQueue({ id: deckId, newCardsPerDay: 0, reviewsPerDay: 0 }, [], [], Date.now());
      return buildDeckStudyQueue(deck, data.cards, data.reviews, Date.now());
    };
    const summaries = data.decks.map((deck) => ({
      deck,
      total: data.cards.filter((c) => c.deckId === deck.id).length,
      toStudy: studyQueue(deck.id).cards.length,
    }));
    return { ...data, summaries, saveDeck, deleteDeck, saveCard, deleteCard, studyQueue, grade, importCards };
  }, [data, saveDeck, deleteDeck, saveCard, deleteCard, grade, importCards]);

  // Render nothing until the first load (and seeding) finishes so screens never see an empty store.
  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
