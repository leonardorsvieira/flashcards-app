import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authErrorMessage } from './messages';
import { supabase } from './supabase';

const GUEST_KEY = '@flashcards/guest/v1';

/** loading: restoring session; signedIn: has account; guest: local-only; signedOut: must choose. */
export type AuthStatus = 'loading' | 'signedIn' | 'guest' | 'signedOut';

export interface AuthResult {
  error: string | null;
  /** True when sign-up succeeded but the e-mail must be confirmed before signing in. */
  needsConfirmation?: boolean;
}

interface Auth {
  status: AuthStatus;
  user: User | null;
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  continueAsGuest(): Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data }, g] = await Promise.all([supabase.auth.getSession(), AsyncStorage.getItem(GUEST_KEY)]);
        if (!alive) return;
        setSession(data.session);
        setGuest(g === '1');
      } catch (e) {
        console.warn('Restoring session failed', e);
      } finally {
        if (alive) setReady(true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) setSession(next);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp: Auth['signUp'] = useCallback(async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return { error: authErrorMessage(error) };
      return { error: null, needsConfirmation: !data.session };
    } catch (e) {
      return { error: authErrorMessage(e as Error) };
    }
  }, []);

  const signIn: Auth['signIn'] = useCallback(async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? authErrorMessage(error) : null };
    } catch (e) {
      return { error: authErrorMessage(e as Error) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out failed', e);
      // Offline: drop the local session anyway.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    setSession(null);
    // After logging out, ask again instead of silently entering guest mode.
    setGuest(false);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
  }, []);

  const continueAsGuest = useCallback(async () => {
    setGuest(true);
    await AsyncStorage.setItem(GUEST_KEY, '1').catch(() => undefined);
  }, []);

  const value = useMemo<Auth>(() => {
    const user = session?.user ?? null;
    const status: AuthStatus = !ready ? 'loading' : user ? 'signedIn' : guest ? 'guest' : 'signedOut';
    return { status, user, signUp, signIn, signOut, continueAsGuest };
  }, [session, ready, guest, signUp, signIn, signOut, continueAsGuest]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error('AuthProvider missing');
  return a;
}
