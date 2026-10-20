import {
  AsyncStorageRepository,
  DEFAULT_STORAGE_KEY,
  FlashcardRepository,
  InMemoryRepository,
  KeyValueStorage,
  MemoryStorage,
  NotFoundError,
  recordReview,
  RepositoryOptions,
  ValidationError,
} from '../repository';
import { at } from '../__fixtures__/helpers';

function deterministic(): Required<Pick<RepositoryOptions, 'now' | 'generateId'>> {
  let t = at(2026, 1, 1);
  let id = 0;
  return { now: () => (t += 1000), generateId: () => `id-${++id}` };
}

type Factory = () => { repo: FlashcardRepository };

const factories: [string, Factory][] = [
  ['InMemoryRepository', () => ({ repo: new InMemoryRepository(deterministic()) })],
  ['AsyncStorageRepository', () => ({ repo: new AsyncStorageRepository(new MemoryStorage(), deterministic()) })],
];

describe.each(factories)('%s', (_name, factory) => {
  let repo: FlashcardRepository;

  beforeEach(() => {
    repo = factory().repo;
  });

  it('creates, lists, updates and deletes decks', async () => {
    const a = await repo.createDeck({ name: '  Spanish ' });
    const b = await repo.createDeck({ name: 'Kanji', newCardsPerDay: 5, reviewsPerDay: 50 });
    expect(a).toMatchObject({ name: 'Spanish', description: '', newCardsPerDay: 20, reviewsPerDay: 200 });
    expect(b).toMatchObject({ newCardsPerDay: 5, reviewsPerDay: 50 });
    expect((await repo.listDecks()).map((d) => d.id)).toEqual([a.id, b.id]);

    const updated = await repo.updateDeck(a.id, { name: 'Español', newCardsPerDay: 10 });
    expect(updated.name).toBe('Español');
    expect(updated.updatedAt).toBeGreaterThan(a.updatedAt);
    expect(await repo.getDeck(a.id)).toEqual(updated);

    await repo.deleteDeck(a.id);
    expect(await repo.getDeck(a.id)).toBeNull();
    expect(await repo.listDecks()).toHaveLength(1);
  });

  it('validates input', async () => {
    await expect(repo.createDeck({ name: '   ' })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.createDeck({ name: 'x', newCardsPerDay: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(repo.updateDeck('missing', { name: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.createCard({ deckId: 'missing', front: 'a', back: 'b' })).rejects.toBeInstanceOf(NotFoundError);
    const deck = await repo.createDeck({ name: 'D' });
    await expect(repo.createCard({ deckId: deck.id, front: '', back: 'b' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('a failed update leaves data untouched', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    await expect(repo.updateDeck(deck.id, { name: 'New', reviewsPerDay: 1.5 })).rejects.toBeInstanceOf(ValidationError);
    expect((await repo.getDeck(deck.id))!.name).toBe('D');
  });

  it('manages cards with a fresh schedule', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    const other = await repo.createDeck({ name: 'E' });
    const c1 = await repo.createCard({ deckId: deck.id, front: 'hola', back: 'hello' });
    const c2 = await repo.createCard({ deckId: other.id, front: 'q', back: 'a' });
    expect(c1.schedule.dueAt).toBeNull();
    expect(c1.schedule.easeFactor).toBe(2.5);

    expect(await repo.listCards()).toHaveLength(2);
    expect((await repo.listCards(deck.id)).map((c) => c.id)).toEqual([c1.id]);

    const edited = await repo.updateCard(c1.id, { back: 'hi', deckId: other.id });
    expect(edited).toMatchObject({ back: 'hi', deckId: other.id });
    await expect(repo.updateCard(c1.id, { deckId: 'nope' })).rejects.toBeInstanceOf(NotFoundError);

    await repo.deleteCard(c2.id);
    expect(await repo.getCard(c2.id)).toBeNull();
  });

  it('returns copies so callers cannot mutate stored data', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    const card = await repo.createCard({ deckId: deck.id, front: 'a', back: 'b' });
    card.front = 'mutated';
    card.schedule.easeFactor = 9;
    const fresh = await repo.getCard(card.id);
    expect(fresh!.front).toBe('a');
    expect(fresh!.schedule.easeFactor).toBe(2.5);
  });

  it('records reviews atomically and filters them', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    const card = await repo.createCard({ deckId: deck.id, front: 'a', back: 'b' });
    const t1 = at(2026, 2, 1);
    const first = await recordReview(repo, card.id, 'good', t1, { durationMs: 1200 });
    expect(first.card.schedule.intervalDays).toBe(1);
    expect(first.review).toMatchObject({
      cardId: card.id,
      deckId: deck.id,
      grade: 'good',
      reviewedAt: t1,
      prevRepetitions: 0,
      prevIntervalDays: 0,
      nextIntervalDays: 1,
      durationMs: 1200,
    });

    const t2 = first.card.schedule.dueAt!;
    const second = await recordReview(repo, card.id, 'again', t2);
    expect(second.card.schedule.lapses).toBe(1);
    expect((await repo.getCard(card.id))!.schedule).toEqual(second.card.schedule);

    expect(await repo.listReviews({ cardId: card.id })).toHaveLength(2);
    expect(await repo.listReviews({ since: t2 })).toHaveLength(1);
    expect(await repo.listReviews({ until: t2 })).toHaveLength(1);
    await expect(recordReview(repo, 'missing', 'good', t1)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('moving a card moves its review history, deleting cascades', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    const other = await repo.createDeck({ name: 'E' });
    const card = await repo.createCard({ deckId: deck.id, front: 'a', back: 'b' });
    await recordReview(repo, card.id, 'good', at(2026, 2, 1));
    await repo.updateCard(card.id, { deckId: other.id });
    expect(await repo.listReviews({ deckId: other.id })).toHaveLength(1);

    await repo.deleteDeck(other.id);
    expect(await repo.listCards()).toHaveLength(0);
    expect(await repo.listReviews()).toHaveLength(0);
  });

  it('serializes concurrent writes', async () => {
    const deck = await repo.createDeck({ name: 'D' });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => repo.createCard({ deckId: deck.id, front: `f${i}`, back: 'b' })),
    );
    expect(await repo.listCards(deck.id)).toHaveLength(20);
  });
});

describe('AsyncStorageRepository persistence', () => {
  it('persists to the injected storage and reloads in a new instance', async () => {
    const storage = new MemoryStorage();
    const repo = new AsyncStorageRepository(storage, deterministic());
    const deck = await repo.createDeck({ name: 'Persisted' });
    await repo.createCard({ deckId: deck.id, front: 'a', back: 'b' });

    const raw = await storage.getItem(DEFAULT_STORAGE_KEY);
    expect(JSON.parse(raw!)).toMatchObject({ version: 1 });

    const reopened = new AsyncStorageRepository(storage);
    expect((await reopened.listDecks())[0].name).toBe('Persisted');
    expect(await reopened.listCards(deck.id)).toHaveLength(1);
  });

  it('uses a custom storage key and clear() removes data', async () => {
    const storage = new MemoryStorage();
    const repo = new AsyncStorageRepository(storage, { storageKey: 'custom' });
    await repo.createDeck({ name: 'D' });
    expect(await storage.getItem('custom')).not.toBeNull();
    expect(await storage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
    await repo.clear();
    expect(await storage.getItem('custom')).toBeNull();
    expect(await repo.listDecks()).toEqual([]);
  });

  it('keeps the last persisted state when a write fails', async () => {
    const inner = new MemoryStorage();
    let fail = false;
    const storage: KeyValueStorage = {
      getItem: (k) => inner.getItem(k),
      removeItem: (k) => inner.removeItem(k),
      setItem: async (k, v) => {
        if (fail) throw new Error('disk full');
        return inner.setItem(k, v);
      },
    };
    const repo = new AsyncStorageRepository(storage);
    await repo.createDeck({ name: 'ok' });
    fail = true;
    await expect(repo.createDeck({ name: 'lost' })).rejects.toThrow('disk full');
    fail = false;
    expect((await repo.listDecks()).map((d) => d.name)).toEqual(['ok']);
  });

  it('rejects a corrupt snapshot', async () => {
    const storage = new MemoryStorage();
    await storage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify({ version: 99 }));
    const repo = new AsyncStorageRepository(storage);
    await expect(repo.listDecks()).rejects.toBeInstanceOf(ValidationError);
  });

  it('InMemoryRepository can be seeded and exported', async () => {
    const source = new InMemoryRepository(deterministic());
    await source.createDeck({ name: 'Seed' });
    const copy = new InMemoryRepository({ initial: source.exportSnapshot() });
    expect((await copy.listDecks())[0].name).toBe('Seed');
  });
});
