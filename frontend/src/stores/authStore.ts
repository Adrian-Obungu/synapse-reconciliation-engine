/**
 * Authentication state store for the Synapse Reconciliation Engine.
 * Manages the OTP login flow, session lifecycle, and auth state transitions.
 *
 * Uses Zustand for lightweight, TypeScript-native state management.
 * Integrates with the custom backend OTP service and Supabase session lifecycle.
 */

import { create } from 'zustand';
import { otpService } from '../services/api/otpService';
import { signOutUser, onSessionChange, getCurrentSession } from '../services/supabase/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stages of the OTP authentication flow. */
type OtpStep = 'phone_input' | 'otp_verify' | 'authenticated';

interface AuthState {
  /** Whether the user has an active, valid session. */
  isAuthenticated: boolean;

  /** Whether the initial auth check is in progress. */
  isLoading: boolean;

  /** The authenticated user's ID (from Supabase), or null. */
  userId: string | null;

  /** The phone number used for OTP authentication, or null. */
  phone: string | null;

  // OTP flow state
  /** Current step in the OTP authentication flow. */
  otpStep: OtpStep;

  /** Error message from the last OTP operation, or null. */
  otpError: string | null;

  /** Whether an OTP request or verification is in flight. */
  otpLoading: boolean;

  // Actions
  /** Requests an OTP code to be sent to the specified phone number. */
  requestOTP: (phone: string) => Promise<void>;

  /** Verifies an OTP code and establishes a session. */
  verifyOTP: (phone: string, code: string) => Promise<void>;

  /** Signs out the current user and resets all auth state. */
  logout: () => Promise<void>;

  /** Initializes auth state and subscribes to session change events. */
  initializeAuth: () => () => void;

  /** Resets the OTP flow back to the phone input step. */
  resetOtpFlow: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  phone: null,
  otpStep: 'phone_input',
  otpError: null,
  otpLoading: false,

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  requestOTP: async (phone: string) => {
    set({ otpLoading: true, otpError: null });

    const result = await otpService.requestOTP(phone);

    if (result.ok) {
      set({
        otpStep: 'otp_verify',
        phone,
        otpLoading: false,
        otpError: null,
      });
    } else {
      set({
        otpError: result.error.message,
        otpLoading: false,
      });
    }
  },

  verifyOTP: async (phone: string, code: string) => {
    set({ otpLoading: true, otpError: null });

    const result = await otpService.verifyOTP(phone, code);

    if (result.ok) {
      set({
        isAuthenticated: true,
        userId: result.data.user_id,
        otpStep: 'authenticated',
        otpLoading: false,
        otpError: null,
      });
    } else {
      set({
        otpError: result.error.message,
        otpLoading: false,
      });
    }
  },

  logout: async () => {
    await signOutUser();
    set({
      isAuthenticated: false,
      userId: null,
      phone: null,
      otpStep: 'phone_input',
      otpError: null,
      otpLoading: false,
    });
  },

  initializeAuth: () => {
    // Check for existing session on mount
    getCurrentSession().then((session) => {
      if (session) {
        set({
          isAuthenticated: true,
          userId: session.user.id,
          otpStep: 'authenticated',
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }).catch(() => {
      set({ isLoading: false });
    });

    // Subscribe to auth state changes (TOKEN_REFRESHED, SIGNED_OUT)
    const unsubscribe = onSessionChange((event, session) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session) {
            set({
              isAuthenticated: true,
              userId: session.user.id,
              otpStep: 'authenticated',
            });
          }
          break;

        case 'SIGNED_OUT':
          set({
            isAuthenticated: false,
            userId: null,
            phone: null,
            otpStep: 'phone_input',
            otpError: null,
            otpLoading: false,
          });
          // Redirect to login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login?reason=session_expired';
          }
          break;
      }
    });

    return unsubscribe;
  },

  resetOtpFlow: () => {
    set({
      otpStep: 'phone_input',
      otpError: null,
      otpLoading: false,
    });
  },
}));
