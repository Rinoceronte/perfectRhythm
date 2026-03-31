import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { coachStudents } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/v1/students/:id/notes
 * Returns the coach's private notes for this student.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const [rel] = await db
		.select({ notes: coachStudents.notes })
		.from(coachStudents)
		.where(and(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, params.id)))
		.limit(1);

	if (!rel) return err('NOT_FOUND', 'Student not found', 404);

	return ok({ notes: rel.notes });
};
