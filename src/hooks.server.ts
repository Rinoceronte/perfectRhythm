import { validateSession } from '$lib/server/services/auth';
import { getSiteSettings } from '$lib/server/services/site-settings';
import { supabaseAdmin } from '$lib/server/supabase';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Provide Supabase client for Storage (video/voice uploads)
	event.locals.supabase = supabaseAdmin;

	// White-label branding for this deployment (cached in-process)
	event.locals.siteSettings = await getSiteSettings();

	const token = event.cookies.get('session');

	event.locals.safeGetSession = async () => {
		if (!token) return { session: null, user: null };
		const result = await validateSession(token);
		if (!result) return { session: null, user: null };
		return { session: result.session, user: result.user };
	};

	return resolve(event);
};
