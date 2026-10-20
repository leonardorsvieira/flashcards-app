import { parseSnapshot, type RepositorySnapshot } from '../core/repository';

/** Pure helpers for cloud sync (no I/O), unit-tested in __tests__/sync.test.ts. */

export type SyncAction = 'push' | 'pull' | 'noop';

export interface RemoteState {
  /** The remote snapshot (valid and parsed). */
  snapshot: RepositorySnapshot;
  /** Remote updated_at, epoch ms. */
  updatedAt: number;
}

export interface DecideInput {
  /** Local snapshot (never mutated). */
  local: RepositorySnapshot;
  /** Epoch ms of the last local modification, or null if never modified/synced. */
  localUpdatedAt: number | null;
  /** Remote row, or null when the user has no row yet. */
  remote: RemoteState | null;
}

export function isSnapshotEmpty(s: RepositorySnapshot): boolean {
  return s.decks.length === 0 && s.cards.length === 0 && s.reviews.length === 0;
}

/**
 * Decides which side wins.
 * - No remote row: push local data if there is any.
 * - Remote row exists: last-write-wins on updated_at. Local data that was never
 *   modified on this device (localUpdatedAt null) always loses, so a fresh
 *   device pulls instead of overwriting the cloud copy.
 */
export function decideSync({ local, localUpdatedAt, remote }: DecideInput): SyncAction {
  if (!remote) return isSnapshotEmpty(local) ? 'noop' : 'push';
  if (localUpdatedAt === null) return 'pull';
  if (localUpdatedAt > remote.updatedAt) return 'push';
  if (localUpdatedAt < remote.updatedAt) return 'pull';
  return 'noop';
}

/** Validates a jsonb value coming from the server. Returns null when it is not a usable snapshot. */
export function snapshotFromRemote(data: unknown): RepositorySnapshot | null {
  if (data === null || data === undefined) return null;
  try {
    return parseSnapshot(JSON.stringify(data));
  } catch {
    return null;
  }
}

/** Builds RemoteState from a raw row; null if data is empty/invalid or timestamp unparsable. */
export function remoteFromRow(row: { data: unknown; updated_at: string } | null): RemoteState | null {
  if (!row) return null;
  const snapshot = snapshotFromRemote(row.data);
  const updatedAt = Date.parse(row.updated_at);
  if (!snapshot || Number.isNaN(updatedAt)) return null;
  return { snapshot, updatedAt };
}

const BASE_KEY = '@flashcards/core/v1';
const SEEDED_BASE = '@flashcards/seeded/v1';
const META_BASE = '@flashcards/sync-meta/v1';

/** Storage key for the dataset; per user when logged in so accounts never mix on one device. */
export function dataKeyFor(userId: string | null): string {
  return userId ? `${BASE_KEY}/u/${userId}` : BASE_KEY;
}

export function seededKeyFor(userId: string | null): string {
  return userId ? `${SEEDED_BASE}/u/${userId}` : SEEDED_BASE;
}

export function metaKeyFor(userId: string): string {
  return `${META_BASE}/u/${userId}`;
}

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';

export function syncStatusLabel(status: SyncStatus, lastSyncedAt: number | null): string {
  switch (status) {
    case 'off':
      return 'Sem sincronização (modo local)';
    case 'syncing':
      return 'Sincronizando...';
    case 'pending':
      return 'Alterações aguardando envio';
    case 'offline':
      return 'Sem conexão. Será sincronizado quando voltar.';
    case 'error':
      return 'Erro ao sincronizar. Tentaremos novamente.';
    case 'synced':
      return lastSyncedAt
        ? `Sincronizado às ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Sincronizado';
  }
}
