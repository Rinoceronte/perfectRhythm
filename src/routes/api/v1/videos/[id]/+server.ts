import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getVideoById,
	getReviewsForVideo,
	deleteVideo,
	isVideoOwner,
	coachCanAccessVideo
} from '$lib/server/services/video';

/**
 * GET /api/v1/videos/:id
 * Returns a video with its reviews.
 * Student can access own video; coach can access if they have an active relationship.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Video ID is required');

	const video = await getVideoById(id);
	if (!video) return err('NOT_FOUND', 'Video not found', 404);

	const role = user.user_metadata?.role ?? 'student';

	if (role === 'student') {
		if (video.studentId !== user.id) return err('FORBIDDEN', 'Access denied', 403);
	} else if (role === 'coach') {
		const canAccess = await coachCanAccessVideo(user.id, id);
		if (!canAccess) return err('FORBIDDEN', 'Access denied', 403);
	}

	// Only return the requesting coach's own reviews; student sees all their reviews
	const allReviews = await getReviewsForVideo(id);
	const reviews = role === 'coach' ? allReviews.filter((r) => r.coachId === user.id) : allReviews;

	return ok({ ...video, reviews });
};

/**
 * DELETE /api/v1/videos/:id
 * Student can delete their own video. Deletes all reviews + storage files.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Video ID is required');

	const owns = await isVideoOwner(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	await deleteVideo(locals.supabase, id);

	return ok({ deleted: true });
};
