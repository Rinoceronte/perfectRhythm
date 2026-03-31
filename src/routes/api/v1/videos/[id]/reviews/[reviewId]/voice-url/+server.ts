import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getReviewById, getVoiceTrackUploadUrl } from '$lib/server/services/video';

/**
 * POST /api/v1/videos/:id/reviews/:reviewId/voice-url
 * Returns a signed URL for the coach to upload their voice track directly to Supabase Storage.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';
	if (role !== 'coach') return err('FORBIDDEN', 'Only coaches can upload voice tracks', 403);

	const { reviewId } = params;
	if (!reviewId) return err('BAD_REQUEST', 'Review ID is required');

	const review = await getReviewById(reviewId);
	if (!review) return err('NOT_FOUND', 'Review not found', 404);
	if (review.coachId !== user.id) return err('FORBIDDEN', 'Access denied', 403);

	const { data, error, path } = await getVoiceTrackUploadUrl(locals.supabase, user.id, reviewId);
	if (error || !data) return err('STORAGE_ERROR', 'Could not create voice upload URL');

	return ok({ uploadUrl: data.signedUrl, storagePath: path });
};
