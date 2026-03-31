import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getVideoById,
	getReviewsForVideo,
	createReview,
	coachCanAccessVideo
} from '$lib/server/services/video';

/**
 * GET /api/v1/videos/:id/reviews
 * Coach sees their own reviews only. Student sees all reviews on their video.
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
		const reviews = await getReviewsForVideo(id);
		return ok(reviews);
	}

	// Coach: verify access
	const canAccess = await coachCanAccessVideo(user.id, id);
	if (!canAccess) return err('FORBIDDEN', 'Access denied', 403);

	const allReviews = await getReviewsForVideo(id);
	return ok(allReviews.filter((r) => r.coachId === user.id));
};

/**
 * POST /api/v1/videos/:id/reviews
 * Coach creates a new review session for a video.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';
	if (role !== 'coach') return err('FORBIDDEN', 'Only coaches can create reviews', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Video ID is required');

	const canAccess = await coachCanAccessVideo(user.id, id);
	if (!canAccess) return err('FORBIDDEN', 'Access denied', 403);

	const review = await createReview(id, user.id);
	return ok(review);
};
