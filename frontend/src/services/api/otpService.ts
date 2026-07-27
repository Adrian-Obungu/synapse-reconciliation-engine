/**
 * OTP authentication service for the Synapse Reconciliation Engine.
 * Wraps the custom FastAPI backend OTP flow, NOT Supabase's built-in phone auth.
 */

import type { ApiResult, OtpVerifyResponse } from '../../lib/types';
import { httpPost } from './http';
import { setSessionFromTokens } from '../supabase/auth';

export const otpService = {
  /**
   * Requests an OTP code to be sent to the specified phone number.
   */
  requestOTP(phone: string): Promise<ApiResult<{ message: string }>> {
    // Phase 3 Fix: Changed payload key from 'phone' to 'phone_number'
    return httpPost<{ message: string }>('/otp/request', { phone_number: phone });
  },

  /**
   * Verifies an OTP code and establishes a Supabase session.
   */
  async verifyOTP(
    phone: string,
    code: string
  ): Promise<ApiResult<OtpVerifyResponse>> {
    // Phase 3 Fix: Changed payload key from 'phone' to 'phone_number'
    const result = await httpPost<OtpVerifyResponse>('/otp/verify', {
      phone_number: phone,
      otp_code: code,
    });

    // On successful verification, attempt to hydrate the Supabase client session.
    // If Supabase host is unreachable/offline in local dev, catch gracefully.
    if (result.ok) {
      try {
        await setSessionFromTokens(
          result.data.access_token,
          result.data.refresh_token
        );
      } catch (err) {
        console.warn('[OTP Service] Local dev notice: Supabase session hydration skipped/failed:', err);
      }
    }

    return result;
  },
};