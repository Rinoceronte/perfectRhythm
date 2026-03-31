import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	respondToBooking,
	cancelBooking,
	verifyCoachOwnsBooking,
	verifyStudentOwnsBooking
} from '$lib/server/services/schedule';
import { RespondToBookingSchema } from '$lib/shared/validation/schedule';

/**
 * PATCH /api/v1/schedule/bookings/:id
 * Confirm or decline a booking. Coach only.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach')
		return err('FORBIDDEN', 'Coach access required', 403);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Booking ID required');

	const owns = await verifyCoachOwnsBooking(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const body = await request.json().catch(() => null);
	const parsed = RespondToBookingSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const booking = await respondToBooking(id, parsed.data.status);
	if (!booking) return err('NOT_FOUND', 'Booking not found', 404);

	return ok(booking);
};

/**
 * DELETE /api/v1/schedule/bookings/:id
 * Cancel a booking. Coach or the student who made it.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Booking ID required');

	const role = user.user_metadata?.role;

	const [isCoach, isStudent] = await Promise.all([
		role === 'coach' ? verifyCoachOwnsBooking(user.id, id) : Promise.resolve(false),
		verifyStudentOwnsBooking(user.id, id)
	]);

	if (!isCoach && !isStudent) return err('FORBIDDEN', 'Access denied', 403);

	const booking = await cancelBooking(id);
	if (!booking) return err('NOT_FOUND', 'Booking not found', 404);

	return ok(booking);
};
