import { newSchedule, scheduleReview, SchedulerConfig } from './scheduler';
import {
  Card,
  CardPatch,
  CardSchedule,
  Deck,
  DeckPatch,
  DEFAULT_NEW_CARDS_PER_DAY,
  DEFAULT_REVIEWS_PER_DAY,
  Grade,
  NewCardInput,
  NewDeckInput,
  Review,
} from './types';

export interface ReviewQuery {
  deckId?: string;
  cardId?: string;
  /** Inclusive lower bound on reviewedAt. */
  since?: number;
  /** Exclusive upper bound on reviewedAt. */
  until?: number;
}

export interface FlashcardRepository {
  listDecks(): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | null>;
  createDeck(input: NewDeckInput): Promise<Deck>;
  updateDeck(id: string, patch: DeckPatch): Promise<Deck>;
  /** Deletes the deck together with its cards and reviews. */
  deleteDeck(id: string): Promise<void>;

  /** Lists cards, optionally limited to one deck. Ordered by createdAt. */
  listCards(deckId?: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | null>;
  createCard(input: NewCardInput): Promise<Card>;
  updateCard(id: string, patch: CardPatch): Promise<Card>;
  /** Deletes the card together with its reviews. */
  deleteCard(id: string): Promise<void>;

  addReview(review: Omit<Review, 'id'>): Promise<Review>;
  /** Atomically stores a card's new schedule and logs the matching review. */
  commitReview(
    cardId: string,
    schedule: CardSchedule,
    review: Omit<Review, 'id' | 'cardId' | 'deckId'>,
  ): Promise<RecordReviewResult>;
  /** Lists reviews ordered by reviewedAt ascending. */
  listReviews(query?: ReviewQuery): Promise<Review[]>;
}

export class NotFoundError extends Error {
  constructor(kind: 'deck' | 'card', id: string) {
    super(`${kind} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface RepositoryOptions {
  /** Clock used for createdAt/updatedAt. Defaults to Date.now. */
  now?: () => number;
  /** ID generator. Defaults to a time+random base36 id. */
  generateId?: () => string;
  /** Scheduler config used for new cards' initial schedule. */
  scheduler?: Partial<SchedulerConfig>;
}

export interface RepositorySnapshot {
  version: 1;
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
}

export function emptySnapshot(): RepositorySnapshot {
  return { version: 1, decks: [], cards: [], reviews: [] };
}

let idCounter = 0;
export function defaultGenerateId(): string {
  idCounter = (idCounter + 1) % 1679616; // 36^4
  return (
    Date.now().toString(36) +
    idCounter.toString(36).padStart(4, '0') +
    Math.random().toString(36).slice(2, 8)
  );
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireText(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value;
}

function requireLimit(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
  return value;
}

/**
 * Shared implementation over a whole-dataset snapshot. Subclasses provide
 * `load` and `persist`; mutations are serialized so concurrent calls cannot
 * overwrite each other's writes.
 */
export abstract class SnapshotRepository implements FlashcardRepository {
  protected readonly now: () => number;
  protected readonly generateId: () => string;
  protected readonly schedulerConfig?: Partial<SchedulerConfig>;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: RepositoryOptions = {}) {
    this.now = options.now ?? Date.now;
    this.generateId = options.generateId ?? defaultGenerateId;
    this.schedulerConfig = options.scheduler;
  }

  protected abstract load(): Promise<RepositorySnapshot>;
  protected abstract persist(snapshot: RepositorySnapshot): Promise<void>;

  private run<T>(fn: (s: RepositorySnapshot) => T, write: boolean): Promise<T> {
    const task = this.queue.then(async () => {
      const loaded = await this.load();
      // Writes work on a copy so a failed validation or storage error never
      // leaves a half-applied change behind.
      const snapshot = write ? clone(loaded) : loaded;
      const result = fn(snapshot);
      if (write) await this.persist(snapshot);
      return result === undefined ? result : clone(result);
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private read<T>(fn: (s: RepositorySnapshot) => T): Promise<T> {
    return this.run(fn, false);
  }

  private write<T>(fn: (s: RepositorySnapshot) => T): Promise<T> {
    return this.run(fn, true);
  }

  // Decks

  listDecks(): Promise<Deck[]> {
    return this.read((s) => [...s.decks].sort((a, b) => a.createdAt - b.createdAt));
  }

  getDeck(id: string): Promise<Deck | null> {
    return this.read((s) => s.decks.find((d) => d.id === id) ?? null);
  }

  createDeck(input: NewDeckInput): Promise<Deck> {
    return this.write((s) => {
      const ts = this.now();
      const deck: Deck = {
        id: this.generateId(),
        name: requireText(input.name, 'name').trim(),
        description: input.description ?? '',
        createdAt: ts,
        updatedAt: ts,
        newCardsPerDay: requireLimit(input.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY, 'newCardsPerDay'),
        reviewsPerDay: requireLimit(input.reviewsPerDay ?? DEFAULT_REVIEWS_PER_DAY, 'reviewsPerDay'),
      };
      s.decks.push(deck);
      return deck;
    });
  }

  updateDeck(id: string, patch: DeckPatch): Promise<Deck> {
    return this.write((s) => {
      const deck = s.decks.find((d) => d.id === id);
      if (!deck) throw new NotFoundError('deck', id);
      if (patch.name !== undefined) deck.name = requireText(patch.name, 'name').trim();
      if (patch.description !== undefined) deck.description = patch.description;
      if (patch.newCardsPerDay !== undefined)
        deck.newCardsPerDay = requireLimit(patch.newCardsPerDay, 'newCardsPerDay');
      if (patch.reviewsPerDay !== undefined)
        deck.reviewsPerDay = requireLimit(patch.reviewsPerDay, 'reviewsPerDay');
      deck.updatedAt = this.now();
      return deck;
    });
  }

  deleteDeck(id: string): Promise<void> {
    return this.write((s) => {
      s.decks = s.decks.filter((d) => d.id !== id);
      s.cards = s.cards.filter((c) => c.deckId !== id);
      s.reviews = s.reviews.filter((r) => r.deckId !== id);
    });
  }

  // Cards

  listCards(deckId?: string): Promise<Card[]> {
    return this.read((s) =>
      s.cards
        .filter((c) => deckId === undefined || c.deckId === deckId)
        .sort((a, b) => a.createdAt - b.createdAt),
    );
  }

  getCard(id: string): Promise<Card | null> {
    return this.read((s) => s.cards.find((c) => c.id === id) ?? null);
  }

  createCard(input: NewCardInput): Promise<Card> {
    return this.write((s) => {
      if (!s.decks.some((d) => d.id === input.deckId)) throw new NotFoundError('deck', input.deckId);
      const ts = this.now();
      const card: Card = {
        id: this.generateId(),
        deckId: input.deckId,
        front: requireText(input.front, 'front'),
        back: requireText(input.back, 'back'),
        createdAt: ts,
        updatedAt: ts,
        schedule: newSchedule(this.schedulerConfig),
      };
      s.cards.push(card);
      return card;
    });
  }

  updateCard(id: string, patch: CardPatch): Promise<Card> {
    return this.write((s) => {
      const card = s.cards.find((c) => c.id === id);
      if (!card) throw new NotFoundError('card', id);
      if (patch.deckId !== undefined && patch.deckId !== card.deckId) {
        if (!s.decks.some((d) => d.id === patch.deckId)) throw new NotFoundError('deck', patch.deckId);
        card.deckId = patch.deckId;
        for (const r of s.reviews) if (r.cardId === id) r.deckId = patch.deckId;
      }
      if (patch.front !== undefined) card.front = requireText(patch.front, 'front');
      if (patch.back !== undefined) card.back = requireText(patch.back, 'back');
      if (patch.schedule !== undefined) card.schedule = { ...patch.schedule };
      card.updatedAt = this.now();
      return card;
    });
  }

  deleteCard(id: string): Promise<void> {
    return this.write((s) => {
      s.cards = s.cards.filter((c) => c.id !== id);
      s.reviews = s.reviews.filter((r) => r.cardId !== id);
    });
  }

  // Reviews

  addReview(input: Omit<Review, 'id'>): Promise<Review> {
    return this.write((s) => {
      if (!s.cards.some((c) => c.id === input.cardId)) throw new NotFoundError('card', input.cardId);
      const review: Review = { ...input, id: this.generateId() };
      s.reviews.push(review);
      return review;
    });
  }

  commitReview(
    cardId: string,
    nextSchedule: CardSchedule,
    input: Omit<Review, 'id' | 'cardId' | 'deckId'>,
  ): Promise<RecordReviewResult> {
    return this.write((s) => {
      const card = s.cards.find((c) => c.id === cardId);
      if (!card) throw new NotFoundError('card', cardId);
      card.schedule = { ...nextSchedule };
      card.updatedAt = this.now();
      const review: Review = { ...input, cardId, deckId: card.deckId, id: this.generateId() };
      s.reviews.push(review);
      return { card, review };
    });
  }

  listReviews(query: ReviewQuery = {}): Promise<Review[]> {
    return this.read((s) =>
      s.reviews
        .filter(
          (r) =>
            (query.deckId === undefined || r.deckId === query.deckId) &&
            (query.cardId === undefined || r.cardId === query.cardId) &&
            (query.since === undefined || r.reviewedAt >= query.since) &&
            (query.until === undefined || r.reviewedAt < query.until),
        )
        .sort((a, b) => a.reviewedAt - b.reviewedAt),
    );
  }
}

/** Repository kept entirely in memory. Useful for tests and previews. */
export class InMemoryRepository extends SnapshotRepository {
  private snapshot: RepositorySnapshot;

  constructor(options: RepositoryOptions & { initial?: RepositorySnapshot } = {}) {
    super(options);
    this.snapshot = options.initial ? clone(options.initial) : emptySnapshot();
  }

  protected async load(): Promise<RepositorySnapshot> {
    return this.snapshot;
  }

  protected async persist(snapshot: RepositorySnapshot): Promise<void> {
    this.snapshot = snapshot;
  }

  /** Deep copy of all data (e.g. for export/backup). */
  exportSnapshot(): RepositorySnapshot {
    return clone(this.snapshot);
  }
}

/**
 * Minimal async key-value contract. `@react-native-async-storage/async-storage`'s
 * default export satisfies it, so it can be passed in directly from app code.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** In-memory KeyValueStorage, handy for tests. */
export class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export interface AsyncStorageRepositoryOptions extends RepositoryOptions {
  /** Storage key holding the serialized snapshot. */
  storageKey?: string;
}

export const DEFAULT_STORAGE_KEY = '@flashcards/core/v1';

/**
 * Repository persisted to an injected KeyValueStorage (AsyncStorage in the app).
 * The whole dataset is stored as one JSON document and cached after first load.
 */
export class AsyncStorageRepository extends SnapshotRepository {
  private readonly storage: KeyValueStorage;
  private readonly storageKey: string;
  private cache: RepositorySnapshot | null = null;

  constructor(storage: KeyValueStorage, options: AsyncStorageRepositoryOptions = {}) {
    super(options);
    this.storage = storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  }

  protected async load(): Promise<RepositorySnapshot> {
    if (this.cache) return this.cache;
    const raw = await this.storage.getItem(this.storageKey);
    this.cache = raw ? parseSnapshot(raw) : emptySnapshot();
    return this.cache;
  }

  protected async persist(snapshot: RepositorySnapshot): Promise<void> {
    // Cache is only replaced after a successful write.
    await this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
    this.cache = snapshot;
  }

  /** Forgets the in-memory cache so the next call re-reads storage. */
  invalidateCache(): void {
    this.cache = null;
  }

  /** Removes all persisted data. */
  async clear(): Promise<void> {
    await this.storage.removeItem(this.storageKey);
    this.cache = null;
  }
}

export function parseSnapshot(raw: string): RepositorySnapshot {
  const data = JSON.parse(raw) as Partial<RepositorySnapshot>;
  if (!data || data.version !== 1 || !Array.isArray(data.decks) || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    throw new ValidationError('Unsupported or corrupt flashcards snapshot');
  }
  return data as RepositorySnapshot;
}

export interface RecordReviewResult {
  card: Card;
  review: Review;
}

/**
 * Grades a card: applies the scheduler, then stores the new schedule and the
 * Review in one atomic repository write.
 */
export async function recordReview(
  repo: FlashcardRepository,
  cardId: string,
  grade: Grade,
  now: number,
  options: { durationMs?: number; scheduler?: Partial<SchedulerConfig> } = {},
): Promise<RecordReviewResult> {
  const card = await repo.getCard(cardId);
  if (!card) throw new NotFoundError('card', cardId);
  const prev = card.schedule;
  const next = scheduleReview(prev, grade, now, options.scheduler);
  return repo.commitReview(cardId, next, {
    grade,
    reviewedAt: now,
    prevRepetitions: prev.repetitions,
    prevIntervalDays: prev.intervalDays,
    nextIntervalDays: next.intervalDays,
    prevEaseFactor: prev.easeFactor,
    nextEaseFactor: next.easeFactor,
    ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
  });
}
