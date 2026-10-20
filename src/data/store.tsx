import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { localRepository } from './localRepository';
import type { FlashcardsRepository, Snapshot } from './repository';
import type { Card, Deck, DeckSummary, Grade, Review } from './types';

// Swap the repository here when src/core is wired in.
const repo: FlashcardsRepository = localRepository;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

interface Store extends Snapshot {
  ready: boolean;
  summaries: DeckSummary[];
  saveDeck(input: { id?: string; name: string; description: string; color: string }): string;
  deleteDeck(id: string): void;
  saveCard(input: { id?: string; deckId: string; front: string; back: string }): void;
  deleteCard(id: string): void;
  dueCards(deckId: string): Card[];
  grade(cardId: string, grade: Grade): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot>({ decks: [], cards: [], reviews: [] });
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    repo.load().then((d) => {
      setData(d);
      loaded.current = true;
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (loaded.current) repo.save(data);
  }, [data]);

  const saveDeck: Store['saveDeck'] = useCallback((input) => {
    const id = input.id ?? uid();
    setData((d) => {
      const existing = d.decks.find((x) => x.id === id);
      if (existing) {
        const deck: Deck = { ...existing, name: input.name, description: input.description, color: input.color };
        return { ...d, decks: d.decks.map((x) => (x.id === id ? deck : x)) };
      }
      const deck: Deck = { id, name: input.name, description: input.description, color: input.color, createdAt: Date.now() };
      return { ...d, decks: [...d.decks, deck] };
    });
    return id;
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setData((d) => ({
      decks: d.decks.filter((x) => x.id !== id),
      cards: d.cards.filter((c) => c.deckId !== id),
      reviews: d.reviews.filter((r) => r.deckId !== id),
    }));
  }, []);

  const saveCard: Store['saveCard'] = useCallback((input) => {
    setData((d) => {
      if (input.id) {
        return { ...d, cards: d.cards.map((c) => (c.id === input.id ? { ...c, front: input.front, back: input.back } : c)) };
      }
      const now = Date.now();
      const card: Card = {
        id: uid(), deckId: input.deckId, front: input.front, back: input.back,
        createdAt: now, ease: 2.5, intervalDays: 0, reps: 0, due: now,
      };
      return { ...d, cards: [...d.cards, card] };
    });
  }, []);

  const deleteCard = useCallback((id: string) => {
    setData((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== id), reviews: d.reviews.filter((r) => r.cardId !== id) }));
  }, []);

  const grade: Store['grade'] = useCallback((cardId, g) => {
    setData((d) => {
      const card = d.cards.find((c) => c.id === cardId);
      if (!card) return d;
      const now = Date.now();
      const next = repo.schedule(card, g, now);
      const review: Review = { id: uid(), cardId, deckId: card.deckId, grade: g, reviewedAt: now };
      return { ...d, cards: d.cards.map((c) => (c.id === cardId ? next : c)), reviews: [...d.reviews, review] };
    });
  }, []);

  const value = useMemo<Store>(() => {
    const now = Date.now();
    const summaries = data.decks.map((deck) => {
      const cs = data.cards.filter((c) => c.deckId === deck.id);
      return {
        deck,
        total: cs.length,
        due: cs.filter((c) => c.reps > 0 && c.due <= now).length,
        fresh: cs.filter((c) => c.reps === 0 && c.due <= now).length,
      };
    });
    return {
      ...data, ready, summaries, saveDeck, deleteDeck, saveCard, deleteCard, grade,
      dueCards: (deckId) =>
        data.cards.filter((c) => c.deckId === deckId && c.due <= Date.now()).sort((a, b) => a.due - b.due),
    };
  }, [data, ready, saveDeck, deleteDeck, saveCard, deleteCard, grade]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
