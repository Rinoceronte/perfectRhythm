import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { publishBlock, verifyCoachOwnsBlock } from '$lib/server/services/schedule';

/**
 * POST /api/v1/availability/:id/publish
 * Publish a block and generate lesson slots. Coach must own it.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Block ID required');

	const owns = await verifyCoachOwnsBlock(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const result = await publishBlock(id);
	if (!result) return err('NOT_FOUND', 'Block not found', 404);

	return ok(result);
};
