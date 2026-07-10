import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getSlotsForStudent,
	getSlotsForBlock,
	verifyCoachOwnsBlock
} from '$lib/server/services/schedule';

/**
 * GET /api/v1/schedule/slots?coachId=&scheduleDate=   (student view)
 * GET /api/v1/schedule/slots?blockId=                 (coach view — own block)
 *
 * Student view applies the invisible block filter silently.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const role = user.user_metadata?.role;

	const blockId = url.searchParams.get('blockId');

	if (blockId) {
		// Coach fetching their own block's slots
		if (role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

		const owns = await verifyCoachOwnsBlock(user.id, blockId);
		if (!owns) return err('FORBIDDEN', 'Access denied', 403);

		const slots = await getSlotsForBlock(blockId);
		return ok(slots);
	}

	// Student fetching available slots for a coach on a date
	const coachId = url.searchParams.get('coachId');
	const scheduleDate = url.searchParams.get('scheduleDate');

	if (!coachId || !scheduleDate) return err('BAD_REQUEST', 'coachId and scheduleDate are required');

	const slots = await getSlotsForStudent(coachId, user.id, scheduleDate);
	return ok(slots);
};
