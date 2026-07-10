import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteSettings } from '$lib/shared/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			siteSettings: SiteSettings;
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
			branding: SiteSettings;
		}
		// interface Error {}
		// interface Platform {}
	}
}

export {};
