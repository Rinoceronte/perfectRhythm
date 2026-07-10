import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getStudentSkills,
	verifyCoachOwnsRelationship,
	verifyStudentInRelationship
} from '$lib/server/services/skills';
import { ReorderSkillsSchema } from '$lib/shared/validation/skills';
import { db } from '$lib/server/db';
import { studentSkills } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/v1/skills/reorder
 * Manually reorder skills by assigning new priorityScore values based on position.
 * Both coaches and students in the relationship may reorder.
 * Priority scores are assigned as: total - index (so first item gets highest score).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = ReorderSkillsSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { coachStudentId, orderedIds } = parsed.data;

	const [isCoach, isStudent] = await Promise.all([
		verifyCoachOwnsRelationship(user.id, coachStudentId),
		verifyStudentInRelationship(user.id, coachStudentId)
	]);
	if (!isCoach && !isStudent) return err('FORBIDDEN', 'Access denied', 403);

	// Verify all IDs belong to this relationship
	const existingSkills = await getStudentSkills(coachStudentId);
	const existingIds = new Set(existingSkills.map((s) => s.id));
	const allValid = orderedIds.every((id) => existingIds.has(id));
	if (!allValid)
		return err('BAD_REQUEST', 'One or more skill IDs do not belong to this relationship');

	// Assign priority scores: first item = highest score
	const total = orderedIds.length;
	await Promise.all(
		orderedIds.map((id, index) =>
			db
				.update(studentSkills)
				.set({ priorityScore: total - index, updatedAt: new Date() })
				.where(and(eq(studentSkills.id, id), eq(studentSkills.coachStudentId, coachStudentId)))
		)
	);

	return ok({ reordered: orderedIds.length });
};
