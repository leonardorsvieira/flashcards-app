import { emptySnapshot, MemoryStorage, type RepositorySnapshot } from '../../core/repository';
import { SyncEngine, type RemoteRow, type RemoteStore } from '../syncEngine';
import {
  dataKeyFor,
  decideSync,
  isSnapshotEmpty,
  metaKeyFor,
  remoteFromRow,
  seededKeyFor,
  snapshotFromRemote,
} from '../syncLogic';

const withDeck = (): RepositorySnapshot => ({
  version: 1,
  decks: [{ id: 'd1', name: 'A', description: '', createdAt: 1, updatedAt: 1, newCardsPerDay: 20, reviewsPerDay: 200 }],
  cards: [],
  reviews: [],
});

const remoteOf = (snapshot: RepositorySnapshot, updatedAt: number) => ({ snapshot, updatedAt });

describe('decideSync', () => {
  it('does nothing when both sides are empty', () => {
    expect(decideSync({ local: emptySnapshot(), localUpdatedAt: null, remote: null })).toBe('noop');
  });

  it('pushes local data when there is no remote row', () => {
    expect(decideSync({ local: withDeck(), localUpdatedAt: 5, remote: null })).toBe('push');
    expect(decideSync({ local: withDeck(), localUpdatedAt: null, remote: null })).toBe('push');
  });

  it('pulls on a fresh device even if remote is older than "now"', () => {
    expect(decideSync({ local: emptySnapshot(), localUpdatedAt: null, remote: remoteOf(withDeck(), 100) })).toBe('pull');
  });

  it('newer remote wins (pull)', () => {
    expect(decideSync({ local: withDeck(), localUpdatedAt: 100, remote: remoteOf(emptySnapshot(), 200) })).toBe('pull');
  });

  it('newer local wins (push), including a deliberate local wipe', () => {
    expect(decideSync({ local: emptySnapshot(), localUpdatedAt: 300, remote: remoteOf(withDeck(), 200) })).toBe('push');
  });

  it('equal timestamps are a noop', () => {
    expect(decideSync({ local: withDeck(), localUpdatedAt: 200, remote: remoteOf(withDeck(), 200) })).toBe('noop');
  });
});

describe('remote parsing', () => {
  it('accepts a valid snapshot and timestamp', () => {
    const r = remoteFromRow({ data: withDeck(), updated_at: '2026-01-01T00:00:00.000Z' });
    expect(r?.updatedAt).toBe(Date.parse('2026-01-01T00:00:00.000Z'));
    expect(r?.snapshot.decks).toHaveLength(1);
  });

  it('rejects empty, corrupt or wrong-version data', () => {
    expect(snapshotFromRemote(null)).toBeNull();
    expect(snapshotFromRemote({})).toBeNull();
    expect(snapshotFromRemote({ version: 2, decks: [], cards: [], reviews: [] })).toBeNull();
    expect(remoteFromRow({ data: withDeck(), updated_at: 'nope' })).toBeNull();
    expect(remoteFromRow(null)).toBeNull();
  });

  it('isSnapshotEmpty', () => {
    expect(isSnapshotEmpty(emptySnapshot())).toBe(true);
    expect(isSnapshotEmpty(withDeck())).toBe(false);
  });
});

describe('storage keys', () => {
  it('are distinct per user and for guests', () => {
    expect(dataKeyFor(null)).not.toBe(dataKeyFor('u1'));
    expect(dataKeyFor('u1')).not.toBe(dataKeyFor('u2'));
    expect(seededKeyFor('u1')).not.toBe(seededKeyFor('u2'));
    expect(metaKeyFor('u1')).not.toBe(metaKeyFor('u2'));
  });
});

describe('SyncEngine', () => {
  function setup(row: RemoteRow | null, local: RepositorySnapshot) {
    const storage = new MemoryStorage();
    const state = { row, local, upserts: [] as { data: RepositorySnapshot; at: string }[] };
    const remote: RemoteStore = {
      fetch: async () => state.row,
      upsert: async (data, at) => {
        state.upserts.push({ data, at });
        state.row = { data, updated_at: at };
      },
    };
    const statuses: string[] = [];
    const engine = new SyncEngine({
      userId: 'u1',
      storage,
      remote,
      local: {
        read: async () => state.local,
        replace: async (s) => {
          state.local = s;
        },
      },
      onStatus: (s) => statuses.push(s),
      onRemoteApplied: () => undefined,
      now: () => 1000,
    });
    return { engine, state, statuses, storage };
  }

  it('pulls remote data on a fresh device', async () => {
    const { engine, state } = setup({ data: withDeck(), updated_at: new Date(500).toISOString() }, emptySnapshot());
    const res = await engine.reconcile();
    expect(res).toEqual({ action: 'pull', remotePresent: true });
    expect(state.local.decks).toHaveLength(1);
    // Immediately re-running is a noop (timestamps match).
    expect((await engine.reconcile()).action).toBe('noop');
    engine.dispose();
  });

  it('pushes after a local change and then settles', async () => {
    const { engine, state } = setup({ data: emptySnapshot(), updated_at: new Date(500).toISOString() }, withDeck());
    await engine.markDirty();
    const res = await engine.reconcile();
    expect(res.action).toBe('push');
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].at).toBe(new Date(1000).toISOString());
    expect((await engine.reconcile()).action).toBe('noop');
    engine.dispose();
  });

  it('reports remote absent so callers may seed', async () => {
    const { engine } = setup(null, emptySnapshot());
    expect(await engine.reconcile()).toEqual({ action: 'noop', remotePresent: false });
    engine.dispose();
  });

  it('keeps local data and reports offline when fetch fails', async () => {
    const { engine, state, statuses } = setup(null, withDeck());
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (engine as unknown as { o: { remote: RemoteStore } }).o.remote.fetch = async () => {
      throw new TypeError('Network request failed');
    };
    expect((await engine.reconcile()).action).toBe('failed');
    expect(statuses).toContain('offline');
    expect(state.local.decks).toHaveLength(1);
    engine.dispose();
    warn.mockRestore();
  });

  it('refuses to overwrite an unreadable remote row', async () => {
    const { engine, state, statuses } = setup(
      { data: { version: 99, decks: [] }, updated_at: new Date(1).toISOString() },
      withDeck(),
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect((await engine.reconcile()).action).toBe('failed');
    expect(state.upserts).toHaveLength(0);
    expect(statuses).toContain('error');
    engine.dispose();
    warn.mockRestore();
  });
});

describe('AsyncStorageRepository.replaceAll', () => {
  it('replaces the dataset and persists it', async () => {
    const { AsyncStorageRepository } = await import('../../core/repository');
    const storage = new MemoryStorage();
    const repo = new AsyncStorageRepository(storage, { storageKey: 'k' });
    await repo.createDeck({ name: 'old' });
    await repo.replaceAll(withDeck());
    expect((await repo.listDecks()).map((d) => d.id)).toEqual(['d1']);
    const again = new AsyncStorageRepository(storage, { storageKey: 'k' });
    expect((await again.listDecks()).map((d) => d.name)).toEqual(['A']);
  });
});
