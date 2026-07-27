/**
 * Authentication wrapper providing clean async boundaries
 * around the Supabase GoTrue session lifecycle.
 * 
 * Auth flow:
 * 1. User enters phone → frontend calls POST /api/v1/otp/request
 * 2. User receives SMS → enters OTP → frontend calls POST /api/v1/otp/verify
 * 3. Backend verifies OTP → Supabase Admin SDK generates session tokens
 * 4. Backend returns tokens → frontend calls setSessionFromTokens()
 * 5. Supabase client is hydrated → JWT available for all API calls
 */

import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from './client';

/**
 * Retrieves the current active session, if any.
 * Returns null if no session exists or if the session has expired
 * and could not be automatically refreshed.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Extracts the JWT access token from the current session.
 * Returns null if no active session exists.
 * This token is used as the Bearer token in all API requests.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.access_token ?? null;
}

/**
 * Hydrates the Supabase client with session tokens received from
 * the backend OTP verification endpoint.
 * Called after successful OTP verification to establish the session.
 * 
 * @param accessToken - JWT access token from backend
 * @param refreshToken - Refresh token from backend
 * @throws Error if session hydration fails
 */
export async function setSessionFromTokens(
  accessToken: string,
  refreshToken: string
): Promise<Session> {
  const { data: { session }, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !session) {
    throw new Error(
      `[Synapse] Failed to hydrate session: ${error?.message ?? 'No session returned'}`
    );
  }

  return session;
}

/**
 * Attempts a silent token refresh using the current refresh token.
 * Used by the HTTP transport to recover from 401 errors before
 * redirecting to the login page.
 * 
 * @returns true if refresh succeeded, false otherwise
 */
export async function refreshSession(): Promise<boolean> {
  const { data: { session }, error } = await supabase.auth.refreshSession();
  return !error && session !== null;
}

/**
 * Signs out the current user and clears all session state.
 */
export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut();
}

/** Callback signature for session change events. */
export type SessionChangeCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;

/**
 * Subscribes to Supabase auth state changes.
 * Monitors TOKEN_REFRESHED, SIGNED_OUT, and SIGNED_IN events.
 * 
 * @param callback - Handler invoked on each auth state transition
 * @returns Unsubscribe function to clean up the listener
 */
export function onSessionChange(
  callback: SessionChangeCallback
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
