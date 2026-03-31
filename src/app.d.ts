import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{
				session: { token: string; expiresAt: Date } | null;
				user: {
					id: string;
					email: string;
					user_metadata: { display_name: string; role: string };
				} | null;
			}>;
		}
		interface PageData {
			session: { token: string; expiresAt: Date } | null;
		}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
