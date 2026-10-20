import type { KeyValueStorage, RepositorySnapshot } from '../core/repository';
import { decideSync, metaKeyFor, remoteFromRow, snapshotFromRemote, type SyncStatus } from './syncLogic';

export interface RemoteRow {
  data: unknown;
  updated_at: string;
}

/** Network side, injected so the engine can be tested without Supabase. */
export interface RemoteStore {
  fetch(): Promise<RemoteRow | null>;
  upsert(data: RepositorySnapshot, updatedAtIso: string): Promise<void>;
}

/** Local side: the repository, exposed minimally. */
export interface LocalStore {
  read(): Promise<RepositorySnapshot>;
  replace(snapshot: RepositorySnapshot): Promise<void>;
}

export interface SyncEngineOptions {
  userId: string;
  storage: KeyValueStorage;
  remote: RemoteStore;
  local: LocalStore;
  onStatus(status: SyncStatus, lastSyncedAt: number | null): void;
  /** Called after remote data replaced local data. */
  onRemoteApplied(): void;
  now?: () => number;
  debounceMs?: number;
  retryMs?: number;
}

export interface ReconcileResult {
  action: 'push' | 'pull' | 'noop' | 'failed';
  /** True if a valid remote row existed (so callers know not to seed sample data). */
  remotePresent: boolean;
}

function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return e instanceof TypeError || msg.includes('fetch') || msg.includes('network') || msg.includes('timeout');
}

export class SyncEngine {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private lastSyncedAt: number | null = null;
  private readonly now: () => number;
  private readonly debounceMs: number;
  private readonly retryMs: number;

  constructor(private readonly o: SyncEngineOptions) {
    this.now = o.now ?? Date.now;
    this.debounceMs = o.debounceMs ?? 2000;
    this.retryMs = o.retryMs ?? 15000;
  }

  private emit(status: SyncStatus) {
    if (!this.disposed) this.o.onStatus(status, this.lastSyncedAt);
  }

  private async getLocalUpdatedAt(): Promise<number | null> {
    const raw = await this.o.storage.getItem(metaKeyFor(this.o.userId));
    if (!raw) return null;
    try {
      const v = JSON.parse(raw)?.localUpdatedAt;
      return typeof v === 'number' ? v : null;
    } catch {
      return null;
    }
  }

  private setLocalUpdatedAt(v: number): Promise<void> {
    return this.o.storage.setItem(metaKeyFor(this.o.userId), JSON.stringify({ localUpdatedAt: v }));
  }

  /** Call after every local change: records the time and schedules a debounced push. */
  async markDirty(): Promise<void> {
    if (this.disposed) return;
    await this.setLocalUpdatedAt(this.now());
    this.emit('pending');
    this.schedule(this.debounceMs);
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.reconcile();
    }, ms);
  }

  /** Pulls/pushes according to last-write-wins. Serialized; safe to call repeatedly. */
  reconcile(): Promise<ReconcileResult> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const run = this.chain.then(() => this.doReconcile());
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async doReconcile(): Promise<ReconcileResult> {
    if (this.disposed) return { action: 'failed', remotePresent: false };
    this.emit('syncing');
    try {
      const row = await this.o.remote.fetch();
      const remote = remoteFromRow(row);
      // A row with unusable data might just be a newer format: never overwrite it blindly.
      if (row && !remote && row.data !== null && row.data !== undefined && !snapshotFromRemote(row.data)) {
        throw new Error('Remote snapshot is invalid');
      }
      const local = await this.o.local.read();
      const localUpdatedAt = await this.getLocalUpdatedAt();
      const action = decideSync({ local, localUpdatedAt, remote });
      if (action === 'pull' && remote) {
        await this.o.local.replace(remote.snapshot);
        await this.setLocalUpdatedAt(remote.updatedAt);
        this.o.onRemoteApplied();
      } else if (action === 'push') {
        const ts = localUpdatedAt ?? this.now();
        if (localUpdatedAt === null) await this.setLocalUpdatedAt(ts);
        await this.o.remote.upsert(local, new Date(ts).toISOString());
      }
      this.lastSyncedAt = this.now();
      // A change made while syncing re-armed the timer; keep showing "pending".
      this.emit(this.timer ? 'pending' : 'synced');
      return { action, remotePresent: remote !== null };
    } catch (e) {
      console.warn('Sync failed', e);
      this.emit(isNetworkError(e) ? 'offline' : 'error');
      if (!this.disposed) this.schedule(this.retryMs);
      return { action: 'failed', remotePresent: false };
    }
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
