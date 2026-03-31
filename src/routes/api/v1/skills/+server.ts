import type { RequestHandler } from '@sveltejs/kit';
import { ok, err } from '$lib/server/utils/api-response';
import {
	getStudentSkills,
	assignStudentSkill,
	verifyCoachOwnsRelationship,
	verifyStudentInRelationship
} from '$lib/server/services/skills';
import { AssignStudentSkillSchema } from '$lib/shared/validation/skills';

/**
 * GET /api/v1/skills?coachStudentId=
 * Returns student skills for a coach-student relationship.
 * Coach or student in the relationship may call this.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const coachStudentId = url.searchParams.get('coachStudentId');
	if (!coachStudentId) return err('BAD_REQUEST', 'coachStudentId is required');

	// Verify the caller is either the coach or student in this relationship
	const [isCoach, isStudent] = await Promise.all([
		verifyCoachOwnsRelationship(user.id, coachStudentId),
		verifyStudentInRelationship(user.id, coachStudentId)
	]);
	if (!isCoach && !isStudent) return err('FORBIDDEN', 'Access denied', 403);

	const skillList = await getStudentSkills(coachStudentId);
	return ok(skillList);
};

/**
 * POST /api/v1/skills
 * Assigns a skill definition to a student. Coach or student may create; source is set by role.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) return err('UNAUTHORIZED', 'Not authenticated', 401);

	const body = await request.json().catch(() => null);
	const parsed = AssignStudentSkillSchema.safeParse(body);
	if (!parsed.success) return err('VALIDATION_ERROR', parsed.error.message);

	const { coachStudentId } = parsed.data;

	const [isCoach, isStudent] = await Promise.all([
		verifyCoachOwnsRelationship(user.id, coachStudentId),
		verifyStudentInRelationship(user.id, coachStudentId)
	]);
	if (!isCoach && !isStudent) return err('FORBIDDEN', 'Access denied', 403);

	const source = isCoach ? 'coach' : 'student';
	const skill = await assignStudentSkill(parsed.data, source);
	return ok(skill);
};
