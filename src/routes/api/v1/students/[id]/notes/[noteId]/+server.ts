import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { coachStudents, coachNotes } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const UpdateNoteSchema = z.object({
	content: z.string().min(1).max(5000)
});

/**
 * PATCH /api/v1/students/:id/notes/:noteId
 * Update a note's content.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const [rel] = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, params.id!)))
		.limit(1);

	if (!rel) return err('NOT_FOUND', 'Student not found', 404);

	const body = await request.json();
	const parsed = UpdateNoteSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const [updated] = await db
		.update(coachNotes)
		.set({ content: parsed.data.content })
		.where(and(eq(coachNotes.id, params.noteId!), eq(coachNotes.coachStudentId, rel.id)))
		.returning();

	if (!updated) return err('NOT_FOUND', 'Note not found', 404);

	return ok(updated);
};
