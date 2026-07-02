import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { getBookingsForCoach, coachBookSlot } from '$lib/server/services/schedule';
import { CoachBookSlotSchema } from '$lib/shared/validation/schedule';

export const GET: RequestHandler = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Coach access required', 403);
	}

	const bookings = await getBookingsForCoach(user.id);
	return ok(bookings);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Coach access required', 403);
	}

	const body = await request.json();
	const parsed = CoachBookSlotSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	try {
		const result = await coachBookSlot(user.id, parsed.data);
		return ok(result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Unknown error';
		if (msg === 'SLOT_NOT_OWNED') return err('FORBIDDEN', 'You do not own this slot', 403);
		if (msg === 'SLOT_NOT_FOUND') return err('NOT_FOUND', 'Slot not found', 404);
		if (msg === 'SLOT_NOT_AVAILABLE') return err('CONFLICT', 'Slot is no longer available', 409);
		return err('INTERNAL_ERROR', msg, 500);
	}
};
