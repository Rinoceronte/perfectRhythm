import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import { db } from '$lib/server/db';
import { users, coachStudents } from '$lib/server/db/schema';
import { eq, ilike, and } from 'drizzle-orm';

/**
 * GET /api/v1/coach/students?q=search
 * Search coach's students by display name.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	if (user.user_metadata?.role !== 'coach') return err('FORBIDDEN', 'Coach access required', 403);

	const q = url.searchParams.get('q')?.trim() ?? '';

	const results = await db
		.select({
			studentId: coachStudents.studentId,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl
		})
		.from(coachStudents)
		.innerJoin(users, eq(coachStudents.studentId, users.id))
		.where(
			q
				? and(eq(coachStudents.coachId, user.id), ilike(users.displayName, `%${q}%`))
				: eq(coachStudents.coachId, user.id)
		)
		.orderBy(users.displayName)
		.limit(20);

	return ok(results);
};
