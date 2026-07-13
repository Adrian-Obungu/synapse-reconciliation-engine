/**
 * OTP authentication service for the Synapse Reconciliation Engine.
 * Wraps the custom FastAPI backend OTP flow, NOT Supabase's built-in phone auth.
 * 
 * Flow:
 * 1. requestOTP(phone) → POST /otp/request → SMS sent to user
 * 2. verifyOTP(phone, code) → POST /otp/verify → Supabase session tokens returned
 * 3. On successful verification, automatically hydrates the Supabase client session
 */

import type { ApiResult, OtpVerifyResponse } from '../../lib/types';
import { httpPost } from './http';
import { setSessionFromTokens } from '../supabase/auth';

export const otpService = {
  /**
   * Requests an OTP code to be sent to the specified phone number.
   * The backend generates and sends the OTP via SMS.
   * 
   * @param phone - Kenyan phone number (any format accepted by formatKenyanPhone)
   * @returns Success message or error
   */
  requestOTP(phone: string): Promise<ApiResult<{ message: string }>> {
    return httpPost<{ message: string }>('/otp/request', { phone });
  },

  /**
   * Verifies an OTP code and establishes a Supabase session.
   * On success, automatically hydrates the Supabase client with the
   * session tokens returned by the backend.
   * 
   * @param phone - The phone number the OTP was sent to
   * @param code - The OTP code entered by the user
   * @returns OTP verification response with session tokens, or error
   */
  async verifyOTP(
    phone: string,
    code: string
  ): Promise<ApiResult<OtpVerifyResponse>> {
    const result = await httpPost<OtpVerifyResponse>('/otp/verify', {
      phone,
      otp_code: code,
    });

    // On successful verification, hydrate the Supabase client session
    if (result.ok) {
      await setSessionFromTokens(
        result.data.access_token,
        result.data.refresh_token
      );
    }

    return result;
  },
};
