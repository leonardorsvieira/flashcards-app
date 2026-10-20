import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth';
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
import { SyncEngine } from './syncEngine';
import { supabaseRemote } from './syncRemote';
import { dataKeyFor, isSnapshotEmpty, seededKeyFor, type SyncStatus } from './syncLogic';

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

export interface SyncInfo {
  /** 'off' when running local-only (no account). */
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Syncs right now (pushes pending changes / pulls remote). No-op in local-only mode. */
  syncNow(): Promise<void>;
}

interface Store extends Data {
  sync: SyncInfo;
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

async function readAll(repo: AsyncStorageRepository): Promise<Data> {
  const [decks, cards, reviews] = await Promise.all([repo.listDecks(), repo.listCards(), repo.listReviews()]);
  return { decks, cards, reviews };
}

/** Creates the sample Portuguese deck once. Returns true if it was created. */
async function seedSample(repo: AsyncStorageRepository, seededKey: string): Promise<boolean> {
  if (await AsyncStorage.getItem(seededKey)) return false;
  let created = false;
  if ((await repo.listDecks()).length === 0) {
    const deck = await repo.createDeck({
      name: SEED_DECK_NAME,
      description: 'Sample deck to get you started',
    });
    for (const c of SEED_CARDS) await repo.createCard({ deckId: deck.id, front: c.front, back: c.back });
    created = true;
  }
  await AsyncStorage.setItem(seededKey, '1');
  return created;
}

/** Picks the dataset for the current account (or the local-only guest dataset). */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'loading') return null;
  const userId = status === 'signedIn' && user ? user.id : null;
  // Remount per account so data never leaks between users on the same device.
  return (
    <StoreInner key={userId ?? 'guest'} userId={userId}>
      {children}
    </StoreInner>
  );
}

function StoreInner({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(userId ? 'syncing' : 'off');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const repo = useMemo(() => new AsyncStorageRepository(AsyncStorage, { storageKey: dataKeyFor(userId) }), [userId]);
  const engineRef = useRef<SyncEngine | null>(null);

  const refresh = useCallback(async () => {
    const next = await readAll(repo);
    if (mounted.current) setData(next);
  }, [repo]);

  /** Call after every local mutation: schedules a cloud push and refreshes the UI. */
  const changed = useCallback(async () => {
    await engineRef.current?.markDirty();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    let engine: SyncEngine | null = null;
    (async () => {
      const seededKey = seededKeyFor(userId);
      // Local-only mode seeds immediately. Accounts seed only after confirming the cloud is empty.
      if (!userId) {
        try {
          await seedSample(repo, seededKey);
        } catch (e) {
          console.warn('Seeding failed', e);
        }
      }
      try {
        await refresh();
      } catch (e) {
        console.warn('Loading data failed', e);
        if (mounted.current) setData({ decks: [], cards: [], reviews: [] });
      }
      if (!userId || !mounted.current) return;

      engine = new SyncEngine({
        userId,
        storage: AsyncStorage,
        remote: supabaseRemote(userId),
        local: {
          read: async () => ({ version: 1 as const, ...(await readAll(repo)) }),
          replace: (snapshot) => repo.replaceAll(snapshot),
        },
        onStatus: (st, at) => {
          if (!mounted.current) return;
          setSyncStatus(st);
          setLastSyncedAt(at);
        },
        onRemoteApplied: () => void refresh().catch(() => undefined),
      });
      engineRef.current = engine;
      const result = await engine.reconcile();
      if (mounted.current && result.action !== 'failed' && !result.remotePresent) {
        try {
          const local = await readAll(repo);
          if (isSnapshotEmpty({ version: 1, ...local }) && (await seedSample(repo, seededKey))) {
            await engine.markDirty();
            await refresh();
          }
        } catch (e) {
          console.warn('Seeding failed', e);
        }
      }
    })();
    return () => {
      mounted.current = false;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [repo, userId, refresh]);

  const syncNow = useCallback(async () => {
    await engineRef.current?.reconcile();
  }, []);

  const saveDeck: Store['saveDeck'] = useCallback(
    async ({ id, name, description }) => {
      const deck = id ? await repo.updateDeck(id, { name, description }) : await repo.createDeck({ name, description });
      await changed();
      return deck.id;
    },
    [repo, changed],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      await repo.deleteDeck(id);
      await changed();
    },
    [repo, changed],
  );

  const saveCard: Store['saveCard'] = useCallback(
    async ({ id, deckId, front, back }) => {
      if (id) await repo.updateCard(id, { front, back });
      else await repo.createCard({ deckId, front, back });
      await changed();
    },
    [repo, changed],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      await repo.deleteCard(id);
      await changed();
    },
    [repo, changed],
  );

  const grade: Store['grade'] = useCallback(
    async (cardId, g, durationMs) => {
      const { card } = await recordReview(repo, cardId, g, Date.now(), { durationMs });
      await changed();
      return card;
    },
    [repo, changed],
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
        if (added > 0) await changed();
        else await refresh();
      }
      return added;
    },
    [repo, changed, refresh],
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
    const sync: SyncInfo = { status: syncStatus, lastSyncedAt, syncNow };
    return { ...data, sync, summaries, saveDeck, deleteDeck, saveCard, deleteCard, studyQueue, grade, importCards };
  }, [data, syncStatus, lastSyncedAt, syncNow, saveDeck, deleteDeck, saveCard, deleteCard, grade, importCards]);

  // Render nothing until the first load (and seeding) finishes so screens never see an empty store.
  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
