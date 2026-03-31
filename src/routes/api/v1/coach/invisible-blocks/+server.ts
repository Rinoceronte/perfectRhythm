import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getInvisibleBlocksForCoach,
	createInvisibleBlock
} from '$lib/server/services/schedule';
import { CreateInvisibleBlockSchema } from '$lib/shared/validation/schedule';

/**
 * GET /api/v1/coach/invisible-blocks
 * List all invisible blocks for the authenticated coach.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const blocks = await getInvisibleBlocksForCoach(user.id);
	return ok(blocks);
};

/**
 * POST /api/v1/coach/invisible-blocks
 * Create an invisible block for a student. Coach only.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const body = await request.json().catch(() => null);
	const parsed = CreateInvisibleBlockSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const block = await createInvisibleBlock(user.id, parsed.data.studentId);
	return ok(block);
};
