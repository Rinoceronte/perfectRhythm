import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// PUBLIC_-prefixed vars are only exposed via the public env module
const supabaseUrl = env.SUPABASE_URL || publicEnv.PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || '';

// Storage-only admin client (auth is handled by our own session system).
// Typed non-null for convenience; actually null when Supabase credentials
// are missing, in which case storage features are unavailable.
export const supabaseAdmin: SupabaseClient =
	supabaseServiceKey && supabaseUrl
		? createClient(supabaseUrl, supabaseServiceKey)
		: (null as unknown as SupabaseClient);
