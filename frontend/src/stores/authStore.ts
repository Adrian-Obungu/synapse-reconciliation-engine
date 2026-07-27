import { create } from 'zustand';
import { otpService } from '../services/api/otpService';
import { signOutUser, onSessionChange, getCurrentSession } from '../services/supabase/auth';

type OtpStep = 'phone_input' | 'otp_verify' | 'authenticated';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  phone: string | null;
  otpStep: OtpStep;
  otpError: string | null;
  otpLoading: boolean;
  requestOTP: (phone: string) => Promise<void>;
  verifyOTP: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => () => void;
  resetOtpFlow: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  phone: null,
  otpStep: 'phone_input',
  otpError: null,
  otpLoading: false,

  requestOTP: async (phone: string) => {
    set({ otpLoading: true, otpError: null });
    try {
      const result = await otpService.requestOTP(phone);
      if (result.ok) {
        set({ otpStep: 'otp_verify', phone, otpLoading: false, otpError: null });
      } else {
        set({ otpError: result.error.message, otpLoading: false });
      }
    } catch (err: any) {
      set({ otpError: err.message || 'Failed to request OTP', otpLoading: false });
    }
  },

  verifyOTP: async (phone: string, code: string) => {
    set({ otpLoading: true, otpError: null });
    try {
      const result = await otpService.verifyOTP(phone, code);
      if (result.ok) {
        set({
          isAuthenticated: true,
          userId: result.data?.user_id || 'temp_user_id',
          otpStep: 'authenticated',
          otpLoading: false,
          otpError: null,
        });
      } else {
        set({
          otpError: result.error?.message || 'Verification failed',
          otpLoading: false,
        });
      }
    } catch (err: any) {
      set({
        otpError: err.message || 'Session hydration failed',
        otpLoading: false,
      });
    }
  },

  logout: async () => {
    await signOutUser();
    set({ isAuthenticated: false, userId: null, phone: null, otpStep: 'phone_input', otpError: null, otpLoading: false });
  },

  initializeAuth: () => {
    getCurrentSession().then((session) => {
      if (session) {
        set({ isAuthenticated: true, userId: session.user.id, otpStep: 'authenticated', isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }).catch(() => set({ isLoading: false }));

    return onSessionChange((event, session) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session) set({ isAuthenticated: true, userId: session.user.id, otpStep: 'authenticated' });
          break;
        case 'SIGNED_OUT':
          set({ isAuthenticated: false, userId: null, phone: null, otpStep: 'phone_input', otpError: null, otpLoading: false });
          if (window.location.pathname !== '/login') window.location.href = '/login?reason=session_expired';
          break;
      }
    });
  },

  resetOtpFlow: () => set({ otpStep: 'phone_input', otpError: null, otpLoading: false }),
}));