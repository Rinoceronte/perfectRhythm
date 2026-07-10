import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { removeInvisibleBlock } from '$lib/server/services/schedule';

/**
 * DELETE /api/v1/coach/invisible-blocks/:id
 * Remove an invisible block. Coach must own it.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Block ID required');

	const removed = await removeInvisibleBlock(id, user.id);
	if (!removed) return err('NOT_FOUND', 'Invisible block not found', 404);

	return ok({ deleted: true });
};
