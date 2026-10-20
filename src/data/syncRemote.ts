import { supabase } from '@/auth/supabase';
import type { RepositorySnapshot } from '@/core';
import type { RemoteStore } from './syncEngine';

/** RemoteStore backed by public.user_snapshots (RLS: one row per user). */
export function supabaseRemote(userId: string): RemoteStore {
  return {
    async fetch() {
      const { data, error } = await supabase
        .from('user_snapshots')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { data: data.data, updated_at: data.updated_at } : null;
    },
    async upsert(snapshot: RepositorySnapshot, updatedAtIso: string) {
      const { error } = await supabase
        .from('user_snapshots')
        .upsert({ user_id: userId, data: snapshot, updated_at: updatedAtIso }, { onConflict: 'user_id' });
      if (error) throw new Error(error.message);
    },
  };
}
