import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || '';

// Storage-only admin client (auth is handled by our own session system)
export const supabaseAdmin = supabaseServiceKey && supabaseUrl
	? createClient(supabaseUrl, supabaseServiceKey)
	: null as any; // Storage features unavailable without Supabase credentials
