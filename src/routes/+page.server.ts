import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPublicScheduleSummary } from '$lib/server/services/schedule';

export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) redirect(303, '/dashboard');

	const owner = locals.siteSettings.owner;
	if (!owner) {
		return { upcomingEvents: [], availability: [] };
	}

	const { upcomingEvents, availability } = await getPublicScheduleSummary(owner.id);
	return { upcomingEvents, availability };
};
