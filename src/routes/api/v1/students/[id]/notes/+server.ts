import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { coachStudents, coachNotes } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

/** Resolve the coach_student relationship for this coach + student */
async function getRelationship(coachId: string, studentId: string) {
	const [rel] = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.coachId, coachId), eq(coachStudents.studentId, studentId)))
		.limit(1);
	return rel ?? null;
}

const AddNoteSchema = z.object({
	content: z.string().min(1).max(5000)
});

/**
 * GET /api/v1/students/:id/notes
 * Returns all notes for this student, newest first.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const rel = await getRelationship(user.id, params.id!);
	if (!rel) return err('NOT_FOUND', 'Student not found', 404);

	const notes = await db
		.select()
		.from(coachNotes)
		.where(eq(coachNotes.coachStudentId, rel.id))
		.orderBy(desc(coachNotes.createdAt));

	return ok(notes);
};

/**
 * POST /api/v1/students/:id/notes
 * Add a new note.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const rel = await getRelationship(user.id, params.id!);
	if (!rel) return err('NOT_FOUND', 'Student not found', 404);

	const body = await request.json();
	const parsed = AddNoteSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const [note] = await db
		.insert(coachNotes)
		.values({
			coachStudentId: rel.id,
			content: parsed.data.content
		})
		.returning();

	return ok(note);
};
