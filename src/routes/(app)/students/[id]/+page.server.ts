import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, coachStudents, coachNotes } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { getStudentSkills, getCategories, getDefinitions } from '$lib/server/services/skills';

export const load: PageServerLoad = async ({ params, locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/login');

	const role = (user.user_metadata?.role as 'student' | 'coach') ?? 'student';
	if (role !== 'coach') redirect(303, '/');

	// Get the coach-student relationship
	const relationship = await db
		.select({
			coachStudentId: coachStudents.id,
			status: coachStudents.status,
			createdAt: coachStudents.createdAt,
			studentId: users.id,
			displayName: users.displayName,
			email: users.email,
			avatarUrl: users.avatarUrl,
			bio: users.bio,
			leaderLevel: users.leaderLevel,
			followerLevel: users.followerLevel,
			yearsDancing: users.yearsDancing
		})
		.from(coachStudents)
		.innerJoin(users, eq(coachStudents.studentId, users.id))
		.where(and(eq(coachStudents.coachId, user.id), eq(coachStudents.studentId, params.id)))
		.limit(1);

	if (relationship.length === 0) error(404, 'Student not found');

	const student = relationship[0];

	const [skills, skillCategories, skillDefinitions, notes] = await Promise.all([
		getStudentSkills(student.coachStudentId),
		getCategories(),
		getDefinitions(),
		db
			.select()
			.from(coachNotes)
			.where(eq(coachNotes.coachStudentId, student.coachStudentId))
			.orderBy(desc(coachNotes.createdAt))
	]);

	return {
		student: {
			id: student.studentId,
			displayName: student.displayName,
			email: student.email,
			avatarUrl: student.avatarUrl,
			bio: student.bio,
			leaderLevel: student.leaderLevel,
			followerLevel: student.followerLevel,
			yearsDancing: student.yearsDancing,
			since: student.createdAt!.toISOString(),
			coachStudentId: student.coachStudentId
		},
		skills,
		skillCategories,
		skillDefinitions,
		notes
	};
};
