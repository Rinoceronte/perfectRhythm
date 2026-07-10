import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	updateAvailabilityBlock,
	deleteAvailabilityBlock,
	verifyCoachOwnsBlock
} from '$lib/server/services/schedule';
import { UpdateAvailabilityBlockSchema } from '$lib/shared/validation/schedule';

/**
 * PATCH /api/v1/availability/:id
 * Update an availability block. Coach must own it. Cannot update published blocks.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Block ID required');

	const owns = await verifyCoachOwnsBlock(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const body = await request.json().catch(() => null);
	const parsed = UpdateAvailabilityBlockSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const updated = await updateAvailabilityBlock(id, parsed.data);
	if (!updated) return err('NOT_FOUND', 'Block not found', 404);

	return ok(updated);
};

/**
 * DELETE /api/v1/availability/:id
 * Delete a block and all its slots. Coach must own it.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Block ID required');

	const owns = await verifyCoachOwnsBlock(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const deleted = await deleteAvailabilityBlock(id);
	if (!deleted) return err('NOT_FOUND', 'Block not found', 404);

	return ok({ deleted: true });
};
