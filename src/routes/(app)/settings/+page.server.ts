import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, '/login');
	if (user.user_metadata?.role !== 'coach') redirect(303, '/dashboard');

	// Branding itself comes from the root layout (data.branding)
	return {};
};
