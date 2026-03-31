import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getVideosForStudent, getVideosForCoach } from '$lib/server/services/video';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) error(401, 'Not authenticated');

	const role = user.user_metadata?.role ?? 'student';

	const videos =
		role === 'coach'
			? await getVideosForCoach(user.id)
			: await getVideosForStudent(user.id);

	return { videos, role, userId: user.id };
};
