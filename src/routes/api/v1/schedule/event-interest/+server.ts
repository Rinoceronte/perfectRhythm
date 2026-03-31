import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	registerEventInterest,
	checkEventInterest,
	cancelEventInterest
} from '$lib/server/services/schedule';
import { RegisterEventInterestSchema } from '$lib/shared/validation/schedule';

/**
 * GET /api/v1/schedule/event-interest?eventId=&coachId=
 * Check if the current student has expressed interest.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const eventId = url.searchParams.get('eventId');
	const coachId = url.searchParams.get('coachId');
	if (!eventId || !coachId) return err('BAD_REQUEST', 'eventId and coachId required');

	const interested = await checkEventInterest(eventId, coachId, user.id);
	return ok({ interested });
};

/**
 * POST /api/v1/schedule/event-interest
 * Register a student's interest in a coach at an event (waiting list).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = RegisterEventInterestSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const interest = await registerEventInterest(parsed.data.eventId, parsed.data.coachId, user.id);
	return ok(interest);
};

/**
 * DELETE /api/v1/schedule/event-interest?eventId=&coachId=
 * Cancel a student's interest in a coach at an event.
 */
export const DELETE: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const eventId = url.searchParams.get('eventId');
	const coachId = url.searchParams.get('coachId');
	if (!eventId || !coachId) return err('BAD_REQUEST', 'eventId and coachId required');

	const deleted = await cancelEventInterest(eventId, coachId, user.id);
	return ok({ deleted });
};
