import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getEventsForCoach, createEvent, searchEvents } from '$lib/server/services/schedule';
import { CreateEventSchema } from '$lib/shared/validation/schedule';

/**
 * GET /api/v1/events
 * Lists events for the authenticated coach.
 * ?search=query — searches all events across the platform (for event picker autocomplete)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const search = url.searchParams.get('search');
	if (search !== null) {
		const results = await searchEvents(search);
		return ok(results);
	}

	const list = await getEventsForCoach(user.id);
	return ok(list);
};

/**
 * POST /api/v1/events
 * Creates or links to an existing event. Coach only.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const body = await request.json().catch(() => null);
	const parsed = CreateEventSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	try {
		const event = await createEvent(user.id, parsed.data);
		return ok(event);
	} catch (e) {
		if (e instanceof Error && e.message === 'DUPLICATE_EVENT') {
			return err('DUPLICATE_EVENT', 'You are already linked to this event', 409);
		}
		throw e;
	}
};
