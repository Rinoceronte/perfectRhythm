import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { bookingRequests } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verifyStudentOwnsBooking } from '$lib/server/services/schedule';
import { z } from 'zod';

const UpdateLessonNotesSchema = z.object({
	studentNotesBefore: z.string().max(2000).optional(),
	studentNotesAfter: z.string().max(2000).optional()
});

/**
 * PATCH /api/v1/schedule/bookings/:id/notes
 * Student updates their before/after lesson notes.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const { id } = params;
	if (!id) return err('BAD_REQUEST', 'Booking ID required');

	const owns = await verifyStudentOwnsBooking(user.id, id);
	if (!owns) return err('FORBIDDEN', 'Access denied', 403);

	const body = await request.json();
	const parsed = UpdateLessonNotesSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const updates: Record<string, string | null> = {};
	if (parsed.data.studentNotesBefore !== undefined) {
		updates.studentNotesBefore = parsed.data.studentNotesBefore || null;
	}
	if (parsed.data.studentNotesAfter !== undefined) {
		updates.studentNotesAfter = parsed.data.studentNotesAfter || null;
	}

	const [updated] = await db
		.update(bookingRequests)
		.set(updates)
		.where(eq(bookingRequests.id, id))
		.returning();

	return ok(updated);
};
