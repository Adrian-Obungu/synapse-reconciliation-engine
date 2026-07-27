/**
 * Supabase client singleton for the Synapse Reconciliation Engine.
 * Initialized once at module load using validated environment variables.
 */

import { createClient } from '@supabase/supabase-js';
import { ENV } from '../../lib/env';

/**
 * Singleton Supabase client instance.
 * Used for authentication session management throughout the application.
 */
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
