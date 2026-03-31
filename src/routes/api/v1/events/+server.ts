import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getEventsForCoach, createEvent } from '$lib/server/services/schedule';
import { CreateEventSchema } from '$lib/shared/validation/schedule';

/**
 * GET /api/v1/events
 * Lists events for the authenticated coach.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const list = await getEventsForCoach(user.id);
	return ok(list);
};

/**
 * POST /api/v1/events
 * Creates a new event. Coach only.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const body = await request.json().catch(() => null);
	const parsed = CreateEventSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const event = await createEvent(user.id, parsed.data);
	return ok(event);
};
