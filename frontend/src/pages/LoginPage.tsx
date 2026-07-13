/**
 * OTP Login Page for the Synapse Reconciliation Engine.
 *
 * Multi-step authentication terminal:
 * Step 1 (phone_input): Phone number input with live formatKenyanPhone() preview
 * Step 2 (otp_verify): 6-digit auto-advancing OTP code boxes with 60s resend cooldown
 *
 * Consumes authStore for state management.
 * Redirects to /dashboard on successful authentication.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { formatKenyanPhone } from '../lib/format';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LoginPage() {
  const navigate = useNavigate();

  // Auth store state
  const otpStep = useAuthStore((s) => s.otpStep);
  const otpError = useAuthStore((s) => s.otpError);
  const otpLoading = useAuthStore((s) => s.otpLoading);
  const requestOTP = useAuthStore((s) => s.requestOTP);
  const verifyOTP = useAuthStore((s) => s.verifyOTP);
  const resetOtpFlow = useAuthStore((s) => s.resetOtpFlow);

  // Redirect on successful authentication
  useEffect(() => {
    if (otpStep === 'authenticated') {
      navigate('/dashboard', { replace: true });
    }
  }, [otpStep, navigate]);

  return (
    <div className="min-h-screen bg-midnight-950 flex items-center justify-center p-4">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-800/5 via-transparent to-midnight-950 pointer-events-none" />

      {/* Login card */}
      <div className="relative w-full max-w-md">
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Brand header */}
          <div className="px-8 pt-8 pb-4 text-center">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-50 tracking-tight">
                Synapse
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Reconciliation Engine
            </p>
          </div>

          {/* Step content */}
          <div className="px-8 pb-8">
            {otpStep === 'phone_input' && (
              <PhoneStep
                onSubmit={requestOTP}
                isLoading={otpLoading}
                error={otpError}
              />
            )}
            {otpStep === 'otp_verify' && (
              <OtpStep
                onVerify={verifyOTP}
                onResend={requestOTP}
                onBack={resetOtpFlow}
                isLoading={otpLoading}
                error={otpError}
              />
            )}
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Secured by Supabase GoTrue + FastAPI OTP
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Phone Input
// ---------------------------------------------------------------------------

function PhoneStep({
  onSubmit,
  isLoading,
  error,
}: {
  onSubmit: (phone: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}) {
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear local error on typing
  const handleChange = (value: string) => {
    setPhone(value);
    setLocalError(null);
  };

  // Live format preview
  const formatted = phone.trim() ? formatKenyanPhone(phone.trim()) : '';
  const isValidFormat = formatted !== phone.trim() && formatted.startsWith('+254');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleaned = phone.trim();
    if (!cleaned) {
      setLocalError('Please enter your phone number');
      return;
    }

    const normalizedPreview = formatKenyanPhone(cleaned);
    if (normalizedPreview === cleaned || !normalizedPreview.startsWith('+254')) {
      setLocalError('Enter a valid Kenyan phone number (07XX or 01XX)');
      return;
    }

    await onSubmit(cleaned);
  };

  const displayError = localError || error;

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-slate-50 mb-1 text-center">
        Sign in
      </h2>
      <p className="text-sm text-slate-400 mb-6 text-center">
        Enter your phone number to receive a verification code
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone input */}
        <div>
          <label htmlFor="phone-input" className="block text-xs font-medium text-slate-400 mb-1.5">
            Phone Number
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">
              +254
            </span>
            <input
              ref={inputRef}
              id="phone-input"
              type="tel"
              value={phone}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="712 345 678"
              className="w-full pl-14 pr-4 py-3 bg-midnight-950 border border-slate-700 rounded-lg text-sm text-slate-50 placeholder:text-slate-600 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="tel"
              disabled={isLoading}
            />
          </div>

          {/* Live format preview */}
          {phone.trim() && (
            <p className={`mt-1.5 text-xs ${isValidFormat ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isValidFormat ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1 -mt-0.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {formatted}
                </>
              ) : (
                'Invalid format'
              )}
            </p>
          )}
        </div>

        {/* Error banner */}
        {displayError && (
          <div className="px-3 py-2.5 bg-coral-500/10 border border-coral-500/30 rounded-lg animate-fade-in">
            <p className="text-xs text-coral-500 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {displayError}
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !phone.trim()}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending code...
            </>
          ) : (
            'Send Verification Code'
          )}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: OTP Verification
// ---------------------------------------------------------------------------

function OtpStep({
  onVerify,
  onResend,
  onBack,
  isLoading,
  error,
}: {
  onVerify: (phone: string, code: string) => Promise<void>;
  onResend: (phone: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const phone = useAuthStore((s) => s.phone) ?? '';
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first digit on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-submit when all 6 digits are entered
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Only allow single digits
      const digit = value.replace(/\D/g, '').slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;

        // Auto-submit when complete
        if (digit && index === OTP_LENGTH - 1 && next.every((d) => d !== '')) {
          const code = next.join('');
          onVerify(phone, code);
        }

        return next;
      });

      // Auto-advance to next input
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [phone, onVerify]
  );

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: clear current and move to previous
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
      } else {
        setDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      }
      e.preventDefault();
    }

    // Arrow keys
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Paste support: distribute pasted digits across all boxes
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const newDigits = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);

    // Focus appropriate input
    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if complete
    if (pasted.length === OTP_LENGTH) {
      onVerify(phone, pasted);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length === OTP_LENGTH) {
      onVerify(phone, code);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    await onResend(phone);
    inputRefs.current[0]?.focus();
  };

  const formattedPhone = formatKenyanPhone(phone);

  return (
    <div className="animate-slide-left">
      <h2 className="text-xl font-semibold text-slate-50 mb-1 text-center">
        Verify your number
      </h2>
      <p className="text-sm text-slate-400 mb-6 text-center">
        Enter the 6-digit code sent to{' '}
        <span className="text-emerald-400 font-medium">{formattedPhone}</span>
      </p>

      <form onSubmit={handleManualSubmit} className="space-y-5">
        {/* OTP digit boxes */}
        <div className="flex items-center justify-center gap-2.5" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="otp-digit"
              disabled={isLoading}
              autoComplete="one-time-code"
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-3 py-2.5 bg-coral-500/10 border border-coral-500/30 rounded-lg animate-fade-in">
            <p className="text-xs text-coral-500 flex items-start gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </p>
          </div>
        )}

        {/* Verify button */}
        <button
          type="submit"
          disabled={isLoading || digits.some((d) => !d)}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify Code'
          )}
        </button>

        {/* Resend & Back links */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onBack}
            className="text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to phone number
          </button>

          {cooldown > 0 ? (
            <span className="text-slate-600 tabular-nums">
              Resend in 0:{String(cooldown).padStart(2, '0')}
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Resend code
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
