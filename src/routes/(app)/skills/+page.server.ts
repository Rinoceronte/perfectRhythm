import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getStudentSkills,
	getCategories,
	getDefinitions,
	verifyCoachOwnsRelationship,
	verifyStudentInRelationship
} from '$lib/server/services/skills';
import { db } from '$lib/server/db';
import { coachStudents } from '$lib/server/db/schema';
import { eq, or } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) error(401, 'Not authenticated');

	const coachStudentId = url.searchParams.get('coachStudentId');

	// If no coachStudentId given, load the first relationship the user is in
	let resolvedCoachStudentId = coachStudentId;

	if (!resolvedCoachStudentId) {
		const rel = await db
			.select({ id: coachStudents.id })
			.from(coachStudents)
			.where(
				or(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, user.id))
			)
			.limit(1);

		if (rel.length === 0) {
			return {
				skills: [],
				categories: [],
				definitions: [],
				coachStudentId: null,
				isCoach: false,
				hasRelationship: false
			};
		}

		resolvedCoachStudentId = rel[0].id;
	}

	// Auth check: caller must be in this relationship
	const [isCoach, isStudent] = await Promise.all([
		verifyCoachOwnsRelationship(user.id, resolvedCoachStudentId),
		verifyStudentInRelationship(user.id, resolvedCoachStudentId)
	]);

	if (!isCoach && !isStudent) error(403, 'Access denied');

	const [skills, categories, definitions] = await Promise.all([
		getStudentSkills(resolvedCoachStudentId),
		getCategories(),
		getDefinitions()
	]);

	return {
		skills,
		categories,
		definitions,
		coachStudentId: resolvedCoachStudentId,
		isCoach,
		hasRelationship: true
	};
};
