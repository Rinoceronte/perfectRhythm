import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getVideosForStudent, getVideosForCoach } from '$lib/server/services/video';

/**
 * GET /api/v1/videos
 * Student sees their own videos. Coach sees videos for all their active students.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';

	if (role === 'coach') {
		const videoList = await getVideosForCoach(user.id);
		return ok(videoList);
	}

	const videoList = await getVideosForStudent(user.id);
	return ok(videoList);
};
