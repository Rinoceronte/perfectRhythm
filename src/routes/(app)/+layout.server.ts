import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session) redirect(303, '/login');
	return {
		session,
		displayName: (user?.user_metadata?.display_name as string) ?? 'User',
		role: (user?.user_metadata?.role as string) ?? 'student'
	};
};
