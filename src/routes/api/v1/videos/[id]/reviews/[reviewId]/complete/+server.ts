import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getReviewById, completeReview } from '$lib/server/services/video';

/**
 * POST /api/v1/videos/:id/reviews/:reviewId/complete
 * Coach finalizes the review — triggers composite video generation.
 * Sets status to 'compositing'; the Mux webhook will set it to 'complete'.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';
	if (role !== 'coach') return err('FORBIDDEN', 'Only coaches can complete reviews', 403);

	const { reviewId } = params;
	if (!reviewId) return err('BAD_REQUEST', 'Review ID is required');

	const review = await getReviewById(reviewId);
	if (!review) return err('NOT_FOUND', 'Review not found', 404);
	if (review.coachId !== user.id) return err('FORBIDDEN', 'Access denied', 403);
	if (review.status === 'complete') return err('BAD_REQUEST', 'Review is already complete');

	const updated = await completeReview(reviewId);

	// TODO: Queue compositing job (FFmpeg worker)
	// For now, the status is 'compositing' and the worker will pick it up

	return ok(updated);
};
