import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { SaveAnnotationsSchema } from '$lib/shared/validation/video';
import { getReviewById, saveAnnotations } from '$lib/server/services/video';
import type { Annotation } from '$lib/shared/types';

/**
 * PATCH /api/v1/videos/:id/reviews/:reviewId
 * Coach saves annotation progress mid-session.
 * Also accepts voiceTrackPath if voice was just uploaded.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role ?? 'student';
	if (role !== 'coach') return err('FORBIDDEN', 'Only coaches can save annotations', 403);

	const { reviewId } = params;
	if (!reviewId) return err('BAD_REQUEST', 'Review ID is required');

	const review = await getReviewById(reviewId);
	if (!review) return err('NOT_FOUND', 'Review not found', 404);
	if (review.coachId !== user.id) return err('FORBIDDEN', 'Access denied', 403);

	const body = await request.json().catch(() => null);
	const parsed = SaveAnnotationsSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	// voiceTrackPath is optional — if provided, save it
	const voiceTrackPath: string | null | undefined =
		typeof body?.voiceTrackPath === 'string' ? body.voiceTrackPath : undefined;

	const updated = await saveAnnotations(
		reviewId,
		parsed.data.annotations as unknown as Annotation[],
		voiceTrackPath
	);
	return ok(updated);
};
