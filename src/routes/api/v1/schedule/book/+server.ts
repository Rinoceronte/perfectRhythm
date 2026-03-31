import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	bookSlot,
	verifySlotBookable,
	getCoachIdForSlot,
	checkInvisibleBlock
} from '$lib/server/services/schedule';
import { BookSlotSchema } from '$lib/shared/validation/schedule';

/**
 * POST /api/v1/schedule/book
 * Request a lesson slot. Students only.
 * Applies invisible block check — looks like "slot not available" to blocked students.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = BookSlotSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { slotId, coachId, notes } = parsed.data;

	// Invisible block — return same error as "not available" to avoid leaking block status
	const blocked = await checkInvisibleBlock(coachId, user.id);
	if (blocked) return err('UNAVAILABLE', 'Slot not available', 409);

	const bookable = await verifySlotBookable(slotId, user.id);
	if (!bookable.ok) return err('UNAVAILABLE', bookable.reason ?? 'Slot not available', 409);

	// Confirm the slot actually belongs to the stated coachId
	const actualCoachId = await getCoachIdForSlot(slotId);
	if (!actualCoachId || actualCoachId !== coachId)
		return err('BAD_REQUEST', 'Invalid slot or coach mismatch');

	const booking = await bookSlot(slotId, user.id, coachId, notes);
	return ok(booking);
};
