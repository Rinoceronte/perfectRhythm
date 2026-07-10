import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getBlocksForCoach,
	getPublishedBlocksForCoachInRange,
	createAvailabilityBlock
} from '$lib/server/services/schedule';
import { CreateAvailabilityBlockSchema } from '$lib/shared/validation/schedule';

/**
 * GET /api/v1/availability?coachId=&startDate=&endDate=
 * Coach: returns all their own blocks.
 * Student: returns published blocks for a given coachId + date range.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role;

	if (role === 'coach') {
		const blocks = await getBlocksForCoach(user.id);
		return ok(blocks);
	}

	// Students need coachId + date range
	const coachId = url.searchParams.get('coachId');
	const startDate = url.searchParams.get('startDate');
	const endDate = url.searchParams.get('endDate');

	if (!coachId || !startDate || !endDate)
		return err('BAD_REQUEST', 'coachId, startDate, and endDate are required');

	const blocks = await getPublishedBlocksForCoachInRange(coachId, startDate, endDate);
	return ok(blocks);
};

/**
 * POST /api/v1/availability
 * Creates an availability block. Coach only.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const body = await request.json().catch(() => null);
	const parsed = CreateAvailabilityBlockSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const block = await createAvailabilityBlock(user.id, parsed.data);
	return ok(block);
};
