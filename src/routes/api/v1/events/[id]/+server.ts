import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getEventById,
	updateEvent,
	deleteEvent,
	verifyCoachOwnsEvent
} from '$lib/server/services/schedule';
import { UpdateEventSchema } from '$lib/shared/validation/schedule';

/**
 * PATCH /api/v1/events/:id
 * Update an event. Coach must own it.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Event ID required');

	const owns = await verifyCoachOwnsEvent(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const body = await request.json().catch(() => null);
	const parsed = UpdateEventSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const updated = await updateEvent(id, parsed.data);
	if (!updated) return err('NOT_FOUND', 'Event not found', 404);

	return ok(updated);
};

/**
 * DELETE /api/v1/events/:id
 * Delete an event. Coach must own it.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Event ID required');

	const owns = await verifyCoachOwnsEvent(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const deleted = await deleteEvent(id);
	if (!deleted) return err('NOT_FOUND', 'Event not found', 404);

	return ok({ deleted: true });
};
