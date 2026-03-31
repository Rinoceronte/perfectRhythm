import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getStudentSkillById,
	updateStudentSkill,
	deleteStudentSkill,
	verifyCoachOwnsRelationship,
	verifyStudentInRelationship
} from '$lib/server/services/skills';
import { UpdateStudentSkillSchema } from '$lib/shared/validation/skills';

async function resolveSkillAccess(
	userId: string,
	skillId: string
): Promise<{
	isCoach: boolean;
	isStudent: boolean;
	skill: Awaited<ReturnType<typeof getStudentSkillById>>;
}> {
	const skill = await getStudentSkillById(skillId);
	if (!skill) return { isCoach: false, isStudent: false, skill: null };

	const [isCoach, isStudent] = await Promise.all([
		verifyCoachOwnsRelationship(userId, skill.coachStudentId),
		verifyStudentInRelationship(userId, skill.coachStudentId)
	]);

	return { isCoach, isStudent, skill };
}

/**
 * PATCH /api/v1/skills/:id
 * Update a student skill. Coach edits lock the skill; student edits are flagged as student source.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = UpdateStudentSkillSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { isCoach, isStudent, skill } = await resolveSkillAccess(user.id, params.id!);
	if (!skill) return err('NOT_FOUND', 'Skill not found', 404);
	if (!isCoach && !isStudent) return err('FORBIDDEN', 'Access denied', 403);

	// Students cannot change coachLocked
	if (!isCoach && parsed.data.coachLocked !== undefined) {
		return err('FORBIDDEN', 'Only coaches can change the lock status', 403);
	}

	const source = isCoach ? 'coach' : 'student';
	const updated = await updateStudentSkill(params.id!, parsed.data, source);
	return ok(updated);
};

/**
 * DELETE /api/v1/skills/:id
 * Only coaches may delete student skills.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const { isCoach, skill } = await resolveSkillAccess(user.id, params.id!);
	if (!skill) return err('NOT_FOUND', 'Skill not found', 404);
	if (!isCoach) return err('FORBIDDEN', 'Only coaches can delete skills', 403);

	await deleteStudentSkill(params.id!);
	return ok({ deleted: true });
};
