import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { findOrCreateStudent } from '$lib/server/services/schedule';
import { db } from '$lib/server/db';
import { coachStudents } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const AddStudentSchema = z.object({
	email: z.string().email(),
	displayName: z.string().min(1).max(200).optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') {
		return err('FORBIDDEN', 'Coach access required', 403);
	}

	const body = await request.json();
	const parsed = AddStudentSchema.safeParse(body);
	if (!parsed.success) {
		return err('VALIDATION_ERROR', parsed.error.issues[0].message);
	}

	const student = await findOrCreateStudent(parsed.data.email, parsed.data.displayName);

	// Check if already on this coach's roster
	const existing = await db
		.select({ id: coachStudents.id })
		.from(coachStudents)
		.where(and(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, student.id)))
		.limit(1);

	if (existing.length > 0) {
		return err('DUPLICATE', 'Already added', 409);
	}

	await db.insert(coachStudents).values({
		coachId: user.id,
		studentId: student.id
	});

	return ok({
		studentId: student.id,
		displayName: student.displayName,
		avatarUrl: student.avatarUrl,
		studentCreated: student.created
	});
};
